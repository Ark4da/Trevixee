"use client";
import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useStats } from "@/hooks/use-trades";
import type { StatsData } from "@/hooks/use-trades";
import { useAppStore } from "@/store";
import { useT } from "@/lib/useT";
import { PaywallCard } from "@/components/billing/paywall-card";
import type { Entitlements } from "@/lib/entitlements";
import { AiInsightsWidget } from "@/components/ai/ai-insights-widget";
import { TrendingUp, TrendingDown, BarChart3, Clock, Layers, BarChart2, Brain, Star } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  LineChart, Line,
} from "recharts";
import { GradientAreaChart } from "@/components/ui/gradient-area-chart";

/* ── Palette ── */
const SAGE    = "#22C55E";
const BRICK   = "#EF4444";
const SAGE_C  = "#7BAF8A";
const BRICK_C = "#AC5A56";
const AMBER   = "#B08050";
const KL = "text-[10px] uppercase tracking-widest text-ink-5 font-medium";

function fmt(n: number, decimals = 2) {
  return n >= 0
    ? `+$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
    : `-$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtMin(m: number) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

function dayInputValue(d: Date) { return d.toISOString().slice(0, 10); }

async function safeJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return await res.json() as T;
  } catch {
    return null;
  }
}

function useChartTheme(dark: boolean) {
  return {
    grid:          dark ? "rgba(255,255,255,0.04)" : "#D4D4E0",
    axis:          dark ? "#636060" : "#9494AE",
    tooltipBg:     dark ? "#1D1C1A" : "#FFFFFF",
    tooltipBorder: dark ? "rgba(255,190,120,0.12)" : "#D4D4E0",
  };
}

/* ── KPI card ── */
function KpiCard({ label, value, sub, color, badge, delta }: {
  label: string; value: string; sub?: string; color?: string;
  badge?: "pro" | "team"; delta?: { value: number; pct?: number };
}) {
  return (
    <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <p className={KL}>{label}</p>
        {badge && <PlanBadge plan={badge} />}
      </div>
      <p className="text-2xl font-bold font-mono leading-none truncate" style={{ color }}>{value}</p>
      <div className="flex items-center gap-2 mt-2">
        {sub && <p className="text-[11px] text-ink-5 truncate">{sub}</p>}
        {delta !== undefined && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-medium font-mono shrink-0",
            delta.value >= 0 ? "text-[#7BAF8A]" : "text-[#AC5A56]"
          )}>
            {delta.value >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {delta.value >= 0 ? "+" : ""}{delta.pct !== undefined ? `${delta.pct.toFixed(0)}%` : fmt(delta.value, 0)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Plan badge ── */
function PlanBadge({ plan }: { plan: "pro" | "team" }) {
  const isPro = plan === "pro";
  return (
    <span className="chip text-[8px] shrink-0" style={{
      background: isPro ? "rgba(240,114,64,0.12)" : "rgba(99,102,241,0.12)",
      color: isPro ? "var(--color-brand)" : "#6366F1",
      padding: "2px 6px",
    }}>
      {isPro ? "PRO" : "TEAM"}
    </span>
  );
}

/* ── Section header ── */
function SectionHeader({ label, plan }: { label: string; plan?: "pro" | "team" }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <p className={KL}>{label}</p>
      {plan && <PlanBadge plan={plan} />}
    </div>
  );
}

/* ── Tooltip ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, dark, avgValue, suffix }: any) {
  const c = useChartTheme(dark);
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const diff = avgValue !== undefined ? val - avgValue : undefined;
  return (
    <div style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 10, padding: "10px 14px", minWidth: 110 }}>
      {label && <p style={{ color: c.axis, fontSize: 11, marginBottom: 4 }}>{label}</p>}
      <p style={{ color: val >= 0 ? SAGE_C : BRICK_C, fontSize: 14, fontWeight: 700, margin: 0 }}>
        {suffix ? `${val}${suffix}` : fmt(val)}
      </p>
      {diff !== undefined && (
        <p style={{ color: diff >= 0 ? SAGE_C : BRICK_C, fontSize: 10, marginTop: 3 }}>
          {diff >= 0 ? "+" : ""}{suffix ? `${diff.toFixed(0)}${suffix}` : fmt(diff)} vs avg
        </p>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RMultipleTooltip({ active, payload, label, dark }: any) {
  const c = useChartTheme(dark);
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { count: number; share?: number; avgR?: number; pnl?: number };
  return (
    <div style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 10, padding: "10px 14px", minWidth: 160 }}>
      <p style={{ color: c.axis, fontSize: 11, marginBottom: 6 }}>{label}</p>
      <p style={{ color: row.avgR && row.avgR >= 0 ? SAGE_C : BRICK_C, fontSize: 14, fontWeight: 700, margin: 0 }}>
        {row.count} trades · {row.share ?? 0}%
      </p>
      <p style={{ color: c.axis, fontSize: 11, marginTop: 4 }}>
        Avg {row.avgR && row.avgR >= 0 ? "+" : ""}{(row.avgR ?? 0).toFixed(2)}R · {fmt(row.pnl ?? 0, 0)}
      </p>
    </div>
  );
}

type AnalyticsRange = { from?: string; to?: string };

const ANALYTICS_COPY = {
  en: {
    overview: "Overview",
    performance: "Performance",
    setups: "Setups",
    sessions: "Sessions",
    analytics: "Analytics",
    range7d: "Last 7d",
    range30d: "Last 30d",
    allHistory: "All history",
    custom: "Custom",
    to: "to",
    freeUnlocks: "PRO unlocks: All history / Custom range · Setups, Sessions · AI review",
    netPl: "Net P/L",
    avgR: "Avg R",
    peakToTrough: "Peak to trough",
    previousPeriod: "Arrows vs previous period",
    patternTitle: "Pattern Radar (Pro)",
    patternBody: "Get compact signals from your trade stats, then open Trevixe Lens for the deeper conversation.",
    equityCurve: "Equity curve",
    monthlyPl: "Monthly P/L",
    commissionDrag: "Commission drag",
    totalFeesPaid: "total fees paid",
    feesGross: "Fees / Gross P&L",
    highFee: "High fee ratio. Consider reducing trade frequency or switching brokers.",
    bestDays: "Best days",
    worstDays: "Worst days",
    discipline: "Discipline",
    journalConsistency: "Journal consistency (30d)",
    winStreak: "Win streak",
    lossStreak: "Loss streak",
    dailyPl: "Daily P/L",
    avgMonth: "avg {value}/mo",
    avgDay: "avg {value}/day",
    insightsTitle: "Decision brief",
    whatWorks: "What works",
    mainRisk: "Main risk",
    nextAction: "Next action",
    edgePositive: "Your edge is positive this period.",
    edgeNegative: "This period is not paying yet.",
    winRateStrong: "Win rate is holding above 50%.",
    drawdownWatch: "Drawdown is the main constraint.",
    feeDrag: "Fees are eating a large part of the result.",
    setupGap: "Setups are not tagged consistently yet.",
    qualityGap: "Trade quality fields are underfilled.",
    keepReviewing: "Keep reviewing the same playbook and avoid adding noise.",
    reduceFees: "Audit the highest-frequency days and cut low-quality repeats.",
    tagSetups: "Tag every new trade with a setup before the next review.",
    logQuality: "Rate each trade and add state/mistake notes after closing.",
    qualityTitle: "Trade quality",
    qualitySubtitle: "Psychology is folded into quality so it only shows up when it can explain performance.",
    qualityScore: "Quality coverage",
    ratedTrades: "Rated trades",
    emotionTrades: "Emotion tagged",
    rulesLogged: "Rules logged",
    emotionalState: "Emotional state",
    ratingDistribution: "Rating distribution",
    state: "State",
    trades: "Trades",
    winRate: "Win Rate",
    totalPl: "Total P/L",
    noQuality: "Start by rating trades and marking emotional state. Once coverage grows, this block becomes a real behavior report.",
    noEmotions: "No emotional-state data yet.",
    noRatings: "No rated trades yet.",
    highRated: "High-rated trades",
    lowRated: "Low-rated trades",
    maeTitle: "MAE / MFE - Excursion analysis",
    maeBody: "MAE = how far against you before exit. MFE = how far in your favor. Capture % = what % of MFE you banked.",
    avgMae: "Avg MAE",
    avgMfe: "Avg MFE",
    mfeCapture: "MFE Capture",
    avgDrawdown: "avg drawdown in trade",
    avgPeak: "avg peak in trade",
    fromTrades: "from {count} trades",
    maeEmpty: "Add MAE/MFE to trades in the journal to unlock exit quality analysis.",
    rDistribution: "R-Multiple distribution",
    healthyEdge: "Healthy edge: peak in +1R to +2R zone",
    rollingWinRate: "Rolling win rate · 20 trades",
    holdDuration: "Hold duration · winners vs losers",
    winnersHeldLonger: "Losers held {ratio}x longer than winners. Consider tighter stops.",
    byInstrument: "By instrument",
    instrument: "Instrument",
    long: "Long",
    short: "Short",
    byHour: "P/L by hour",
    dayHourHeatmap: "Day x Hour heatmap - Avg P/L per cell",
    loss: "Loss",
    noData: "No data",
    win: "Win",
    hoverDetails: "Hover for details",
    daySummary: "Day-of-week summary",
    day: "Day",
    noSetup: "No setup",
  },
  ru: {
    overview: "Обзор",
    performance: "Результаты",
    setups: "Сетапы",
    sessions: "Время",
    analytics: "Аналитика",
    range7d: "7 дней",
    range30d: "30 дней",
    allHistory: "Вся история",
    custom: "Период",
    to: "по",
    freeUnlocks: "PRO открывает: всю историю / свой период · сетапы, время · AI-разбор",
    netPl: "Чистый P/L",
    avgR: "Средний R",
    peakToTrough: "От пика до минимума",
    previousPeriod: "Стрелки к прошлому периоду",
    patternTitle: "Радар паттернов (Pro)",
    patternBody: "Короткие сигналы из статистики, а глубокий разбор можно продолжить в Trevixe Lens.",
    equityCurve: "Кривая капитала",
    monthlyPl: "P/L по месяцам",
    commissionDrag: "Влияние комиссий",
    totalFeesPaid: "всего комиссий",
    feesGross: "Комиссии / валовый P/L",
    highFee: "Комиссии слишком сильно давят на результат. Проверь частоту сделок и условия брокера.",
    bestDays: "Лучшие дни",
    worstDays: "Худшие дни",
    discipline: "Дисциплина",
    journalConsistency: "Регулярность журнала (30д)",
    winStreak: "Серия W",
    lossStreak: "Серия L",
    dailyPl: "P/L по дням",
    avgMonth: "ср. {value}/мес",
    avgDay: "ср. {value}/день",
    insightsTitle: "Короткий вывод",
    whatWorks: "Что работает",
    mainRisk: "Главный риск",
    nextAction: "Следующее действие",
    edgePositive: "В этом периоде есть положительное преимущество.",
    edgeNegative: "Этот период пока не приносит стабильный результат.",
    winRateStrong: "Винрейт держится выше 50%.",
    drawdownWatch: "Просадка сейчас главный ограничитель.",
    feeDrag: "Комиссии съедают большую часть результата.",
    setupGap: "Сетапы пока размечены нерегулярно.",
    qualityGap: "Качество сделок пока заполнено слабо.",
    keepReviewing: "Продолжай разбирать тот же плейбук и не добавляй лишний шум.",
    reduceFees: "Проверь самые частые дни и убери повторные низкокачественные входы.",
    tagSetups: "Помечай сетап у каждой новой сделки до следующего обзора.",
    logQuality: "После закрытия сделки ставь рейтинг и отмечай состояние/ошибку.",
    qualityTitle: "Качество сделки",
    qualitySubtitle: "Психология встроена в качество: она появляется там, где реально объясняет результат.",
    qualityScore: "Заполненность качества",
    ratedTrades: "Сделки с рейтингом",
    emotionTrades: "Отмечено состояние",
    rulesLogged: "Правила отмечены",
    emotionalState: "Эмоциональное состояние",
    ratingDistribution: "Распределение рейтингов",
    state: "Состояние",
    trades: "Сделки",
    winRate: "Винрейт",
    totalPl: "Общий P/L",
    noQuality: "Начни с рейтинга сделки и эмоционального состояния. Когда заполненность вырастет, этот блок станет настоящим отчетом по поведению.",
    noEmotions: "Пока нет данных по состоянию.",
    noRatings: "Пока нет сделок с рейтингом.",
    highRated: "Высокий рейтинг",
    lowRated: "Низкий рейтинг",
    maeTitle: "MAE / MFE - анализ выхода",
    maeBody: "MAE = насколько сделка шла против тебя до выхода. MFE = насколько шла в твою пользу. Capture % = какую часть MFE удалось забрать.",
    avgMae: "Средний MAE",
    avgMfe: "Средний MFE",
    mfeCapture: "Захват MFE",
    avgDrawdown: "ср. просадка в сделке",
    avgPeak: "ср. пик в сделке",
    fromTrades: "по {count} сделкам",
    maeEmpty: "Добавь MAE/MFE в сделках, чтобы увидеть качество выхода.",
    rDistribution: "Распределение R-Multiple",
    healthyEdge: "Здоровое преимущество: пик в зоне +1R до +2R",
    rollingWinRate: "Скользящий винрейт · 20 сделок",
    holdDuration: "Время удержания · прибыльные vs убыточные",
    winnersHeldLonger: "Убытки держались в {ratio}x дольше прибыли. Стоит проверить стопы.",
    byInstrument: "По инструментам",
    instrument: "Инструмент",
    long: "Лонг",
    short: "Шорт",
    byHour: "P/L по часам",
    dayHourHeatmap: "День x час - средний P/L в ячейке",
    loss: "Убыток",
    noData: "Нет данных",
    win: "Прибыль",
    hoverDetails: "Наведи для деталей",
    daySummary: "Итог по дням недели",
    day: "День",
    noSetup: "Без сетапа",
  },
} as const;

function getAnalyticsCopy(lang?: string) {
  return lang === "ru" ? ANALYTICS_COPY.ru : ANALYTICS_COPY.en;
}

function useAnalyticsCopy(lang?: string) {
  const [effectiveLang, setEffectiveLang] = useState(lang);

  useEffect(() => {
    let cancelled = false;
    let next = lang;
    try {
      const saved = localStorage.getItem("tz-lang");
      if (saved === "ru" || saved === "en") next = saved;
    } catch {
      // keep store language
    }

    queueMicrotask(() => {
      if (!cancelled) setEffectiveLang(next);
    });

    return () => { cancelled = true; };
  }, [lang]);

  return getAnalyticsCopy(effectiveLang);
}

/* ── Prev-period hook ── */
function usePrevPeriodStats(range: AnalyticsRange): StatsData | null {
  const [prev, setPrev] = useState<StatsData | null>(null);

  useEffect(() => {
    if (!range.from) return;
    const from = new Date(range.from);
    const to   = range.to ? new Date(range.to) : new Date();
    const dur  = to.getTime() - from.getTime();
    const prevTo   = new Date(from.getTime() - 86_400_000);
    const prevFrom = new Date(prevTo.getTime() - dur);
    const p = new URLSearchParams();
    p.set("from", dayInputValue(prevFrom));
    p.set("to",   dayInputValue(prevTo));
    p.set("tzOffset", String(new Date().getTimezoneOffset()));
    fetch(`/api/trades/stats?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(setPrev)
      .catch(() => setPrev(null));
  }, [range.from, range.to]);

  return range.from ? prev : null;
}

/* ── Monthly P&L helper ── */
function computeMonthly(dailyPnl: { date: string; pnl: number }[]) {
  const map = new Map<string, number>();
  for (const d of dailyPnl) {
    const month = d.date.slice(0, 7);
    map.set(month, (map.get(month) || 0) + d.pnl);
  }
  return Array.from(map.entries())
    .map(([month, pnl]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      pnl: Math.round(pnl * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
}

function InsightPill({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? SAGE_C : tone === "bad" ? BRICK_C : AMBER;
  return (
    <div className="rounded-xl bg-tinted border border-stroke p-4 min-w-0">
      <p className={cn(KL, "mb-2")}>{label}</p>
      <p className="text-sm font-medium text-ink leading-snug" style={{ color }}>{value}</p>
    </div>
  );
}

function DecisionBrief({ stats, rulesPct, feePct, copy }: {
  stats: StatsData;
  rulesPct: number;
  feePct: number;
  copy: ReturnType<typeof getAnalyticsCopy>;
}) {
  const setupTagged = stats.tradesBySetup.filter((s) => s.name !== "No Setup").reduce((sum, s) => sum + s.trades, 0);
  const setupCoverage = stats.totalTrades > 0 ? Math.round((setupTagged / stats.totalTrades) * 100) : 0;
  const qualityFilled = Math.max(stats.byRating.reduce((sum, r) => sum + r.trades, 0), stats.byEmotionalState.reduce((sum, e) => sum + e.trades, 0));
  const qualityCoverage = stats.totalTrades > 0 ? Math.round((qualityFilled / stats.totalTrades) * 100) : 0;

  const works = stats.netPnl > 0
    ? copy.edgePositive
    : stats.winRate >= 50
      ? copy.winRateStrong
      : copy.edgeNegative;

  const risk = feePct > 20
    ? copy.feeDrag
    : stats.maxDrawdown > Math.abs(stats.netPnl)
      ? copy.drawdownWatch
      : setupCoverage < 60
        ? copy.setupGap
        : qualityCoverage < 60
          ? copy.qualityGap
          : copy.keepReviewing;

  const action = feePct > 20
    ? copy.reduceFees
    : setupCoverage < 60
      ? copy.tagSetups
      : qualityCoverage < 60 || rulesPct < 70
        ? copy.logQuality
        : copy.keepReviewing;

  return (
    <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep">
      <SectionHeader label={copy.insightsTitle} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <InsightPill label={copy.whatWorks} value={works} tone={stats.netPnl >= 0 || stats.winRate >= 50 ? "good" : "bad"} />
        <InsightPill label={copy.mainRisk} value={risk} tone={feePct > 20 || stats.maxDrawdown > Math.abs(stats.netPnl) ? "bad" : "warn"} />
        <InsightPill label={copy.nextAction} value={action} tone="warn" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB: Overview
   ════════════════════════════════════════════════════════════════════════════ */
interface MaeMfeRecord { tradeId: string; mae: number; mfe: number }

function OverviewTab({ dark, range, canUseAiTradeReview }: {
  dark: boolean; range: AnalyticsRange; canUseAiTradeReview: boolean;
}) {
  const t = useT();
  const { lang } = useAppStore();
  const copy = useAnalyticsCopy(lang);
  const c = useChartTheme(dark);
  const { stats } = useStats(range.from, range.to);
  const prevStats  = usePrevPeriodStats(range);

  const [journal, setJournal] = useState<{ rulesFollowed: boolean }[]>([]);
  const [maeMfe,  setMaeMfe]  = useState<MaeMfeRecord[] | null>(null);

  useEffect(() => {
    fetch("/api/journal")
      .then((r) => safeJson<unknown>(r))
      .then((d) => { if (Array.isArray(d)) setJournal(d); })
      .catch(() => setJournal([]));
  }, []);

  useEffect(() => {
    fetch("/api/trades/maemfe")
      .then((r) => safeJson<unknown>(r))
      .then((d) => {
        if (Array.isArray(d)) setMaeMfe(d);
      })
      .catch(() => setMaeMfe(null));
  }, []);

  if (!stats) return <div className="py-16 text-center text-sm text-ink-5">{t("loading")}</div>;
  if (stats.totalTrades === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="h-12 w-12 text-ink-4 mb-4" />
      <h3 className="text-lg font-semibold text-ink mb-2">{t("reports_no_trades")}</h3>
      <p className="text-sm text-ink-4 max-w-sm">{t("reports_no_trades_desc")}</p>
    </div>
  );

  const rulesPct  = journal.length > 0 ? Math.round((journal.filter(j => j.rulesFollowed).length / journal.length) * 100) : 0;
  const journalPct = Math.min(Math.round((journal.length / 30) * 100), 100);
  const avgDailyPnl = stats.dailyPnl.length > 0
    ? stats.dailyPnl.reduce((s, d) => s + d.pnl, 0) / stats.dailyPnl.length : 0;

  const monthly = computeMonthly(stats.dailyPnl);
  const avgMonthlyPnl = monthly.length > 0 ? monthly.reduce((s, m) => s + m.pnl, 0) / monthly.length : 0;

  const sortedDays = [...stats.dailyPnl].sort((a, b) => b.pnl - a.pnl);
  const bestDays  = sortedDays.slice(0, 3);
  const worstDays = sortedDays.slice(-3).reverse();

  const feePct = stats.totalPnl > 0 ? Math.round((stats.totalFees / stats.totalPnl) * 100) : 0;

  const maeMfeAgg = maeMfe && maeMfe.length > 0 ? {
    avgMae: maeMfe.reduce((s, r) => s + r.mae, 0) / maeMfe.length,
    avgMfe: maeMfe.reduce((s, r) => s + r.mfe, 0) / maeMfe.length,
    captureRate: maeMfe.reduce((s, r) => s + (r.mfe > 0 ? r.mfe / (r.mae + r.mfe) : 0), 0) / maeMfe.length * 100,
    count: maeMfe.length,
  } : null;

  // Period delta helpers
  const pnlDelta = prevStats ? {
    value: stats.netPnl - prevStats.netPnl,
    pct: prevStats.netPnl !== 0 ? ((stats.netPnl - prevStats.netPnl) / Math.abs(prevStats.netPnl)) * 100 : undefined,
  } : undefined;
  const wrDelta = prevStats ? { value: stats.winRate - prevStats.winRate } : undefined;
  const rDelta  = prevStats ? { value: stats.avgRMultiple - prevStats.avgRMultiple } : undefined;

  return (
    <div className="space-y-6">
      {/* KPI row with period deltas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={copy.netPl}
          value={fmt(stats.netPnl)}
          sub={`${stats.totalTrades} ${t("trades").toLowerCase()}`}
          color={stats.netPnl >= 0 ? SAGE : BRICK}
          delta={pnlDelta}
        />
        <KpiCard label={t("progress_win_rate")}
          value={`${stats.winRate}%`}
          sub={`${stats.wins}W / ${stats.losses}L`}
          color={stats.winRate >= 50 ? SAGE_C : BRICK_C}
          delta={wrDelta ? { value: wrDelta.value, pct: wrDelta.value } : undefined}
        />
        <KpiCard label={copy.avgR}
          value={`${stats.avgRMultiple >= 0 ? "+" : ""}${stats.avgRMultiple}R`}
          sub={`PF ${!isFinite(stats.profitFactor ?? NaN) ? "∞" : stats.profitFactor!.toFixed(2)}`}
          color={stats.avgRMultiple >= 1 ? SAGE_C : AMBER}
          delta={rDelta}
        />
        <KpiCard label={t("progress_max_drawdown")}
          value={stats.maxDrawdown > 0 ? `-$${stats.maxDrawdown.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "$0"}
          sub={copy.peakToTrough}
          color={stats.maxDrawdown > 0 ? BRICK_C : undefined}
        />
      </div>

      {prevStats && (
        <p className="text-[10px] text-ink-5 -mt-2">
          {copy.previousPeriod} · {prevStats.totalTrades} {copy.trades.toLowerCase()}
        </p>
      )}

      <DecisionBrief stats={stats} rulesPct={rulesPct} feePct={feePct} copy={copy} />

      {canUseAiTradeReview ? (
        <AiInsightsWidget />
      ) : (
        <PaywallCard
          feature="ai_trade_review"
          title={copy.patternTitle}
          body={copy.patternBody}
        />
      )}

      {/* Equity curve */}
      {stats.cumulativePnl.length > 1 && (
        <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
          <SectionHeader label={copy.equityCurve} />
          <GradientAreaChart
            data={stats.cumulativePnl.map(d => ({ label: d.date, value: d.pnl }))}
            dark={dark} height={200}
            tooltipFormatter={(v) => fmt(v)}
          />
        </div>
      )}

      {/* Monthly P&L + Commission drag */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Monthly bars */}
        {monthly.length > 1 && (
          <div className="md:col-span-2 rounded-2xl border border-stroke bg-card p-6 shadow-deep">
            <div className="flex items-center justify-between mb-4">
              <p className={KL}>{copy.monthlyPl}</p>
              {avgMonthlyPnl !== 0 && (
                <span className="text-[10px] text-ink-5">{copy.avgMonth.replace("{value}", fmt(avgMonthlyPnl, 0))}</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="2 4" stroke={c.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} width={48}
                  tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                <ReferenceLine y={0} stroke={c.grid} />
                {avgMonthlyPnl !== 0 && <ReferenceLine y={avgMonthlyPnl} stroke={AMBER} strokeDasharray="3 3" strokeOpacity={0.5} />}
                <Tooltip content={(p) => <ChartTooltip {...p} dark={dark} avgValue={avgMonthlyPnl} />} wrapperStyle={{ pointerEvents: "none" }} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {monthly.map((m, i) => (
                    <Cell key={i} fill={m.pnl >= 0 ? SAGE_C : BRICK_C} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Commission drag — full-width when no monthly data */}
        <div className={cn("rounded-2xl border border-stroke bg-card p-6 shadow-deep", monthly.length <= 1 && "md:col-span-3")}>
          <SectionHeader label={copy.commissionDrag} />
          <p className="text-2xl font-bold font-mono truncate" style={{ color: BRICK_C }}>
            -${stats.totalFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-ink-5 mt-2">{copy.totalFeesPaid}</p>
          {feePct > 0 && (
            <div className="mt-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-ink-4">{copy.feesGross}</span>
                <span className="text-xs font-mono font-medium" style={{ color: feePct > 20 ? BRICK_C : AMBER }}>{feePct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-tinted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(feePct, 100)}%`, background: feePct > 20 ? BRICK_C : AMBER }} />
              </div>
              {feePct > 20 && (
                <p className="text-[10px] text-ink-5 mt-2">{copy.highFee}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Best / Worst days */}
      {sortedDays.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[{ title: copy.bestDays, days: bestDays, isPos: true }, { title: copy.worstDays, days: worstDays, isPos: false }].map(({ title, days, isPos }) => (
            <div key={title} className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
              <SectionHeader label={title} />
              <div className="space-y-2">
                {days.map((d, i) => (
                  <div key={d.date} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-ink-5 w-4">{i + 1}</span>
                      <span className="text-xs text-ink-3">{d.date}</span>
                    </div>
                    <span className="text-sm font-bold font-mono" style={{ color: isPos ? SAGE_C : BRICK_C }}>{fmt(d.pnl)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Discipline + Daily P&L */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
          <SectionHeader label={copy.discipline} />
          <div className="space-y-4">
            {[
              { label: t("journal_rules_followed"), value: rulesPct, color: rulesPct >= 70 ? SAGE_C : rulesPct >= 50 ? AMBER : BRICK_C },
              { label: copy.journalConsistency, value: journalPct, color: journalPct >= 70 ? SAGE_C : AMBER },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-ink-3">{item.label}</span>
                  <span className="text-sm font-bold font-mono" style={{ color: item.color }}>{item.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-tinted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.value}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-tinted border border-stroke p-3">
              <p className={cn(KL, "mb-1")}>{copy.winStreak}</p>
              <p className="text-xl font-bold font-mono" style={{ color: SAGE_C }}>+{stats.currentWinStreak ?? stats.maxConsecutiveWins}</p>
            </div>
            <div className="rounded-xl bg-tinted border border-stroke p-3">
              <p className={cn(KL, "mb-1")}>{copy.lossStreak}</p>
              <p className="text-xl font-bold font-mono" style={{ color: BRICK_C }}>-{stats.currentLossStreak ?? stats.maxConsecutiveLosses}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
          <div className="flex items-center justify-between mb-4">
            <p className={KL}>{copy.dailyPl}</p>
            {avgDailyPnl !== 0 && <span className="text-[10px] text-ink-5">{copy.avgDay.replace("{value}", fmt(avgDailyPnl, 0))}</span>}
          </div>
          {stats.dailyPnl.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={stats.dailyPnl.slice(-20)} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="2 4" stroke={c.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} width={48}
                  tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                <ReferenceLine y={0} stroke={c.grid} />
                {avgDailyPnl !== 0 && <ReferenceLine y={avgDailyPnl} stroke={AMBER} strokeDasharray="3 3" strokeOpacity={0.5} />}
                <Tooltip content={(p) => <ChartTooltip {...p} dark={dark} avgValue={avgDailyPnl} />} wrapperStyle={{ pointerEvents: "none" }} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {stats.dailyPnl.slice(-20).map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? SAGE_C : BRICK_C} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-ink-5 text-center py-10">{t("common_no_data")}</p>}
        </div>
      </div>

      {/* MAE / MFE */}
      <TradeQualitySection stats={stats} journal={journal} copy={copy} dark={dark} />
      <MaeMfeSection agg={maeMfeAgg} />
    </div>
  );
}

function TradeQualitySection({ stats, journal, copy, dark }: {
  stats: StatsData;
  journal: { rulesFollowed: boolean }[];
  copy: ReturnType<typeof getAnalyticsCopy>;
  dark: boolean;
}) {
  const c = useChartTheme(dark);
  const ratedCount = stats.byRating.reduce((sum, r) => sum + r.trades, 0);
  const emotionCount = stats.byEmotionalState.reduce((sum, e) => sum + e.trades, 0);
  const rulesCount = journal.length;
  const ratingCoverage = stats.totalTrades > 0 ? Math.round((ratedCount / stats.totalTrades) * 100) : 0;
  const emotionCoverage = stats.totalTrades > 0 ? Math.round((emotionCount / stats.totalTrades) * 100) : 0;
  const rulesCoverage = stats.totalTrades > 0 ? Math.min(Math.round((rulesCount / stats.totalTrades) * 100), 100) : 0;
  const qualityCoverage = Math.round((ratingCoverage + emotionCoverage + rulesCoverage) / 3);
  const maxRatingCount = Math.max(...stats.byRating.map(r => r.trades), 1);
  const hasRatings = stats.byRating.length > 0;
  const hasEmotions = stats.byEmotionalState.length > 0;
  const highPnl = stats.byRating.filter(r => r.rating >= 4).reduce((sum, r) => sum + r.pnl, 0);
  const lowPnl = stats.byRating.filter(r => r.rating <= 2).reduce((sum, r) => sum + r.pnl, 0);

  return (
    <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
      <div className="flex flex-col gap-1 mb-5">
        <SectionHeader label={copy.qualityTitle} />
        <p className="text-[11px] text-ink-5 -mt-3">{copy.qualitySubtitle}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: copy.qualityScore, value: qualityCoverage, icon: Brain },
          { label: copy.ratedTrades, value: ratingCoverage, icon: Star },
          { label: copy.emotionTrades, value: emotionCoverage, icon: Brain },
          { label: copy.rulesLogged, value: rulesCoverage, icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          const color = item.value >= 70 ? SAGE_C : item.value >= 35 ? AMBER : BRICK_C;
          return (
            <div key={item.label} className="rounded-xl bg-tinted border border-stroke p-4">
              <div className="flex items-center justify-between mb-2">
                <p className={KL}>{item.label}</p>
                <Icon className="h-3.5 w-3.5 text-ink-5" />
              </div>
              <p className="text-xl font-bold font-mono" style={{ color }}>{item.value}%</p>
              <div className="mt-2 h-1.5 rounded-full bg-card overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${item.value}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {hasRatings || hasEmotions ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl bg-tinted border border-stroke p-4">
            <p className={cn(KL, "mb-4")}>{copy.ratingDistribution}</p>
            {hasRatings ? (
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const row = stats.byRating.find((r) => r.rating === rating);
                  const count = row?.trades ?? 0;
                  const pnl = row?.pnl ?? 0;
                  const pct = count > 0 ? Math.max(4, Math.round((count / maxRatingCount) * 100)) : 0;
                  const barColor = pnl > 0 ? SAGE_C : pnl < 0 ? BRICK_C : "#6B7280";
                  const empty = count === 0;
                  return (
                    <div key={rating} className={cn("flex items-center gap-3", empty && "opacity-40")}>
                      <div className="flex items-center gap-0.5 w-20 shrink-0">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className="h-2.5 w-2.5"
                            fill={i < rating ? AMBER : "transparent"}
                            style={{ color: i < rating ? AMBER : "var(--color-ink-5)" }}
                          />
                        ))}
                      </div>
                      <div className="flex-1 h-3.5 rounded-sm bg-card overflow-hidden">
                        {pct > 0 && (
                          <div
                            className="h-full rounded-sm transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: barColor, opacity: 0.55 + (rating / 5) * 0.35 }}
                          />
                        )}
                      </div>
                      <span className="text-xs font-mono text-ink-4 w-10 text-right tnum">{count}</span>
                      <span
                        className="text-xs font-mono w-16 text-right tnum"
                        style={{ color: empty ? "var(--color-ink-5)" : pnl >= 0 ? SAGE_C : BRICK_C }}
                      >
                        {empty ? "—" : fmt(pnl, 0)}
                      </span>
                    </div>
                  );
                })}
                <p className="text-[10px] text-ink-5 pt-3 border-t border-stroke">
                  {copy.highRated}: {fmt(highPnl, 0)} · {copy.lowRated}: {fmt(lowPnl, 0)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-4 py-8 text-center">{copy.noRatings}</p>
            )}
          </div>

          <div className="rounded-xl bg-tinted border border-stroke overflow-hidden">
            <div className="px-4 pt-4 pb-2"><p className={KL}>{copy.emotionalState}</p></div>
            {hasEmotions ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-stroke bg-card">
                    {[copy.state, copy.trades, copy.winRate, copy.totalPl].map((h, i) => (
                      <th key={h} className={cn("py-2.5 px-4 text-[10px] font-medium uppercase tracking-wider text-ink-5", i === 0 ? "text-left" : "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke">
                  {stats.byEmotionalState.slice(0, 6).map((e) => (
                    <tr key={e.state} className="hover:bg-card/70 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-ink capitalize">{e.state}</td>
                      <td className="px-4 py-2.5 text-right text-ink-3">{e.trades}</td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: e.winRate >= 60 ? SAGE_C : e.winRate >= 50 ? AMBER : BRICK_C }}>{e.winRate}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold font-mono" style={{ color: e.pnl >= 0 ? SAGE_C : BRICK_C }}>{fmt(e.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-ink-4 py-8 text-center">{copy.noEmotions}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-tinted border border-dashed border-stroke p-8 text-center">
          <p className="text-sm text-ink-4 max-w-xl mx-auto">{copy.noQuality}</p>
        </div>
      )}
    </div>
  );
}

function MaeMfeSection({ agg }: {
  agg: { avgMae: number; avgMfe: number; captureRate: number; count: number } | null;
}) {
  const { lang } = useAppStore();
  const copy = useAnalyticsCopy(lang);
  return (
    <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
      <SectionHeader label={copy.maeTitle} />
      <p className="text-[11px] text-ink-5 mb-5 -mt-2">
        {copy.maeBody}
      </p>
      {agg ? (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-tinted border border-stroke p-4">
            <p className={cn(KL, "mb-1")}>{copy.avgMae}</p>
            <p className="text-2xl font-bold font-mono truncate" style={{ color: BRICK_C }}>-${agg.avgMae.toFixed(2)}</p>
            <p className="text-[10px] text-ink-5 mt-1">{copy.avgDrawdown}</p>
          </div>
          <div className="rounded-xl bg-tinted border border-stroke p-4">
            <p className={cn(KL, "mb-1")}>{copy.avgMfe}</p>
            <p className="text-2xl font-bold font-mono truncate" style={{ color: SAGE_C }}>+${agg.avgMfe.toFixed(2)}</p>
            <p className="text-[10px] text-ink-5 mt-1">{copy.avgPeak}</p>
          </div>
          <div className="rounded-xl bg-tinted border border-stroke p-4">
            <p className={cn(KL, "mb-1")}>{copy.mfeCapture}</p>
            <p className="text-2xl font-bold font-mono truncate" style={{ color: agg.captureRate >= 50 ? SAGE_C : AMBER }}>
              {agg.captureRate.toFixed(1)}%
            </p>
            <p className="text-[10px] text-ink-5 mt-1">{copy.fromTrades.replace("{count}", String(agg.count))}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-tinted border border-stroke p-8 text-center">
          <p className="text-sm text-ink-4">{copy.maeEmpty}</p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB: Performance
   ════════════════════════════════════════════════════════════════════════════ */
function PerformanceTab({ dark, range }: { dark: boolean; range: AnalyticsRange }) {
  const t = useT();
  const { lang } = useAppStore();
  const copy = useAnalyticsCopy(lang);
  const c = useChartTheme(dark);
  const { stats } = useStats(range.from, range.to);

  if (!stats) return <div className="py-16 text-center text-sm text-ink-5">{t("loading")}</div>;
  if (stats.totalTrades === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="h-12 w-12 text-ink-4 mb-4" />
      <h3 className="text-lg font-semibold text-ink mb-2">{t("reports_no_trades")}</h3>
    </div>
  );

  const avgDayPnl = (stats.tradesByDay?.length ?? 0) > 0
    ? stats.tradesByDay!.reduce((s, d) => s + d.pnl, 0) / stats.tradesByDay!.length : 0;
  const rBuckets = stats.rMultipleHistogram ?? [];
  const maxHistCount = Math.max(1, ...rBuckets.map(b => b.count));
  const lossRTrades = rBuckets.filter(b => !b.isWin).reduce((sum, b) => sum + b.count, 0);
  const winRTrades = rBuckets.filter(b => b.isWin).reduce((sum, b) => sum + b.count, 0);
  const leftTailTrades = rBuckets.filter(b => b.label.includes("-2")).reduce((sum, b) => sum + b.count, 0);
  const rightTailTrades = rBuckets.filter(b => b.label.includes("+2") || b.label.includes("+3")).reduce((sum, b) => sum + b.count, 0);
  const bestRBucket = rBuckets.reduce<(typeof rBuckets)[number] | null>((best, bucket) => {
    if (!best || bucket.count > best.count) return bucket;
    return best;
  }, null);
  const rEdgeText = stats.avgRMultiple > 0 && rightTailTrades >= leftTailTrades
    ? "R profile is constructive: winners are offsetting the left tail."
    : leftTailTrades > rightTailTrades
      ? "Left tail is heavy: review stop discipline and loss size."
      : "R profile is close to neutral: improve +1R to +2R conversion.";
  const avgWrLine = (stats.rollingWinRate?.length ?? 0) > 0
    ? Math.round(stats.rollingWinRate!.reduce((s, r) => s + r.wr, 0) / stats.rollingWinRate!.length)
    : stats.winRate;

  const metrics = [
    { label: t("progress_avg_win"),       value: `+$${stats.avgWin.toFixed(2)}`,        color: SAGE_C  },
    { label: t("progress_avg_loss"),      value: `-$${stats.avgLoss.toFixed(2)}`,        color: BRICK_C },
    { label: t("dash_biggest_win"),       value: `+$${stats.biggestWin.toFixed(2)}`,    color: SAGE    },
    { label: t("dash_biggest_loss"),      value: `-$${Math.abs(stats.biggestLoss).toFixed(2)}`, color: BRICK },
    { label: t("progress_profit_factor"), value: !isFinite(stats.profitFactor ?? NaN) ? "∞" : stats.profitFactor!.toFixed(2),
      color: (stats.profitFactor ?? 0) >= 1.5 ? SAGE_C : BRICK_C },
    { label: t("dash_stat_expectancy"),   value: fmt(stats.expectancy), color: stats.expectancy >= 0 ? SAGE_C : BRICK_C },
  ];

  const longPct  = stats.totalTrades > 0 ? Math.round((stats.tradesBySide.long  / stats.totalTrades) * 100) : 0;
  const shortPct = stats.totalTrades > 0 ? Math.round((stats.tradesBySide.short / stats.totalTrades) * 100) : 0;

  return (
    <div className="space-y-5">

      {/* ── Compact metrics strip ── */}
      <div className="rounded-2xl border border-stroke bg-card shadow-deep overflow-hidden">
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-stroke">
          {metrics.map((m, i) => (
            <div key={m.label} className={cn("px-4 py-4", i === 0 && "pl-5", i === metrics.length - 1 && "pr-5")}>
              <p className="text-[9px] uppercase tracking-widest text-ink-5 mb-1.5 leading-tight">{m.label}</p>
              <p className="text-lg font-bold font-mono leading-none" style={{ color: m.color }}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── R-Multiple distribution ── */}
      <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={KL}>{copy.rDistribution}</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">Risk-unit profile</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-4">{rEdgeText}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0 lg:min-w-[420px]">
            {[
              { label: "Avg R", value: `${stats.avgRMultiple >= 0 ? "+" : ""}${stats.avgRMultiple.toFixed(2)}R`, color: stats.avgRMultiple >= 0 ? SAGE_C : BRICK_C },
              { label: "Profit factor", value: !isFinite(stats.profitFactor ?? NaN) ? "∞" : stats.profitFactor!.toFixed(2), color: (stats.profitFactor ?? 0) >= 1 ? SAGE_C : BRICK_C },
              { label: "Win buckets", value: String(winRTrades), color: SAGE_C },
              { label: "Loss buckets", value: String(lossRTrades), color: BRICK_C },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-stroke bg-tinted px-3 py-2 min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-ink-5">{item.label}</p>
                <p className="mt-1 truncate font-mono text-base font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-5">
          <div className="min-w-0">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rBuckets} margin={{ top: 12, right: 8, left: 0, bottom: 2 }} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip content={(p) => <RMultipleTooltip {...p} dark={dark} />} cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} wrapperStyle={{ pointerEvents: "none" }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={68}>
                  {rBuckets.map((bucket) => {
                    const pct = bucket.count > 0 ? bucket.count / maxHistCount : 0;
                    return (
                      <Cell
                        key={bucket.label}
                        fill={bucket.isWin ? SAGE_C : BRICK_C}
                        fillOpacity={0.32 + pct * 0.58}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {rBuckets.map((bucket) => (
                <div key={bucket.label} className="rounded-lg border border-stroke bg-tinted px-2 py-2 text-center">
                  <p className="text-[9px] font-mono text-ink-5">{bucket.share ?? 0}%</p>
                  <p className="mt-0.5 text-[10px] font-semibold" style={{ color: (bucket.avgR ?? 0) >= 0 ? SAGE_C : BRICK_C }}>
                    {(bucket.avgR ?? 0) >= 0 ? "+" : ""}{(bucket.avgR ?? 0).toFixed(1)}R
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-tinted p-4">
            <p className={cn(KL, "mb-3")}>Readout</p>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-4">Main cluster</span>
                  <span className="font-mono text-ink">{bestRBucket?.label ?? "n/a"}</span>
                </div>
                <div className="h-2 rounded-full bg-card overflow-hidden">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${bestRBucket && stats.totalTrades > 0 ? Math.max(6, (bestRBucket.count / stats.totalTrades) * 100) : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-4">Left tail</span>
                  <span className="font-mono text-ink">{leftTailTrades} trades</span>
                </div>
                <div className="h-2 rounded-full bg-card overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${stats.totalTrades > 0 ? Math.max(leftTailTrades ? 6 : 0, (leftTailTrades / stats.totalTrades) * 100) : 0}%`, background: BRICK_C }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-4">Right tail</span>
                  <span className="font-mono text-ink">{rightTailTrades} trades</span>
                </div>
                <div className="h-2 rounded-full bg-card overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${stats.totalTrades > 0 ? Math.max(rightTailTrades ? 6 : 0, (rightTailTrades / stats.totalTrades) * 100) : 0}%`, background: SAGE_C }} />
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-stroke bg-card p-3">
              <p className="text-xs leading-relaxed text-ink-4">
                Ideal shape: small left tail, most losses near -1R, and enough +1R to +3R trades to pay for failed attempts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Rolling WR + Hold duration ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {stats.rollingWinRate.length >= 5 && (
          <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep">
            <div className="flex items-center justify-between mb-3">
              <p className={KL}>{copy.rollingWinRate}</p>
              <span className="text-[10px] text-ink-5">avg {avgWrLine}%</span>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={stats.rollingWinRate} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={c.grid} vertical={false} />
                <XAxis dataKey="n" tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false}
                  tickFormatter={n => `#${n}`} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} width={28}
                  domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <ReferenceLine y={50} stroke={c.grid} strokeDasharray="4 4" />
                {avgWrLine !== 50 && <ReferenceLine y={avgWrLine} stroke={AMBER} strokeDasharray="3 3" strokeOpacity={0.5} />}
                <Tooltip content={(p) => <ChartTooltip {...p} dark={dark} avgValue={avgWrLine} suffix="%" />} wrapperStyle={{ pointerEvents: "none" }} />
                <Line dataKey="wr" type="monotone" dot={false} strokeWidth={1.5} stroke={SAGE_C} strokeOpacity={0.9} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {(stats.avgWinDuration > 0 || stats.avgLossDuration > 0) && (
          <div className={cn("rounded-2xl border border-stroke bg-card p-5 shadow-deep", stats.rollingWinRate.length < 5 && "md:col-span-2")}>
            <p className={cn(KL, "mb-4")}>{copy.holdDuration}</p>
            <div className="space-y-4">
              {[
                { label: copy.win, value: stats.avgWinDuration,  color: SAGE_C  },
                { label: copy.loss, value: stats.avgLossDuration, color: BRICK_C },
              ].map(item => {
                const maxDur = Math.max(stats.avgWinDuration, stats.avgLossDuration, 1);
                const pct = Math.round((item.value / maxDur) * 100);
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-ink-3">{item.label}</span>
                      <span className="text-sm font-bold font-mono" style={{ color: item.color }}>{fmtMin(item.value)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-tinted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {stats.avgLossDuration > stats.avgWinDuration * 1.3 && stats.avgWinDuration > 0 && (
              <p className="text-[10px] text-ink-5 mt-4 pt-3 border-t border-stroke">
                {copy.winnersHeldLonger.replace("{ratio}", String(Math.round((stats.avgLossDuration / stats.avgWinDuration) * 10) / 10))}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Day of week + Long/Short ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.tradesByDay.length > 0 && (
          <div className="md:col-span-2 rounded-2xl border border-stroke bg-card p-5 shadow-deep">
            <div className="flex items-center justify-between mb-3">
              <p className={KL}>{t("reports_tab_day")}</p>
              {avgDayPnl !== 0 && <span className="text-[10px] text-ink-5">avg {fmt(avgDayPnl, 0)}/day</span>}
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={stats.tradesByDay} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="2 4" stroke={c.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} width={44}
                  tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                <ReferenceLine y={0} stroke={c.grid} />
                {avgDayPnl !== 0 && <ReferenceLine y={avgDayPnl} stroke={AMBER} strokeDasharray="3 3" strokeOpacity={0.5} />}
                <Tooltip content={(p) => <ChartTooltip {...p} dark={dark} avgValue={avgDayPnl} />} wrapperStyle={{ pointerEvents: "none" }} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {stats.tradesByDay.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? SAGE_C : BRICK_C} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Long / Short inline */}
        <div className={cn("rounded-2xl border border-stroke bg-card p-5 shadow-deep flex flex-col justify-between", !stats.tradesByDay.length && "md:col-span-3")}>
          <p className={cn(KL, "mb-4")}>{t("reports_long_short")}</p>
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {[
              { label: copy.long,  count: stats.tradesBySide.long,  pct: longPct,  color: SAGE_C  },
              { label: copy.short, count: stats.tradesBySide.short, pct: shortPct, color: BRICK_C },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-ink-3">{s.label}</span>
                  <span className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-tinted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-stroke grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-ink-5 uppercase tracking-widest">{copy.long}</p>
              <p className="text-sm font-mono font-bold" style={{ color: SAGE_C }}>{stats.tradesBySide.long}</p>
            </div>
            <div>
              <p className="text-[9px] text-ink-5 uppercase tracking-widest">{copy.short}</p>
              <p className="text-sm font-mono font-bold" style={{ color: BRICK_C }}>{stats.tradesBySide.short}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── By instrument — table only ── */}
      {stats.tradesBySymbol.length > 0 && (
        <div className="rounded-2xl border border-stroke bg-card overflow-hidden shadow-deep">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <p className={KL}>{copy.byInstrument}</p>
            <span className="text-[10px] text-ink-5">{stats.tradesBySymbol.length} instruments</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke bg-tinted">
                {[copy.instrument, t("trades"), copy.winRate, copy.totalPl, copy.avgR].map((h, i) => (
                  <th key={h} className={cn("py-2 px-4 text-[10px] font-medium uppercase tracking-wider text-ink-5", i === 0 ? "text-left" : "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {stats.tradesBySymbol.slice(0, 12).map(s => (
                <tr key={s.name} className="hover:bg-tinted/40 transition-colors">
                  <td className="px-4 py-2 font-medium text-ink">{s.name}</td>
                  <td className="px-4 py-2 text-right text-ink-3">{s.trades}</td>
                  <td className="px-4 py-2 text-right font-medium text-sm"
                    style={{ color: s.winRate >= 60 ? SAGE_C : s.winRate >= 50 ? AMBER : BRICK_C }}>{s.winRate}%</td>
                  <td className="px-4 py-2 text-right font-semibold font-mono"
                    style={{ color: s.pnl >= 0 ? SAGE_C : BRICK_C }}>{fmt(s.pnl)}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm"
                    style={{ color: s.avgR >= 1 ? SAGE_C : s.avgR >= 0 ? AMBER : BRICK_C }}>
                    {s.avgR >= 0 ? "+" : ""}{s.avgR}R
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB: Setups
   ════════════════════════════════════════════════════════════════════════════ */
function SetupsTab({ dark, canUseTagBreakdown, range }: {
  dark: boolean; canUseTagBreakdown: boolean; range: AnalyticsRange;
}) {
  const t = useT();
  const { lang } = useAppStore();
  const copy = useAnalyticsCopy(lang);
  const c = useChartTheme(dark);
  const { stats } = useStats(range.from, range.to);

  if (!stats) return <div className="py-16 text-center text-sm text-ink-5">{t("loading")}</div>;

  const content = (
    <div className="space-y-6">
      {stats.tradesBySetup.length > 0 ? (
        <>
          <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
            <SectionHeader label={t("reports_by_setups")} plan="pro" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.tradesBySetup.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={c.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={(p) => <ChartTooltip {...p} dark={dark} />} wrapperStyle={{ pointerEvents: "none" }} />
                <ReferenceLine x={0} stroke={c.grid} />
                <Bar dataKey="pnl" radius={[0, 3, 3, 0]}>
                  {stats.tradesBySetup.slice(0, 10).map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? SAGE_C : BRICK_C} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-stroke bg-card overflow-hidden shadow-deep">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke bg-tinted">
                  {[t("trades_col_setup"), t("trades"), copy.winRate, copy.totalPl, copy.avgR].map((h, i) => (
                    <th key={h} className={cn("py-2.5 px-4 text-[10px] font-medium uppercase tracking-wider text-ink-5", i === 0 ? "text-left" : "text-right")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke">
                {stats.tradesBySetup.map(s => (
                  <tr key={s.name} className="hover:bg-tinted/40 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-ink">{s.name === "No Setup" ? copy.noSetup : s.name}</td>
                    <td className="px-4 py-2.5 text-right text-ink-3">{s.trades}</td>
                    <td className="px-4 py-2.5 text-right font-medium" style={{ color: s.winRate >= 60 ? SAGE_C : s.winRate >= 50 ? AMBER : BRICK_C }}>{s.winRate}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold font-mono" style={{ color: s.pnl >= 0 ? SAGE_C : BRICK_C }}>{fmt(s.pnl)}</td>
                    <td className="px-4 py-2.5 text-right font-mono" style={{ color: s.avgR >= 1 ? SAGE_C : s.avgR >= 0 ? AMBER : BRICK_C }}>
                      {s.avgR >= 0 ? "+" : ""}{s.avgR}R
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Layers className="h-12 w-12 text-ink-4 mb-4" />
          <p className="text-sm text-ink-4">{t("reports_no_data")}</p>
        </div>
      )}
    </div>
  );

  if (!canUseTagBreakdown) return <PaywallCard feature="advanced_reports" blur>{content}</PaywallCard>;
  return content;
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB: Sessions
   ════════════════════════════════════════════════════════════════════════════ */
interface HeatmapCell { dow: number; dowLabel: string; hour: number; count: number; winRate: number; avgPnl: number }
const DOW_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function SessionsTab({ dark, canUseTimeHeatmap, range }: {
  dark: boolean; canUseTimeHeatmap: boolean; range: AnalyticsRange;
}) {
  const t = useT();
  const { lang } = useAppStore();
  const copy = useAnalyticsCopy(lang);
  const c = useChartTheme(dark);
  const { stats } = useStats(range.from, range.to);
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  const fetchHeatmap = useCallback(async () => {
    if (!canUseTimeHeatmap) return;
    setHeatmapLoading(true);
    try {
      const p = new URLSearchParams();
      if (range.from) p.set("from", range.from);
      if (range.to)   p.set("to",   range.to);
      const res = await fetch(`/api/trades/stats/heatmap?${p}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.cells) setHeatmapCells(data.cells);
    } finally { setHeatmapLoading(false); }
  }, [canUseTimeHeatmap, range.from, range.to]);

  useEffect(() => { fetchHeatmap(); }, [fetchHeatmap]);

  const cellMap = new Map<string, HeatmapCell>();
  heatmapCells.forEach(c => cellMap.set(`${c.dowLabel}:${c.hour}`, c));
  const maxAbsPnl = heatmapCells.length > 0 ? Math.max(...heatmapCells.map(c => Math.abs(c.avgPnl)), 1) : 1;

  const activeHours = heatmapCells.length > 0
    ? Array.from(new Set(heatmapCells.map(c => c.hour))).sort((a, b) => a - b)
    : Array.from({ length: 24 }, (_, i) => i);
  const minHour = activeHours[0] ?? 0;
  const maxHour = activeHours[activeHours.length - 1] ?? 23;
  const displayHours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  const tradesByHour = stats?.tradesByHour ?? [];
  const tradesByDay = stats?.tradesByDay ?? [];
  const avgHourPnl = tradesByHour.length > 0
    ? tradesByHour.reduce((s, h) => s + h.pnl, 0) / tradesByHour.length : 0;

  const content = (
    <div className="space-y-6">
      {tradesByHour.length > 0 ? (
        <>
          {/* By-hour bar */}
          <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader label={copy.byHour} plan="pro" />
              {avgHourPnl !== 0 && <span className="text-[10px] text-ink-5 -mt-4">avg {fmt(avgHourPnl, 0)}/hr</span>}
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={tradesByHour} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="2 4" stroke={c.grid} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false}
                  tickFormatter={h => `${String(h).padStart(2,"0")}h`} />
                <YAxis tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} width={48}
                  tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                <ReferenceLine y={0} stroke={c.grid} />
                {avgHourPnl !== 0 && <ReferenceLine y={avgHourPnl} stroke={AMBER} strokeDasharray="3 3" strokeOpacity={0.5} />}
                <Tooltip content={(p) => <ChartTooltip {...p} dark={dark} avgValue={avgHourPnl} />} wrapperStyle={{ pointerEvents: "none" }} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {tradesByHour.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? SAGE_C : BRICK_C} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* DOW × Hour heatmap */}
          <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
            <SectionHeader label={copy.dayHourHeatmap} plan="pro" />
            {heatmapLoading ? (
              <div className="py-8 text-center text-sm text-ink-5">{t("loading")}</div>
            ) : heatmapCells.length > 0 ? (
              <div className="overflow-x-auto -mx-2">
                <div className="inline-block min-w-max px-2">
                  <div className="flex ml-12 mb-1 gap-px">
                    {displayHours.map(h => (
                      <div key={h} className="w-7 text-center text-[8px] text-ink-5 shrink-0">
                        {h % 3 === 0 ? String(h).padStart(2,"0") : ""}
                      </div>
                    ))}
                  </div>
                  {DOW_ORDER.map(dow => (
                    <div key={dow} className="flex items-center gap-px mb-px">
                      <span className="w-12 text-[9px] text-ink-5 text-right pr-2 shrink-0">{dow}</span>
                      {displayHours.map(h => {
                        const cell = cellMap.get(`${dow}:${h}`);
                        if (!cell) return (
                          <div key={h} className="w-7 h-5 rounded-sm shrink-0"
                            style={{ backgroundColor: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)" }} />
                        );
                        const intensity = Math.min(Math.abs(cell.avgPnl) / maxAbsPnl, 1);
                        const isPos = cell.avgPnl >= 0;
                        return (
                          <div key={h} className="w-7 h-5 rounded-sm shrink-0 cursor-default hover:opacity-75 transition-opacity"
                            title={`${dow} ${String(h).padStart(2,"0")}:00 — avg ${fmt(cell.avgPnl)}, ${cell.winRate}% WR, ${cell.count} trades`}
                            style={{ backgroundColor: isPos
                              ? `rgba(123,175,138,${0.12 + intensity * 0.78})`
                              : `rgba(172,90,86,${0.12 + intensity * 0.78})` }}
                          />
                        );
                      })}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 mt-3 ml-12">
                    {[{ bg: "rgba(172,90,86,0.8)", label: copy.loss }, { bg: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)", label: copy.noData }, { bg: "rgba(123,175,138,0.8)", label: copy.win }].map(x => (
                      <div key={x.label} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: x.bg }} />
                        <span className="text-[9px] text-ink-5">{x.label}</span>
                      </div>
                    ))}
                    <span className="text-[9px] text-ink-5 ml-2">{copy.hoverDetails}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-5 text-center py-8">{t("common_no_data")}</p>
            )}
          </div>

          {/* Day-of-week summary table */}
          {tradesByDay.length > 0 && (
            <div className="rounded-2xl border border-stroke bg-card overflow-hidden shadow-deep">
              <div className="px-6 pt-5 pb-3"><p className={KL}>{copy.daySummary}</p></div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke bg-tinted">
                    {[copy.day, t("trades"), copy.winRate, copy.totalPl].map((h, i) => (
                      <th key={h} className={cn("py-2.5 px-4 text-[10px] font-medium uppercase tracking-wider text-ink-5", i === 0 ? "text-left" : "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke">
                  {tradesByDay.map(d => (
                    <tr key={d.day} className="hover:bg-tinted/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-ink">{d.day}</td>
                      <td className="px-4 py-2.5 text-right text-ink-3">{d.trades}</td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: d.winRate >= 60 ? SAGE_C : d.winRate >= 50 ? AMBER : BRICK_C }}>{d.winRate}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold font-mono" style={{ color: d.pnl >= 0 ? SAGE_C : BRICK_C }}>{fmt(d.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-12 w-12 text-ink-4 mb-4" />
          <p className="text-sm text-ink-4">{t("common_no_data")}</p>
        </div>
      )}
    </div>
  );

  if (!canUseTimeHeatmap) return <PaywallCard feature="time_heatmap" blur>{content}</PaywallCard>;
  return content;
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB: Psychology (Pro)
   ════════════════════════════════════════════════════════════════════════════ */
function PsychologyTab({ dark, canUseAdvancedReports, range }: {
  dark: boolean; canUseAdvancedReports: boolean; range: AnalyticsRange;
}) {
  const t = useT();
  const c = useChartTheme(dark);
  const { stats } = useStats(range.from, range.to);

  if (!stats) return <div className="py-16 text-center text-sm text-ink-5">{t("loading")}</div>;

  const hasEmotions = (stats.byEmotionalState?.length ?? 0) > 0;
  const hasRatings  = (stats.byRating?.length ?? 0) > 0;
  const maxRatingCount = Math.max(...(stats.byRating?.map(r => r.trades) ?? [1]));

  const content = (
    <div className="space-y-6">
      {/* Emotional state breakdown */}
      <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
        <SectionHeader label="Win rate by emotional state" plan="pro" />
        {hasEmotions ? (
          <>
            <ResponsiveContainer width="100%" height={Math.min(stats.byEmotionalState.length * 40 + 20, 260)}>
              <BarChart data={stats.byEmotionalState.slice(0, 8)} layout="vertical"
                margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={c.grid} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${v}%`} />
                <YAxis dataKey="state" type="category" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} width={90} />
                <ReferenceLine x={50} stroke={c.grid} strokeDasharray="4 4" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = stats.byEmotionalState.find(e => e.state === label);
                    return (
                      <div style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 10, padding: "10px 14px" }}>
                        <p style={{ color: c.axis, fontSize: 11, marginBottom: 4 }}>{label}</p>
                        <p style={{ color: (payload[0].value as number) >= 50 ? SAGE_C : BRICK_C, fontSize: 14, fontWeight: 700 }}>{payload[0].value}% WR</p>
                        {row && <p style={{ color: c.axis, fontSize: 10, marginTop: 3 }}>{row.trades} trades · {fmt(row.pnl)}</p>}
                      </div>
                    );
                  }}
                  wrapperStyle={{ pointerEvents: "none" }}
                />
                <Bar dataKey="winRate" radius={[0, 3, 3, 0]}>
                  {stats.byEmotionalState.slice(0, 8).map((d, i) => (
                    <Cell key={i} fill={d.winRate >= 50 ? SAGE_C : BRICK_C} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 rounded-2xl border border-stroke bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke bg-tinted">
                    {["State", t("trades"), "Win Rate", "Total P/L"].map((h, i) => (
                      <th key={h} className={cn("py-2.5 px-4 text-[10px] font-medium uppercase tracking-wider text-ink-5", i === 0 ? "text-left" : "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke">
                  {stats.byEmotionalState.map(e => (
                    <tr key={e.state} className="hover:bg-tinted/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-ink capitalize">{e.state}</td>
                      <td className="px-4 py-2.5 text-right text-ink-3">{e.trades}</td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: e.winRate >= 60 ? SAGE_C : e.winRate >= 50 ? AMBER : BRICK_C }}>{e.winRate}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold font-mono" style={{ color: e.pnl >= 0 ? SAGE_C : BRICK_C }}>{fmt(e.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-tinted border border-stroke p-8 text-center">
            <Brain className="h-8 w-8 text-ink-4 mx-auto mb-3" />
            <p className="text-sm text-ink-4">No emotional state data yet. Add how you felt when logging trades.</p>
          </div>
        )}
      </div>

      {/* Rating distribution */}
      <div className="rounded-2xl border border-stroke bg-card p-6 shadow-deep">
        <SectionHeader label="Trade quality — rating distribution" plan="pro" />
        {hasRatings ? (
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map(r => {
              const row = stats.byRating.find(b => b.rating === r);
              const count = row?.trades ?? 0;
              const pct = Math.round((count / maxRatingCount) * 100);
              return (
                <div key={r} className="flex items-center gap-3">
                  <div className="flex items-center gap-0.5 w-20 shrink-0">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="h-2.5 w-2.5" fill={i < r ? AMBER : "transparent"}
                        style={{ color: i < r ? AMBER : c.axis }} />
                    ))}
                  </div>
                  <div className="flex-1 h-4 rounded-sm bg-tinted overflow-hidden">
                    <div className="h-full rounded-sm transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: AMBER, opacity: 0.4 + (r / 5) * 0.5 }}
                    />
                  </div>
                  <span className="text-xs font-mono text-ink-4 w-12 text-right">{count} trades</span>
                  {row && <span className="text-xs font-mono w-14 text-right" style={{ color: row.pnl >= 0 ? SAGE_C : BRICK_C }}>{fmt(row.pnl, 0)}</span>}
                </div>
              );
            })}
            {hasRatings && (
              <p className="text-[10px] text-ink-5 mt-2 pt-3 border-t border-stroke">
                {(() => {
                  const high = stats.byRating.filter(r => r.rating >= 4);
                  const low  = stats.byRating.filter(r => r.rating <= 2);
                  const highPnl = high.reduce((s, r) => s + r.pnl, 0);
                  const lowPnl  = low.reduce((s, r)  => s + r.pnl, 0);
                  if (high.length > 0 && low.length > 0) {
                    return `High-rated trades (4-5★): ${fmt(highPnl, 0)} · Low-rated (1-2★): ${fmt(lowPnl, 0)}`;
                  }
                  return "";
                })()}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-tinted border border-stroke p-8 text-center">
            <Star className="h-8 w-8 text-ink-4 mx-auto mb-3" />
            <p className="text-sm text-ink-4">No rated trades yet. Add a 1–5 star rating when logging trades.</p>
          </div>
        )}
      </div>

      {/* No data state */}
      {!hasEmotions && !hasRatings && stats.totalTrades > 0 && (
        <div className="rounded-2xl border border-dashed border-stroke p-8 text-center">
          <p className="text-sm text-ink-4 max-w-sm mx-auto">
            Psychology data appears here once you add emotional state and ratings to your trades.
            Go to Trades, open any trade, and fill in the Psychology section.
          </p>
        </div>
      )}
    </div>
  );

  if (!canUseAdvancedReports) return <PaywallCard feature="advanced_reports" blur>{content}</PaywallCard>;
  return content;
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const { darkMode, lang } = useAppStore();
  const copy = useAnalyticsCopy(lang);
  const [activeTab, setActiveTab] = useState("overview");
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [rangeMode, setRangeMode] = useState<"7d" | "30d" | "all" | "custom">("30d");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return dayInputValue(d);
  });
  const [customTo, setCustomTo] = useState(() => dayInputValue(new Date()));

  useEffect(() => {
    fetch("/api/me/entitlements")
      .then((r) => safeJson<Entitlements>(r))
      .then((data) => setEntitlements(data))
      .catch(() => setEntitlements(null));
  }, []);

  const caps = entitlements?.capabilities;
  const plan = entitlements?.plan ?? "free";
  const canUseCustomDateRange  = caps?.canUseCustomDateRange  ?? false;
  const canUseTagBreakdown     = caps?.canUseTagBreakdown     ?? false;
  const canUseTimeHeatmap      = caps?.canUseTimeHeatmap      ?? false;
  const canUseAdvancedReports  = caps?.canUseAdvancedReports  ?? false;
  const canUseAiTradeReview    = caps?.canUseAiTradeReview    ?? false;

  const isFree = plan === "free";
  // Free gets a useful 30-day window. Pro/Team unlock all history and custom ranges.
  const lockedRange = (isFree || !canUseCustomDateRange) && (rangeMode === "all" || rangeMode === "custom");
  const last7  = new Date(); last7.setDate(last7.getDate() - 7);
  const last30 = new Date(); last30.setDate(last30.getDate() - 30);
  const effectiveRange: AnalyticsRange = lockedRange
    ? { from: dayInputValue(last30) }
    : rangeMode === "7d"     ? { from: dayInputValue(last7) }
    : rangeMode === "30d"    ? { from: dayInputValue(last30) }
    : rangeMode === "custom" ? { from: customFrom, to: customTo }
    : {};

  const tabs = [
    { id: "overview",    label: copy.overview,     icon: BarChart2,  gated: false },
    { id: "performance", label: copy.performance,  icon: TrendingUp, gated: false },
    { id: "setups",      label: copy.setups,       icon: Layers,     gated: !canUseTagBreakdown },
    { id: "sessions",    label: copy.sessions,     icon: Clock,      gated: !canUseTimeHeatmap },
  ];

  const planColor = plan === "free" ? undefined : plan === "pro" ? "var(--color-brand)" : "#6366F1";
  const planBg    = plan === "free" ? undefined : plan === "pro" ? "rgba(240,114,64,0.12)" : "rgba(99,102,241,0.12)";
  const planLabel = plan === "pro" ? "Pro" : plan === "team" ? "Team" : null;

  const now = new Date();
  const issueLabel = lang === "ru"
    ? `${copy.analytics} · ${now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}`
    : `Analytics · ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

  return (
    <div className="-mx-6 -mt-6 page-enter">
      {/* Masthead */}
      <div className="px-6 md:px-10 pt-10 pb-6 border-b border-stroke">
        <div className="flex items-center gap-3">
          <p className="editorial-label">{issueLabel}</p>
          {planLabel && (
            <span className="chip text-[9px]" style={{ background: planBg, color: planColor, padding: "2px 8px" }}>
              {planLabel}
            </span>
          )}
        </div>
        <h1 className="font-serif text-[48px] md:text-[64px] leading-[0.98] tracking-[-0.03em] font-bold mt-3">
          {copy.analytics}<span className="text-brand">.</span>
        </h1>

        {/* Tabs */}
        <div className="mt-6 rounded-lg border border-stroke bg-card p-0.5 inline-flex items-center text-[11px] overflow-x-auto max-w-full gap-px">
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap transition-colors rounded-md",
                  isActive ? "bg-lift font-semibold text-ink" : "text-ink-3 hover:text-ink")}>
                <TabIcon className="h-3 w-3 shrink-0" />
                {tab.label}
                {tab.gated && (
                  <span className="chip text-[7px] ml-0.5" style={{ background: "rgba(240,114,64,0.12)", color: "var(--color-brand)", padding: "1px 5px" }}>
                    PRO
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Range selector */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-stroke bg-card p-0.5 gap-0.5 text-[11px]">
            {[
              { id: "7d",     label: copy.range7d,    locked: false },
              { id: "30d",    label: copy.range30d,   locked: false },
              { id: "all",    label: copy.allHistory, locked: isFree || !canUseCustomDateRange },
              { id: "custom", label: copy.custom,     locked: isFree || !canUseCustomDateRange },
            ].map(item => (
              <button key={item.id} onClick={() => setRangeMode(item.id as "7d" | "30d" | "all" | "custom")}
                className={cn("rounded-md px-3 py-1.5 font-medium transition-colors flex items-center gap-1",
                  rangeMode === item.id ? "bg-lift text-ink" : "text-ink-4 hover:text-ink-2")}>
                {item.label}
                {item.locked && (
                  <span className="chip text-[7px]" style={{ background: "rgba(240,114,64,0.12)", color: "var(--color-brand)", padding: "1px 4px" }}>PRO</span>
                )}
              </button>
            ))}
          </div>

          {rangeMode === "custom" && !lockedRange && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-8 rounded-lg border border-stroke bg-card px-2.5 text-[12px] text-ink outline-none focus:border-brand" />
              <span className="text-[11px] text-ink-5">{copy.to}</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-8 rounded-lg border border-stroke bg-card px-2.5 text-[12px] text-ink outline-none focus:border-brand" />
            </div>
          )}
        </div>

        {lockedRange && (
          <div className="mt-4 max-w-xl">
            <PaywallCard feature="custom_date_range" inline />
          </div>
        )}

        {plan === "free" && (
          <p className="mt-3 text-[10px] text-ink-5">
            {copy.freeUnlocks}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="px-6 md:px-10 py-8">
        <div key={activeTab} className="anim-fade-up">
          {activeTab === "overview"    && <OverviewTab    dark={darkMode} range={effectiveRange} canUseAiTradeReview={canUseAiTradeReview} />}
          {activeTab === "performance" && <PerformanceTab dark={darkMode} range={effectiveRange} />}
          {activeTab === "setups"      && <SetupsTab      dark={darkMode} canUseTagBreakdown={canUseTagBreakdown} range={effectiveRange} />}
          {activeTab === "sessions"    && <SessionsTab    dark={darkMode} canUseTimeHeatmap={canUseTimeHeatmap} range={effectiveRange} />}
          {activeTab === "psychology"  && <PsychologyTab  dark={darkMode} canUseAdvancedReports={canUseAdvancedReports} range={effectiveRange} />}
        </div>

      </div>
    </div>
  );
}
