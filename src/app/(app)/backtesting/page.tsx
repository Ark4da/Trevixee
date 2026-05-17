"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  FlaskConical,
  Layers,
  RotateCcw,
  Target,
  X,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PaywallCard } from "@/components/billing/paywall-card";
import { GradientAreaChart } from "@/components/ui/gradient-area-chart";
import { useToast } from "@/components/ui/toast";
import type { Entitlements } from "@/lib/entitlements";
import { computeResult, type BacktestTrade } from "@/lib/backtest";
import { toLocalDayKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/useT";
import { useAppStore } from "@/store";

type Trade = BacktestTrade;

const SAGE_C = "#7BAF8A";
const BRICK_C = "#AC5A56";
const AMBER = "#B08050";
const KL = "text-[10px] uppercase tracking-widest text-ink-5 font-medium";

const inputCls = "h-9 w-full rounded-lg border border-stroke-2 bg-tinted px-3 text-xs text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none";
const selCls = "h-9 w-full appearance-none rounded-lg border border-stroke-2 bg-tinted px-3 pr-8 text-xs text-ink focus:border-brand focus:outline-none";

const MARKET_OPTIONS = [
  { value: "all", label: "All markets" },
  { value: "futures", label: "Futures" },
  { value: "forex", label: "Forex" },
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
  { value: "options", label: "Options" },
];

const SIDE_OPTIONS = [
  { value: "all", label: "Long + Short" },
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n >= 0 ? "+" : "-"}$${abs}`;
}

function scoreColor(score: number) {
  if (score >= 75) return SAGE_C;
  if (score >= 45) return AMBER;
  return BRICK_C;
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong edge";
  if (score >= 45) return "Promising, needs work";
  return "Needs validation";
}

function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const slice = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, items, pageSize]
  );

  return {
    page: currentPage,
    totalPages,
    slice,
    next: () => setPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
  };
}

function BarTooltip({
  active,
  payload,
  label,
  dark,
}: {
  active?: boolean;
  payload?: readonly { value?: unknown }[];
  label?: unknown;
  dark: boolean;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  const colors = dark
    ? { bg: "#1A1810", border: "#302C1E" }
    : { bg: "#FEFCF9", border: "#D9D2C7" };

  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      {label != null && <p style={{ color: "#8C8578", marginBottom: 4 }}>{String(label)}</p>}
      <p style={{ color: value >= 0 ? SAGE_C : BRICK_C, fontWeight: 700 }}>{fmt(value)}</p>
    </div>
  );
}

export default function BacktestingPage() {
  const { darkMode, lang } = useAppStore();
  const toast = useToast();
  const t = useT();

  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  useEffect(() => {
    fetch("/api/me/entitlements").then(r => r.json()).then(setEntitlements);
  }, []);

  /* ── Filters ─────────────────────────────────────────────────────────── */
  const [market,    setMarket]    = useState("all");
  const [side,      setSide]      = useState("all");
  const [setup,     setSetup]     = useState("all");
  const [symbol,    setSymbol]    = useState("");
  const [from,      setFrom]      = useState("");
  const [to,        setTo]        = useState("");
  const [minRating, setMinRating] = useState("0");
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* ── Data ────────────────────────────────────────────────────────────── */
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [setupList, setSetupList] = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<"equity" | "trades" | "setups" | "symbols">("equity");

  /* ── Fetch ───────────────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trades?limit=2000&status=closed");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const trades: Trade[] = data.trades || [];
      setAllTrades(trades);
      const setups = [...new Set(trades.map(tr => tr.setup).filter(Boolean))] as string[];
      setSetupList(setups.sort());
    } catch {
      toast(t("error_load"), "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Filtered result ─────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return allTrades.filter(tr => {
      const tradeDay = toLocalDayKey(tr.entryDate);
      if (market !== "all" && tr.market !== market) return false;
      if (side !== "all" && tr.side !== side) return false;
      if (setup !== "all" && tr.setup !== setup) return false;
      if (symbol.trim() && !tr.symbol.toUpperCase().includes(symbol.trim().toUpperCase())) return false;
      if (from && tradeDay < from) return false;
      if (to && tradeDay > to) return false;
      if (parseInt(minRating) > 0 && (tr.rating ?? 0) < parseInt(minRating)) return false;
      return true;
    });
  }, [allTrades, market, side, setup, symbol, from, to, minRating]);

  const result = useMemo(() => computeResult(filtered), [filtered]);

  /* ── Active filter chips ─────────────────────────────────────────────── */
  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (market !== "all") chips.push({ label: `Рынок: ${MARKET_OPTIONS.find(o => o.value === market)?.label}`, clear: () => setMarket("all") });
    if (side !== "all") chips.push({ label: `Сторона: ${SIDE_OPTIONS.find(o => o.value === side)?.label}`, clear: () => setSide("all") });
    if (setup !== "all") chips.push({ label: `Сетап: ${setup}`, clear: () => setSetup("all") });
    if (symbol.trim()) chips.push({ label: `Символ: ${symbol.trim()}`, clear: () => setSymbol("") });
    if (from) chips.push({ label: `С: ${from}`, clear: () => setFrom("") });
    if (to) chips.push({ label: `По: ${to}`, clear: () => setTo("") });
    if (parseInt(minRating) > 0) chips.push({ label: `Мин. оценка: ${minRating}★`, clear: () => setMinRating("0") });
    return chips;
  }, [market, side, setup, symbol, from, to, minRating]);

  const reset = () => {
    setMarket("all"); setSide("all"); setSetup("all");
    setSymbol(""); setFrom(""); setTo(""); setMinRating("0");
  };

  /* ── Strategy Score ─────────────────────────────────────────────────── */
  const strategyScore = useMemo(() => {
    const { winRate, profitFactor, expectancy, avgRMultiple } = result;
    const pf = !isFinite(profitFactor) ? 3 : profitFactor;
    const score =
      (winRate * 0.35) +
      (Math.min(pf, 3) / 3 * 30) +
      (expectancy > 0 ? 20 : 0) +
      (avgRMultiple > 1 ? 15 : avgRMultiple > 0 ? 8 : 0);
    return Math.min(100, Math.round(score));
  }, [result]);

  /* ── Chart axis colors ───────────────────────────────────────────────── */
  const axisColor = darkMode ? "#6A6355" : "#B5ADA3";
  const gridColor = darkMode ? "#302C1E" : "#E9E3D9";

  /* ── Trades pagination ───────────────────────────────────────────────── */
  const closedTrades = useMemo(
    () => result.trades.filter(tr => tr.status === "closed").sort((a, b) => b.entryDate.localeCompare(a.entryDate)),
    [result.trades]
  );
  const tradePag = usePagination(closedTrades, 100);

  /* ── By-symbol max pnl for bar list ─────────────────────────────────── */
  const maxAbsSymPnl = useMemo(
    () => result.bySymbol.reduce((mx, s) => Math.max(mx, Math.abs(s.pnl)), 1),
    [result.bySymbol]
  );

  /* ── By-setup profit factor ──────────────────────────────────────────── */
  const bySetupEnriched = useMemo(() => result.bySetup.map(s => {
    const setupTrades = result.trades.filter(tr => tr.status === "closed" && (tr.setup || "Без сетапа") === s.name);
    const sWinPnl = setupTrades.filter(tr => tr.netPnl > 0).reduce((a, tr) => a + tr.netPnl, 0);
    const sLossPnl = Math.abs(setupTrades.filter(tr => tr.netPnl <= 0).reduce((a, tr) => a + tr.netPnl, 0));
    const pf = sLossPnl > 0 ? sWinPnl / sLossPnl : sWinPnl > 0 ? Infinity : 0;
    return { ...s, profitFactor: pf };
  }), [result.bySetup, result.trades]);

  const bySymbolEnriched = useMemo(() => result.bySymbol.map(s => {
    const symTrades = result.trades.filter(tr => tr.status === "closed" && tr.symbol === s.name);
    const sWinPnl = symTrades.filter(tr => tr.netPnl > 0).reduce((a, tr) => a + tr.netPnl, 0);
    const sLossPnl = Math.abs(symTrades.filter(tr => tr.netPnl <= 0).reduce((a, tr) => a + tr.netPnl, 0));
    const pf = sLossPnl > 0 ? sWinPnl / sLossPnl : sWinPnl > 0 ? Infinity : 0;
    return { ...s, profitFactor: pf };
  }), [result.bySymbol, result.trades]);

  /* ── Loading state ───────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="animate-pulse space-y-5">
          <div className="h-10 w-72 rounded-lg bg-tinted" />
          <div className="h-28 rounded-xl bg-tinted" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-tinted" />)}
          </div>
          <div className="h-80 rounded-xl bg-tinted" />
        </div>
      </div>
    );
  }

  /* ── Paywall gate ────────────────────────────────────────────────────── */
  if (entitlements && !entitlements.capabilities.canUseAdvancedBacktesting) {
    return (
      <div className="max-w-2xl mx-auto p-8 pt-16">
        <PaywallCard feature="advanced_backtesting" />
      </div>
    );
  }

  /* ── Tabs config ─────────────────────────────────────────────────────── */
  const TABS = [
    { key: "equity"  as const, label: "Equity Curve" },
    { key: "trades"  as const, label: "Сделки" },
    { key: "setups"  as const, label: "По сетапам" },
    { key: "symbols" as const, label: "По инструментам" },
  ];

  const now = new Date();
  const issueLabel = lang === "ru"
    ? `Издание ${String(Math.floor(now.getMonth() / 3) + 1).padStart(2, "0")} · ${now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })} · Лаборатория стратегий`
    : `Issue ${String(Math.floor(now.getMonth() / 3) + 1).padStart(2, "0")} · ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })} · Strategy lab`;
  const headlineTop = lang === "ru" ? "Бэктест" : "Backtest";
  const headlineBot = lang === "ru" ? "стратегии." : "dry-run.";

  return (
    <div className="-mx-6 -mt-6 page-enter">

      {/* ══════════ Editorial Masthead ══════════ */}
      <div className="px-6 md:px-10 pt-10 pb-6 border-b border-stroke">
        <p className="editorial-label">{issueLabel}</p>
        <div className="flex items-end justify-between gap-6 flex-wrap mt-3">
          <h1 className="font-serif text-[56px] md:text-[72px] leading-[0.98] tracking-[-0.035em] font-bold">
            {headlineTop}<br />
            <span className="italic text-ink-3 font-normal">{headlineBot}</span>
          </h1>
          {result.totalTrades > 0 && (
            <div className="text-right shrink-0 pb-3">
              <p className="editorial-label mb-1">
                {lang === "ru" ? "Итог прогона" : "Run result"}
              </p>
              <p className="font-serif text-2xl md:text-[28px] font-bold tnum leading-none"
                style={{ color: result.netPnl >= 0 ? SAGE_C : BRICK_C }}>
                {result.netPnl >= 0 ? "+" : "−"}${Math.abs(result.netPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-ink-5 mt-1.5 font-mono tnum">
                {result.totalTrades} {lang === "ru" ? "сделок" : "trades"} · {result.winRate}% WR
              </p>
            </div>
          )}
        </div>
        <p className="text-[13px] text-ink-3 mt-5 max-w-xl font-serif italic">
          «{lang === "ru"
              ? "Отмотай без предвзятости. Проверь сетап за часы."
              : "Replay without bias. Forward-test a setup in hours."}»
        </p>

        {/* meta-strip */}
        <div className="mt-5 flex items-center gap-4 flex-wrap text-[12px] text-ink-4">
          {result.totalTrades > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 border"
                style={{ borderColor: `${scoreColor(strategyScore)}50`, background: `${scoreColor(strategyScore)}12` }}>
                <Award className="h-3 w-3" style={{ color: scoreColor(strategyScore) }} />
                <span className="text-[11px] font-bold font-mono tracking-wider" style={{ color: scoreColor(strategyScore) }}>
                  Score {strategyScore}
                </span>
              </span>
              <span className="font-mono tnum">
                {result.wins}W / {result.losses}L
              </span>
              <span className="text-ink-5 font-mono">· PF {!isFinite(result.profitFactor ?? NaN) ? "∞" : result.profitFactor!.toFixed(2)}</span>
              <span className="text-ink-5 font-mono">· {result.avgRMultiple.toFixed(2)}R avg</span>
            </>
          )}
          <button
            onClick={reset}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-[11px] font-medium text-ink-3 hover:text-ink hover:border-stroke-2 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            {lang === "ru" ? "Сбросить" : "Reset"}
          </button>
        </div>
      </div>

      <div className="px-6 md:px-10 py-8 space-y-8">

      {/* ══════════ Filter panel ══════════ */}
      <div className="rounded-2xl border border-stroke bg-card overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg, rgba(240,114,64,0.9), rgba(240,114,64,0.1))" }} />
        {/* Panel header (toggle) */}
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-tinted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Filter className="h-3.5 w-3.5 text-ink-4" />
            <p className="editorial-label">{lang === "ru" ? "Фильтры" : "Filters"}</p>
            {activeChips.length > 0 && (
              <span className="chip font-mono tnum" style={{ background: "rgba(240,114,64,0.12)", color: "#F07240", padding: "2px 8px" }}>
                {activeChips.length} {lang === "ru" ? "активных" : "active"}
              </span>
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-ink-4 transition-transform duration-200", filtersOpen && "rotate-180")} />
        </button>

        {filtersOpen && (
          <div className="border-t border-stroke px-5 pb-5 pt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              {/* Market */}
              <div>
                <label className={cn(KL, "block mb-1")}>Рынок</label>
                <div className="relative">
                  <select value={market} onChange={e => setMarket(e.target.value)} className={selCls}>
                    {MARKET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-5" />
                </div>
              </div>
              {/* Side */}
              <div>
                <label className={cn(KL, "block mb-1")}>Направление</label>
                <div className="relative">
                  <select value={side} onChange={e => setSide(e.target.value)} className={selCls}>
                    {SIDE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-5" />
                </div>
              </div>
              {/* Setup */}
              <div>
                <label className={cn(KL, "block mb-1")}>Сетап</label>
                <div className="relative">
                  <select value={setup} onChange={e => setSetup(e.target.value)} className={selCls}>
                    <option value="all">Все сетапы</option>
                    {setupList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-5" />
                </div>
              </div>
              {/* Symbol */}
              <div>
                <label className={cn(KL, "block mb-1")}>Символ</label>
                <input
                  type="text" value={symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase())}
                  placeholder="BTC, ETH..." className={inputCls}
                />
              </div>
              {/* From */}
              <div>
                <label className={cn(KL, "block mb-1")}>С даты</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
              </div>
              {/* To */}
              <div>
                <label className={cn(KL, "block mb-1")}>По дату</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
              </div>
              {/* Min rating */}
              <div>
                <label className={cn(KL, "block mb-1")}>Мин. оценка</label>
                <div className="relative">
                  <select value={minRating} onChange={e => setMinRating(e.target.value)} className={selCls}>
                    <option value="0">Любая</option>
                    <option value="3">3★ и выше</option>
                    <option value="4">4★ и выше</option>
                    <option value="5">Только 5★</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-5" />
                </div>
              </div>
            </div>

            {/* Active filter chips */}
            {activeChips.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {activeChips.map((chip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/8 px-2.5 py-0.5 text-[11px] font-medium text-brand"
                  >
                    {chip.label}
                    <button onClick={chip.clear} className="hover:opacity-70 transition-opacity ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1 rounded-full border border-stroke-2 px-2.5 py-0.5 text-[11px] text-ink-4 hover:text-ink transition-colors"
                >
                  <X className="h-3 w-3" /> Сбросить всё
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {result.totalTrades === 0 ? (
        <div className="rounded-2xl border border-stroke-2 border-dashed p-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-tinted border border-stroke-2 flex items-center justify-center mx-auto mb-5">
            <FlaskConical className="h-8 w-8 text-ink-5" />
          </div>
          <p className="font-serif text-2xl font-bold text-ink mb-2">
            {lang === "ru" ? "Тишина." : "Silence."}
          </p>
          <p className="text-sm text-ink-4 mb-6 font-serif italic max-w-sm mx-auto">
            «{lang === "ru"
                ? "Ни одна сделка не прошла сквозь фильтры. Ослабь решётку или начни заново."
                : "No trade survived your filters. Loosen the sieve or start over."}»
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-4 py-2 text-sm font-semibold text-white transition-colors"
            style={{ boxShadow: "0 4px 14px rgba(240,114,64,0.28)" }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {lang === "ru" ? "Сбросить фильтры" : "Reset filters"}
          </button>
        </div>
      ) : (
        <>
          {/* ══════════ Strategy Score ══════════ */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-5 rounded-2xl border border-stroke bg-card p-7 relative overflow-hidden"
              style={{ background: `linear-gradient(160deg, ${scoreColor(strategyScore)}14 0%, transparent 60%)` }}>
              <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${scoreColor(strategyScore)}E0, ${scoreColor(strategyScore)}20)` }} />
              <p className="editorial-label">Strategy Score</p>
              <p className="font-serif text-2xl font-bold mt-2">
                {scoreLabel(strategyScore)}<span className="text-brand">.</span>
              </p>

              <div className="mt-8 flex items-end gap-5">
                <p className="font-serif font-bold leading-none tnum" style={{ color: scoreColor(strategyScore), fontSize: 96 }}>
                  {strategyScore}
                </p>
                <div className="flex-1 pb-3">
                  <div className="h-2 rounded-full bg-tinted border border-stroke-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${strategyScore}%`, background: scoreColor(strategyScore) }}
                    />
                  </div>
                  <div className="flex text-[9px] text-ink-5 justify-between mt-2 editorial-label tracking-widest">
                    <span>0</span>
                    <span style={{ color: BRICK_C }}>{lang === "ru" ? "Работать" : "Work"}</span>
                    <span style={{ color: AMBER }}>{lang === "ru" ? "Расти" : "Grow"}</span>
                    <span style={{ color: SAGE_C }}>{lang === "ru" ? "Топ" : "Top"}</span>
                    <span>100</span>
                  </div>
                </div>
              </div>

              <p className="text-[12px] text-ink-4 mt-6 font-serif italic">
                «{lang === "ru"
                    ? "Составная оценка стратегии собрана из четырёх столпов: точности, качества прибыли, матожидания и R-коэффициента."
                    : "Composite strategy score built from four pillars: accuracy, profit quality, expectancy, and R-multiple."}»
              </p>
            </div>

            {/* Score pillars — 2x2 feature cards */}
            <div className="col-span-12 lg:col-span-7 grid grid-cols-2 gap-4">
              {[
                {
                  label: "Win Rate",
                  contribution: Math.round(result.winRate * 0.35),
                  max: 35,
                  value: `${result.winRate}%`,
                  icon: Target,
                },
                {
                  label: "Profit Factor",
                  contribution: Math.round(Math.min(!isFinite(result.profitFactor) ? 3 : result.profitFactor, 3) / 3 * 30),
                  max: 30,
                  value: !isFinite(result.profitFactor ?? NaN) ? "∞" : result.profitFactor!.toFixed(2),
                  icon: BarChart3,
                },
                {
                  label: "Expectancy",
                  contribution: result.expectancy > 0 ? 20 : 0,
                  max: 20,
                  value: fmt(result.expectancy),
                  icon: Zap,
                },
                {
                  label: "Avg R",
                  contribution: result.avgRMultiple > 1 ? 15 : result.avgRMultiple > 0 ? 8 : 0,
                  max: 15,
                  value: `${result.avgRMultiple.toFixed(2)}R`,
                  icon: Activity,
                },
              ].map(pillar => {
                const pct = Math.round((pillar.contribution / pillar.max) * 100);
                const col = pct >= 70 ? SAGE_C : pct >= 40 ? AMBER : BRICK_C;
                const PIcon = pillar.icon;
                return (
                  <div key={pillar.label} className="rounded-2xl border border-stroke bg-card p-5 relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${col}E0, ${col}20)` }} />
                    <div className="flex items-center justify-between mb-1">
                      <p className="editorial-label" style={{ color: col }}>{pillar.label}</p>
                      <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: `${col}18` }}>
                        <PIcon className="h-3 w-3" style={{ color: col }} />
                      </div>
                    </div>
                    <p className="font-serif text-2xl md:text-3xl font-bold mt-2 tnum truncate" style={{ color: col }}>
                      {pillar.value}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex-1 h-1 rounded-full bg-tinted overflow-hidden mr-3">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                      </div>
                      <span className="text-[10px] font-mono tnum text-ink-4">+{pillar.contribution}/{pillar.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>


          {/* ══════════ Breakdown (tabs) ══════════ */}
          <div>
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-5">
              <div>
                <p className="editorial-label">{lang === "ru" ? "Разбор" : "Breakdown"}</p>
                <p className="font-serif text-2xl font-bold mt-2">
                  {activeTab === "equity"  && (lang === "ru" ? "Кривая капитала." : "Equity curve.")}
                  {activeTab === "trades"  && (lang === "ru" ? "Летопись сделок." : "Trade log.")}
                  {activeTab === "setups"  && (lang === "ru" ? "Что работает." : "What works.")}
                  {activeTab === "symbols" && (lang === "ru" ? "Где ты ловишь." : "Where you fish.")}
                </p>
              </div>
              <div className="rounded-lg border border-stroke bg-card p-0.5 flex items-center text-[11px] overflow-x-auto">
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "px-3 py-1.5 whitespace-nowrap transition-colors rounded-md",
                      activeTab === tab.key
                        ? "bg-lift font-semibold text-ink"
                        : "text-ink-3 hover:text-ink"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-stroke bg-card overflow-hidden relative">
              <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg, rgba(240,114,64,0.9), rgba(240,114,64,0.1))" }} />
              <div className="p-6">

              {/* ── Equity Curve tab ──────────────────────────────────── */}
              {activeTab === "equity" && (
                <div className="space-y-6">
                  {result.equityCurve.length > 1 ? (
                    <>
                      <div>
                        <p className="editorial-label mb-3">{lang === "ru" ? "Капитал во времени" : "Equity over time"}</p>
                        <GradientAreaChart
                          data={result.equityCurve.map(d => ({
                            label: d.dateLabel,
                            value: d.pnl,
                            trades: d.trades,
                            wins: d.wins,
                            losses: d.losses,
                          }))}
                          dark={darkMode}
                          height={320}
                          tooltipFormatter={(v) => `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`}
                        />
                      </div>

                      {/* Drawdown bar chart */}
                      <div className="pt-4 border-t border-stroke">
                        <p className="editorial-label mb-3">{lang === "ru" ? "Просадка по дням" : "Drawdown by day"}</p>
                        <ResponsiveContainer width="100%" height={100}>
                          <BarChart
                            data={result.equityCurve.filter(d => d.chartDrawdown < 0)}
                            margin={{ top: 2, right: 4, left: 0, bottom: 0 }}
                            barCategoryGap="15%"
                          >
                            <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                            <XAxis
                              dataKey="dateLabel"
                              stroke="transparent"
                              tick={{ fontSize: 9, fill: axisColor }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              stroke="transparent"
                              tick={{ fontSize: 9, fill: axisColor }}
                              tickLine={false}
                              axisLine={false}
                              width={52}
                              tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                            />
                            <Tooltip
                              content={(props) => <BarTooltip {...props} dark={darkMode} />}
                              cursor={{ fill: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
                              wrapperStyle={{ pointerEvents: "none" }}
                            />
                            <Bar dataKey="chartDrawdown" radius={[2, 2, 0, 0]}>
                              {result.equityCurve.filter(d => d.chartDrawdown < 0).map((_, i) => (
                                <Cell key={i} fill={BRICK_C} fillOpacity={0.7} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                      <BarChart3 className="h-10 w-10 text-ink-5" />
                      <p className="text-sm text-ink-4">Недостаточно данных для графика</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Trades tab ────────────────────────────────────────── */}
              {activeTab === "trades" && (
                <div className="space-y-4">
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-y border-stroke bg-tinted">
                          {[
                            lang === "ru" ? "Дата" : "Date",
                            lang === "ru" ? "Символ" : "Symbol",
                            lang === "ru" ? "Сторона" : "Side",
                            lang === "ru" ? "Сетап" : "Setup",
                            lang === "ru" ? "Вход" : "Entry",
                            lang === "ru" ? "Выход" : "Exit",
                            "P/L",
                            "R",
                            lang === "ru" ? "Оценка" : "Rating",
                          ].map((h, i) => (
                            <th
                              key={h}
                              className={cn(
                                "editorial-label py-2.5 px-3",
                                i === 0 ? "pl-6" : "",
                                i === 8 ? "pr-6" : "",
                                i >= 4 ? "text-right" : "text-left"
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stroke">
                        {tradePag.slice.map(tr => (
                          <tr key={tr.id} className="hover:bg-tinted/40 transition-colors">
                            <td className="px-3 py-2.5 text-xs text-ink-4 whitespace-nowrap">
                              {new Date(tr.entryDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-ink">{tr.symbol}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                                style={{
                                  background: `${tr.side === "long" ? SAGE_C : BRICK_C}22`,
                                  color: tr.side === "long" ? SAGE_C : BRICK_C,
                                }}
                              >
                                {tr.side.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-ink-4">{tr.setup || "—"}</td>
                            <td className="px-3 py-2.5 text-right text-xs text-ink-3 font-mono">
                              ${tr.entryPrice.toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-ink-3 font-mono">
                              {tr.exitPrice != null ? `$${tr.exitPrice.toFixed(2)}` : "—"}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right text-sm font-semibold font-mono"
                              style={{ color: tr.netPnl >= 0 ? SAGE_C : BRICK_C }}
                            >
                              {fmt(tr.netPnl)}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right text-xs font-medium font-mono"
                              style={{ color: tr.rMultiple >= 0 ? SAGE_C : BRICK_C }}
                            >
                              {tr.rMultiple !== 0 ? `${tr.rMultiple.toFixed(2)}R` : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-ink-4">
                              {tr.rating ? `${tr.rating}★` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {tradePag.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-ink-5">
                        Показано {(tradePag.page - 1) * 100 + 1}–{Math.min(tradePag.page * 100, closedTrades.length)} из {closedTrades.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={tradePag.prev}
                          disabled={tradePag.page === 1}
                          className="h-8 w-8 rounded-lg border border-stroke-2 flex items-center justify-center text-ink-4 hover:text-ink hover:bg-tinted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-xs text-ink-4 px-1">
                          {tradePag.page} / {tradePag.totalPages}
                        </span>
                        <button
                          onClick={tradePag.next}
                          disabled={tradePag.page === tradePag.totalPages}
                          className="h-8 w-8 rounded-lg border border-stroke-2 flex items-center justify-center text-ink-4 hover:text-ink hover:bg-tinted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── По сетапам tab ────────────────────────────────────── */}
              {activeTab === "setups" && (
                <div className="space-y-5">
                  {bySetupEnriched.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2">
                      <Layers className="h-8 w-8 text-ink-5" />
                      <p className="text-sm text-ink-4">Нет данных по сетапам</p>
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={bySetupEnriched}
                          margin={{ top: 4, right: 4, left: 0, bottom: 40 }}
                          barCategoryGap="30%"
                        >
                          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="transparent"
                            tick={{ fontSize: 9, fill: axisColor }}
                            tickLine={false}
                            axisLine={false}
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis
                            stroke="transparent"
                            tick={{ fontSize: 10, fill: axisColor }}
                            tickLine={false}
                            axisLine={false}
                            width={56}
                            tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                          />
                          <Tooltip
                            content={(props) => <BarTooltip {...props} dark={darkMode} />}
                            cursor={{ fill: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                            wrapperStyle={{ pointerEvents: "none" }}
                          />
                          <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
                            {bySetupEnriched.map((d, i) => (
                              <Cell key={i} fill={d.pnl >= 0 ? SAGE_C : BRICK_C} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stroke">
                            {["Сетап", "Сделок", "Win Rate", "Total P/L", "Avg P/L", "Profit Factor"].map((h, i) => (
                              <th
                                key={h}
                                className={cn(
                                  "py-2 px-3 text-[10px] font-medium uppercase tracking-wider text-ink-5",
                                  i === 0 ? "text-left" : "text-right"
                                )}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bySetupEnriched.map(s => (
                            <tr key={s.name} className="hover:bg-tinted/40 transition-colors">
                              <td className="px-3 py-2.5 font-medium text-ink">{s.name}</td>
                              <td className="px-3 py-2.5 text-right text-ink-3">{s.trades}</td>
                              <td
                                className="px-3 py-2.5 text-right font-medium"
                                style={{ color: s.winRate >= 60 ? SAGE_C : s.winRate >= 50 ? AMBER : BRICK_C }}
                              >
                                {s.winRate}%
                              </td>
                              <td
                                className="px-3 py-2.5 text-right font-semibold font-mono"
                                style={{ color: s.pnl >= 0 ? SAGE_C : BRICK_C }}
                              >
                                {fmt(s.pnl)}
                              </td>
                              <td
                                className="px-3 py-2.5 text-right text-xs font-mono"
                                style={{ color: s.pnl / s.trades >= 0 ? SAGE_C : BRICK_C }}
                              >
                                {fmt(s.pnl / s.trades)}
                              </td>
                              <td
                                className="px-3 py-2.5 text-right text-xs font-medium"
                                style={{ color: s.profitFactor >= 1.5 ? SAGE_C : s.profitFactor >= 1 ? AMBER : BRICK_C }}
                              >
                                {!isFinite(s.profitFactor ?? NaN) ? "∞" : s.profitFactor!.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ── По инструментам tab ───────────────────────────────── */}
              {activeTab === "symbols" && (
                <div className="space-y-5">
                  {bySymbolEnriched.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2">
                      <BarChart3 className="h-8 w-8 text-ink-5" />
                      <p className="text-sm text-ink-4">Нет данных по инструментам</p>
                    </div>
                  ) : (
                    <>
                      {/* HBar list */}
                      <div className="space-y-2">
                        <p className={cn(KL, "mb-3")}>P/L по инструментам</p>
                        {bySymbolEnriched.map(s => {
                          const barPct = Math.round((Math.abs(s.pnl) / maxAbsSymPnl) * 100);
                          return (
                            <div key={s.name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-ink w-20 truncate">{s.name}</span>
                                  <span className="text-ink-5">{s.trades} сделок</span>
                                  <span
                                    className="text-[10px] font-medium"
                                    style={{ color: s.winRate >= 50 ? SAGE_C : BRICK_C }}
                                  >
                                    {s.winRate}% WR
                                  </span>
                                </div>
                                <span
                                  className="font-semibold font-mono"
                                  style={{ color: s.pnl >= 0 ? SAGE_C : BRICK_C }}
                                >
                                  {fmt(s.pnl)}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-tinted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${barPct}%`,
                                    background: s.pnl >= 0 ? SAGE_C : BRICK_C,
                                    opacity: 0.8,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-stroke" />

                      {/* Table */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stroke">
                            {["Инструмент", "Сделок", "Win Rate", "Total P/L", "Avg P/L", "Profit Factor"].map((h, i) => (
                              <th
                                key={h}
                                className={cn(
                                  "py-2 px-3 text-[10px] font-medium uppercase tracking-wider text-ink-5",
                                  i === 0 ? "text-left" : "text-right"
                                )}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bySymbolEnriched.map(s => (
                            <tr key={s.name} className="hover:bg-tinted/40 transition-colors">
                              <td className="px-3 py-2.5 font-semibold text-ink">{s.name}</td>
                              <td className="px-3 py-2.5 text-right text-ink-3">{s.trades}</td>
                              <td
                                className="px-3 py-2.5 text-right font-medium"
                                style={{ color: s.winRate >= 60 ? SAGE_C : s.winRate >= 50 ? AMBER : BRICK_C }}
                              >
                                {s.winRate}%
                              </td>
                              <td
                                className="px-3 py-2.5 text-right font-semibold font-mono"
                                style={{ color: s.pnl >= 0 ? SAGE_C : BRICK_C }}
                              >
                                {fmt(s.pnl)}
                              </td>
                              <td
                                className="px-3 py-2.5 text-right text-xs font-mono"
                                style={{ color: s.pnl / s.trades >= 0 ? SAGE_C : BRICK_C }}
                              >
                                {fmt(s.pnl / s.trades)}
                              </td>
                              <td
                                className="px-3 py-2.5 text-right text-xs font-medium"
                                style={{ color: s.profitFactor >= 1.5 ? SAGE_C : s.profitFactor >= 1 ? AMBER : BRICK_C }}
                              >
                                {!isFinite(s.profitFactor ?? NaN) ? "∞" : s.profitFactor!.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              </div>
            </div>
          </div>

          {/* ══════════ Контекст и риск ══════════ */}
          <div>
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-5">
              <div>
                <p className="editorial-label">{lang === "ru" ? "Контекст и риск" : "Context & risk"}</p>
                <p className="font-serif text-2xl font-bold mt-2">
                  {lang === "ru" ? "Какой ценой." : "At what cost."}
                </p>
              </div>
              <p className="text-[11px] text-ink-5 font-mono tnum tracking-widest uppercase">
                05 {lang === "ru" ? "метрик" : "metrics"}
              </p>
            </div>
            <div className="rounded-2xl border border-stroke bg-card relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg, rgba(176,128,80,0.7), rgba(176,128,80,0.1))" }} />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-stroke">
                {/* 1. Всего сделок */}
                <div className="p-4">
                  <p className="editorial-label">{lang === "ru" ? "Всего сделок" : "Total trades"}</p>
                  <p className="font-serif text-2xl font-bold tnum mt-2 text-ink leading-none">
                    {result.totalTrades}
                  </p>
                  <p className="text-[11px] text-ink-5 mt-2 font-mono tnum">
                    <span style={{ color: SAGE_C }}>{result.wins}W</span> / <span style={{ color: BRICK_C }}>{result.losses}L</span>
                  </p>
                </div>
                {/* 2. Avg win / loss */}
                <div className="p-4">
                  <p className="editorial-label">{lang === "ru" ? "Avg Win / Loss" : "Avg Win / Loss"}</p>
                  <p className="font-serif text-xl font-bold tnum mt-2 leading-none whitespace-nowrap" style={{ color: SAGE_C }}>
                    +${Math.round(result.avgWin).toLocaleString("en-US")}
                  </p>
                  <p className="text-[13px] font-bold tnum mt-1 font-mono" style={{ color: BRICK_C }}>
                    {result.avgLoss > 0 ? `−$${Math.round(result.avgLoss).toLocaleString("en-US")}` : "$0"}
                  </p>
                </div>
                {/* 3. Max drawdown + Recovery */}
                <div className="p-4">
                  <p className="editorial-label">{lang === "ru" ? "Макс. просадка" : "Max drawdown"}</p>
                  <p className="font-serif text-2xl font-bold tnum mt-2 leading-none whitespace-nowrap"
                     style={{ color: result.maxDrawdown > 0 ? BRICK_C : "var(--color-ink)" }}>
                    {result.maxDrawdown > 0 ? `−$${Math.round(result.maxDrawdown).toLocaleString("en-US")}` : "$0"}
                  </p>
                  <p className="text-[11px] text-ink-5 mt-2">
                    Recovery: <span style={{ color: result.recoveryFactor >= 2 ? SAGE_C : result.recoveryFactor >= 1 ? AMBER : BRICK_C }} className="font-mono font-semibold">
                      {result.maxDrawdown > 0 ? result.recoveryFactor.toFixed(2) : "—"}
                    </span>
                  </p>
                </div>
                {/* 4. Sharpe / Sortino */}
                <div className="p-4">
                  <p className="editorial-label">Sharpe / Sortino</p>
                  <p className="font-serif text-2xl font-bold tnum mt-2 leading-none"
                     style={{ color: result.sharpeRatio >= 1 ? SAGE_C : result.sharpeRatio >= 0 ? AMBER : BRICK_C }}>
                    {result.sharpeRatio !== 0 ? result.sharpeRatio.toFixed(2) : "—"}
                  </p>
                  <p className="text-[11px] mt-2">
                    Sortino: <span className="font-mono font-semibold"
                      style={{ color: result.sortino >= 1.5 ? SAGE_C : result.sortino >= 0 ? AMBER : BRICK_C }}>
                      {result.sortino !== 0 ? result.sortino.toFixed(2) : "—"}
                    </span>
                  </p>
                </div>
                {/* 5. Streaks + Fees */}
                <div className="p-4">
                  <p className="editorial-label">{lang === "ru" ? "Серии / Комиссии" : "Streaks / Fees"}</p>
                  <p className="font-serif text-2xl font-bold tnum mt-2 leading-none whitespace-nowrap">
                    <span style={{ color: SAGE_C }}>+{result.maxConsecWins}</span>
                    <span className="text-ink-5 mx-1"> / </span>
                    <span style={{ color: BRICK_C }}>−{result.maxConsecLosses}</span>
                  </p>
                  <p className="text-[11px] text-ink-5 mt-2 font-mono">
                    ${Math.round(result.totalFees).toLocaleString("en-US")} {lang === "ru" ? "комиссий" : "fees"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Colophon */}
          <div className="border-t border-stroke pt-6 text-center">
            <p className="font-serif italic text-sm text-ink-3">
              — {lang === "ru" ? "Конец отчёта о прогоне" : "End of dry-run"} —
            </p>
            <p className="editorial-label mt-2">
              {lang === "ru" ? "Сгенерировано" : "Generated by"} Trevixe · {now.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long", year: "numeric" })} · {now.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
