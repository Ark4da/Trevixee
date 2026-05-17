"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { computeResult, type BacktestTrade } from "@/lib/backtest";
import { GradientAreaChart } from "@/components/ui/gradient-area-chart";
import { useAppStore } from "@/store";
import { ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ReferenceLine,
} from "recharts";

const SAGE    = "#22C55E";
const BRICK   = "#EF4444";
const SAGE_C  = "#7BAF8A";
const BRICK_C = "#AC5A56";
const AMBER   = "#B08050";
const KL = "text-[10px] uppercase tracking-widest text-ink-5 font-medium";

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n >= 0 ? "+" : "-") + "$" + abs;
}

function fmtShort(n: number) {
  if (Math.abs(n) >= 1000) return `${n >= 0 ? "+" : "-"}$${(Math.abs(n) / 1000).toFixed(1)}k`;
  return fmt(n);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, dark }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value as number;
  const colors = dark
    ? { bg: "#1A1810", border: "#302C1E" }
    : { bg: "#FEFCF9", border: "#D9D2C7" };
  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: v >= 0 ? SAGE_C : BRICK_C, fontWeight: 700 }}>{fmt(v)}</p>
    </div>
  );
}

interface PlaybookBacktestTabProps {
  playbookId: string;
  playbookName: string;
  playbookMarket: string;
  playbookTags?: string | null;
}

export function PlaybookBacktestTab({ playbookId, playbookName, playbookMarket, playbookTags }: PlaybookBacktestTabProps) {
  const { darkMode } = useAppStore();
  const router = useRouter();
  const [allTrades, setAllTrades] = useState<BacktestTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "trades" | "calendar">("overview");

  // Filters
  const [market, setMarket] = useState(playbookMarket !== "all" ? playbookMarket : "all");
  const [side, setSide] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trades?limit=2000&status=closed");
      const data = await res.json();
      setAllTrades(data.trades || []);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const playbookTagList = useMemo(
    () => (playbookTags || "").split(",").map(t => t.trim().toLowerCase()).filter(Boolean),
    [playbookTags]
  );

  // Match stats for debug hint
  const matchCounts = useMemo(() => {
    let byId = 0, bySetup = 0, byTag = 0;
    allTrades.forEach(tr => {
      if (tr.playbookId === playbookId) { byId++; return; }
      if (!!tr.setup && tr.setup.toLowerCase() === playbookName.toLowerCase()) { bySetup++; return; }
      // Exact tag match only — split trade tags and check each against playbook tag list
      const tradeTags = (tr.tags || "").split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
      if (playbookTagList.length > 0 && playbookTagList.some(tag => tradeTags.includes(tag))) byTag++;
    });
    return { byId, bySetup, byTag };
  }, [allTrades, playbookId, playbookName, playbookTagList]);

  const filtered = useMemo(() => {
    return allTrades.filter(tr => {
      if (market !== "all" && tr.market !== market) return false;
      if (side !== "all" && tr.side !== side) return false;
      if (from && tr.entryDate < from) return false;
      if (to && tr.entryDate > to) return false;
      const idMatch = tr.playbookId === playbookId;
      const setupMatch = !!tr.setup && tr.setup.toLowerCase() === playbookName.toLowerCase();
      // Exact tag match — split by comma, compare each tag exactly (no substring!)
      const tradeTags = (tr.tags || "").split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
      const tagMatch = playbookTagList.length > 0 && playbookTagList.some(tag => tradeTags.includes(tag));
      return idMatch || setupMatch || tagMatch;
    });
  }, [allTrades, market, side, from, to, playbookId, playbookName, playbookTagList]);

  const result = useMemo(() => computeResult(filtered), [filtered]);

  const axisColor = darkMode ? "#6A6355" : "#B5ADA3";
  const gridColor = darkMode ? "#302C1E" : "#E9E3D9";
  const pfDisplay = !isFinite(result.profitFactor ?? NaN) ? "∞" : result.profitFactor!.toFixed(2);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 rounded-lg bg-tinted" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-tinted" />)}
        </div>
        <div className="h-48 rounded-xl bg-tinted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-ink-4">
            Бэктест стратегии <span className="font-semibold text-ink">«{playbookName}»</span>
          </p>
          <p className="text-[11px] text-ink-5 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              {matchCounts.byId > 0 && <span className="text-brand/80">{matchCounts.byId} по ID</span>}
              {matchCounts.byId > 0 && (matchCounts.bySetup > 0 || matchCounts.byTag > 0) && <span className="mx-1">·</span>}
              {matchCounts.bySetup > 0 && <span className="text-ink-4">{matchCounts.bySetup} по сетапу</span>}
              {matchCounts.bySetup > 0 && matchCounts.byTag > 0 && <span className="mx-1">·</span>}
              {matchCounts.byTag > 0 && <span className="text-ink-4">{matchCounts.byTag} по тегам</span>}
              {matchCounts.byId === 0 && matchCounts.bySetup === 0 && matchCounts.byTag === 0 && (
                <span className="text-ink-5">сделки не привязаны</span>
              )}
            </span>
            <Link href="/backtesting" className="text-brand hover:underline inline-flex items-center gap-0.5">
              Полный бэктест <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <button
          onClick={fetchTrades}
          className="flex items-center gap-1.5 rounded-lg border border-stroke-2 px-3 py-1.5 text-xs text-ink-4 hover:text-ink transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Обновить
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={market} onChange={e => setMarket(e.target.value)}
          className="h-8 rounded-lg border border-stroke-2 bg-tinted px-2 text-xs text-ink focus:border-brand focus:outline-none">
          <option value="all">Все рынки</option>
          <option value="futures">Futures</option>
          <option value="forex">Forex</option>
          <option value="stocks">Stocks</option>
          <option value="crypto">Crypto</option>
          <option value="options">Options</option>
        </select>
        <select value={side} onChange={e => setSide(e.target.value)}
          className="h-8 rounded-lg border border-stroke-2 bg-tinted px-2 text-xs text-ink focus:border-brand focus:outline-none">
          <option value="all">Long + Short</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="h-8 rounded-lg border border-stroke-2 bg-tinted px-2 text-xs text-ink focus:border-brand focus:outline-none" />
        <span className="text-ink-5 text-xs">—</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="h-8 rounded-lg border border-stroke-2 bg-tinted px-2 text-xs text-ink focus:border-brand focus:outline-none" />
        {(from || to || side !== "all" || market !== (playbookMarket !== "all" ? playbookMarket : "all")) && (
          <button onClick={() => { setMarket(playbookMarket !== "all" ? playbookMarket : "all"); setSide("all"); setFrom(""); setTo(""); }}
            className="text-xs text-ink-5 hover:text-brand transition-colors">сбросить</button>
        )}
      </div>

      {/* Empty state */}
      {result.totalTrades === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center border border-stroke-2 border-dashed rounded-xl">
          <p className="text-ink-4 text-sm mb-1">Нет закрытых сделок для этой стратегии</p>
          <p className="text-ink-5 text-xs">Добавляй сделки с полем «Сетап» = <span className="font-mono text-brand">«{playbookName}»</span> или привязывай плейбук при создании сделки</p>
          <Link href="/trades" className="mt-3 text-xs text-brand hover:underline">Добавить сделку →</Link>
        </div>
      ) : (
        <>
          {/* ── KPI tiles ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Сделок", value: String(result.totalTrades), sub: `${result.wins}W / ${result.losses}L` },
              { label: "Win Rate", value: `${result.winRate}%`, color: result.winRate >= 50 ? SAGE : BRICK },
              { label: "Net P&L", value: fmtShort(result.netPnl), color: result.netPnl >= 0 ? SAGE : BRICK },
              { label: "Profit Factor", value: pfDisplay, color: (result.profitFactor ?? 0) >= 1.5 ? SAGE : BRICK },
              { label: "Avg R", value: `${result.avgRMultiple.toFixed(2)}R`, color: result.avgRMultiple >= 0 ? SAGE : BRICK },
              { label: "Expectancy", value: fmtShort(result.expectancy), color: result.expectancy >= 0 ? SAGE : BRICK },
              { label: "Max Drawdown", value: result.maxDrawdown > 0 ? `−$${result.maxDrawdown.toFixed(0)}` : "$0", color: result.maxDrawdown > 0 ? BRICK : undefined },
              { label: "Recovery Factor", value: result.recoveryFactor > 0 ? result.recoveryFactor.toFixed(2) : "—", color: result.recoveryFactor >= 2 ? SAGE : result.recoveryFactor >= 1 ? AMBER : BRICK_C },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="rounded-xl border border-stroke bg-card p-3">
                <p className={KL}>{label}</p>
                <p className="text-lg font-bold font-mono mt-1 tnum" style={{ color: color || undefined }}>{value}</p>
                {sub && <p className="text-[10px] text-ink-5 mt-0.5 font-mono">{sub}</p>}
              </div>
            ))}
          </div>

          {/* ── Secondary metrics row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Sharpe Ratio", value: result.sharpeRatio !== 0 ? result.sharpeRatio.toFixed(2) : "—", color: result.sharpeRatio >= 1 ? SAGE_C : result.sharpeRatio >= 0 ? AMBER : BRICK_C },
              { label: "Sortino", value: result.sortino !== 0 ? result.sortino.toFixed(2) : "—", color: result.sortino >= 1.5 ? SAGE_C : result.sortino >= 0 ? AMBER : BRICK_C },
              { label: "Лучший день", value: result.bestDay !== 0 ? fmtShort(result.bestDay) : "—", color: SAGE_C },
              { label: "Худший день", value: result.worstDay !== 0 ? fmtShort(result.worstDay) : "—", color: BRICK_C },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-stroke bg-card p-3">
                <p className={KL}>{label}</p>
                <p className="text-sm font-bold font-mono mt-1 tnum" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="rounded-xl border border-stroke bg-card overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-stroke bg-tinted/50">
              {(["overview", "trades", "calendar"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px",
                    activeTab === tab
                      ? "border-brand text-brand"
                      : "border-transparent text-ink-4 hover:text-ink"
                  )}
                >
                  {tab === "overview" ? "Графики" : tab === "trades" ? "Сделки" : "Календарь"}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-5">
              {/* ═══ OVERVIEW TAB ═══ */}
              {activeTab === "overview" && (
                <>
                  {/* ── 1. Equity Curve ── */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <p className={KL}>Кривая капитала (Equity Curve)</p>
                      <span className="text-[10px] text-ink-5">накопленный P&L по дням</span>
                    </div>
                    <p className="text-[11px] text-ink-4 mb-3">
                      Показывает, как растёт или падает суммарный P&L со временем.
                      Зелёная область — прибыль выше нуля, красная — убыток.
                    </p>
                    {result.equityCurve.length > 1 ? (
                      <GradientAreaChart
                        data={result.equityCurve.map(d => ({
                          label: d.dateLabel,
                          value: d.pnl,
                          trades: d.trades,
                          wins: d.wins,
                          losses: d.losses,
                        }))}
                        dark={darkMode}
                        height={220}
                        tooltipFormatter={(v) => `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`}
                      />
                    ) : (
                      <div className="h-32 flex items-center justify-center text-ink-5 text-sm border border-stroke-2 border-dashed rounded-lg">
                        Нужно минимум 2 дня с закрытыми сделками
                      </div>
                    )}
                  </div>

                  {/* ── 2. Drawdown ── */}
                  {result.equityCurve.length > 1 && (
                    <div className="pt-5 border-t border-stroke">
                      <div className="flex items-baseline justify-between mb-1">
                        <p className={KL}>Просадка (Drawdown)</p>
                        <span className="text-[10px] text-ink-5">глубина от пика</span>
                      </div>
                      <p className="text-[11px] text-ink-4 mb-3">
                        Насколько P&L опустился ниже предыдущего максимума. Чем длиннее и глубже красный бар — тем хуже период стратегии.
                        Нулевая просадка = нет баров.
                      </p>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart
                          data={result.equityCurve.filter(d => d.date !== "0000-00-00")}
                          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                          barCategoryGap="12%"
                        >
                          <CartesianGrid strokeDasharray="2 6" stroke={gridColor} vertical={false} />
                          <XAxis dataKey="dateLabel" stroke="transparent"
                            tick={{ fontSize: 9, fill: axisColor }} tickLine={false} axisLine={false}
                            interval="preserveStartEnd" />
                          <YAxis stroke="transparent"
                            tick={{ fontSize: 9, fill: axisColor }} tickLine={false} axisLine={false} width={50}
                            tickFormatter={v => v === 0 ? "$0" : `-$${Math.abs(v) >= 1000 ? `${(Math.abs(v)/1000).toFixed(1)}k` : Math.abs(v).toFixed(0)}`} />
                          <ReferenceLine y={0} stroke={axisColor} strokeOpacity={0.3} strokeDasharray="3 5" />
                          <Tooltip
                            cursor={{ fill: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0]?.payload;
                              const v = d?.chartDrawdown ?? 0;
                              if (v === 0) return null;
                              return (
                                <div style={{
                                  background: darkMode ? "#1A1810" : "#FEFCF9",
                                  border: `1px solid ${darkMode ? "#302C1E" : "#D9D2C7"}`,
                                  borderRadius: 8, padding: "8px 12px", fontSize: 12,
                                }}>
                                  <p style={{ color: axisColor, fontSize: 10, marginBottom: 4 }}>{d?.dateLabel}</p>
                                  <p style={{ color: BRICK_C, fontWeight: 700 }}>
                                    Просадка: −${Math.abs(v).toFixed(2)}
                                  </p>
                                  <p style={{ color: axisColor, fontSize: 10, marginTop: 2 }}>
                                    от пика ${d?.chartHigh?.toFixed(2)}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="chartDrawdown" radius={[2, 2, 0, 0]} maxBarSize={24}>
                            {result.equityCurve.filter(d => d.date !== "0000-00-00").map((d, i) => (
                              <Cell key={i} fill={BRICK_C} fillOpacity={d.chartDrawdown < 0 ? 0.75 : 0} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* ── 3. Trade-by-trade P&L ── */}
                  {result.tradePnlSeries.length > 0 && (
                    <div className="pt-5 border-t border-stroke">
                      <div className="flex items-baseline justify-between mb-1">
                        <p className={KL}>P&L по каждой сделке</p>
                        <span className="text-[10px] text-ink-5">
                          {result.tradePnlSeries.length > 60
                            ? `последние 60 из ${result.tradePnlSeries.length}`
                            : `${result.tradePnlSeries.length} сделок`}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-4 mb-3">
                        Каждый столбик = одна сделка в хронологическом порядке.
                        <span style={{ color: SAGE_C }}> Зелёный</span> — прибыль,
                        <span style={{ color: BRICK_C }}> красный</span> — убыток.
                        Высота = размер P&L.
                      </p>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart
                          data={result.tradePnlSeries.slice(-60)}
                          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                          barCategoryGap="8%"
                        >
                          <CartesianGrid strokeDasharray="2 6" stroke={gridColor} vertical={false} />
                          <YAxis stroke="transparent"
                            tick={{ fontSize: 9, fill: axisColor }} tickLine={false} axisLine={false} width={50}
                            tickFormatter={v => `${v >= 0 ? "+" : "-"}$${Math.abs(v) >= 1000 ? `${(Math.abs(v)/1000).toFixed(1)}k` : Math.abs(v).toFixed(0)}`} />
                          <ReferenceLine y={0} stroke={axisColor} strokeOpacity={0.4} strokeDasharray="3 5" />
                          <Tooltip
                            cursor={{ fill: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0]?.payload;
                              return (
                                <div style={{
                                  background: darkMode ? "#1A1810" : "#FEFCF9",
                                  border: `1px solid ${darkMode ? "#302C1E" : "#D9D2C7"}`,
                                  borderRadius: 8, padding: "8px 12px", fontSize: 12,
                                }}>
                                  <p style={{ color: axisColor, fontSize: 10, marginBottom: 4 }}>
                                    {d?.symbol} · {d?.date}
                                  </p>
                                  <p style={{ color: d?.win ? SAGE_C : BRICK_C, fontWeight: 700 }}>
                                    {d?.pnl >= 0 ? "+" : ""}${Math.abs(d?.pnl ?? 0).toFixed(2)}
                                  </p>
                                  <p style={{ color: axisColor, fontSize: 10, marginTop: 2 }}>
                                    Сделка #{(d?.idx ?? 0) + 1}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={20}>
                            {result.tradePnlSeries.slice(-60).map((d, i) => (
                              <Cell key={i} fill={d.win ? SAGE_C : BRICK_C} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* ── 4. P&L by symbol ── */}
                  {result.bySymbol.length > 0 && (
                    <div className="pt-5 border-t border-stroke">
                      <div className="flex items-baseline justify-between mb-1">
                        <p className={KL}>P&L по инструментам</p>
                        <span className="text-[10px] text-ink-5">топ {result.bySymbol.length}</span>
                      </div>
                      <p className="text-[11px] text-ink-4 mb-3">
                        Суммарный P&L по каждому инструменту. Показывает, где стратегия работает лучше всего.
                      </p>
                      <div style={{ height: Math.max(120, result.bySymbol.length * 32) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={result.bySymbol} layout="vertical" margin={{ left: 4, right: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                            <XAxis type="number" tick={{ fill: axisColor, fontSize: 9 }}
                              tickFormatter={v => `${v >= 0 ? "+" : "-"}$${Math.abs(v) >= 1000 ? `${(Math.abs(v)/1000).toFixed(1)}k` : Math.abs(v).toFixed(0)}`} />
                            <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} width={60} />
                            <ReferenceLine x={0} stroke={axisColor} strokeOpacity={0.3} />
                            <Tooltip
                              cursor={{ fill: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                  <div style={{
                                    background: darkMode ? "#1A1810" : "#FEFCF9",
                                    border: `1px solid ${darkMode ? "#302C1E" : "#D9D2C7"}`,
                                    borderRadius: 8, padding: "8px 12px", fontSize: 12,
                                  }}>
                                    <p style={{ color: axisColor, fontSize: 10, marginBottom: 4 }}>{d?.name}</p>
                                    <p style={{ color: (d?.pnl ?? 0) >= 0 ? SAGE_C : BRICK_C, fontWeight: 700 }}>
                                      {(d?.pnl ?? 0) >= 0 ? "+" : ""}${Math.abs(d?.pnl ?? 0).toFixed(2)}
                                    </p>
                                    <p style={{ color: axisColor, fontSize: 10, marginTop: 2 }}>
                                      {d?.trades} сделок · {d?.winRate}% WR
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                              {result.bySymbol.map((s, i) => (
                                <Cell key={i} fill={s.pnl >= 0 ? SAGE_C : BRICK_C} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ TRADES TAB ═══ */}
              {activeTab === "trades" && (
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="border-b border-stroke bg-tinted/50">
                        {["Дата", "Символ", "Сторона", "Сетап", "P&L", "R"].map((h, i) => (
                          <th key={h} className={cn(
                            "py-2 px-3 text-[10px] font-medium uppercase tracking-wider text-ink-5",
                            i === 0 ? "pl-4 text-left" : i >= 4 ? "text-right" : "text-left"
                          )}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stroke">
                      {[...filtered]
                        .filter(t => t.status === "closed")
                        .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
                        .map(tr => (
                          <tr key={tr.id}
                            onClick={() => router.push(`/trades/${tr.id}`)}
                            className="hover:bg-tinted/40 transition-colors cursor-pointer">
                            <td className="px-3 py-2.5 pl-4 text-xs text-ink-4 whitespace-nowrap">
                              {new Date(tr.entryDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-ink">{tr.symbol}</td>
                            <td className="px-3 py-2.5">
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                                style={{ background: `${tr.side === "long" ? SAGE_C : BRICK_C}22`, color: tr.side === "long" ? SAGE_C : BRICK_C }}>
                                {tr.side.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-ink-4">{tr.setup || "—"}</td>
                            <td className="px-3 py-2.5 text-right font-semibold font-mono text-sm"
                              style={{ color: tr.netPnl >= 0 ? SAGE_C : BRICK_C }}>
                              {fmt(tr.netPnl)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-mono"
                              style={{ color: tr.rMultiple >= 0 ? SAGE_C : BRICK_C }}>
                              {tr.rMultiple !== 0 ? `${tr.rMultiple.toFixed(2)}R` : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ═══ CALENDAR TAB ═══ */}
              {activeTab === "calendar" && (
                <div className="space-y-4">
                  <p className={KL}>Monthly P&L Calendar</p>
                  {result.monthlyPnl.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-ink-5 text-sm">Нет данных</div>
                  ) : (
                    <>
                      {/* Calendar grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {result.monthlyPnl.map(m => {
                          const maxAbs = Math.max(...result.monthlyPnl.map(x => Math.abs(x.pnl)), 1);
                          const intensity = Math.min(Math.abs(m.pnl) / maxAbs, 1);
                          const bg = m.pnl >= 0
                            ? `rgba(34,197,94,${0.08 + intensity * 0.35})`
                            : `rgba(239,68,68,${0.08 + intensity * 0.35})`;
                          const textColor = m.pnl >= 0 ? SAGE : BRICK;
                          return (
                            <div key={m.month}
                              className="rounded-lg border border-stroke p-2.5 text-center"
                              style={{ background: bg }}>
                              <p className="text-[10px] text-ink-5 font-medium uppercase tracking-wide">{m.label}</p>
                              <p className="text-sm font-bold font-mono mt-1 tnum" style={{ color: textColor }}>
                                {m.pnl >= 0 ? "+" : ""}${Math.abs(m.pnl) >= 1000 ? `${(Math.abs(m.pnl)/1000).toFixed(1)}k` : m.pnl.toFixed(0)}
                              </p>
                              <p className="text-[9px] text-ink-5 mt-0.5">{m.trades} сд.</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Monthly bar chart */}
                      <div className="pt-2">
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={result.monthlyPnl} margin={{ top: 4, right: 4, left: 0, bottom: 20 }} barCategoryGap="25%">
                            <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                            <XAxis dataKey="label" stroke="transparent"
                              tick={{ fontSize: 9, fill: axisColor }} tickLine={false} axisLine={false}
                              angle={-35} textAnchor="end" interval={0} />
                            <YAxis stroke="transparent"
                              tick={{ fontSize: 9, fill: axisColor }} tickLine={false} axisLine={false} width={48}
                              tickFormatter={v => `${v >= 0 ? "+" : "-"}$${Math.abs(v) >= 1000 ? `${(Math.abs(v)/1000).toFixed(1)}k` : Math.abs(v).toFixed(0)}`} />
                            <Tooltip content={(props) => <ChartTooltip {...props} dark={darkMode} />}
                              cursor={{ fill: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }} />
                            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                              {result.monthlyPnl.map((m, i) => (
                                <Cell key={i} fill={m.pnl >= 0 ? SAGE_C : BRICK_C} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Monthly table */}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-stroke">
                            {["Месяц", "Сделок", "P&L"].map((h, i) => (
                              <th key={h} className={cn("py-1.5 px-2 text-[10px] font-medium uppercase tracking-wider text-ink-5", i > 0 ? "text-right" : "text-left")}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stroke">
                          {[...result.monthlyPnl].reverse().map(m => (
                            <tr key={m.month} className="hover:bg-tinted/30 transition-colors">
                              <td className="px-2 py-2 font-medium text-ink">{m.label}</td>
                              <td className="px-2 py-2 text-right text-ink-4">{m.trades}</td>
                              <td className="px-2 py-2 text-right font-semibold font-mono"
                                style={{ color: m.pnl >= 0 ? SAGE_C : BRICK_C }}>
                                {fmt(m.pnl)}
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

          {/* Bottom summary strip */}
          <div className="rounded-xl border border-stroke bg-card px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className={KL}>Победы / Пораж.</p>
              <p className="mt-1 text-sm font-bold font-mono">
                <span style={{ color: SAGE_C }}>{result.wins}W</span>
                <span className="text-ink-5 mx-1">·</span>
                <span style={{ color: BRICK_C }}>{result.losses}L</span>
              </p>
            </div>
            <div>
              <p className={KL}>Серия побед</p>
              <p className="mt-1 text-sm font-bold font-mono" style={{ color: SAGE_C }}>
                {result.maxConsecWins} подряд
              </p>
            </div>
            <div>
              <p className={KL}>Серия пораж.</p>
              <p className="mt-1 text-sm font-bold font-mono" style={{ color: BRICK_C }}>
                {result.maxConsecLosses} подряд
              </p>
            </div>
            <div>
              <p className={KL}>Комиссии</p>
              <p className="mt-1 text-sm font-bold font-mono" style={{ color: AMBER }}>
                {result.totalFees > 0
                  ? `−$${result.totalFees.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                  : "—"}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
