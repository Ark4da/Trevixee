import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { endOfOffsetDay, startOfOffsetDay, toOffsetDayKey } from "@/lib/date";
import { getEntitlements } from "@/lib/entitlements";
import { requireAuth } from "@/lib/guards";

export async function GET(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const accountId = url.searchParams.get("accountId");
  const tzOffsetRaw = Number(url.searchParams.get("tzOffset"));
  const tzOffset = Number.isFinite(tzOffsetRaw) ? tzOffsetRaw : new Date().getTimezoneOffset();
  const shiftToTz = (d: Date | string) =>
    new Date((d instanceof Date ? d.getTime() : new Date(d).getTime()) - tzOffset * 60_000);

  const ents = await getEntitlements(userId);
  const historyFloor = ents.maxHistoryDays > 0
    ? new Date(Date.now() - ents.maxHistoryDays * 86_400_000)
    : null;

  const baseWhere: Record<string, unknown> = { userId };
  {
    const dateFilter: Record<string, unknown> = {};
    if (historyFloor) dateFilter.gte = historyFloor;
    if (from) {
      const start = startOfOffsetDay(from, tzOffset);
      if (start) {
        dateFilter.gte = historyFloor
          ? new Date(Math.max(historyFloor.getTime(), start.getTime()))
          : start;
      }
    }
    if (to) {
      const end = endOfOffsetDay(to, tzOffset);
      if (end) dateFilter.lte = end;
    }
    if (Object.keys(dateFilter).length) baseWhere.entryDate = dateFilter;
  }
  if (accountId && accountId !== "all") {
    if (accountId === "unassigned") {
      baseWhere.accountId = null;
    } else {
      const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
      if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      baseWhere.accountId = accountId;
    }
  }

  const where = { ...baseWhere, status: "closed" };
  const [trades, totalAnyTrades] = await Promise.all([
    prisma.trade.findMany({ where, orderBy: { entryDate: "asc" } }),
    prisma.trade.count({ where: baseWhere }),
  ]);

  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return NextResponse.json({
      totalTrades: 0, totalAnyTrades, wins: 0, losses: 0, winRate: 0, totalPnl: 0, totalFees: 0,
      netPnl: 0, avgWin: 0, avgLoss: 0, biggestWin: 0, biggestLoss: 0,
      profitFactor: 0, expectancy: 0, avgRMultiple: 0, maxDrawdown: 0,
      maxConsecutiveWins: 0, maxConsecutiveLosses: 0, avgDuration: 0,
      currentWinStreak: 0, currentLossStreak: 0, avgWinDuration: 0, avgLossDuration: 0,
      dailyPnl: [], cumulativePnl: [], tradesBySetup: [], tradesBySymbol: [],
      tradesByDay: [], tradesBySide: { long: 0, short: 0 },
      tradesByHour: [], tradesSeries: [], tradePnls: [], calendarData: [],
      byEmotionalState: [], byRating: [], rMultipleHistogram: [], rollingWinRate: [],
    });
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = (wins.length / totalTrades) * 100;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const totalFees = trades.reduce((s, t) => s + t.fees, 0);
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const biggestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl)) : 0;
  const biggestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl)) : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const expectancy = totalPnl / totalTrades;
  const avgRMultiple = trades.reduce((s, t) => s + t.rMultiple, 0) / totalTrades;

  // Max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let cumPnl = 0;
  for (const t of trades) {
    cumPnl += t.pnl;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Consecutive wins/losses
  let maxConsWins = 0, maxConsLosses = 0, curWins = 0, curLosses = 0;
  let currentWinStreak = 0, currentLossStreak = 0;
  for (const t of trades) {
    if (t.pnl > 0) { curWins++; curLosses = 0; }
    else { curLosses++; curWins = 0; }
    if (curWins > maxConsWins) maxConsWins = curWins;
    if (curLosses > maxConsLosses) maxConsLosses = curLosses;
  }
  // Current streaks (from end of trades array)
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].pnl > 0) {
      if (currentLossStreak > 0) break;
      currentWinStreak++;
    } else {
      if (currentWinStreak > 0) break;
      currentLossStreak++;
    }
  }

  // Average duration in minutes
  const durations = trades
    .filter((t) => t.exitDate)
    .map((t) => (new Date(t.exitDate!).getTime() - new Date(t.entryDate).getTime()) / 60000);
  const avgDuration = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;

  // Daily P/L
  const dailyMap = new Map<string, number>();
  for (const t of trades) {
    const day = toOffsetDayKey(t.entryDate, tzOffset);
    dailyMap.set(day, (dailyMap.get(day) || 0) + t.pnl);
  }
  const dailyPnl = Array.from(dailyMap.entries())
    .map(([date, pnl]) => ({ date, pnl: Math.round(pnl * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Cumulative P/L
  let runningPnl = 0;
  const cumulativePnl = dailyPnl.map((d) => {
    runningPnl += d.pnl;
    return { date: d.date, pnl: Math.round(runningPnl * 100) / 100 };
  });

  // By setup
  const setupMap = new Map<string, { trades: number; pnl: number; wins: number; totalR: number }>();
  for (const t of trades) {
    const s = t.setup || "No Setup";
    const cur = setupMap.get(s) || { trades: 0, pnl: 0, wins: 0, totalR: 0 };
    cur.trades++;
    cur.pnl += t.pnl;
    cur.totalR += t.rMultiple;
    if (t.pnl > 0) cur.wins++;
    setupMap.set(s, cur);
  }
  const tradesBySetup = Array.from(setupMap.entries()).map(([name, d]) => ({
    name, trades: d.trades, pnl: Math.round(d.pnl * 100) / 100,
    winRate: Math.round((d.wins / d.trades) * 100 * 10) / 10,
    avgR: Math.round((d.totalR / d.trades) * 100) / 100,
  })).sort((a, b) => b.pnl - a.pnl);

  // By symbol
  const symbolMap = new Map<string, { trades: number; pnl: number; wins: number; totalR: number }>();
  for (const t of trades) {
    const cur = symbolMap.get(t.symbol) || { trades: 0, pnl: 0, wins: 0, totalR: 0 };
    cur.trades++;
    cur.pnl += t.pnl;
    cur.totalR += t.rMultiple;
    if (t.pnl > 0) cur.wins++;
    symbolMap.set(t.symbol, cur);
  }
  const tradesBySymbol = Array.from(symbolMap.entries()).map(([name, d]) => ({
    name, trades: d.trades, pnl: Math.round(d.pnl * 100) / 100,
    winRate: Math.round((d.wins / d.trades) * 100 * 10) / 10,
    avgR: Math.round((d.totalR / d.trades) * 100) / 100,
  })).sort((a, b) => b.trades - a.trades);

  // By day of week
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayMap = new Map<number, { trades: number; pnl: number; wins: number }>();
  for (const t of trades) {
    const d = shiftToTz(t.entryDate).getUTCDay();
    const cur = dayMap.get(d) || { trades: 0, pnl: 0, wins: 0 };
    cur.trades++;
    cur.pnl += t.pnl;
    if (t.pnl > 0) cur.wins++;
    dayMap.set(d, cur);
  }
  const tradesByDay = Array.from(dayMap.entries()).map(([day, d]) => ({
    day: dayNames[day], trades: d.trades, pnl: Math.round(d.pnl * 100) / 100, winRate: Math.round((d.wins / d.trades) * 100 * 10) / 10,
  })).sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day));

  // By side
  const longs = trades.filter((t) => t.side === "long").length;
  const shorts = trades.filter((t) => t.side === "short").length;

  // Calendar data
  const calendarMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    const day = toOffsetDayKey(t.entryDate, tzOffset);
    const cur = calendarMap.get(day) || { pnl: 0, trades: 0 };
    cur.pnl += t.pnl;
    cur.trades += 1;
    calendarMap.set(day, cur);
  }
  const calendarData = Array.from(calendarMap.entries()).map(([date, d]) => ({
    date,
    pnl: Math.round(d.pnl * 100) / 100,
    trades: d.trades,
  }));

  // Per-trade cumulative series (for "by trade" chart view)
  let runningByTrade = 0;
  const tradesSeries = trades.map((t, i) => {
    runningByTrade += t.pnl;
    return {
      label: t.symbol || `#${i + 1}`,
      n: i + 1,
      pnl: Math.round(t.pnl * 100) / 100,
      cumPnl: Math.round(runningByTrade * 100) / 100,
    };
  });

  // By hour of day
  const hourMap = new Map<number, { trades: number; pnl: number; wins: number }>();
  for (const t of trades) {
    const h = shiftToTz(t.entryDate).getUTCHours();
    const cur = hourMap.get(h) || { trades: 0, pnl: 0, wins: 0 };
    cur.trades++;
    cur.pnl += t.pnl;
    if (t.pnl > 0) cur.wins++;
    hourMap.set(h, cur);
  }
  const tradesByHour = Array.from(hourMap.entries()).map(([hour, d]) => ({
    hour,
    trades: d.trades,
    pnl: Math.round(d.pnl * 100) / 100,
    winRate: Math.round((d.wins / d.trades) * 100 * 10) / 10,
  })).sort((a, b) => a.hour - b.hour);

  // By emotional state
  const emotionMap = new Map<string, { trades: number; wins: number; pnl: number }>();
  for (const t of trades) {
    const state = t.emotionalState?.trim();
    if (!state) continue;
    const cur = emotionMap.get(state) || { trades: 0, wins: 0, pnl: 0 };
    cur.trades++;
    if (t.pnl > 0) cur.wins++;
    cur.pnl += t.pnl;
    emotionMap.set(state, cur);
  }
  const byEmotionalState = Array.from(emotionMap.entries()).map(([state, d]) => ({
    state,
    trades: d.trades,
    winRate: Math.round((d.wins / d.trades) * 100),
    pnl: Math.round(d.pnl * 100) / 100,
  })).sort((a, b) => b.trades - a.trades);

  // By rating (1–5 stars)
  const ratingMap = new Map<number, { trades: number; wins: number; pnl: number }>();
  for (const t of trades) {
    if (t.rating === null || t.rating === undefined) continue;
    const cur = ratingMap.get(t.rating) || { trades: 0, wins: 0, pnl: 0 };
    cur.trades++;
    if (t.pnl > 0) cur.wins++;
    cur.pnl += t.pnl;
    ratingMap.set(t.rating, cur);
  }
  const byRating = Array.from(ratingMap.entries()).map(([rating, d]) => ({
    rating,
    trades: d.trades,
    winRate: Math.round((d.wins / d.trades) * 100),
    pnl: Math.round(d.pnl * 100) / 100,
  })).sort((a, b) => a.rating - b.rating);

  // R-Multiple distribution histogram (7 buckets)
  const R_BUCKETS = [
    { label: "≤ -2R",     min: -Infinity, max: -2,       isWin: false },
    { label: "-2 to -1R", min: -2,        max: -1,       isWin: false },
    { label: "-1 to 0R",  min: -1,        max: 0,        isWin: false },
    { label: "0 to +1R",  min: 0,         max: 1,        isWin: true  },
    { label: "+1 to +2R", min: 1,         max: 2,        isWin: true  },
    { label: "+2 to +3R", min: 2,         max: 3,        isWin: true  },
    { label: "≥ +3R",     min: 3,         max: Infinity, isWin: true  },
  ] as const;
  const rMultipleHistogram = R_BUCKETS.map(b => {
    const bucketTrades = trades.filter(t => t.rMultiple > b.min && t.rMultiple <= b.max);
    const bucketPnl = bucketTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const bucketR = bucketTrades.reduce((sum, trade) => sum + trade.rMultiple, 0);
    return {
      label: b.label,
      count: bucketTrades.length,
      isWin: b.isWin,
      pnl: Math.round(bucketPnl * 100) / 100,
      avgR: bucketTrades.length > 0 ? Math.round((bucketR / bucketTrades.length) * 100) / 100 : 0,
      share: totalTrades > 0 ? Math.round((bucketTrades.length / totalTrades) * 100) : 0,
    };
  });

  // Win vs Loss average hold duration (minutes)
  const winDurs = wins.filter(t => t.exitDate)
    .map(t => (new Date(t.exitDate!).getTime() - new Date(t.entryDate).getTime()) / 60000);
  const lossDurs = losses.filter(t => t.exitDate)
    .map(t => (new Date(t.exitDate!).getTime() - new Date(t.entryDate).getTime()) / 60000);
  const avgWinDuration  = winDurs.length  > 0 ? Math.round(winDurs.reduce((s, d) => s + d, 0)  / winDurs.length)  : 0;
  const avgLossDuration = lossDurs.length > 0 ? Math.round(lossDurs.reduce((s, d) => s + d, 0) / lossDurs.length) : 0;

  // Rolling win rate — 20-trade window
  const ROLL_WINDOW = 20;
  const rollingWinRate: { n: number; wr: number }[] = [];
  for (let i = ROLL_WINDOW - 1; i < trades.length; i++) {
    const w = trades.slice(i - ROLL_WINDOW + 1, i + 1).filter(t => t.pnl > 0).length;
    rollingWinRate.push({ n: i + 1, wr: Math.round((w / ROLL_WINDOW) * 100) });
  }

  return NextResponse.json({
    totalTrades, totalAnyTrades, wins: wins.length, losses: losses.length,
    winRate: Math.round(winRate * 10) / 10,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    biggestWin: Math.round(biggestWin * 100) / 100,
    biggestLoss: Math.round(biggestLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    avgRMultiple: Math.round(avgRMultiple * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxConsecutiveWins: maxConsWins,
    maxConsecutiveLosses: maxConsLosses,
    currentWinStreak,
    currentLossStreak,
    avgDuration: Math.round(avgDuration),
    avgWinDuration,
    avgLossDuration,
    dailyPnl, cumulativePnl, tradesSeries, tradesBySetup, tradesBySymbol, tradesByDay,
    tradesBySide: { long: longs, short: shorts },
    calendarData, tradesByHour,
    tradePnls: trades.map((t) => Math.round(t.pnl * 100) / 100),
    byEmotionalState,
    byRating,
    rMultipleHistogram,
    rollingWinRate,
  });
}
