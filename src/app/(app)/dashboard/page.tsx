"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { parseDayKey, toLocalDayKey } from "@/lib/date";
import { useStats } from "@/hooks/use-trades";
import { useAppStore } from "@/store";
import { useT } from "@/lib/useT";
import { type TKey } from "@/lib/i18n";
import { Portal } from "@/components/ui/portal";
import { getNumericMetric, getPayloadPoint } from "@/lib/chart-metrics";
import {
  BarChart3, AlertTriangle, ChevronLeft, ChevronRight, BookOpen, Shield,
  X, Star, Image as ImageIcon, FileText, CheckCircle, XCircle, ChevronDown,
  Pin, Lightbulb, TrendingDown, Check, Settings2, DollarSign, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { GradientAreaChart } from "@/components/ui/gradient-area-chart";
import { useToast } from "@/components/ui/toast";

// ── Muted palette — Institutional Matte ─────────────────────────────────────
const SAGE    = "#22C55E";   // high-contrast green: profit text
const BRICK  = "#EF4444";   // high-contrast red:  loss text
const SAGE_C  = "#7BAF8A";   // chart arcs / bars (muted)
const BRICK_C = "#AC5A56";   // chart arcs / bars (muted)

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n >= 0
    ? `+$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : `-$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function getTradesLoggedLabel(n: number, lang: "en" | "ru", t: (key: TKey, vars?: Record<string, string | number>) => string) {
  if (lang === "ru") {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const key =
      mod10 === 1 && mod100 !== 11 ? "dash_trades_logged_one" :
      mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "dash_trades_logged_few" :
      "dash_trades_logged_many";
    return t(key, { n });
  }
  return t(n === 1 ? "dash_trades_logged_one" : "dash_trades_logged_many", { n });
}

function useChartTheme(dark: boolean) {
  return {
    grid:          dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
    axis:          dark ? "#7A7068" : "#B0A99E",
    tooltipBg:     dark ? "#1C1612" : "#FEFCF9",
    tooltipBorder: dark ? "rgba(255,255,255,0.08)" : "#D9D2C7",
  };
}

function deepShadow(dark: boolean): string {
  return dark
    ? "0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 8px rgba(0,0,0,0.25), 0 20px 60px rgba(0,0,0,0.55)"
    : "0 1px 0 rgba(255,255,255,0.95) inset, 0 4px 8px rgba(0,0,0,0.05), 0 16px 48px rgba(0,0,0,0.10)";
}

// KPI label — tiny uppercase, tracked, muted
const KL = "text-[10px] uppercase tracking-widest text-ink-5 font-medium";
// Serif style for headline numbers
const SERIF: React.CSSProperties = { fontFamily: "var(--font-dm-serif, 'DM Serif Display', Georgia, serif)" };

// ── Custom tooltip ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartPayloadItem = { value?: unknown; payload?: unknown };

function ChartTooltip({ active, payload, label, formatter, dark }: {
  active?: boolean; payload?: ChartPayloadItem[]; label?: string;
  formatter?: (v: number) => string; dark: boolean; [k: string]: unknown;
}) {
  const c = useChartTheme(dark);
  if (!active || !payload?.length) return null;
  const val = Number(payload[0].value ?? 0);
  const formatted = formatter ? formatter(val) : `$${val.toFixed(2)}`;
  const positive = val >= 0;
  const point = getPayloadPoint(payload);
  const high = getNumericMetric(point, ["chartHigh", "high"]);
  const low = getNumericMetric(point, ["chartLow", "low"]);
  const drawdown = getNumericMetric(point, ["chartDrawdown", "drawdown"]);
  const fmtMetric = (metric: number) => (formatter ? formatter(metric) : `$${metric.toFixed(2)}`);
  return (
    <div style={{
      background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`,
      borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    }}>
      {label && <p style={{ color: c.axis, fontSize: 11, marginBottom: 4 }}>{label}</p>}
      <p style={{ color: positive ? SAGE_C : BRICK_C, fontSize: 15, fontWeight: 700, margin: 0 }}>{formatted}</p>
      {high !== null && (
        <p style={{ color: c.axis, fontSize: 11, marginTop: 4, marginBottom: 0 }}>High: {fmtMetric(high)}</p>
      )}
      {low !== null && (
        <p style={{ color: c.axis, fontSize: 11, marginTop: 2, marginBottom: 0 }}>Low: {fmtMetric(low)}</p>
      )}
      {drawdown !== null && drawdown < 0 && (
        <p style={{ color: BRICK_C, fontSize: 11, marginTop: 2, marginBottom: 0 }}>Drawdown: {fmtMetric(drawdown)}</p>
      )}
    </div>
  );
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900, delay = 200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setVal(Math.round(eased * target));
        if (t < 1) requestAnimationFrame(tick);
        else setVal(target);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return val;
}

// ── Win/Loss SVG Ring ─────────────────────────────────────────────────────────
function WinLossRing({ wins, losses, winRate, dark }: {
  wins: number; losses: number; winRate: number; dark: boolean;
}) {
  const t = useT();
  const size = 130;
  const sw   = 10;
  const r    = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const total  = wins + losses;
  const GAP    = 6;
  const winArc  = total > 0 ? Math.max(0, circ * (wins  / total) - GAP) : 0;
  const lossArc = total > 0 ? Math.max(0, circ * (losses / total) - GAP) : 0;
  const trackC  = dark ? "#252015" : "#EDE8E0";

  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setDrawn(true), 80); return () => clearTimeout(id); }, []);
  const displayRate = useCountUp(winRate, 900, 150);
  const arcStyle: React.CSSProperties = { transition: "stroke-dasharray 1.1s cubic-bezier(0.34,1.1,0.64,1)" };

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackC} strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={SAGE_C} strokeWidth={sw}
          strokeDasharray={`${drawn ? winArc : 0} ${circ}`} strokeLinecap="round" style={arcStyle} />
        {lossArc > 0 && (
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={BRICK_C} strokeWidth={sw}
            strokeDasharray={`${drawn ? lossArc : 0} ${circ}`}
            strokeDashoffset={-(winArc + GAP)} strokeLinecap="round" style={arcStyle} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="font-serif text-[38px] font-bold leading-none tnum text-gradient-sage">{displayRate}<span className="text-ink-4 text-[22px]">%</span></p>
        <p className="editorial-label mt-1.5">{t("common_win_rate")}</p>
      </div>
    </div>
  );
}

// ── Image helpers ─────────────────────────────────────────────────────────────
const IMG_SEP = "\n\n---images---\n";
function decodeImages(content: string): { text: string; images: string[] } {
  const idx = content.indexOf(IMG_SEP);
  if (idx === -1) return { text: content, images: [] };
  return {
    text: content.slice(0, idx),
    images: content.slice(idx + IMG_SEP.length).split("\n").filter(Boolean),
  };
}

// ── Day Detail Modal ──────────────────────────────────────────────────────────
interface DayTrade {
  id: string; symbol: string; side: string; pnl: number; netPnl: number;
  entryPrice: number; exitPrice: number | null; quantity: number;
  entryDate: string; setup: string | null; notes: string | null;
}
interface JournalEntry {
  date: string; preMarketNotes: string | null; postMarketNotes: string | null;
  marketCondition: string | null; emotionalState: string | null;
  rulesFollowed: boolean; lessonsLearned: string | null; dailyGoal: string | null;
  goalMet: boolean; rating: number | null; notes: string | null;
}

function DayDetailModal({ date, onClose }: { date: string; onClose: () => void }) {
  const t = useT();
  const [trades, setTrades]   = useState<DayTrade[]>([]);
  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox]     = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`tz-screenshots-${date}`);
      if (saved) setTimeout(() => setScreenshots(JSON.parse(saved)), 0);
    } catch { /* noop */ }

    const tzOffset = new Date().getTimezoneOffset();
    Promise.all([
      fetch(`/api/trades?from=${date}&to=${date}&limit=100&tzOffset=${tzOffset}`).then(r => r.json()),
      fetch(`/api/journal?date=${date}`).then(r => r.json()),
    ]).then(([tradesData, journalData]) => {
      setTrades(tradesData.trades || []);
      setJournal(journalData || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [date]);

  const dayPnl = trades.reduce((s, tr) => s + tr.pnl, 0);
  const wins   = trades.filter(tr => tr.pnl > 0).length;
  const losses = trades.filter(tr => tr.pnl < 0).length;
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const tradeImages = trades.flatMap(tr => tr.notes ? decodeImages(tr.notes).images : []);
  const allImages = [...screenshots, ...tradeImages];

  return (
    <Portal>
      {lightbox && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={lightbox} alt="" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
      <div className="fixed inset-0 z-[200] overflow-y-auto py-6 px-4">
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm anim-backdrop" onClick={onClose} />
        <div className="relative w-full max-w-2xl mx-auto my-auto rounded-xl border border-stroke bg-card shadow-2xl anim-scale-in">
          <div className="flex items-start justify-between px-6 py-4 border-b border-stroke">
            <div>
              <h2 className="text-lg font-semibold text-ink">{dateLabel}</h2>
              {!loading && trades.length > 0 && (
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="font-bold" style={{ color: dayPnl >= 0 ? SAGE : BRICK }}>
                    {dayPnl >= 0 ? "+" : ""}${dayPnl.toFixed(2)}
                  </span>
                  <span className="text-ink-5">·</span>
                  <span className="text-ink-4">{trades.length} {t("trades")}</span>
                  <span className="text-ink-5">·</span>
                  <span style={{ color: SAGE }}>{wins}W</span>
                  <span className="text-ink-5">/</span>
                  <span style={{ color: BRICK }}>{losses}L</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-ink-5 hover:text-ink transition-colors mt-0.5">
              <X className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-ink-5">{t("loading")}</div>
          ) : (
            <div className="px-6 py-5 space-y-5">
              {trades.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-brand" />{t("journal_trades_today")}
                  </h3>
                  <div className="space-y-1.5">
                    {trades.map(tr => {
                      const { images: trImgs } = tr.notes ? decodeImages(tr.notes) : { images: [] };
                      return (
                        <div key={tr.id} className="flex items-center justify-between rounded-lg bg-tinted px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                background: tr.side === "long" ? `${SAGE}25` : `${BRICK}25`,
                                color: tr.side === "long" ? SAGE : BRICK,
                              }}>
                              {tr.side.toUpperCase()}
                            </span>
                            <span className="text-sm font-semibold text-ink">{tr.symbol}</span>
                            {tr.setup && (
                              <span className="rounded bg-brand/10 text-brand px-1.5 py-0.5 text-[10px]">{tr.setup}</span>
                            )}
                            {trImgs.length > 0 && <ImageIcon className="h-3 w-3 text-ink-5" />}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-ink-4 text-xs">
                              {new Date(tr.entryDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                            </span>
                            <span className="font-bold" style={{ color: tr.pnl >= 0 ? SAGE : BRICK }}>
                              {tr.pnl >= 0 ? "+" : ""}${tr.pnl.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {journal && (
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand" />{t("nav_journal")}
                  </h3>
                  <div className="space-y-3 rounded-xl border border-stroke bg-tinted p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      {journal.rating && (
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={cn("h-3.5 w-3.5", s <= journal.rating! ? "fill-amber-400 text-amber-400" : "text-stroke-2")} />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs">
                        {journal.rulesFollowed
                          ? <CheckCircle className="h-3.5 w-3.5" style={{ color: SAGE }} />
                          : <XCircle className="h-3.5 w-3.5" style={{ color: BRICK }} />}
                        <span className="text-ink-4">{t("journal_rules_followed")}</span>
                      </div>
                      {journal.goalMet && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <CheckCircle className="h-3.5 w-3.5" style={{ color: SAGE }} />
                          <span className="text-ink-4">{t("journal_goal_met")}</span>
                        </div>
                      )}
                    </div>
                    {journal.dailyGoal && (
                      <div>
                        <p className={cn(KL, "mb-1")}>{t("journal_daily_goal")}</p>
                        <p className="text-sm text-ink-2">{journal.dailyGoal}</p>
                      </div>
                    )}
                    {journal.emotionalState && (
                      <div>
                        <p className={cn(KL, "mb-1")}>{t("journal_emotional_state")}</p>
                        <p className="text-sm text-ink-2 capitalize">{journal.emotionalState}</p>
                      </div>
                    )}
                    {journal.preMarketNotes && (
                      <div>
                        <p className={cn(KL, "mb-1")}>{t("journal_pre_market")}</p>
                        <p className="text-sm text-ink-2 whitespace-pre-wrap">{journal.preMarketNotes}</p>
                      </div>
                    )}
                    {journal.postMarketNotes && (
                      <div>
                        <p className={cn(KL, "mb-1")}>{t("journal_post_market")}</p>
                        <p className="text-sm text-ink-2 whitespace-pre-wrap">{journal.postMarketNotes}</p>
                      </div>
                    )}
                    {journal.lessonsLearned && (
                      <div>
                        <p className={cn(KL, "mb-1")}>{t("journal_lessons")}</p>
                        <p className="text-sm text-ink-2 whitespace-pre-wrap">{journal.lessonsLearned}</p>
                      </div>
                    )}
                    {journal.notes && (
                      <div>
                        <p className={cn(KL, "mb-1")}>{t("journal_extra_notes")}</p>
                        <p className="text-sm text-ink-2 whitespace-pre-wrap">{journal.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {allImages.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-brand" />{t("journal_screenshots")}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {allImages.map((url, i) => (
                      <div key={i}
                        className="rounded-lg overflow-hidden aspect-video bg-tinted cursor-pointer group relative"
                        onClick={() => setLightbox(url)}>
                        <img src={url} alt="" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trades.length === 0 && !journal && (
                <div className="text-center py-8 text-ink-5 text-sm">{t("no_data")}</div>
              )}

              <div className="pt-1 border-t border-stroke flex justify-end">
                <Link href="/journal" className="text-xs text-brand hover:underline flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> {t("dash_view_journal")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ── P/L Calendar ─────────────────────────────────────────────────────────────
function PnlCalendar({ calendarData }: { calendarData: { date: string; pnl: number; trades: number }[] }) {
  const t = useT();
  const today = new Date();
  const [year, setYear]       = useState(today.getFullYear());
  const [month, setMonth]     = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const pnlMap    = new Map(calendarData.map(d => [d.date, d]));
  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString("en-US", { month: "long", year: "numeric" });

  const cells: (null | { day: number; date: string })[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, date: dateStr });
  }

  const goMonth = (delta: number) => {
    let m = month + delta, y = year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setMonth(m); setYear(y);
  };

  const monthEntries  = calendarData.filter(d => d.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`));
  const monthPnl      = monthEntries.reduce((s, d) => s + d.pnl, 0);
  const monthTrades   = monthEntries.reduce((s, d) => s + d.trades, 0);
  const greenDays     = monthEntries.filter(d => d.pnl > 0).length;
  const redDays       = monthEntries.filter(d => d.pnl < 0).length;
  const todayStr      = toLocalDayKey(today);
  const monthSummaryLabel = `${monthName}.`;

  return (
    <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background:"linear-gradient(90deg, rgba(201,166,113,0.9), rgba(201,166,113,0.1))"}} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="editorial-label">{t("dash_calendar")}</p>
          <h3 className="font-serif text-[22px] leading-tight font-bold tracking-tight mt-1">
            <span className="tnum" style={{ color: monthPnl >= 0 ? SAGE : BRICK }}>{fmt(monthPnl)}</span>
            <span className="italic text-ink-3 text-[16px] ml-2">{monthSummaryLabel}</span>
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="chip tnum" style={{background:"var(--color-bg-tinted)", color:"var(--color-text-ink-3)"}}>{monthTrades} {t("dash_calendar_trades")}</span>
            <span className="chip tnum" style={{background:"rgba(34,197,94,0.12)", color:"#22C55E", fontWeight:700}}>{greenDays}W</span>
            <span className="chip tnum" style={{background:"rgba(239,68,68,0.12)", color:"#EF4444", fontWeight:700}}>{redDays}L</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => goMonth(-1)} className="rounded-lg p-1.5 text-ink-3 hover:text-ink hover:bg-tinted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-ink w-32 text-center">{monthName}</span>
          <button onClick={() => goMonth(1)} className="rounded-lg p-1.5 text-ink-3 hover:text-ink hover:bg-tinted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {[t("dash_day_sun"), t("dash_day_mon"), t("dash_day_tue"), t("dash_day_wed"), t("dash_day_thu"), t("dash_day_fri"), t("dash_day_sat")].map(d => (
          <div key={d} className="editorial-label text-center py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} />;
          const data    = pnlMap.get(cell.date);
          const isToday = cell.date === todayStr;
          let cellBg: string | undefined;
          let pnlText = "";

          if (data) {
            if (data.pnl > 0) {
              const alpha = Math.round((0.10 + Math.min(data.pnl / 500, 1) * 0.30) * 100) / 100;
              cellBg = `rgba(123,175,138,${alpha})`;
            } else if (data.pnl < 0) {
              const alpha = Math.round((0.10 + Math.min(Math.abs(data.pnl) / 500, 1) * 0.30) * 100) / 100;
              cellBg = `rgba(172,90,86,${alpha})`;
            } else {
              cellBg = "rgba(100,100,120,0.06)";
            }
            pnlText = data.pnl >= 0 ? `+$${data.pnl.toFixed(0)}` : `-$${Math.abs(data.pnl).toFixed(0)}`;
          }

          return (
            <div
              key={cell.date}
              title={data ? `${cell.date}\n${data.trades} trades\n${pnlText}` : cell.date}
              onClick={() => data && setSelectedDate(cell.date)}
              className={cn(
                "rounded-lg p-1.5 min-h-[52px] flex flex-col transition-colors",
                !data && "bg-tinted",
                data ? "cursor-pointer hover:ring-1 hover:ring-brand/40" : "cursor-default",
                isToday && "ring-1 ring-brand/50"
              )}
              style={cellBg ? { background: cellBg } : undefined}
            >
              <span className={cn("text-xs font-medium tnum", isToday ? "text-brand" : "text-ink-3")}>{cell.day}</span>
              {data && (
                <>
                  <span className="text-[10px] font-semibold leading-tight mt-auto tnum font-mono"
                    style={{ color: data.pnl >= 0 ? SAGE : BRICK }}>{pnlText}</span>
                  <span className="text-[9px] text-ink-4 tnum">{data.trades}t</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-ink-5 border-t border-stroke pt-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `${SAGE_C}50` }} />
          {t("dash_profitable_day")}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `${BRICK_C}50` }} />
          {t("dash_loss_day")}
        </div>
      </div>

      {selectedDate && <DayDetailModal date={selectedDate} onClose={() => setSelectedDate(null)} />}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-tinted", className)} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton className="h-9 w-48" /><Skeleton className="h-3 w-32" /></div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="lg:col-span-2 h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 gap-5">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

// ── Annual Heatmap ────────────────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CELL = 12;
const GAP  = 2;

function AnnualHeatmap({ calendarData, dark, embedded }: {
  calendarData: { date: string; pnl: number; trades: number }[];
  dark: boolean;
  embedded?: boolean;
}) {
  const pnlMap  = new Map(calendarData.map(d => [d.date, d]));
  const today   = new Date();
  const year    = today.getFullYear();
  const todayStr = toLocalDayKey(today);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const jan1 = new Date(year, 0, 1);
  const startOffset = jan1.getDay();
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array(startOffset).fill(null);

  for (let d = new Date(jan1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    week.push(toLocalDayKey(d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthAtWeek: (string | null)[] = weeks.map(() => null);
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const first = w.find(d => d !== null);
    if (!first) return;
    const parsed = parseDayKey(first);
    if (!parsed) return;
    const m = parsed.getMonth();
    if (m !== lastMonth) { monthAtWeek[wi] = MONTHS_SHORT[m]; lastMonth = m; }
  });

  const getCellBg = (dateStr: string | null): string => {
    if (!dateStr) return "transparent";
    const d = pnlMap.get(dateStr);
    if (!d) return dark ? "#1A1A22" : "#E8E8EF";
    const sign      = d.pnl >= 0;
    const intensity = Math.min(Math.abs(d.pnl) / 400, 1);
    const alpha     = Math.round((0.25 + intensity * 0.75) * 100) / 100;
    return sign
      ? `rgba(123,175,138,${alpha})`   // SAGE_C palette
      : `rgba(172,90,86,${alpha})`;    // BRICK_C palette
  };

  const inner = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="editorial-label">Trading Activity {year}</p>
          <p className="text-[11px] text-ink-5 mt-1 font-serif italic">«The year, woven day by day.»</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-ink-5">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `${SAGE_C}aa` }} /> Profitable
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `${BRICK_C}aa` }} /> Loss
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: dark ? "#1A1A22" : "#E8E8EF" }} /> No trades
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1" onMouseLeave={() => setTooltip(null)}>
        <div className="flex w-fit mx-auto" style={{ gap: GAP }}>
          <div className="flex flex-col flex-shrink-0 mr-1" style={{ gap: GAP }}>
            <div style={{ height: 14 }} />
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} style={{ height: CELL, fontSize: 9, lineHeight: `${CELL}px` }}
                className="text-ink-5 text-right pr-1 w-4">
                {i % 2 === 1 ? d : ""}
              </div>
            ))}
          </div>

          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col flex-shrink-0" style={{ gap: GAP }}>
              <div style={{ height: 14, fontSize: 9, lineHeight: "14px", width: CELL }}
                className="text-ink-5 overflow-hidden whitespace-nowrap">
                {monthAtWeek[wi] || ""}
              </div>
              {w.map((dateStr, di) => {
                const data    = dateStr ? pnlMap.get(dateStr) : null;
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={di}
                    style={{
                      width: CELL, height: CELL, borderRadius: 2,
                      background: getCellBg(dateStr),
                      outline: isToday ? "1.5px solid #E87030" : undefined,
                      cursor: data ? "pointer" : "default",
                    }}
                    onMouseEnter={e => {
                      if (!dateStr) return;
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({
                        text: data
                          ? `${dateStr}: ${data.pnl >= 0 ? "+" : ""}$${data.pnl.toFixed(2)} (${data.trades} trade${data.trades !== 1 ? "s" : ""})`
                          : `${dateStr}: No trades`,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                      });
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-stroke bg-card px-2 py-1 text-xs text-ink shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="px-5 pb-5 pt-4">{inner}</div>;
  }

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-5 overflow-hidden">
      {inner}
    </div>
  );
}

// ── Recent Trades Widget ──────────────────────────────────────────────────────
interface RecentTrade {
  id: string; symbol: string; side: string; pnl: number; netPnl: number;
  entryDate: string; setup: string | null;
}

function RecentTradesWidget() {
  const t = useT();
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades?limit=3&sort=entryDate&dir=desc")
      .then(r => r.json())
      .then(d => { setTrades(d.trades || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-5">
      <Skeleton className="h-4 w-32 mb-4" />
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 mb-1.5" />)}
    </div>
  );

  if (!trades.length) return null;

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-5 relative overflow-hidden flex-1 flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background:"linear-gradient(90deg, rgba(240,114,64,0.9), rgba(240,114,64,0.1))"}} />
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="editorial-label">{t("dash_recent_trades")}</p>
          <p className="text-[11px] text-ink-5 mt-1 font-serif italic">«Latest entries from the ledger.»</p>
        </div>
        <Link href="/trades" className="text-[11px] text-brand hover:underline mt-0.5 whitespace-nowrap">{t("dash_view_journal")} →</Link>
      </div>
      <div className="space-y-0.5 flex-1">
        {trades.map(tr => (
          <div key={tr.id}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-tinted transition-colors group">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 tracking-wider"
                style={{
                  background: tr.side === "long" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                  color: tr.side === "long" ? "#22C55E" : "#EF4444",
                }}>
                {tr.side === "long" ? "L" : "S"}
              </span>
              <span className="text-[13px] font-semibold text-ink font-mono truncate">{tr.symbol}</span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="editorial-label hidden sm:block tnum">
                {new Date(tr.entryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
              <span className="text-[13px] font-bold font-mono min-w-[68px] text-right tnum"
                style={{ color: tr.pnl >= 0 ? SAGE : BRICK }}>
                {tr.pnl >= 0 ? "+" : "−"}${Math.abs(tr.pnl).toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW LAYOUT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Mini Activity Heatmap — fills parent, one month at a time ────────────────
function MiniActivityHeatmap({ calendarData, dark }: {
  calendarData: { date: string; pnl: number; trades: number }[];
  dark: boolean;
}) {
  const today    = new Date();
  const todayStr = toLocalDayKey(today);
  const [offset, setOffset] = useState(0);

  const displayDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const dYear  = displayDate.getFullYear();
  const dMonth = displayDate.getMonth();
  const monthLabel = displayDate.toLocaleString("en-US", { month: "short", year: "numeric" });

  const pnlMap = new Map(calendarData.map(d => [d.date, d]));

  // Build week-columns for this month (Sun=0 … Sat=6)
  const firstDay = new Date(dYear, dMonth, 1).getDay();
  const daysIn   = new Date(dYear, dMonth + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++)
    cells.push(`${dYear}-${String(dMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const cols: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));

  const getBg = (ds: string | null) => {
    if (!ds) return "transparent";
    const d = pnlMap.get(ds);
    if (!d) return dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    const a = +(0.28 + Math.min(Math.abs(d.pnl) / 400, 1) * 0.65).toFixed(2);
    return d.pnl >= 0 ? `rgba(123,175,138,${a})` : `rgba(172,90,86,${a})`;
  };

  const canBack = offset > -(today.getMonth() + (today.getFullYear() - 2024) * 12);
  const canFwd  = offset < 0;

  return (
    <div className="flex flex-col h-full w-full" style={{ gap: 4 }}>

      {/* Nav row */}
      <div className="flex items-center justify-between flex-shrink-0">
        <button onClick={() => setOffset(o => o - 1)} disabled={!canBack}
          className="p-0.5 text-ink-5 hover:text-ink disabled:opacity-20 transition-colors">
          <ChevronLeft className="h-3 w-3" />
        </button>
        <span className="text-[9px] font-semibold text-ink-3 tracking-wide">{monthLabel}</span>
        <button onClick={() => setOffset(o => o + 1)} disabled={!canFwd}
          className="p-0.5 text-ink-5 hover:text-ink disabled:opacity-20 transition-colors">
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Day-of-week labels + cell columns — fills remaining height */}
      <div className="flex flex-1 min-h-0" style={{ gap: 3 }}>

        {/* Day labels column */}
        <div className="flex flex-col justify-around flex-shrink-0 pb-px" style={{ width: 10 }}>
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <span key={i} className="text-ink-5 text-center leading-none" style={{ fontSize: 7 }}>{d}</span>
          ))}
        </div>

        {/* Week columns — each stretches to fill width & height */}
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col flex-1 min-w-0 min-h-0" style={{ gap: 3 }}>
            {col.map((ds, di) => (
              <div key={di} className="flex-1 rounded-[2px] min-h-0"
                style={{
                  background: getBg(ds),
                  outline: ds === todayStr ? "1.5px solid #E87030" : undefined,
                }} />
            ))}
          </div>
        ))}
      </div>

    </div>
  );
}

// ── Onboarding Balance Modal ──────────────────────────────────────────────────
function OnboardingBalanceModal({ t }: { onSaved?: (bal: number) => void; t: (key: TKey) => string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md anim-backdrop" />

        <div className="relative w-full sm:max-w-[400px] rounded-t-3xl sm:rounded-2xl border border-stroke bg-card shadow-2xl overflow-hidden anim-spring-in">

          {/* Ambient glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-72 rounded-full opacity-15"
            style={{ background: "radial-gradient(ellipse, var(--color-brand) 0%, transparent 70%)" }} />

          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px]"
            style={{ background: "linear-gradient(90deg, transparent, var(--color-brand), transparent)" }} />

          {/* Close */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 z-10 rounded-lg p-1.5 text-ink-4 hover:text-ink hover:bg-tinted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-7 pt-8 pb-7">
            {/* Icon */}
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10">
              <Settings2 className="h-[18px] w-[18px] text-brand" />
            </div>

            {/* Text */}
            <h2 className="font-serif text-[27px] leading-tight font-bold text-ink">
              {t("onboard_balance_title")}
            </h2>
            <p className="mt-2.5 text-[13px] text-ink-3 leading-relaxed">
              {t("onboard_balance_subtitle")}
            </p>

            {/* Hint rows */}
            <div className="mt-5 space-y-2">
              {([
                { icon: DollarSign, label: "Balance" },
                { icon: Clock,       label: "Timezone" },
              ] as const).map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-stroke bg-tinted px-4 py-3 group">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 border border-brand/20">
                    <Icon className="h-3.5 w-3.5 text-brand" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-ink-2">{label}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href="/settings?tab=trading"
                onClick={() => setDismissed(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "var(--color-brand)" }}
              >
                {t("onboard_balance_cta")}
              </Link>
              <button
                onClick={() => setDismissed(true)}
                className="w-full py-2 text-xs text-ink-5 hover:text-ink-3 transition-colors"
              >
                {t("onboard_balance_skip")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Balance Hero Row ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BalanceHeroRow({ stats, t }: { stats: any; darkMode: boolean; t: (key: TKey) => string }) {
  const [settings, setSettings] = useState<{
    accountBalance?: number; maxDailyLoss?: number; maxDailyTrades?: number;
  }>({});

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(setSettings).catch(() => {});
  }, []);

  const startBalance   = settings.accountBalance ?? 0;
  const currentBalance = startBalance + stats.totalPnl;
  const pct            = startBalance > 0 ? (stats.totalPnl / startBalance) * 100 : 0;
  const positive       = stats.totalPnl >= 0;

  const todayStr   = toLocalDayKey(new Date());
  const todayEntry = (stats.calendarData || []).find((d: { date: string }) => d.date === todayStr) as
    { date: string; pnl: number; trades: number } | undefined;
  const todayPnl    = todayEntry?.pnl ?? 0;
  const todayTrades = todayEntry?.trades ?? 0;

  // ── Weekly / monthly slices ──────────────────────────────────────────────────
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - dayOfWeek);
  const startOfLastWeek = new Date(startOfWeek); startOfLastWeek.setDate(startOfWeek.getDate() - 7);
  const endOfLastWeek   = new Date(startOfWeek); endOfLastWeek.setDate(startOfWeek.getDate() - 1);
  const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);

  const calArr = (stats.calendarData || []) as { date: string; pnl: number; trades: number }[];
  const weekEntries = calArr.filter(d => d.date >= toLocalDayKey(startOfWeek) && d.date <= todayStr);
  const thisWeekPnl    = weekEntries.reduce((s, d) => s + d.pnl, 0);
  const thisWeekTrades = weekEntries.reduce((s, d) => s + d.trades, 0);
  const weekWins       = weekEntries.filter(d => d.pnl > 0).length;
  const weekLosses     = weekEntries.filter(d => d.pnl < 0).length;
  const weekWr         = (weekWins + weekLosses) > 0 ? Math.round(weekWins / (weekWins + weekLosses) * 100) : 0;

  const lastWeekPnl = calArr
    .filter(d => d.date >= toLocalDayKey(startOfLastWeek) && d.date <= toLocalDayKey(endOfLastWeek))
    .reduce((s, d) => s + d.pnl, 0);

  const monthEntries = calArr.filter(d => d.date >= toLocalDayKey(startOfMonth) && d.date <= todayStr);
  const monthPnl     = monthEntries.reduce((s, d) => s + d.pnl, 0);

  // Risk bar — daily loss
  const dailyLimit = settings.maxDailyLoss ?? 0;
  const lossToday  = Math.abs(Math.min(0, todayPnl));
  const lossPct    = dailyLimit > 0 ? Math.min(100, (lossToday / dailyLimit) * 100) : 0;

  const showLossWarn  = dailyLimit > 0 && todayPnl <= -dailyLimit;
  const showTradeWarn = (settings.maxDailyTrades ?? 0) > 0 && todayTrades >= (settings.maxDailyTrades!);

  // Split balance into integer and decimal for the mockup-style serif display
  const [intPart, decPart] = currentBalance
    .toLocaleString("en-US", { minimumFractionDigits: 2 })
    .split(".");

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-7 relative overflow-hidden h-full">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
          background: positive
            ? "linear-gradient(90deg, rgba(123,175,138,0.9), rgba(123,175,138,0.1))"
            : "linear-gradient(90deg, rgba(172,90,86,0.9), rgba(172,90,86,0.1))",
        }} />

        {settings.accountBalance === 0 && (
          <OnboardingBalanceModal
            t={t}
            onSaved={() => {}}
          />
        )}

        <div className="flex items-center justify-between">
          <p className="editorial-label">{t("dash_current_balance")}</p>
          <span className="chip tnum" style={{ background: `${SAGE_C}20`, color: SAGE_C, fontWeight: 700 }}>● Live</span>
        </div>

        <p className="font-serif text-[56px] lg:text-[62px] leading-[0.96] font-bold tracking-[-0.03em] mt-3 text-gradient-brand tnum">
          ${intPart}<span className="text-ink-3 text-3xl">.<span className="text-ink-4">{decPart}</span></span>
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="chip tnum" style={{
            background: positive ? "rgba(123,175,138,0.15)" : "rgba(172,90,86,0.15)",
            color: positive ? SAGE_C : BRICK_C, fontWeight: 700,
          }}>
            {positive ? "▲" : "▼"} {positive ? "+" : "−"}${Math.abs(stats.totalPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })} · {positive ? "+" : "−"}{Math.abs(pct).toFixed(1)}%
          </span>
          <span className="text-[11px] text-ink-5">
            vs. ${startBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })} {t("dash_starting_balance")}
          </span>
        </div>

        {/* Today / Week / Month strip */}
        <div className="mt-6 pt-5 border-t border-stroke grid grid-cols-3 gap-3">
          <div>
            <p className="editorial-label">Today</p>
            <p className="font-serif text-xl font-bold mt-1 tnum" style={{ color: todayPnl >= 0 ? SAGE : BRICK }}>
              {todayPnl >= 0 ? "+" : "−"}${Math.abs(todayPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-ink-5">{todayTrades} trade{todayTrades === 1 ? "" : "s"}</p>
          </div>
          <div>
            <p className="editorial-label">Week</p>
            <p className="font-serif text-xl font-bold mt-1 tnum" style={{ color: thisWeekPnl >= 0 ? SAGE : BRICK }}>
              {thisWeekPnl >= 0 ? "+" : "−"}${Math.abs(thisWeekPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-ink-5">
              {thisWeekTrades} trades{weekWr > 0 ? ` · ${weekWr}% WR` : ""}
            </p>
          </div>
          <div>
            <p className="editorial-label">Month</p>
            <p className="font-serif text-xl font-bold mt-1 tnum" style={{ color: monthPnl >= 0 ? SAGE : BRICK }}>
              {monthPnl >= 0 ? "+" : "−"}${Math.abs(monthPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            {lastWeekPnl !== 0 && (
              <p className="text-[10px] text-ink-5 tnum">
                vs last wk ${Math.abs(lastWeekPnl).toFixed(0)} {thisWeekPnl >= lastWeekPnl ? "↑" : "↓"}
              </p>
            )}
          </div>
        </div>

        {/* Risk bar */}
        <div className="mt-5 pt-4 border-t border-stroke">
          <div className="flex items-center justify-between mb-2">
            <p className="editorial-label">{t("dash_daily_risk_limit")}</p>
            {dailyLimit > 0 ? (
              <span className="font-mono text-[11px] tnum">
                <span style={{ color: BRICK }}>${lossToday.toFixed(0)}</span> <span className="text-ink-5">/ ${dailyLimit}</span>
              </span>
            ) : (
              <Link href="/settings" className="text-[10px] text-ink-5 hover:text-brand italic font-serif">not set →</Link>
            )}
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-lift, rgba(255,255,255,0.08))" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${lossPct}%`, background: "linear-gradient(90deg,#22C55E,#B08050,#EF4444)" }} />
          </div>
        </div>

        {/* Warnings */}
        {(showLossWarn || showTradeWarn) && (
          <div className="mt-4 space-y-1.5">
            {showLossWarn && (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{ background: `${BRICK}14`, borderColor: `${BRICK}40` }}>
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: BRICK }} />
                <p className="text-xs font-medium" style={{ color: BRICK }}>
                  {t("dash_loss_limit_reached")} — ${lossToday.toFixed(0)} / ${dailyLimit}
                </p>
              </div>
            )}
            {showTradeWarn && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                <p className="text-xs font-medium text-amber-500">
                  {t("dash_trade_limit_reached")} — {todayTrades} / {settings.maxDailyTrades}
                </p>
              </div>
            )}
          </div>
        )}

      {/* CTAs */}
      <div className="flex items-center gap-2.5 mt-6">
        <Link href="/trades"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover transition-colors">
          <FileText className="h-3.5 w-3.5" />{t("trades_add")}
        </Link>
        <Link href="/journal"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stroke px-4 py-2 text-xs font-medium text-ink-3 hover:text-ink hover:border-stroke-2 transition-colors">
          <BookOpen className="h-3.5 w-3.5" />{t("dash_write_journal")}
        </Link>
      </div>
    </div>
  );
}

// ── Tabbed Charts ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TabbedCharts({ stats, darkMode, t }: { stats: any; darkMode: boolean; t: (key: TKey) => string }) {
  const [tab, setTab]         = useState<"equity" | "daily">("equity");
  const [equityView, setEquityView] = useState<"overall" | "trades">("overall");
  const [equityRange, setEquityRange] = useState<"30d" | "all">("30d");
  const c = useChartTheme(darkMode);

  const tabs: { id: "equity" | "daily"; label: string }[] = [
    { id: "equity", label: t("dash_cumulative_pl") },
    { id: "daily",  label: t("dash_daily_pl") },
  ];

  const cumulative = (stats.cumulativePnl ?? []) as { date: string; pnl: number }[];
  const visibleCumulative = equityRange === "30d" ? cumulative.slice(-30) : cumulative;

  // Overall: date-based cumulative PnL, styled like the Team dashboard curve.
  const overallData = visibleCumulative.map(
    (d) => ({
      label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      value: d.pnl,
    })
  );

  // By trades: per-trade cumulative PnL, label = symbol + trade number
  const tradesData = (stats.tradesSeries ?? []).map(
    (d: { label: string; n: number; cumPnl: number }) => ({
      label: `${d.n}. ${d.label}`,
      value: d.cumPnl,
    })
  );

  const equityData = equityView === "overall" ? overallData : tradesData;
  const todayStr = toLocalDayKey(new Date());
  const todayPnl = ((stats.calendarData ?? []) as { date: string; pnl: number }[])
    .find((day) => day.date === todayStr)?.pnl ?? 0;
  const rangeLabel = equityView === "overall"
    ? equityRange === "30d" ? "30-day account P/L curve" : "Full account P/L curve"
    : "Per-trade cumulative P/L";

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-6 h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background:"linear-gradient(90deg, rgba(123,175,138,0.9), rgba(123,175,138,0.1))"}} />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 flex-shrink-0">
        <div>
          <p className="editorial-label">Performance Curve</p>
          <h2 className="mt-1 text-[16px] font-semibold text-ink">
            {tab === "equity" ? rangeLabel : "Daily P/L breakdown"}
          </h2>
          <div className="flex gap-3 mt-2">
            {tabs.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider transition-colors pb-0.5",
                  tab === tb.id
                    ? "text-brand border-b border-brand"
                    : "text-ink-5 hover:text-ink-2"
                )}>
                {tb.label}
              </button>
            ))}
            {tab === "equity" && (
              <>
                <span className="text-ink-5 text-[11px]">·</span>
                <button
                  onClick={() => setEquityRange(v => v === "30d" ? "all" : "30d")}
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider transition-colors pb-0.5",
                    equityRange === "30d"
                      ? "text-brand border-b border-brand"
                      : "text-ink-5 hover:text-ink-2"
                  )}
                >
                  30d
                </button>
                <span className="text-ink-5 text-[11px]">/</span>
                <button
                  onClick={() => setEquityView(v => v === "trades" ? "overall" : "trades")}
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider transition-colors pb-0.5",
                    equityView === "trades"
                      ? "text-brand border-b border-brand"
                      : "text-ink-5 hover:text-ink-2"
                  )}
                >
                  By trades
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {tab === "equity" && equityView === "overall" && (
            <span className={cn(
              "rounded-lg border border-stroke bg-tinted px-3 py-1.5 text-[12px] font-semibold jb-mono",
              todayPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
            )}>
              Today {fmt(todayPnl)}
            </span>
          )}
          <span className={cn(
            "rounded-lg border border-stroke bg-tinted px-3 py-1.5 text-[12px] font-semibold jb-mono",
            stats.totalPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
          )}>
            {fmt(stats.totalPnl)}
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0">
        {tab === "equity" ? (
          equityData.length > 0 ? (
            <GradientAreaChart
              data={equityData}
              dark={darkMode}
              height={220}
              tooltipFormatter={fmt}
            />
          ) : (
            <div className="h-60 flex items-center justify-center text-ink-5 text-sm">{t("no_data")}</div>
          )
        ) : (
          stats.dailyPnl?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.dailyPnl} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="40%">
                <defs>
                  <linearGradient id="bG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SAGE_C}  stopOpacity={0.9} />
                    <stop offset="100%" stopColor={SAGE_C}  stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="bR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRICK_C} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={BRICK_C} stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 5" stroke={c.grid} vertical={false} />
                <XAxis dataKey="date" stroke="transparent" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
                <YAxis stroke="transparent" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false}
                  width={52} tickFormatter={v => `$${v}`} />
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ pointerEvents: "none" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload, label }: any) =>
                    <ChartTooltip active={active} payload={payload} label={label} formatter={fmt} dark={darkMode} />
                  }
                />
                <Bar dataKey="pnl" radius={[5, 5, 5, 5]}>
                  {stats.dailyPnl.map((entry: { pnl: number }, i: number) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? "url(#bG)" : "url(#bR)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-ink-5 text-sm">{t("no_data")}</div>
          )
        )}
      </div>
    </div>
  );
}

// ── Win/Loss Ring Card ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WinLossRingCard({ stats, darkMode, t }: { stats: any; darkMode: boolean; t: (key: TKey) => string }) {
  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep px-5 py-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background:"linear-gradient(90deg, rgba(201,166,113,0.9), rgba(201,166,113,0.1))"}} />
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="editorial-label">{t("dash_win_loss")}</p>
          <p className="text-[11px] text-ink-5 mt-0.5 font-serif italic">«The odds, in their purest form.»</p>
        </div>
        <span className="font-mono text-[10px] text-ink-5 tnum">{stats.wins + stats.losses} closed</span>
      </div>

      {/* Ring + side legend */}
      <div className="flex items-center gap-5 mt-1">
        <div className="shrink-0">
          <WinLossRing wins={stats.wins} losses={stats.losses} winRate={stats.winRate} dark={darkMode} />
        </div>
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: SAGE_C }} />
              <span className="editorial-label text-ink-3">{t("dash_wins")}</span>
            </span>
            <span className="font-mono font-semibold tnum" style={{ color: SAGE }}>{stats.wins}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: BRICK_C }} />
              <span className="editorial-label text-ink-3">{t("dash_losses")}</span>
            </span>
            <span className="font-mono font-semibold tnum" style={{ color: BRICK }}>{stats.losses}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-stroke">
            <span className="editorial-label text-ink-3">{t("dash_avg_r")}</span>
            <span className="font-mono font-semibold tnum text-ink">{stats.avgRMultiple}R</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="editorial-label text-ink-3">{t("dash_stat_expectancy")}</span>
            <span className="font-mono font-semibold tnum" style={{ color: stats.expectancy >= 0 ? SAGE : BRICK }}>
              {fmt(stats.expectancy)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Risk Management Widget ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RiskManagementWidget({ stats, t }: { stats: any; t: (key: TKey) => string }) {
  const [settings, setSettings] = useState<{
    accountBalance?: number; maxDailyLoss?: number; maxDailyTrades?: number; maxRiskPerTrade?: number;
  }>({});
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("tz-risk-collapsed");
      return saved === null ? true : saved === "1";
    } catch { return true; }
  });

  const toggleCollapsed = () => {
    setCollapsed(v => {
      const next = !v;
      try { localStorage.setItem("tz-risk-collapsed", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => setSettings(d ?? {})).catch(() => {});
  }, []);

  const todayStr = toLocalDayKey(new Date());
  const todayEntry = (stats.calendarData || []).find((d: { date: string }) => d.date === todayStr) as
    { date: string; pnl: number; trades: number } | undefined;
  const todayPnl    = todayEntry?.pnl ?? 0;
  const todayTrades = todayEntry?.trades ?? 0;

  const dailyLossLimit  = settings.maxDailyLoss   ?? 0;
  const dailyTradeLimit = settings.maxDailyTrades  ?? 0;
  const accountBal      = settings.accountBalance  ?? 0;
  const maxRiskPct      = settings.maxRiskPerTrade ?? 1;

  // Status logic
  const lossUsedPct   = dailyLossLimit > 0 ? Math.min(100, (Math.abs(Math.min(0, todayPnl)) / dailyLossLimit) * 100) : null;
  const tradeUsedPct  = dailyTradeLimit > 0 ? Math.min(100, (todayTrades / dailyTradeLimit) * 100) : null;
  const isHalted      = (lossUsedPct ?? 0) >= 100 || (tradeUsedPct ?? 0) >= 100;
  const isWarning     = !isHalted && ((lossUsedPct ?? 0) >= 70 || (tradeUsedPct ?? 0) >= 80);
  const statusColor   = isHalted ? BRICK_C : isWarning ? "#B08050" : SAGE_C;
  const statusLabel   = isHalted ? t("dash_risk_status_halt") : isWarning ? t("dash_risk_status_warning") : t("dash_risk_status_clear");
  const statusBg      = isHalted ? `${BRICK_C}12` : isWarning ? "rgba(176,128,80,0.10)" : `${SAGE_C}10`;

  // Max position size based on risk %
  const maxPositionRisk = accountBal * (maxRiskPct / 100);

  const rules = [
    t("dash_risk_rule_pause"),
    t("dash_risk_rule_size"),
    t("dash_risk_rule_stop"),
    t("dash_risk_rule_daily_limit"),
  ];

  return (
    <div className="relative rounded-2xl border bg-card shadow-deep overflow-hidden"
      style={{ borderColor: `${statusColor}35` }}>
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: statusColor }} />

      {/* Header — always visible, clickable to collapse */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: collapsed ? undefined : "1px solid var(--color-stroke)" }}>
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2.5 flex-1 text-left"
        >
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${statusColor}18` }}>
            <Shield className="h-4 w-4" style={{ color: statusColor }} />
          </div>
          <div>
            <p className="editorial-label">{t("dash_risk_management_today")}</p>
            <p className="font-serif text-[15px] italic mt-0.5" style={{ color: statusColor }}>{statusLabel}</p>
          </div>
          <ChevronDown
            className="h-4 w-4 ml-2 text-ink-5 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
          />
        </button>
        <div className="flex items-center gap-3 ml-4">
          {/* Quick status pills when collapsed */}
          {collapsed && (
            <div className="flex items-center gap-2">
              {lossUsedPct !== null && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: `${statusColor}18`, color: statusColor }}>
                  ${Math.abs(Math.min(0, todayPnl)).toFixed(0)} / ${dailyLossLimit} {t("dash_risk_loss")}
                </span>
              )}
              {tradeUsedPct !== null && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: `${statusColor}18`, color: statusColor }}>
                  {todayTrades}{dailyTradeLimit > 0 ? ` / ${dailyTradeLimit}` : ""} {t("dash_risk_trades")}
                </span>
              )}
            </div>
          )}
          <Link href="/settings"
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-ink-5 hover:text-brand transition-colors uppercase tracking-wide shrink-0">
            {t("dash_risk_configure")}
          </Link>
        </div>
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Daily Loss */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="editorial-label">{t("dash_daily_drawdown")}</p>
                {dailyLossLimit > 0
                  ? <span className="text-[10px] font-mono font-semibold tnum" style={{ color: todayPnl < 0 ? BRICK_C : SAGE_C }}>
                      ${Math.abs(Math.min(0, todayPnl)).toFixed(0)} / ${dailyLossLimit}
                    </span>
                  : <span className="text-[10px] text-ink-5 italic font-serif">{t("dash_risk_not_set")}</span>
                }
              </div>
              {lossUsedPct !== null ? (
                <>
                  <div className="h-2 rounded-full bg-tinted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${lossUsedPct}%`,
                        background: lossUsedPct >= 100 ? BRICK_C : lossUsedPct >= 70 ? "#B08050" : SAGE_C,
                      }} />
                  </div>
                  <p className="text-xs text-ink-5 tnum">{t("dash_risk_used").replace("{pct}", lossUsedPct.toFixed(0))}</p>
                </>
              ) : (
                <div className="rounded-lg bg-tinted/50 px-3 py-2 text-xs text-ink-5 italic font-serif">
                  {t("dash_risk_set_limit")} <Link href="/settings" className="text-brand hover:underline not-italic">{t("dash_risk_settings_link")}</Link>
                </div>
              )}
            </div>

            {/* Daily Trades */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="editorial-label">{t("dash_trades_today")}</p>
                {dailyTradeLimit > 0
                  ? <span className="text-[10px] font-mono font-semibold tnum" style={{ color: (tradeUsedPct ?? 0) >= 100 ? BRICK_C : SAGE_C }}>
                      {todayTrades} / {dailyTradeLimit}
                    </span>
                  : <span className="text-[10px] font-mono font-semibold text-ink-3 tnum">{todayTrades}</span>
                }
              </div>
              {tradeUsedPct !== null ? (
                <>
                  <div className="h-2 rounded-full bg-tinted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${tradeUsedPct}%`,
                        background: tradeUsedPct >= 100 ? BRICK_C : tradeUsedPct >= 80 ? "#B08050" : SAGE_C,
                      }} />
                  </div>
                  <p className="text-xs text-ink-5 tnum">{t("dash_risk_used").replace("{pct}", tradeUsedPct.toFixed(0))}</p>
                </>
              ) : (
                <div className="h-2 rounded-full bg-tinted" />
              )}
            </div>

            {/* Max position risk */}
            <div className="space-y-2">
              <p className="editorial-label">{t("dash_max_risk_trade")}</p>
              <p className="font-serif text-[22px] font-bold tnum text-gradient-brand leading-none">
                ${maxPositionRisk.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-ink-5 tnum">
                {t("dash_risk_pct_of_balance")
                  .replace("{pct}", String(maxRiskPct))
                  .replace("{balance}", accountBal.toLocaleString("en-US"))}
              </p>
            </div>
          </div>

          {/* Rules reminder */}
          <div className="px-5 pb-4">
            <div className="rounded-xl p-3" style={{ background: statusBg }}>
              <p className="editorial-label mb-2" style={{ color: statusColor }}>{t("dash_risk_rules_title")}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs font-bold mt-0.5 shrink-0 font-mono" style={{ color: statusColor }}>{i + 1}.</span>
                    <span className="text-xs text-ink-4 leading-relaxed">{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Bento Stats Panel ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BentoStatsPanel({ stats, t }: { stats: any; t: (key: TKey) => string }) {
  const rows: { label: string; value: string; color?: string }[][] = [
    [
      { label: t("dash_avg_win"),       value: fmt(stats.avgWin),       color: SAGE },
      { label: t("dash_avg_loss"),      value: fmt(-stats.avgLoss),     color: BRICK },
      { label: t("dash_biggest_win"),   value: fmt(stats.biggestWin),   color: SAGE },
      { label: t("dash_biggest_loss"),  value: fmt(stats.biggestLoss),  color: BRICK },
    ],
    [
      { label: t("dash_max_win_streak"),  value: `${stats.maxConsecutiveWins}`,  color: SAGE },
      { label: t("dash_max_loss_streak"), value: `${stats.maxConsecutiveLosses}`, color: BRICK },
      { label: t("dash_longs"),           value: `${stats.tradesBySide?.long ?? 0}`, color: SAGE },
      { label: t("dash_shorts"),          value: `${stats.tradesBySide?.short ?? 0}`, color: BRICK },
    ],
    [
      { label: t("dash_stat_net_pl"),    value: fmt(stats.netPnl),   color: stats.netPnl >= 0 ? SAGE : BRICK },
      { label: t("dash_total_fees"),     value: `$${stats.totalFees.toLocaleString("en-US", { maximumFractionDigits: 2 })}` },
      { label: t("dash_avg_duration"),   value: `${stats.avgDuration}m` },
      { label: t("dash_total_trades"),   value: String(stats.totalTrades) },
    ],
  ];

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep overflow-hidden relative">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
        background: "linear-gradient(90deg, rgba(240,114,64,0.9), rgba(240,114,64,0.1))"
      }} />

      {/* Panel header — editorial */}
      <div className="px-6 py-4 border-b border-stroke flex items-baseline justify-between">
        <div>
          <p className="editorial-label">Performance Statistics</p>
          <p className="text-[11px] text-ink-5 mt-1 font-serif italic">
            «The numbers don&apos;t lie. Dress them well.»
          </p>
        </div>
        <span className="font-mono text-[10px] text-ink-5">{stats.totalTrades} trades</span>
      </div>

      {/* Metric grid — monolithic bento with 1px dividers */}
      {rows.map((row, ri) => (
        <div key={ri} className={cn("grid grid-cols-2 md:grid-cols-4", ri < rows.length - 1 && "border-b border-stroke")}>
          {row.map((cell, ci) => (
            <div key={ci}
              className={cn("px-6 py-5 relative", ci < row.length - 1 && "border-r border-stroke")}>
              <p className="editorial-label mb-2">{cell.label}</p>
              <p className={cn("font-serif text-[26px] font-bold tracking-tight tnum leading-none", !cell.color && "text-ink")}
                style={cell.color ? { color: cell.color } : undefined}>
                {cell.value}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── KPI Sparkline Strip — 6 editorial KPI cards with top accent bars ─────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KpiSparklineStrip({ stats }: { stats: any }) {
  // Build a small sparkline series from cumulativePnl (last 8 points) for the win-rate card.
  const series: number[] = (() => {
    const arr = (stats.cumulativePnl ?? []) as { pnl: number }[];
    if (!arr.length) return [30, 45, 40, 55, 50, 65, 70, 80];
    const last = arr.slice(-8).map(d => d.pnl);
    const min = Math.min(...last);
    const max = Math.max(...last);
    const span = max - min || 1;
    return last.map(v => Math.round(((v - min) / span) * 80 + 15));
  })();

  const pfDisplay = !isFinite(stats.profitFactor ?? NaN) ? "∞" : Number(stats.profitFactor).toFixed(2);
  const pfGood    = stats.profitFactor >= 2;
  const avgR      = `${Number(stats.avgRMultiple ?? 0).toFixed(2)}`;
  const expect    = stats.expectancy ?? 0;
  const dd        = Number(stats.maxDrawdown ?? 0);

  const cards: { label: string; value: React.ReactNode; hint: string; accent: string; valueClass?: string }[] = [
    {
      label: "Win rate",
      value: <>{stats.winRate}<span className="text-ink-4 text-base">%</span></>,
      hint: "",
      accent: "rgba(123,175,138,0.7)",
    },
    {
      label: "Profit factor",
      value: pfDisplay,
      hint: pfGood ? "excellent > 2.0" : "keep pushing",
      accent: "rgba(240,114,64,0.7)",
    },
    {
      label: "Avg R",
      value: <>{avgR}<span className="text-ink-4 text-base">R</span></>,
      hint: "per trade",
      accent: "rgba(240,114,64,0.7)",
    },
    {
      label: "Expectancy",
      value: expect >= 0
        ? `+$${Math.abs(expect).toFixed(0)}`
        : `−$${Math.abs(expect).toFixed(0)}`,
      hint: "per trade",
      accent: "rgba(176,128,80,0.7)",
      valueClass: expect >= 0 ? "" : "text-brick",
    },
    {
      label: "Max drawdown",
      value: `−$${dd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      hint: "from peak",
      accent: "rgba(172,90,86,0.7)",
      valueClass: "text-brick",
    },
    {
      label: "Total trades",
      value: String(stats.totalTrades),
      hint: `on ${stats.totalTrades} entries`,
      accent: "rgba(255,255,255,0.15)",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c, i) => (
        <div key={i} className="rounded-xl border border-stroke bg-card p-4 relative overflow-hidden card-hover anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: c.accent }} />
          <p className="editorial-label">{c.label}</p>
          <p className={cn("font-serif text-[28px] font-bold tnum tracking-tight mt-2 leading-none", c.valueClass)}>
            {c.value}
          </p>
          {i === 0 ? (
            /* sparkline */
            <div className="flex items-end gap-[2px] mt-3 h-6">
              {series.map((h, k) => (
                <div key={k}
                  className="flex-1 rounded-sm spark-bar"
                  style={{
                    height: `${h}%`,
                    background: k >= series.length - 2 ? SAGE_C : "var(--color-lift, rgba(255,255,255,0.08))",
                    animationDelay: `${k * 40}ms`,
                  }} />
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-ink-5 mt-1.5 tnum">{c.hint || "\u00A0"}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Pinned Notes Widget ───────────────────────────────────────────────────────
function PinnedNotesWidget() {
  const [notes, setNotes] = useState<{ id: string; title: string; content: string; category: string }[]>([]);

  useEffect(() => {
    fetch("/api/notes?isPinned=true")
      .then((r) => r.json())
      .then((d) => setNotes((Array.isArray(d) ? d : []).filter((n: { isPinned?: boolean }) => n.isPinned).slice(0, 3)))
      .catch(() => {});
  }, []);

  if (notes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="editorial-label">Pinned Notes</p>
          <p className="text-[11px] text-ink-5 mt-0.5 font-serif italic">«Уроки, которые нельзя забыть»</p>
        </div>
        <Link href="/notebook" className="text-[10px] text-ink-5 hover:text-brand transition-colors uppercase tracking-wide">
          All notes →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {notes.map((n) => (
          <div key={n.id} className="rounded-xl border border-stroke-2 bg-tinted p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Pin className="h-3 w-3 text-brand shrink-0" />
              <span className="text-[10px] uppercase tracking-wider text-ink-5">{n.category}</span>
            </div>
            <p className="text-sm font-semibold text-ink mb-1 line-clamp-1">{n.title}</p>
            <p className="text-xs text-ink-4 line-clamp-3 leading-relaxed">
              {n.content.split("\n\n---images---\n")[0]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lesson of the Day ─────────────────────────────────────────────────────────
function LessonOfDay() {
  const [lesson, setLesson] = useState<{ id: string; title: string; content: string } | null>(null);

  useEffect(() => {
    fetch("/api/notes?category=lesson")
      .then((r) => r.json())
      .then((d: { id: string; title: string; content: string; category: string }[]) => {
        if (!Array.isArray(d) || d.length === 0) return;
        const lessons = d.filter((n) => n.category === "lesson");
        if (lessons.length === 0) return;
        // Pick pseudo-random based on day of year
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        setLesson(lessons[dayOfYear % lessons.length]);
      })
      .catch(() => {});
  }, []);

  if (!lesson) return null;

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, rgba(176,128,80,0.9), rgba(176,128,80,0.1))" }} />
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <Lightbulb className="h-4 w-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="editorial-label mb-1">Lesson of the day</p>
          <p className="text-sm font-semibold text-ink mb-1">{lesson.title}</p>
          <p className="text-xs text-ink-4 line-clamp-3 leading-relaxed">
            {lesson.content.split("\n\n---images---\n")[0].slice(0, 200)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Pre-Trade Checklist Widget ────────────────────────────────────────────────
const DEFAULT_CHECKLIST = [
  "Определил направление тренда на старшем ТФ",
  "Есть чёткий уровень стоп-лосса",
  "R/R не менее 1:2",
  "Нет крупных новостей в ближайший час",
  "Не превышен дневной лимит потерь",
  "Я в спокойном эмоциональном состоянии",
];

interface AdvancedAlert {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
}

function AdvancedAlertsBanner() {
  const [alerts, setAlerts] = useState<AdvancedAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = sessionStorage.getItem("tz-adv-alerts-dismissed");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/alerts/advanced", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.alerts) return;
        setAlerts(data.alerts.filter((a: AdvancedAlert) => a.level !== "info"));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem("tz-adv-alerts-dismissed", JSON.stringify(Array.from(next))); } catch { /* noop */ }
      return next;
    });
  };

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((alert) => {
        const isCritical = alert.level === "critical";
        const accent = isCritical ? "#EF4444" : "#B08050";
        return (
          <div
            key={alert.id}
            className="flex items-start gap-3 rounded-xl border p-3"
            style={{ borderColor: `${accent}55`, background: `${accent}12` }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: accent }}>
                {isCritical ? "Critical" : "Warning"} · {alert.title}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{alert.body}</p>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              className="shrink-0 rounded-md border border-stroke-2 bg-card px-2 py-1 text-[10px] font-medium text-ink-4 hover:text-ink-2 transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PreTradeChecklist() {
  const storageKey = `tz-checklist-${toLocalDayKey(new Date())}`;
  const [checked, setChecked] = useState<boolean[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch { /* noop */ }
    return new Array(DEFAULT_CHECKLIST.length).fill(false);
  });
  const [collapsed, setCollapsed] = useState(true);

  const toggle = (i: number) => {
    const next = [...checked];
    next[i] = !next[i];
    setChecked(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* noop */ }
  };

  const doneCount = checked.filter(Boolean).length;
  const allDone = doneCount === DEFAULT_CHECKLIST.length;

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
        background: allDone
          ? `linear-gradient(90deg, ${SAGE_C}, ${SAGE_C}40)`
          : "linear-gradient(90deg, rgba(176,128,80,0.7), rgba(176,128,80,0.1))",
      }} />
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: allDone ? `${SAGE_C}18` : "rgba(176,128,80,0.12)" }}>
            <CheckCircle className="h-4 w-4" style={{ color: allDone ? SAGE_C : "#B08050" }} />
          </div>
          <div>
            <p className="editorial-label">Pre-trade checklist · today</p>
            <p className="text-[11px] font-serif italic mt-0.5" style={{ color: allDone ? SAGE_C : "#B08050" }}>
              {allDone ? "Готов к торговле ✓" : `${doneCount} / ${DEFAULT_CHECKLIST.length} выполнено`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 rounded-full bg-tinted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / DEFAULT_CHECKLIST.length) * 100}%`, background: allDone ? SAGE_C : "#B08050" }} />
          </div>
          <ChevronDown className="h-4 w-4 text-ink-5 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }} />
        </div>
      </button>
      {!collapsed && (
        <div className="px-5 pb-4 space-y-2 border-t border-stroke pt-3">
          {DEFAULT_CHECKLIST.map((item, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                checked[i] ? "bg-tinted/50 text-ink-4" : "hover:bg-tinted text-ink-2"
              )}
            >
              <span className={cn(
                "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-all",
                checked[i] ? "border-transparent" : "border-stroke-2"
              )} style={checked[i] ? { background: SAGE_C } : {}}>
                {checked[i] && <Check className="h-3 w-3 text-white" />}
              </span>
              <span className={checked[i] ? "line-through" : ""}>{item}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rule Violations Widget ────────────────────────────────────────────────────
function RuleViolationsWidget() {
  const [violations, setViolations] = useState<{ mistake: string; count: number }[]>([]);
  const [totalThisWeek, setTotalThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const since = startOfWeek.toISOString();
    const from  = toLocalDayKey(startOfWeek);
    const tzOffset = new Date().getTimezoneOffset();

    Promise.all([
      fetch(`/api/trades?from=${from}&limit=200&tzOffset=${tzOffset}`).then(r => r.json()),
      fetch(`/api/violations?since=${encodeURIComponent(since)}`).then(r => r.json()),
    ])
      .then(([tradesData, violationsData]) => {
        const trades = (tradesData as { trades?: { mistakes?: string | null }[] }).trades || [];
        const counts: Record<string, number> = {};
        let total = 0;

        // From mistakes field (legacy)
        trades.forEach((tr) => {
          if (tr.mistakes) {
            tr.mistakes.split(",").map((m: string) => m.trim()).filter(Boolean).forEach((m: string) => {
              counts[m] = (counts[m] || 0) + 1;
              total++;
            });
          }
        });

        // From real violations API
        const realViolations = Array.isArray(violationsData) ? violationsData : [];
        if (realViolations.length > 0) {
          counts["Нарушения правил плейбука"] = (counts["Нарушения правил плейбука"] || 0) + realViolations.length;
          total += realViolations.length;
        }

        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([mistake, count]) => ({ mistake, count }));
        setViolations(sorted);
        setTotalThisWeek(total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || totalThisWeek === 0) return null;

  return (
    <div className="rounded-2xl border bg-card shadow-deep p-5 relative overflow-hidden"
      style={{ borderColor: `${BRICK_C}30` }}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: BRICK_C }} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="editorial-label">Rule violations this week</p>
          <p className="text-[11px] text-ink-5 mt-0.5 font-serif italic">{totalThisWeek} нарушени{totalThisWeek === 1 ? "е" : "й"} за 7 дней</p>
        </div>
        <Link href="/trades" className="text-[10px] text-ink-5 hover:text-brand transition-colors uppercase tracking-wide">
          Все сделки →
        </Link>
      </div>
      <div className="space-y-2.5">
        {violations.map(({ mistake, count }) => {
          const pct = Math.round((count / totalThisWeek) * 100);
          return (
            <div key={mistake}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-3 capitalize">{mistake}</span>
                <span className="text-xs font-mono font-semibold tnum" style={{ color: BRICK_C }}>{count}×</span>
              </div>
              <div className="h-1.5 rounded-full bg-tinted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${BRICK_C}, ${BRICK_C}80)` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Weakness Alerts ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeaknessAlerts({ stats }: { stats: any }) {
  const alerts: { icon: React.ElementType; color: string; bg: string; text: string }[] = [];

  // Check for loss streak
  const calArr = (stats.calendarData || []) as { pnl: number; date: string }[];
  const sortedDays = [...calArr].sort((a, b) => a.date.localeCompare(b.date));
  let lossStreak = 0;
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    if (sortedDays[i].pnl < 0) lossStreak++;
    else break;
  }
  if (lossStreak >= 3) {
    alerts.push({ icon: TrendingDown, color: BRICK, bg: `${BRICK}12`, text: `${lossStreak} убыточных дня подряд. Стоит сделать паузу и пересмотреть подход.` });
  }

  // Check win rate below 40%
  if (stats.totalTrades >= 10 && stats.winRate < 40) {
    alerts.push({ icon: AlertTriangle, color: "#B08050", bg: "rgba(176,128,80,0.10)", text: `Win rate ${stats.winRate}% — ниже 40%. Пересмотрите правила входа.` });
  }

  // Check large max drawdown vs balance (from BalanceHeroRow we don't have balance here, use netPnl / maxDrawdown)
  if (stats.maxDrawdown && stats.maxDrawdown < -1000) {
    const ratio = Math.abs(stats.maxDrawdown) / Math.max(1, Math.abs(stats.netPnl || 1));
    if (ratio > 3) {
      alerts.push({ icon: AlertTriangle, color: BRICK, bg: `${BRICK}12`, text: `Max Drawdown $${Math.abs(stats.maxDrawdown).toFixed(0)} значительно превышает текущую прибыль. Пересмотрите управление рисками.` });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const Icon = alert.icon;
        return (
          <div key={i} className="flex items-start gap-3 rounded-xl border px-4 py-3"
            style={{ background: alert.bg, borderColor: `${alert.color}30` }}>
            <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: alert.color }} />
            <p className="text-sm" style={{ color: alert.color }}>{alert.text}</p>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const t = useT();
  const { stats, loading } = useStats();
  const { darkMode, lang } = useAppStore();
  const { data: session } = useSession();
  const toast = useToast();

  // P1.5-34: Alert toasts for daily loss limit and 3-loss streak
  useEffect(() => {
    if (!stats || loading) return;
    const key = `tz-alerts-${toLocalDayKey(new Date())}`;
    try {
      if (localStorage.getItem(key)) return; // already shown today
    } catch { /* noop */ }

    const shown: string[] = [];

    // Check daily loss limit
    const todayStr = toLocalDayKey(new Date());
    const todayEntry = (stats.calendarData || []).find((d: { date: string }) => d.date === todayStr) as { pnl: number } | undefined;
    // We don't have settings here, but WeaknessAlerts already handles this visually.
    // For toast: check 3+ consecutive loss days
    const calArr = (stats.calendarData || []) as { pnl: number; date: string }[];
    const sorted = [...calArr].sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].pnl < 0) streak++;
      else break;
    }
    if (streak >= 3) {
      shown.push("streak");
      setTimeout(() => toast(`⚠️ ${streak} убыточных дня подряд. Сделай паузу и пересмотри подход.`, "error"), 1500);
    }

    // Check today is losing
    if (todayEntry && todayEntry.pnl < -500) {
      shown.push("loss");
      setTimeout(() => toast(`Сегодня убыток $${Math.abs(todayEntry.pnl).toFixed(0)}. Следи за лимитом!`, "error"), 2500);
    }

    if (shown.length > 0) {
      try { localStorage.setItem(key, "1"); } catch { /* noop */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, loading]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dash_greeting_morning") : hour < 18 ? t("dash_greeting_afternoon") : t("dash_greeting_evening");
  const firstName = (session?.user?.name || "").split(" ")[0] || t("dash_default_name");
  const dateLocale = lang === "ru" ? "ru-RU" : "en-GB";

  if (loading) return <DashboardSkeleton />;

  const visibleTradeCount = stats?.totalAnyTrades ?? stats?.totalTrades ?? 0;
  const hasAnyTrades = visibleTradeCount > 0;

  if (!stats || !hasAnyTrades) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <BarChart3 className="h-16 w-16 text-ink-4 mb-4" />
        <h2 className="text-xl font-semibold text-ink mb-2">{t("dash_no_trades")}</h2>
        <p className="text-ink-3 mb-6 max-w-md">{t("dash_no_trades_desc")}</p>
        <Link href="/trades"
          className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors">
          {t("dash_add_first")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8 page-enter">

      {/* ── Page header — editorial masthead (Trevixe) ── */}
      <div className="pt-2 pb-5 border-b border-stroke">
        <div className="flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className="editorial-label text-ink-5">
                {new Date().toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              <span className="editorial-label text-ink-5">
                · {getTradesLoggedLabel(visibleTradeCount, lang, t)}
              </span>
            </div>
            <h1 className="font-serif text-[40px] md:text-[52px] leading-[0.98] tracking-[-0.03em] font-bold mt-3">
              {greeting}, <span className="italic text-ink-3">{firstName}</span><span className="text-brand">.</span>
            </h1>
            <p className="text-[13px] text-ink-3 mt-2 max-w-md font-serif italic">
              {t("dash_header_quote")}
            </p>
          </div>

        </div>
      </div>

      {/* ── Advanced alerts banner (Pro+) ── */}
      <AdvancedAlertsBanner />

      {/* ── Pre-trade checklist ── */}
      <PreTradeChecklist />

      {/* ── Risk Management strip (collapsed by default) ── */}
      <div className="anim-fade-up delay-0">
        <RiskManagementWidget stats={stats} t={t} />
      </div>

      {/* ── BENTO ROW 1: Balance (5 cols) + Equity chart (7 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 anim-fade-up delay-50">
        <div className="lg:col-span-5">
          <BalanceHeroRow stats={stats} darkMode={darkMode} t={t} />
        </div>
        <div className="lg:col-span-7">
          <TabbedCharts stats={stats} darkMode={darkMode} t={t} />
        </div>
      </div>

      {/* ── BENTO ROW 2: KPI sparkline strip (6 cards) ── */}
      <div className="anim-fade-up delay-150">
        <KpiSparklineStrip stats={stats} />
      </div>

      {/* ── BENTO ROW 3: Calendar (7) + combined Win/Loss · Recent trades (5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch anim-fade-up delay-200">
        <div className="lg:col-span-7">
          <PnlCalendar calendarData={stats.calendarData || []} />
        </div>
        <div className="lg:col-span-5 flex flex-col gap-4 h-full">
          <WinLossRingCard stats={stats} darkMode={darkMode} t={t} />
          <RecentTradesWidget />
        </div>
      </div>

      {/* ── BENTO ROW 4: Dense stats (full width) ── */}
      <div className="anim-fade-up delay-250">
        <BentoStatsPanel stats={stats} t={t} />
      </div>

      {/* ── BENTO ROW 5: Rule Violations (full width) ── */}
      <div className="anim-fade-up delay-300">
        <RuleViolationsWidget />
      </div>

      {/* ── BENTO ROW 6: Weakness Alerts ── */}
      <div className="anim-fade-up delay-400">
        <WeaknessAlerts stats={stats} />
      </div>

      {/* ── BENTO ROW 7: Lesson of the Day + Pinned Notes ── */}
      <div className="anim-fade-up delay-500">
        <LessonOfDay />
        <PinnedNotesWidget />
      </div>
    </div>
  );
}
