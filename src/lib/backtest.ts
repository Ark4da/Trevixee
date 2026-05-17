import { toLocalDayKey } from "@/lib/date";

export interface BacktestTrade {
  id: string; symbol: string; side: string; market: string;
  entryPrice: number; exitPrice: number | null; quantity: number;
  entryDate: string; exitDate: string | null;
  pnl: number; netPnl: number; fees: number; rMultiple: number;
  stopLoss: number | null; setup: string | null;
  tags: string | null; rating: number | null;
  emotionalState: string | null; status: string;
  playbookId: string | null;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  netPnl: number;
  totalFees: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgRMultiple: number;
  expectancy: number;
  maxDrawdown: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  sharpeRatio: number;
  sortino: number;
  recoveryFactor: number;
  bestDay: number;
  worstDay: number;
  equityCurve: {
    date: string;
    dateLabel: string;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    chartHigh: number;
    chartLow: number;
    chartDrawdown: number;
  }[];
  monthlyPnl: {
    month: string;   // "YYYY-MM"
    label: string;   // "Янв 25"
    pnl: number;
    trades: number;
  }[];
  tradePnlSeries: {
    idx: number;
    pnl: number;
    win: boolean;
    symbol: string;
    date: string;
  }[];
  bySetup: { name: string; trades: number; pnl: number; winRate: number }[];
  bySymbol: { name: string; trades: number; pnl: number; winRate: number }[];
}

const RU_MONTHS = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

export function computeResult(trades: BacktestTrade[]): BacktestResult {
  const closed = trades.filter(t => t.status === "closed");
  const wins   = closed.filter(t => t.netPnl > 0);
  const losses = closed.filter(t => t.netPnl <= 0);

  const totalPnl  = closed.reduce((s, t) => s + t.pnl, 0);
  const netPnl    = closed.reduce((s, t) => s + t.netPnl, 0);
  const totalFees = closed.reduce((s, t) => s + t.fees, 0);
  const winPnl    = wins.reduce((s, t) => s + t.netPnl, 0);
  const lossPnl   = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));

  const winRate      = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgWin       = wins.length ? winPnl / wins.length : 0;
  const avgLoss      = losses.length ? lossPnl / losses.length : 0;
  const profitFactor = lossPnl > 0 ? winPnl / lossPnl : wins.length > 0 ? Infinity : 0;
  const avgRMultiple = closed.length ? closed.reduce((s, t) => s + t.rMultiple, 0) / closed.length : 0;
  const expectancy   = closed.length
    ? (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss : 0;

  // Sort by exit date (realized P&L moment), fallback to entry date
  function tradeDate(t: BacktestTrade) { return t.exitDate || t.entryDate; }

  // Drawdown
  let peak = 0, dd = 0, maxDd = 0, runPnl = 0;
  const sorted = [...closed].sort((a, b) => tradeDate(a).localeCompare(tradeDate(b)));
  for (const t of sorted) {
    runPnl += t.netPnl;
    if (runPnl > peak) peak = runPnl;
    dd = peak - runPnl;
    if (dd > maxDd) maxDd = dd;
  }

  // Consecutive streaks
  let maxCW = 0, maxCL = 0, curW = 0, curL = 0;
  for (const t of sorted) {
    if (t.netPnl > 0) { curW++; curL = 0; maxCW = Math.max(maxCW, curW); }
    else { curL++; curW = 0; maxCL = Math.max(maxCL, curL); }
  }

  // Daily equity curve — bucketed by EXIT date (realized P&L)
  const dayMap = new Map<string, { netPnl: number; trades: number; wins: number; losses: number }>();
  for (const t of sorted) {
    const day = toLocalDayKey(tradeDate(t));
    const cur = dayMap.get(day) ?? { netPnl: 0, trades: 0, wins: 0, losses: 0 };
    cur.netPnl += t.netPnl; cur.trades += 1;
    if (t.netPnl > 0) cur.wins++; else cur.losses++;
    dayMap.set(day, cur);
  }
  let cum = 0, runningHigh = 0, runningLow = 0;
  const equityDays = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, d]) => {
      cum += d.netPnl;
      runningHigh = Math.max(runningHigh, cum);
      runningLow  = Math.min(runningLow, cum);
      const pnl = Math.round(cum * 100) / 100;
      const chartHigh = Math.round(runningHigh * 100) / 100;
      const [y, m, dd2] = day.split("-").map(Number);
      const dateLabel = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(dd2)
        ? new Date(y, m - 1, dd2).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
        : day;
      return { date: day, dateLabel, pnl,
        trades: d.trades, wins: d.wins, losses: d.losses,
        chartHigh, chartLow: Math.round(runningLow * 100) / 100,
        chartDrawdown: Math.round((pnl - chartHigh) * 100) / 100 };
    });

  // Prepend a zero-baseline "Start" point so the curve always begins from 0
  const equityCurve = equityDays.length > 0
    ? [{ date: "0000-00-00", dateLabel: "Старт", pnl: 0,
         trades: 0, wins: 0, losses: 0,
         chartHigh: 0, chartLow: 0, chartDrawdown: 0 },
       ...equityDays]
    : [];

  // Sharpe & Sortino from daily P&L
  const dailyPnls = Array.from(dayMap.values()).map(d => d.netPnl);
  const meanDaily = dailyPnls.length ? dailyPnls.reduce((s, v) => s + v, 0) / dailyPnls.length : 0;
  const variance = dailyPnls.length
    ? dailyPnls.reduce((s, v) => s + (v - meanDaily) ** 2, 0) / dailyPnls.length : 0;
  const stdDev = Math.sqrt(variance);
  const downsidePnls = dailyPnls.filter(v => v < 0);
  const downVariance = downsidePnls.length
    ? downsidePnls.reduce((s, v) => s + v ** 2, 0) / downsidePnls.length : 0;
  const downStd = Math.sqrt(downVariance);
  const annFactor = Math.sqrt(252);
  const sharpeRatio = stdDev > 0 ? Math.round((meanDaily / stdDev) * annFactor * 100) / 100 : 0;
  const sortino    = downStd > 0 ? Math.round((meanDaily / downStd) * annFactor * 100) / 100 : 0;
  const recoveryFactor = maxDd > 0 ? Math.round((netPnl / maxDd) * 100) / 100 : 0;

  // Best / worst day
  const bestDay  = dailyPnls.length ? Math.max(...dailyPnls) : 0;
  const worstDay = dailyPnls.length ? Math.min(...dailyPnls) : 0;

  // Monthly P&L — use local-timezone month key (same as equity curve)
  const monthMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of sorted) {
    const key = toLocalDayKey(tradeDate(t)).slice(0, 7); // "YYYY-MM" in local TZ
    const cur = monthMap.get(key) ?? { pnl: 0, trades: 0 };
    cur.pnl += t.netPnl; cur.trades += 1;
    monthMap.set(key, cur);
  }
  const monthlyPnl = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, d]) => {
      const [y, m] = month.split("-").map(Number);
      const label = `${RU_MONTHS[m - 1]} ${String(y).slice(2)}`;
      return { month, label, pnl: Math.round(d.pnl * 100) / 100, trades: d.trades };
    });

  // Trade P&L series (for waterfall chart) — date = exit date for consistency
  const tradePnlSeries = sorted.map((t, idx) => ({
    idx,
    pnl: Math.round(t.netPnl * 100) / 100,
    win: t.netPnl > 0,
    symbol: t.symbol,
    date: toLocalDayKey(tradeDate(t)),
  }));

  // By setup
  const setupMap: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const t of closed) {
    const k = t.setup || "Без сетапа";
    if (!setupMap[k]) setupMap[k] = { trades: 0, pnl: 0, wins: 0 };
    setupMap[k].trades++; setupMap[k].pnl += t.netPnl;
    if (t.netPnl > 0) setupMap[k].wins++;
  }
  const bySetup = Object.entries(setupMap)
    .map(([name, v]) => ({ name, trades: v.trades, pnl: v.pnl, winRate: Math.round((v.wins / v.trades) * 100) }))
    .sort((a, b) => b.pnl - a.pnl);

  // By symbol
  const symMap: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const t of closed) {
    if (!symMap[t.symbol]) symMap[t.symbol] = { trades: 0, pnl: 0, wins: 0 };
    symMap[t.symbol].trades++; symMap[t.symbol].pnl += t.netPnl;
    if (t.netPnl > 0) symMap[t.symbol].wins++;
  }
  const bySymbol = Object.entries(symMap)
    .map(([name, v]) => ({ name, trades: v.trades, pnl: v.pnl, winRate: Math.round((v.wins / v.trades) * 100) }))
    .sort((a, b) => b.trades - a.trades).slice(0, 10);

  return {
    trades, totalTrades: closed.length, wins: wins.length, losses: losses.length,
    winRate, totalPnl, netPnl, totalFees, avgWin, avgLoss,
    profitFactor, avgRMultiple, expectancy, maxDrawdown: maxDd,
    maxConsecWins: maxCW, maxConsecLosses: maxCL,
    sharpeRatio, sortino, recoveryFactor, bestDay, worstDay,
    equityCurve, monthlyPnl, tradePnlSeries, bySetup, bySymbol,
  };
}
