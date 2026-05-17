import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";

const IMG_SEP = "\n\n---images---\n";

function stripImages(value: unknown): string {
  const text = String(value ?? "");
  const idx = text.indexOf(IMG_SEP);
  return idx === -1 ? text : text.slice(0, idx);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvSection(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const gate = await requireCapability("canExportData");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const type = req.nextUrl.searchParams.get("type") === "all" ? "all" : "trades";
  const stamp = new Date().toISOString().slice(0, 10);

  const trades = await prisma.trade.findMany({
    where: { userId },
    orderBy: { entryDate: "desc" },
  });

  const tradeHeaders = [
    "symbol", "side", "entryPrice", "entryDate", "exitPrice", "exitDate",
    "quantity", "fees", "stopLoss", "takeProfit", "pnl", "netPnl",
    "rMultiple", "setup", "strategy", "market", "timeframe",
    "emotionalState", "rating", "tags", "notes", "status",
    "brokerTicket", "accountId",
  ];
  const tradeRows = trades.map((trade) => [
    trade.symbol,
    trade.side,
    trade.entryPrice,
    trade.entryDate.toISOString(),
    trade.exitPrice ?? "",
    trade.exitDate?.toISOString() ?? "",
    trade.quantity,
    trade.fees,
    trade.stopLoss ?? "",
    trade.takeProfit ?? "",
    trade.pnl,
    trade.netPnl,
    trade.rMultiple,
    trade.setup ?? "",
    trade.strategy ?? "",
    trade.market,
    trade.timeframe ?? "",
    trade.emotionalState ?? "",
    trade.rating ?? "",
    trade.tags ?? "",
    stripImages(trade.notes),
    trade.status,
    trade.brokerTicket ?? "",
    trade.accountId ?? "",
  ]);

  const tradeCsv = csvSection(tradeHeaders, tradeRows);
  if (type === "trades") return csvResponse(tradeCsv, `trades_${stamp}.csv`);

  const journalEntries = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });
  const journalHeaders = [
    "Date", "DailyGoal", "MarketCondition", "EmotionalState", "RulesFollowed",
    "GoalMet", "Rating", "PreMarketNotes", "PostMarketNotes", "LessonsLearned", "Notes",
  ];
  const journalRows = journalEntries.map((entry) => [
    entry.date.toISOString(),
    entry.dailyGoal ?? "",
    entry.marketCondition ?? "",
    entry.emotionalState ?? "",
    entry.rulesFollowed,
    entry.goalMet,
    entry.rating ?? "",
    entry.preMarketNotes ?? "",
    entry.postMarketNotes ?? "",
    entry.lessonsLearned ?? "",
    stripImages(entry.notes),
  ]);

  const csv = [
    "# Trades",
    tradeCsv,
    "",
    "# Journal",
    csvSection(journalHeaders, journalRows),
  ].join("\n");

  return csvResponse(csv, `trevixe_export_${stamp}.csv`);
}
