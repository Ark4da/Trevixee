import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/guards";

interface RawRow {
  symbol?: string;
  side?: string;
  entryPrice?: string;
  exitPrice?: string;
  quantity?: string;
  entryDate?: string;
  exitDate?: string;
  fees?: string;
  stopLoss?: string;
  takeProfit?: string;
  setup?: string;
  strategy?: string;
  market?: string;
  timeframe?: string;
  notes?: string;
  tags?: string;
  pnl?: string;
  netPnl?: string;
  rMultiple?: string;
  rating?: string;
  emotionalState?: string;
  status?: string;
  brokerTicket?: string;
  accountId?: string;
  entryTime?: string;
  swap?: string;
}

function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
}

const HEADER_MAP: Record<string, keyof RawRow> = {
  symbol: "symbol", ticker: "symbol", instrument: "symbol", contract: "symbol", pair: "symbol",
  символ: "symbol", инструмент: "symbol", тикер: "symbol",
  side: "side", direction: "side", type: "side", action: "side", buysell: "side",
  сторона: "side", направление: "side", тип: "side", операция: "side",
  entryprice: "entryPrice", entry: "entryPrice", entryprice1: "entryPrice", buyprice: "entryPrice", openprice: "entryPrice", price: "entryPrice", avgprice: "entryPrice",
  ценавхода: "entryPrice", вход: "entryPrice", ценаоткрытия: "entryPrice", цена: "entryPrice",
  exitprice: "exitPrice", exit: "exitPrice", sellprice: "exitPrice", closeprice: "exitPrice", closingprice: "exitPrice",
  ценавыхода: "exitPrice", выход: "exitPrice", ценазакрытия: "exitPrice",
  qty: "quantity", quantity: "quantity", size: "quantity", contracts: "quantity", shares: "quantity", volume: "quantity", lots: "quantity",
  количество: "quantity", объем: "quantity", объём: "quantity", лоты: "quantity",
  entrydate: "entryDate", opendate: "entryDate", datetime: "entryDate", opentime: "entryDate", opened: "entryDate", open: "entryDate", date: "entryDate",
  датавхода: "entryDate", датаоткрытия: "entryDate", датавремя: "entryDate", дата: "entryDate",
  time: "entryTime", время: "entryTime",
  exitdate: "exitDate", closedate: "exitDate", closetime: "exitDate", closed: "exitDate", close: "exitDate",
  датавыхода: "exitDate", датазакрытия: "exitDate",
  fees: "fees", fee: "fees", commission: "fees", commissions: "fees", swap: "swap",
  комиссия: "fees", комиссии: "fees", сборы: "fees",
  stoploss: "stopLoss", stop: "stopLoss", sl: "stopLoss",
  takeprofit: "takeProfit", target: "takeProfit", tp: "takeProfit",
  setup: "setup", signal: "setup",
  strategy: "strategy",
  market: "market", notes: "notes", note: "notes", comment: "notes", comments: "notes", tags: "tags",
  заметки: "notes", комментарий: "notes", теги: "tags",
  pnl: "pnl", profit: "pnl", profitloss: "pnl", grosspl: "pnl", grosspnl: "pnl", pl: "pnl",
  netpnl: "netPnl", netprofit: "netPnl", netpl: "netPnl",
  rmultiple: "rMultiple", r: "rMultiple",
  timeframe: "timeframe", tf: "timeframe",
  emotionalstate: "emotionalState", emotion: "emotionalState", mood: "emotionalState",
  rating: "rating", quality: "rating",
  status: "status",
  прибыль: "pnl", результат: "pnl",
  ticket: "brokerTicket", brokerticket: "brokerTicket", orderid: "brokerTicket", ticketno: "brokerTicket", dealid: "brokerTicket", tradeid: "brokerTicket",
  accountid: "accountId",
  тикет: "brokerTicket", ордер: "brokerTicket", сделка: "brokerTicket",
};

function detectDelimiter(line: string): string {
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: line.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
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
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells.map((c) => c.replace(/^"|"$/g, ""));
}

function extractTradeSection(text: string): string {
  const lines = text.replace(/^\uFEFF+/, "").split(/\r?\n/);
  const tradeHeaderIndex = lines.findIndex((line) => line.trim().toLowerCase() === "# trades");
  if (tradeHeaderIndex === -1) return text;

  const tradeLines: string[] = [];
  for (const line of lines.slice(tradeHeaderIndex + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ") || (trimmed === "" && tradeLines.length > 0)) break;
    if (trimmed !== "") tradeLines.push(line);
  }
  return tradeLines.join("\n");
}

function parseCSV(text: string): RawRow[] {
  const lines = extractTradeSection(text).trim().split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter);
  const fieldMap: Record<number, keyof RawRow> = {};
  headers.forEach((h, i) => {
    const normalized = normalizeHeader(h);
    const mapped = HEADER_MAP[normalized];
    if (!mapped) return;
    const alreadyMapped = Object.values(fieldMap);
    if (normalized === "price" && mapped === "entryPrice" && alreadyMapped.includes("entryPrice")) {
      fieldMap[i] = "exitPrice";
      return;
    }
    fieldMap[i] = mapped;
  });
  return lines.slice(1).map((line) => {
    const cols = splitDelimitedLine(line, delimiter);
    const row: RawRow = {};
    Object.entries(fieldMap).forEach(([idx, field]) => { row[field] = cols[parseInt(idx)] || undefined; });
    return row;
  });
}

function normalizeSide(s: string): string {
  const lower = s.trim().toLowerCase();
  if (["buy", "long", "b", "l", "покупка", "купить", "лонг"].includes(lower)) return "long";
  if (["sell", "short", "s", "продажа", "продать", "шорт"].includes(lower)) return "short";
  return lower === "short" ? "short" : "long";
}

function parseNumber(value?: string, fallback = 0): number {
  if (!value) return fallback;
  const compact = value.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  const normalized = compact.includes(",") && !compact.includes(".")
    ? compact.replace(",", ".")
    : compact.replace(/,/g, "");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeDate(s?: string, time?: string): Date | null {
  if (!s) return null;
  const value = time ? `${s} ${time}` : s;
  let d = new Date(value);
  if (!isNaN(d.getTime())) return d;

  const european = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (european) {
    const [, dd, mm, yyyy, hh = "0", min = "0", sec = "0"] = european;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    d = new Date(Number(year), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec));
  }
  return isNaN(d.getTime()) ? null : d;
}

function parseInteger(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(5, Math.max(1, parsed));
}

function normalizeStatus(value: string | undefined, isClosed: boolean): string {
  const status = value?.trim().toLowerCase();
  if (status === "open" || status === "closed") return status;
  return isClosed ? "closed" : "open";
}

export async function POST(req: NextRequest) {
  const gate = await requireCapability("canUseCsvImport");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json();
  const csvText: string = body.csv;
  if (!csvText) return NextResponse.json({ error: "No CSV data" }, { status: 400 });

  const requestedAccountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  let accountId: string | null = null;
  if (requestedAccountId) {
    const account = await prisma.account.findFirst({
      where: { id: requestedAccountId, userId },
      select: { id: true },
    });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 400 });
    accountId = account.id;
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) return NextResponse.json({ error: "No valid rows found" }, { status: 400 });

  const rowAccountIds = Array.from(new Set(rows.map((row) => row.accountId?.trim()).filter(Boolean) as string[]));
  const validRowAccountIds = new Set<string>();
  if (!accountId && rowAccountIds.length > 0) {
    const accounts = await prisma.account.findMany({
      where: { id: { in: rowAccountIds }, userId },
      select: { id: true },
    });
    accounts.forEach((account) => validRowAccountIds.add(account.id));
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
      const symbol = row.symbol?.toUpperCase();
      const side = row.side ? normalizeSide(row.side) : "long";
      const entryPrice = parseNumber(row.entryPrice);
      const exitPrice = row.exitPrice ? parseNumber(row.exitPrice) : null;
      const quantity = parseNumber(row.quantity, 1);
      const entryDate = safeDate(row.entryDate, row.entryTime);

      if (!symbol || !entryPrice || !entryDate) {
        skipped++;
        errors.push(`Row ${i + 2}: missing symbol, entry price, or date`);
        continue;
      }

      const commission = parseNumber(row.fees);
      const swap = parseNumber(row.swap);
      const fees = Math.abs(commission + swap);
      const stopLoss = row.stopLoss ? parseNumber(row.stopLoss) : null;
      const takeProfit = row.takeProfit ? parseNumber(row.takeProfit) : null;

      let pnl = row.pnl ? parseNumber(row.pnl) : 0;
      if (!row.pnl && exitPrice !== null) {
        pnl = side === "long"
          ? (exitPrice - entryPrice) * quantity
          : (entryPrice - exitPrice) * quantity;
      }
      const netPnl = row.netPnl ? parseNumber(row.netPnl) : pnl - fees;

      let rMultiple = row.rMultiple ? parseNumber(row.rMultiple) : 0;
      if (stopLoss && exitPrice !== null) {
        const risk = Math.abs(entryPrice - stopLoss) * quantity;
        if (risk > 0) rMultiple = pnl / risk;
      }
      const isClosed = exitPrice !== null || !!row.pnl || !!row.netPnl;
      const rowAccountId = row.accountId?.trim();
      const resolvedAccountId = accountId ?? (rowAccountId && validRowAccountIds.has(rowAccountId) ? rowAccountId : null);

      await prisma.trade.create({
        data: {
          userId,
          symbol, side, entryPrice, exitPrice, quantity, entryDate,
          exitDate: safeDate(row.exitDate),
          pnl: Math.round(pnl * 100) / 100,
          fees: Math.round(fees * 100) / 100,
          netPnl: Math.round(netPnl * 100) / 100,
          rMultiple: Math.round(rMultiple * 100) / 100,
          stopLoss,
          takeProfit,
          setup: row.setup || null,
          strategy: row.strategy || null,
          market: row.market || "futures",
          timeframe: row.timeframe || null,
          notes: row.notes || null,
          tags: row.tags || null,
          rating: parseInteger(row.rating),
          emotionalState: row.emotionalState || null,
          brokerTicket: row.brokerTicket || null,
          accountId: resolvedAccountId,
          status: normalizeStatus(row.status, isClosed),
        },
      });
      imported++;
    } catch (error) {
      console.error("CSV trade import failed", error);
      skipped++;
      errors.push(`Row ${i + 2}: failed to save trade`);
    }
  }

  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10) });
}
