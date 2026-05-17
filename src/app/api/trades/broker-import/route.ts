import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";

type RawRow = Record<string, string | undefined>;

const FIELD_ALIASES: Record<string, string[]> = {
  symbol: ["symbol", "ticker", "instrument", "contract", "pair", "символ", "инструмент", "тикер"],
  side: ["side", "direction", "type", "action", "buysell", "сторона", "направление", "тип", "операция"],
  entryPrice: ["entryprice", "entry", "openprice", "price", "avgprice", "buyprice", "ценавхода", "вход", "ценаоткрытия", "цена"],
  exitPrice: ["exitprice", "exit", "closeprice", "sellprice", "ценавыхода", "выход", "ценазакрытия"],
  quantity: ["qty", "quantity", "size", "contracts", "shares", "volume", "lots", "количество", "объем", "объём", "лоты"],
  entryDate: ["entrydate", "opendate", "opentime", "datetime", "date", "time", "opened", "open", "датавхода", "датаоткрытия", "датавремя", "дата", "время"],
  exitDate: ["exitdate", "closedate", "closetime", "closed", "close", "датавыхода", "датазакрытия"],
  fees: ["fees", "fee", "commission", "commissions", "комиссия", "комиссии", "сборы"],
  swap: ["swap", "своп"],
  stopLoss: ["stoploss", "sl", "stop"],
  takeProfit: ["takeprofit", "tp", "target"],
  setup: ["setup", "strategy", "signal"],
  market: ["market", "assetclass", "category"],
  notes: ["notes", "note", "comment", "comments", "заметки", "комментарий"],
  tags: ["tags", "tag", "теги"],
  pnl: ["pnl", "profit", "profitloss", "netpnl", "netprofit", "pl", "прибыль", "результат"],
  brokerTicket: ["ticket", "orderticket", "orderid", "dealid", "tradeid", "positionid", "тикет", "ордер", "сделка"],
};

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
}

function detectDelimiter(line: string): string {
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: line.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  out.push(cell.trim());
  return out.map((v) => v.replace(/^"|"$/g, ""));
}

function parseCsv(text: string): RawRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const usedFields: string[] = [];
  const mapped = headers.map((header) => {
    const match = Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.includes(header));
    let field = match?.[0] ?? null;
    if (header === "price" && field === "entryPrice" && usedFields.includes("entryPrice")) {
      field = "exitPrice";
    }
    if (field) usedFields.push(field);
    return field;
  });

  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, delimiter);
    const row: RawRow = {};
    mapped.forEach((field, idx) => {
      if (field) row[field] = cols[idx];
    });
    return row;
  });
}

function normalizeSide(value?: string): string {
  const side = (value ?? "").toLowerCase();
  if (["sell", "short", "s", "sl", "sellshort", "продажа", "продать", "шорт"].includes(side)) return "short";
  return "long";
}

function numberValue(value?: string, fallback = 0): number {
  if (!value) return fallback;
  const compact = value.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  const normalized = compact.includes(",") && !compact.includes(".")
    ? compact.replace(",", ".")
    : compact.replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateValue(value?: string): Date | null {
  if (!value) return null;
  let parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const european = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (european) {
    const [, dd, mm, yyyy, hh = "0", min = "0", sec = "0"] = european;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    parsed = new Date(Number(year), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec));
  }
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: NextRequest) {
  const gate = await requireCapability("canUseBrokerImport");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const body = await req.json();
  const csvText = typeof body.csv === "string" ? body.csv : "";
  const broker = typeof body.broker === "string" ? body.broker.trim() : "Broker";
  const requestedAccountId = typeof body.accountId === "string" ? body.accountId.trim() : "";

  if (!csvText) return NextResponse.json({ error: "No CSV data" }, { status: 400 });

  let accountId: string | null = null;
  if (requestedAccountId) {
    const account = await prisma.account.findFirst({
      where: { id: requestedAccountId, userId },
      select: { id: true },
    });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 400 });
    accountId = account.id;
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) return NextResponse.json({ error: "No valid rows found" }, { status: 400 });

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const symbol = row.symbol?.toUpperCase().trim();
    const side = normalizeSide(row.side);
    const entryPrice = numberValue(row.entryPrice);
    const exitPrice = row.exitPrice ? numberValue(row.exitPrice) : null;
    const quantity = numberValue(row.quantity, 1);
    const entryDate = dateValue(row.entryDate);

    if (!symbol || entryPrice <= 0 || !entryDate) {
      skipped++;
      errors.push(`Row ${i + 2}: missing symbol, entry price, or entry date`);
      continue;
    }

    const commission = numberValue(row.fees);
    const swap = numberValue(row.swap);
    const fees = Math.abs(commission + swap);
    const stopLoss = row.stopLoss ? numberValue(row.stopLoss) : null;
    const takeProfit = row.takeProfit ? numberValue(row.takeProfit) : null;
    let pnl = row.pnl ? numberValue(row.pnl) : 0;
    if (!row.pnl && exitPrice !== null) {
      pnl = side === "long"
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;
    }

    let rMultiple = 0;
    if (stopLoss && stopLoss > 0) {
      const risk = Math.abs(entryPrice - stopLoss) * quantity;
      rMultiple = risk > 0 ? pnl / risk : 0;
    }

    await prisma.trade.create({
      data: {
        userId,
        symbol,
        side,
        entryPrice,
        exitPrice,
        quantity,
        entryDate,
        exitDate: dateValue(row.exitDate),
        pnl: Math.round(pnl * 100) / 100,
        fees: Math.round(fees * 100) / 100,
        netPnl: Math.round((pnl - fees) * 100) / 100,
        rMultiple: Math.round(rMultiple * 100) / 100,
        stopLoss,
        takeProfit,
        setup: row.setup || null,
        strategy: broker,
        market: row.market || "futures",
        notes: row.notes || null,
        tags: row.tags || null,
        brokerTicket: row.brokerTicket || null,
        accountId,
        status: exitPrice !== null || row.pnl ? "closed" : "open",
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10), broker });
}
