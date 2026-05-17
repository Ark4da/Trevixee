"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Save, Star, Check, ImagePlus, X,
  Loader2, TrendingUp, TrendingDown, Minus, Zap, Wind, Target, Wand2,
  Users2, Lock,
} from "lucide-react";
import { useT } from "@/lib/useT";
import { Portal } from "@/components/ui/portal";
import { useToast } from "@/components/ui/toast";
import { InlineHint } from "@/components/ui/context-tip";

// Institutional matte palette
const SAGE    = "#22C55E";
const BRICK  = "#EF4444";
const AMBER = "#B08050";

interface JournalEntry {
  id: string; date: string; preMarketNotes: string | null; postMarketNotes: string | null;
  marketCondition: string | null; emotionalState: string | null; rulesFollowed: boolean;
  lessonsLearned: string | null; dailyGoal: string | null; goalMet: boolean;
  rating: number | null; notes: string | null; sharedWithTeam: boolean;
}

interface DayTrade {
  id: string;
  symbol: string;
  side: string;
  pnl: number;
  netPnl: number;
  rMultiple: number;
  setup: string | null;
  strategy: string | null;
  entryDate: string;
  notes: string | null;
  mistakes: string | null;
  rating: number | null;
  emotionalState: string | null;
}

interface CalendarTradeDay {
  count: number;
  netPnl: number;
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displayDate(d: Date, lang: string) {
  return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function uniqueClean(values: Array<string | null | undefined>) {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])];
}

function splitCommaList(values: Array<string | null | undefined>) {
  return uniqueClean(values.flatMap((value) => value ? value.split(",") : []));
}

function appendBlock(current: string, title: string, body: string) {
  const block = `${title}\n${body}`;
  return current.trim() ? `${current.trim()}\n\n${block}` : block;
}

function upsertLastBlock(current: string, title: string, body: string) {
  const block = `${title}\n${body}`;
  const trimmed = current.trim();
  const markerIndex = trimmed.lastIndexOf(title);
  if (markerIndex === -1) return appendBlock(trimmed, title, body);
  const before = trimmed.slice(0, markerIndex).trimEnd();
  return before ? `${before}\n\n${block}` : block;
}

function formatTradePoint(trade: DayTrade | null, fallback: string) {
  if (!trade) return fallback;
  const pnl = trade.netPnl ?? trade.pnl;
  const setup = trade.setup ? ` · ${trade.setup}` : "";
  const r = trade.rMultiple ? ` · ${trade.rMultiple.toFixed(2)}R` : "";
  return `${trade.symbol} ${trade.side.toUpperCase()} ${money(pnl)}${r}${setup}`;
}

function pluralizeEntries(count: number, lang: string, words: { one: string; few: string; many: string }) {
  if (lang !== "ru") return count === 1 ? words.one : words.many;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return words.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 > 20)) return words.few;
  return words.many;
}

const SCREENSHOTS_KEY = (date: string) => `tz-screenshots-${date}`;
function loadScreenshots(date: string): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SCREENSHOTS_KEY(date)) || "[]"); } catch { return []; }
}
function saveScreenshots(date: string, urls: string[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SCREENSHOTS_KEY(date), JSON.stringify(urls)); } catch { /* noop */ }
}

const MARKET_CONDITIONS = [
  { value: "trending_up",   Icon: TrendingUp,   key: "mc_trending_up_s",   hex: SAGE  },
  { value: "trending_down", Icon: TrendingDown,  key: "mc_trending_down_s", hex: BRICK },
  { value: "ranging",       Icon: Minus,         key: "mc_ranging_s",       hex: "#7A8AAC" },
  { value: "volatile",      Icon: Zap,           key: "mc_volatile_s",      hex: AMBER },
  { value: "calm",          Icon: Wind,          key: "mc_calm_s",          hex: "#6E9FAF" },
];

const MOODS = [
  { value: "confident",  key: "es_confident"  },
  { value: "neutral",    key: "es_neutral"    },
  { value: "anxious",    key: "es_anxious"    },
  { value: "fearful",    key: "es_fearful"    },
  { value: "greedy",     key: "es_greedy"     },
  { value: "frustrated", key: "es_frustrated" },
  { value: "tired",      key: "es_tired"      },
] as const;

// ─── Mini Calendar ───────────────────────────────────────────────────────────
function MiniCalendar({
  entries, selectedDate, onSelect, lang,
}: {
  entries: JournalEntry[];
  selectedDate: Date;
  onSelect: (d: Date) => void;
  lang: string;
}) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const selYear = selectedDate.getFullYear();
  const selMonth = selectedDate.getMonth();
  useEffect(() => {
    const id = setTimeout(() => {
      setViewYear(selYear);
      setViewMonth(selMonth);
    }, 0);
    return () => clearTimeout(id);
  }, [selYear, selMonth]);

  const entryMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    entries.forEach((e) => {
      const dateOnly = (e.date as string).split("T")[0];
      map[dateOnly] = e.rating;
    });
    return map;
  }, [entries]);
  const [tradeMap, setTradeMap] = useState<Record<string, CalendarTradeDay>>({});

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  useEffect(() => {
    const controller = new AbortController();
    const tzOffset = new Date().getTimezoneOffset();
    const from = formatDate(new Date(viewYear, viewMonth, 1));
    const to = formatDate(new Date(viewYear, viewMonth + 1, 0));

    fetch(`/api/trades?from=${from}&to=${to}&limit=2000&tzOffset=${tzOffset}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: { trades?: Array<{ entryDate: string; pnl?: number | null; netPnl?: number | null }> }) => {
        const next: Record<string, CalendarTradeDay> = {};
        for (const trade of data.trades ?? []) {
          const key = formatDate(new Date(trade.entryDate));
          const current = next[key] ?? { count: 0, netPnl: 0 };
          current.count += 1;
          current.netPnl += Number(trade.netPnl ?? trade.pnl ?? 0);
          next[key] = current;
        }
        setTradeMap(next);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setTradeMap({});
      });

    return () => controller.abort();
  }, [viewYear, viewMonth]);

  const today = new Date();
  const todayStr = formatDate(today);
  const selectedStr = formatDate(selectedDate);

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    lang === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" }
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const dayHeaders = lang === "ru"
    ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div className="rounded-xl border border-stroke bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-tinted text-ink-3 hover:text-ink transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-ink capitalize">{monthName}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-tinted text-ink-3 hover:text-ink transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-ink-4 py-0.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: startOffset }).map((_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(viewYear, viewMonth, day);
          const dStr = formatDate(d);
          const hasEntry = dStr in entryMap;
          const entryRating = entryMap[dStr];
          const tradeDay = tradeMap[dStr];
          const hasTrades = Boolean(tradeDay?.count);
          const isSelected = dStr === selectedStr;
          const isToday = dStr === todayStr;
          const isFuture = d > today;
          const tradeColor = (tradeDay?.netPnl ?? 0) >= 0 ? SAGE : BRICK;
          const hasJournaledTrades = hasEntry && hasTrades;

          const dotColor = !hasEntry ? ""
            : entryRating === null ? "bg-ink-4"
            : entryRating >= 4 ? ""
            : entryRating >= 3 ? "bg-amber-400"
            : "";
          const dotStyleFinal = hasEntry && entryRating !== null
            ? entryRating >= 4 ? { background: SAGE }
            : entryRating >= 3 ? undefined
            : { background: BRICK }
            : undefined;

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelect(d)}
              disabled={isFuture}
              title={hasTrades
                ? `${tradeDay?.count ?? 0} ${lang === "ru" ? "сделок" : "trades"} · ${money(tradeDay?.netPnl ?? 0)}`
                : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg h-8 w-full text-xs transition-colors",
                isSelected
                  ? "bg-brand text-white font-bold"
                  : isFuture
                  ? "text-ink-5 cursor-default"
                  : hasJournaledTrades
                  ? "bg-tinted/70 text-ink font-semibold hover:bg-tinted"
                  : hasTrades
                  ? "bg-white/[0.025] text-ink-3 hover:bg-tinted/70 hover:text-ink"
                  : isToday
                  ? "text-brand font-bold"
                  : "text-ink-3 hover:bg-tinted hover:text-ink cursor-pointer"
              )}
            >
              <span className="leading-none">{day}</span>
              {hasTrades ? (
                <span
                  className={cn(
                    "absolute bottom-0.5 h-1 rounded-full",
                    hasJournaledTrades ? "w-4" : "w-3",
                    isSelected ? "bg-white/80" : ""
                  )}
                  style={isSelected ? undefined : { background: tradeColor, opacity: hasJournaledTrades ? 0.95 : 0.38 }}
                />
              ) : hasEntry && (
                <span
                  className={cn(
                    "absolute bottom-0.5 h-1 w-1 rounded-full",
                    isSelected ? "bg-white/70" : dotColor
                  )}
                  style={isSelected ? undefined : dotStyleFinal}
                />
              )}
              {isToday && !isSelected && (
                <span className="absolute inset-0 rounded-lg border border-brand/40 pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pre-Trade Checklist ──────────────────────────────────────────────────────
const CHECKLIST_QUESTIONS = [
  { id: "slept",   textRu: "Я хорошо выспался и чувствую себя бодро", textEn: "I slept well and feel alert" },
  { id: "plan",    textRu: "У меня есть чёткий торговый план на сегодня", textEn: "I have a clear trading plan for today" },
  { id: "calm",    textRu: "Я спокоен — нет стресса вне рынка", textEn: "I am calm — no outside-market stress" },
  { id: "rules",   textRu: "Я знаю свои правила и готов их соблюдать", textEn: "I know my rules and am ready to follow them" },
  { id: "loss",    textRu: "Я готов принять убыток без эмоциональных решений", textEn: "I can accept a loss without emotional decisions" },
];

function PreTradeChecklist({ dateStr, lang }: { dateStr: string; lang: string }) {
  const storageKey = `checklist-${dateStr}`;
  const [answers, setAnswers] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(storageKey); } catch { return true; }
  });

  const score = CHECKLIST_QUESTIONS.filter((q) => answers[q.id]).length;
  const total = CHECKLIST_QUESTIONS.length;
  const pct = Math.round((score / total) * 100);
  const allAnswered = Object.keys(answers).length === total;
  const isRu = lang === "ru";

  const toggle = (id: string) => {
    const next = { ...answers, [id]: !answers[id] };
    setAnswers(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  const statusHex   = score >= 4 ? SAGE : score >= 3 ? AMBER : BRICK;
  const statusColor = "";
  const barColor    = score >= 3 ? (score >= 4 ? "" : "bg-amber-400") : "";
  const statusText = allAnswered
    ? score >= 4
      ? isRu ? "Отличная готовность — торгуй по плану" : "Ready — trade the plan"
      : score >= 3
        ? isRu ? "Осторожно — будь внимателен" : "Caution — stay selective"
        : isRu ? "Лучше пропустить день или наблюдать" : "Better to skip or observe today"
    : isRu ? `${score}/${total} ответов` : `${score}/${total} answered`;

  return (
    <div className="rounded-xl border border-stroke bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-tinted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: score >= 4 ? `${SAGE}26` : score >= 3 ? `${AMBER}26` : `${BRICK}26` }}
          >
            {score >= 4 ? "✅" : score >= 3 ? "⚠️" : "🔴"}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-ink">{isRu ? "Готов к торговле?" : "Ready to trade?"}</p>
            <p className={cn("text-xs font-medium", statusColor)} style={{ color: statusHex }}>
              {statusText}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {allAnswered && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-stroke-2 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%`, ...(score !== 3 ? { background: statusHex } : {}) }} />
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: statusHex }}>{score}/{total}</span>
            </div>
          )}
          <span className="text-ink-4 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2 border-t border-stroke">
          <p className="text-xs text-ink-4 pt-3 pb-1">
            {isRu ? "Отметь каждый пункт честно перед началом торговли:" : "Check each item honestly before trading:"}
          </p>
          {CHECKLIST_QUESTIONS.map((q) => (
            <button
              key={q.id}
              onClick={() => toggle(q.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all border",
                answers[q.id]
                  ? "text-ink"
                  : "border-stroke-2 bg-tinted/50 text-ink-3 hover:border-stroke hover:text-ink"
              )}
              style={answers[q.id] ? { borderColor: `${SAGE}4D`, background: `${SAGE}14` } : undefined}
            >
              <div
                className={cn(
                  "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  answers[q.id] ? "" : "border-stroke-2"
                )}
                style={answers[q.id] ? { borderColor: SAGE, background: SAGE } : undefined}
              >
                {answers[q.id] && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <span className="text-left">{isRu ? q.textRu : q.textEn}</span>
            </button>
          ))}

          {allAnswered && score < 3 && (
            <div className="mt-3 rounded-lg border px-4 py-3" style={{ borderColor: `${BRICK}4D`, background: `${BRICK}14` }}>
              <p className="text-sm font-semibold" style={{ color: BRICK }}>
                {isRu ? "⚠ Рекомендация: не торгуй сегодня" : "⚠ Recommendation: do not trade today"}
              </p>
              <p className="text-xs text-ink-4 mt-1">
                {isRu ? (
                  <>
                    Твоя готовность {score}/5. Лучшие трейдеры знают когда <em>не</em> торговать.
                    Потраченный день на наблюдение лучше, чем потерянный депозит.
                  </>
                ) : (
                  <>
                    Your readiness is {score}/5. The best traders know when <em>not</em> to trade.
                    A day spent observing is better than a lost account.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function JournalPage() {
  const t = useT();
  const toast = useToast();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAppStore } = require("@/store");
  const lang = useAppStore((s: { lang: string }) => s.lang);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [dayTrades, setDayTrades] = useState<DayTrade[]>([]);
  const [dayPnl, setDayPnl] = useState(0);
  const [saving, setSaving] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [canUseAi, setCanUseAi] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [hasTeamWorkspace, setHasTeamWorkspace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [preMarketNotes, setPreMarketNotes]   = useState("");
  const [postMarketNotes, setPostMarketNotes] = useState("");
  const [marketCondition, setMarketCondition] = useState("");
  const [emotionalState, setEmotionalState]   = useState("");
  const [rulesFollowed, setRulesFollowed]     = useState(true);
  const [lessonsLearned, setLessonsLearned]   = useState("");
  const [dailyGoal, setDailyGoal]             = useState("");
  const [goalMet, setGoalMet]                 = useState(false);
  const [rating, setRating]                   = useState(0);
  const [notes, setNotes]                     = useState("");
  const [sharedWithTeam, setSharedWithTeam]   = useState(true);
  const [hoverRating, setHoverRating]         = useState(0);

  const [entries, setEntries] = useState<JournalEntry[]>([]);

  const dirty = () => setIsDirty(true);
  const dateStr = formatDate(currentDate);
  const isToday = dateStr === formatDate(new Date());
  const dayTradesHref = `/trades?from=${dateStr}&to=${dateStr}`;

  const loadEntries = useCallback(() => {
    fetch("/api/journal")
      .then((r) => { if (!r.ok) throw new Error("failed"); return r.json(); })
      .then(setEntries)
      .catch(() => toast(t("error_load"), "error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/me/entitlements")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setCanUseAi(Boolean(data?.capabilities?.canUseAiTradeReview)))
      .catch(() => setCanUseAi(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspaces")
      .then((res) => res.ok ? res.json() : [])
      .then((workspaces) => {
        if (!cancelled) setHasTeamWorkspace(Array.isArray(workspaces) && workspaces.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasTeamWorkspace(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEntry = useCallback(async () => {
    setLoading(true);
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const [entryRes, tradesRes] = await Promise.all([
        fetch(`/api/journal?date=${dateStr}`),
        fetch(`/api/trades?from=${dateStr}&to=${dateStr}&limit=100&tzOffset=${tzOffset}`),
      ]);
    if (!entryRes.ok || !tradesRes.ok) throw new Error("failed");
    const data = await entryRes.json();
    const tradesData = await tradesRes.json();

    if (data) {
      setPreMarketNotes(data.preMarketNotes || "");
      setPostMarketNotes(data.postMarketNotes || "");
      setMarketCondition(data.marketCondition || "");
      setEmotionalState(data.emotionalState || "");
      setRulesFollowed(data.rulesFollowed ?? true);
      setLessonsLearned(data.lessonsLearned || "");
      setDailyGoal(data.dailyGoal || "");
      setGoalMet(data.goalMet ?? false);
      setRating(data.rating || 0);
      setNotes(data.notes || "");
      setSharedWithTeam(data.sharedWithTeam ?? true);
    } else {
      setPreMarketNotes(""); setPostMarketNotes(""); setMarketCondition("");
      setEmotionalState(""); setRulesFollowed(true); setLessonsLearned("");
      setDailyGoal(""); setGoalMet(false); setRating(0); setNotes(""); setSharedWithTeam(true);
    }

    setDayTrades(
      tradesData.trades.map((tr: DayTrade) => ({
        id: tr.id,
        symbol: tr.symbol,
        side: tr.side,
        pnl: tr.pnl,
        netPnl: tr.netPnl ?? tr.pnl,
        rMultiple: tr.rMultiple ?? 0,
        setup: tr.setup,
        strategy: tr.strategy,
        entryDate: tr.entryDate,
        notes: tr.notes,
        mistakes: tr.mistakes,
        rating: tr.rating,
        emotionalState: tr.emotionalState,
      }))
    );
    setDayPnl(tradesData.trades.reduce((s: number, tr: DayTrade) => s + (tr.netPnl ?? tr.pnl), 0));
    setScreenshots(loadScreenshots(dateStr));
    setSaved(false);
    setIsDirty(false);
    } catch {
      toast(t("error_load"), "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  useEffect(() => { loadEntry(); }, [loadEntry]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Completion progress (7 tracked fields)
  const completionCount = [dailyGoal, preMarketNotes, marketCondition, emotionalState, postMarketNotes, lessonsLearned, rating ? "r" : ""].filter(Boolean).length;
  const completionPct = Math.round((completionCount / 7) * 100);

  // Win rate
  const winRate = dayTrades.length > 0
    ? Math.round((dayTrades.filter((t) => (t.netPnl ?? t.pnl) > 0).length / dayTrades.length) * 100)
    : 0;

  const tradeSummary = useMemo(() => {
    const sorted = [...dayTrades].sort((a, b) => (b.netPnl ?? b.pnl) - (a.netPnl ?? a.pnl));
    const wins = dayTrades.filter((tr) => (tr.netPnl ?? tr.pnl) > 0);
    const losses = dayTrades.filter((tr) => (tr.netPnl ?? tr.pnl) < 0);
    const flat = dayTrades.filter((tr) => (tr.netPnl ?? tr.pnl) === 0);
    const symbols = uniqueClean(dayTrades.map((tr) => tr.symbol));
    const setups = uniqueClean(dayTrades.map((tr) => tr.setup));
    const strategies = uniqueClean(dayTrades.map((tr) => tr.strategy));
    const mistakes = splitCommaList(dayTrades.map((tr) => tr.mistakes));
    const rated = dayTrades.filter((tr) => tr.rating);
    const avgRating = rated.length
      ? rated.reduce((sum, tr) => sum + (tr.rating ?? 0), 0) / rated.length
      : 0;
    const avgR = dayTrades.length
      ? dayTrades.reduce((sum, tr) => sum + (tr.rMultiple ?? 0), 0) / dayTrades.length
      : 0;

    return {
      wins,
      losses,
      flat,
      symbols,
      setups,
      strategies,
      mistakes,
      best: sorted[0] ?? null,
      worst: sorted[sorted.length - 1] ?? null,
      avgRating,
      avgR,
      totalNetPnl: dayTrades.reduce((sum, tr) => sum + (tr.netPnl ?? tr.pnl), 0),
    };
  }, [dayTrades]);

  // Week stats
  const weekStats = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const diff = (dow === 0 ? -6 : 1) - dow;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekEntries = entries.filter((e) => {
      const dateOnly = (e.date as string).split("T")[0];
      const [ey, em, ed] = dateOnly.split("-").map(Number);
      const d = new Date(ey, em - 1, ed);
      return d >= weekStart && d <= weekEnd;
    });
    const withRating = weekEntries.filter((e) => e.rating);
    const avgRating = withRating.length
      ? weekEntries.reduce((s, e) => s + (e.rating || 0), 0) / withRating.length
      : 0;
    return {
      count: weekEntries.length,
      avgRating,
      rulesDays: weekEntries.filter((e) => e.rulesFollowed).length,
    };
  }, [entries]);

  const summaryTitle = t("journal_summary_title");

  const handleAutoDraftTemplate = () => {
    const tradesWord = t("trades").toLowerCase();
    const beSuffix = tradeSummary.flat.length ? ` / ${tradeSummary.flat.length} BE` : "";
    const noData = t("journal_summary_no_data");
    const postDraft = [
      `${t("journal_summary_total")}: ${money(tradeSummary.totalNetPnl)} · ${dayTrades.length} ${tradesWord} · ${tradeSummary.wins.length}W / ${tradeSummary.losses.length}L${beSuffix} · ${winRate}% WR · avg R ${tradeSummary.avgR.toFixed(2)}.`,
      tradeSummary.symbols.length ? `${t("journal_summary_instruments")}: ${tradeSummary.symbols.join(", ")}.` : "",
      tradeSummary.setups.length ? `${t("journal_summary_setups")}: ${tradeSummary.setups.join(", ")}.` : "",
      `${t("journal_summary_best_trade")}: ${formatTradePoint(tradeSummary.best, noData)}.`,
      tradeSummary.worst && tradeSummary.worst.id !== tradeSummary.best?.id
        ? `${t("journal_summary_worst_trade")}: ${formatTradePoint(tradeSummary.worst, noData)}.`
        : "",
      tradeSummary.mistakes.length ? `${t("journal_summary_mistakes")}: ${tradeSummary.mistakes.join(", ")}.` : "",
      `${t("journal_summary_next")}: ${tradeSummary.losses.length > 0
        ? t("journal_summary_next_loss")
        : t("journal_summary_next_win")}.`,
    ].filter(Boolean).join("\n");

    const wasUpdated = postMarketNotes.includes(summaryTitle);
    setPostMarketNotes((current) => upsertLastBlock(current, summaryTitle, postDraft));

    if (!lessonsLearned) {
      const lessonDraft = tradeSummary.losses.length > 0
        ? t("journal_lesson_loss", {
            list: tradeSummary.losses.map((l) => `${l.symbol} ${money(l.netPnl ?? l.pnl)}`).join(", "),
          })
        : t("journal_lesson_win", {
            list: tradeSummary.setups.length ? tradeSummary.setups.join(", ") : t("journal_lesson_win_fallback"),
          });
      setLessonsLearned(lessonDraft);
    }

    if (!notes && tradeSummary.mistakes.length > 0) {
      setNotes(t("journal_notes_mistakes", { list: tradeSummary.mistakes.join(", ") }));
    }

    dirty();
    toast(wasUpdated ? t("journal_summary_updated") : t("journal_summary_built"), "success");
  };

  const handleAutoDraft = async () => {
    if (dayTrades.length === 0) {
      toast(t("journal_summary_no_trades"), "error");
      return;
    }

    if (!canUseAi) {
      toast(t("journal_ai_pro_only"), "error");
      return;
    }

    setAiDrafting(true);
    try {
      const res = await fetch("/api/journal/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr }),
      });
      if (!res.ok) {
        handleAutoDraftTemplate();
        return;
      }
      const draft = (await res.json()) as { postMarketNotes?: string; lessonsLearned?: string; notes?: string };
      const wasUpdated = postMarketNotes.includes(summaryTitle);
      if (draft.postMarketNotes) {
        setPostMarketNotes((current) => upsertLastBlock(current, summaryTitle, draft.postMarketNotes!));
      }
      if (draft.lessonsLearned && !lessonsLearned) {
        setLessonsLearned(draft.lessonsLearned);
      }
      if (draft.notes && !notes) {
        setNotes(draft.notes);
      }
      dirty();
      toast(wasUpdated ? t("journal_summary_updated") : t("journal_summary_built"), "success");
    } catch {
      handleAutoDraftTemplate();
    } finally {
      setAiDrafting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr, preMarketNotes, postMarketNotes, marketCondition,
          emotionalState, rulesFollowed, lessonsLearned, dailyGoal, goalMet, rating, notes, sharedWithTeam,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setSaved(true);
      setIsDirty(false);
      loadEntries();
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast(t("error_save"), "error");
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setScreenshots((prev) => {
          const next = [...prev, data.url];
          saveScreenshots(dateStr, next);
          return next;
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach(uploadFile);
    e.target.value = "";
  };

  const removeScreenshot = (url: string) => {
    setScreenshots((prev) => {
      const next = prev.filter((u) => u !== url);
      saveScreenshots(dateStr, next);
      return next;
    });
  };

  // Paste from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) uploadFile(file);
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  const navigateTo = (d: Date) => {
    if (isDirty) setPendingDate(d);
    else setCurrentDate(d);
  };
  const goDay = (offset: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    navigateTo(d);
  };

  // Ctrl+S
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Derived / display values for editorial masthead ────────────────────────
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries]
  );
  const mastheadDate    = currentDate.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const mcMeta = MARKET_CONDITIONS.find(m => m.value === marketCondition);
  const moodMeta = MOODS.find(m => m.value === emotionalState);

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-0 -mx-6 -mt-6 min-h-[calc(100vh-3.5rem)] page-enter">

      {/* ══════════ LEFT: entry list pane (340px) ══════════ */}
      <aside className="w-full lg:w-[340px] shrink-0 border-r border-stroke flex flex-col bg-card/40">
        {/* Header */}
        <div className="h-14 border-b border-stroke px-5 flex items-center justify-between">
          <div>
            <p className="editorial-label">{t("journal_title")}</p>
            <p className="text-[11px] text-ink-5 mt-0.5 tnum">
              {entries.length} {pluralizeEntries(entries.length, lang, {
                one: t("journal_entry_word"),
                few: lang === "ru" ? "записи" : "entries",
                many: t("journal_entries_word"),
              })}
            </p>
          </div>
          <button
            onClick={() => navigateTo(new Date())}
            title={t("today")}
            className="h-8 w-8 rounded-lg bg-brand hover:bg-brand-hover flex items-center justify-center text-white transition-colors"
            style={{ boxShadow: "0 4px 14px rgba(240,114,64,0.28)" }}
          >
            <span className="text-[18px] leading-none font-semibold">+</span>
          </button>
        </div>

        {/* Mini calendar */}
        <div className="p-4 border-b border-stroke">
          <MiniCalendar
            entries={entries}
            selectedDate={currentDate}
            onSelect={navigateTo}
            lang={lang}
          />
        </div>

        {/* Weekly summary strip */}
        <div className="px-5 py-3 border-b border-stroke grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-serif text-lg font-bold tnum text-ink">{weekStats.count}</p>
            <p className="editorial-label">{t("journal_entries_stat")}</p>
          </div>
          <div>
            <p className="font-serif text-lg font-bold tnum text-amber-400">
              {weekStats.avgRating > 0 ? weekStats.avgRating.toFixed(1) : "—"}
            </p>
            <p className="editorial-label">{t("journal_avg_stat")}</p>
          </div>
          <div>
            <p className="font-serif text-lg font-bold tnum" style={{ color: SAGE }}>{weekStats.rulesDays}</p>
            <p className="editorial-label">{t("journal_rules_stat")}</p>
          </div>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto divide-y divide-stroke">
          {sortedEntries.length === 0 ? (
            <div className="p-5 text-center text-[12px] text-ink-5 italic font-serif">
              {t("journal_entries_empty")}
            </div>
          ) : sortedEntries.slice(0, 30).map(entry => {
            const dateOnly = (entry.date as string).split("T")[0];
            const [y, m, dd] = dateOnly.split("-").map(Number);
            const eDate = new Date(y, m - 1, dd);
            const isActive = dateOnly === dateStr;
            const dateShort = eDate.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US",
              { weekday: "short", day: "numeric", month: "short" });
            const preview = (entry.postMarketNotes || entry.preMarketNotes || entry.lessonsLearned || entry.dailyGoal || "").slice(0, 55);
            const stars = entry.rating ?? 0;
            return (
              <button
                key={entry.id}
                onClick={() => navigateTo(eDate)}
                className={cn(
                  "w-full text-left p-4 transition-colors relative",
                  isActive ? "" : "hover:bg-tinted/40"
                )}
                style={isActive
                  ? { background: "rgba(240,114,64,0.06)", boxShadow: "inset 3px 0 0 var(--color-brand)" }
                  : undefined}
              >
                <div className="flex items-center justify-between">
                  <p className={cn("font-serif italic text-sm", isActive ? "text-ink" : "text-ink-2")}>{dateShort}</p>
                  {stars > 0 && (
                    <div className="flex text-amber-400 text-[11px] tracking-tighter">
                      {"★".repeat(stars)}<span className="text-ink-5">{"★".repeat(5 - stars)}</span>
                    </div>
                  )}
                </div>
                {preview && (
                  <p className={cn("text-[13px] mt-1.5 font-medium truncate", isActive ? "text-ink" : "text-ink-2")}>
                    {preview}{preview.length >= 55 ? "…" : ""}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {entry.rulesFollowed && (
                    <span className="chip" style={{ background: `${SAGE}26`, color: SAGE, padding: "1px 7px", fontSize: 10 }}>
                      ⚑ {t("journal_rules_stat")}
                    </span>
                  )}
                  {entry.goalMet && (
                    <span className="chip" style={{ background: "rgba(240,114,64,0.12)", color: "var(--color-brand)", padding: "1px 7px", fontSize: 10 }}>
                      ✓ {t("journal_daily_goal")}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ══════════ MAIN: editor (editorial article) ══════════ */}
      <main className="flex-1 min-w-0 overflow-x-hidden">

        {/* ── Masthead ── */}
        <div className="px-6 md:px-10 pt-8 pb-5 border-b border-stroke">
          <div className="flex items-center justify-between text-[10px] editorial-label mb-5 flex-wrap gap-2">
            <span>{mastheadDate}</span>
          </div>

          <div className="flex items-baseline justify-between gap-6 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-[40px] md:text-[54px] leading-[0.98] tracking-[-0.035em] font-bold">
                {dailyGoal
                  ? <>{dailyGoal}<span className="text-brand">.</span></>
                  : <span className="text-ink-3 italic font-normal">
                      {t("journal_intent_placeholder")}
                    </span>}
              </h1>
              <p className="text-[13px] text-ink-3 mt-3 max-w-md font-serif italic">
                {t("journal_intent_subtitle")}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-serif text-4xl md:text-5xl font-bold tnum leading-none"
                style={{ color: dayTrades.length === 0 ? "var(--color-ink-4)" : dayPnl >= 0 ? SAGE : BRICK }}>
                {dayTrades.length === 0 ? "—"
                  : `${dayPnl >= 0 ? "+" : "−"}$${Math.abs(dayPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              </p>
              <p className="editorial-label mt-2">
                {dayTrades.length} {t("trades").toLowerCase()}
                {dayTrades.length > 0 ? ` · ${winRate}% WR` : ""}
              </p>
            </div>
          </div>

          {/* Chip row */}
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            {moodMeta && (
              <span className="chip" style={{ background: "rgba(123,175,138,0.12)", color: SAGE, fontWeight: 600 }}>
                ● {t(moodMeta.key)}
              </span>
            )}
            {mcMeta && (
              <span className="chip" style={{ background: `${mcMeta.hex}1A`, color: mcMeta.hex, fontWeight: 600 }}>
                {t(mcMeta.key as Parameters<typeof t>[0])}
              </span>
            )}
            {rulesFollowed && (
              <span className="chip text-ink-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                ⚑ {t("journal_rules_followed")}
              </span>
            )}
            {rating > 0 && (
              <span className="chip text-amber-400" style={{ background: "rgba(255,255,255,0.04)", fontWeight: 700 }}>
                {"★".repeat(rating)}<span className="text-ink-5">{"★".repeat(5 - rating)}</span>
              </span>
            )}
            {!loading && (
              <span className="chip text-ink-5" style={{ background: "rgba(255,255,255,0.03)" }}>
                {completionPct}% {t("journal_complete_pct")}
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => goDay(-1)}
                className="rounded-lg border border-stroke px-2 py-1.5 text-[11px] text-ink-3 hover:text-ink hover:border-stroke-2 transition-colors">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => goDay(1)}
                disabled={isToday}
                className="rounded-lg border border-stroke px-2 py-1.5 text-[11px] text-ink-3 hover:text-ink hover:border-stroke-2 transition-colors disabled:opacity-30">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {dayTrades.length > 0 && (
                <button
                  onClick={handleAutoDraft}
                  disabled={aiDrafting}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-colors disabled:opacity-50",
                    canUseAi
                      ? "border-stroke-2 text-ink-3 hover:text-ink hover:border-stroke"
                      : "border-stroke-2 text-ink-4 hover:text-ink-2"
                  )}
                  title={canUseAi ? t("journal_summary_btn_title") : t("journal_ai_pro_only")}
                >
                  {aiDrafting
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : canUseAi ? <Wand2 className="h-3 w-3" /> : <Lock className="h-3 w-3 text-brand" />}
                  {t("journal_summary_btn")}
                  {!canUseAi && !aiDrafting && (
                    <span className="chip text-[9px] font-medium" style={{ background: "rgba(240,114,64,0.12)", color: "var(--color-brand)", padding: "1px 5px" }}>PRO</span>
                  )}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-semibold text-white transition-all disabled:opacity-50",
                  saved ? "" : isDirty ? "bg-amber-500 hover:bg-amber-400" : "bg-brand hover:bg-brand-hover"
                )}
                style={saved ? { background: SAGE } : undefined}
              >
                {saved ? <><Check className="h-3 w-3" /> {t("journal_saved")}</>
                  : saving ? <><Loader2 className="h-3 w-3 animate-spin" /> {t("journal_saving")}</>
                  : <><Save className="h-3 w-3" /> {isDirty ? t("journal_save_changes") : t("journal_save")}</>}
              </button>
            </div>
          </div>

          {hasTeamWorkspace && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand/20 bg-brand/[0.06] px-4 py-3 text-[12px] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Users2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-ink">
                    {sharedWithTeam ? t("journal_team_share_on") : t("journal_team_share_off")}
                  </p>
                  <p className="mt-0.5 leading-relaxed text-ink-4">
                    {sharedWithTeam ? t("journal_team_share_on_desc") : t("journal_team_share_off_desc")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSharedWithTeam((value) => !value);
                    dirty();
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    sharedWithTeam
                      ? "border-brand/30 text-brand hover:bg-brand/10"
                      : "border-stroke text-ink-4 hover:bg-tinted hover:text-ink"
                  )}
                >
                  {sharedWithTeam ? t("journal_shared") : t("journal_private")}
                </button>
                <Link
                  href="/team/journal"
                  className="rounded-lg border border-stroke px-3 py-1.5 text-[11px] font-semibold text-ink-4 transition-colors hover:bg-tinted hover:text-ink"
                >
                  {t("journal_team_link")}
                </Link>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-ink-5">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{t("loading")}</span>
          </div>
        ) : (
          <div className="px-6 md:px-10 py-8 max-w-[1200px]">
            <div className="grid grid-cols-12 gap-6 lg:gap-10">

              {/* ── Article body (8 cols) ── */}
              <article className="col-span-12 lg:col-span-8 space-y-10">
                {/* Pre-trade checklist, only today */}
                {isToday && <PreTradeChecklist dateStr={dateStr} lang={lang} />}

                {/* Pre-market */}
                <section>
                  <p className="editorial-label mb-3">{t("journal_pre_market")} — Pre-market</p>
                  <textarea
                    value={preMarketNotes}
                    onChange={(e) => { setPreMarketNotes(e.target.value); dirty(); }}
                    placeholder={t("journal_pre_notes_ph")}
                    rows={5}
                    className="w-full bg-transparent border-0 font-serif text-[18px] leading-[1.7] text-ink-2 placeholder:text-ink-5 placeholder:italic focus:outline-none resize-none"
                  />
                </section>

                <hr className="border-stroke" />

                {/* Post-market */}
                <section>
                  <p className="editorial-label mb-3">{t("journal_post_market_label")} — Post-market</p>
                  <textarea
                    value={postMarketNotes}
                    onChange={(e) => { setPostMarketNotes(e.target.value); dirty(); }}
                    placeholder={t("journal_post_notes_ph")}
                    rows={6}
                    className="w-full bg-transparent border-0 font-serif text-[17px] leading-[1.7] text-ink-2 placeholder:text-ink-5 placeholder:italic focus:outline-none resize-none"
                  />
                </section>

                <hr className="border-stroke" />

                {dayPnl < 0 && !lessonsLearned && (
                  <InlineHint message={t("journal_loss_day_hint")} />
                )}

                <section>
                  <p className="editorial-label mb-3">{t("journal_lesson_label")}</p>
                  <div className="pl-5 border-l-2 border-brand">
                    <textarea
                      value={lessonsLearned}
                      onChange={(e) => { setLessonsLearned(e.target.value); dirty(); }}
                      placeholder={t("journal_lessons_ph")}
                      rows={3}
                      className="w-full bg-transparent border-0 font-serif italic text-[20px] leading-[1.45] text-ink placeholder:text-ink-5 focus:outline-none resize-none"
                    />
                  </div>
                </section>

                <hr className="border-stroke" />

                {/* Free notes */}
                <section>
                  <p className="editorial-label mb-3">{t("journal_extra_label")}</p>
                  <textarea
                    value={notes}
                    onChange={(e) => { setNotes(e.target.value); dirty(); }}
                    placeholder={t("journal_extra_notes_ph")}
                    rows={3}
                    className="w-full bg-transparent border-0 font-serif text-[15px] leading-[1.7] text-ink-3 placeholder:text-ink-5 placeholder:italic focus:outline-none resize-none"
                  />
                </section>
              </article>

              {/* ── Sidebar (4 cols) ── */}
              <aside className="col-span-12 lg:col-span-4 space-y-5">
                {/* Trades today */}
                <div className="rounded-2xl border border-stroke bg-card p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, rgba(240,114,64,0.9), rgba(240,114,64,0.1))" }} />
                  <div className="flex items-center justify-between mb-3">
                    <p className="editorial-label">{t("journal_trades_today")}</p>
                    {dayTrades.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] tnum">
                          <span style={{ color: SAGE }}>{tradeSummary.wins.length}W</span>
                          <span className="text-ink-5 mx-1">/</span>
                          <span style={{ color: BRICK }}>{tradeSummary.losses.length}L</span>
                        </span>
                        <Link
                          href={dayTradesHref}
                          className="rounded-md border border-stroke-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-4 transition-colors hover:border-brand/40 hover:text-brand"
                        >
                          {t("journal_open_trades")}
                        </Link>
                      </div>
                    )}
                  </div>
                  {dayTrades.length === 0 ? (
                    <p className="text-[12px] text-ink-5 italic font-serif">{t("journal_no_trades_today")}</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="mb-3 rounded-xl border border-stroke bg-tinted/40 p-3">
                        <p className="text-[9px] uppercase tracking-wider text-ink-5 mb-2">
                          {t("journal_day_insight")}
                        </p>
                        <div className="space-y-1.5 text-[11px] leading-relaxed">
                          <p className="text-ink-3">
                            <span className="text-ink-5">{t("journal_best_label")}</span>{" "}
                            {formatTradePoint(tradeSummary.best, t("journal_no_winner"))}
                          </p>
                          {tradeSummary.worst && tradeSummary.worst.id !== tradeSummary.best?.id && (
                            <p className="text-ink-3">
                              <span className="text-ink-5">{t("journal_worst_label")}</span>{" "}
                              {formatTradePoint(tradeSummary.worst, t("journal_no_loser"))}
                            </p>
                          )}
                          <p className="text-ink-4">
                            {tradeSummary.losses.length > 0
                              ? t("journal_review_losers")
                              : t("journal_keep_winners")}
                          </p>
                        </div>
                      </div>
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-stroke bg-tinted/50 px-2 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-ink-5">{t("journal_winrate_label")}</p>
                          <p className="font-mono text-sm font-bold text-ink">{winRate}%</p>
                        </div>
                        <div className="rounded-lg border border-stroke bg-tinted/50 px-2 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-ink-5">{t("journal_avg_r_label")}</p>
                          <p className="font-mono text-sm font-bold text-ink">{tradeSummary.avgR.toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border border-stroke bg-tinted/50 px-2 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-ink-5">{t("journal_setups_count")}</p>
                          <p className="font-mono text-sm font-bold text-ink">{tradeSummary.setups.length || "—"}</p>
                        </div>
                      </div>
                      {(tradeSummary.setups.length > 0 || tradeSummary.mistakes.length > 0) && (
                        <div className="mb-3 space-y-1">
                          {tradeSummary.setups.length > 0 && (
                            <p className="line-clamp-2 text-[11px] text-ink-4">
                              <span className="text-ink-5">{t("journal_setups_label")}</span> {tradeSummary.setups.join(", ")}
                            </p>
                          )}
                          {tradeSummary.mistakes.length > 0 && (
                            <p className="line-clamp-2 text-[11px]" style={{ color: BRICK }}>
                              {t("journal_mistakes_label")} {tradeSummary.mistakes.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                      {dayTrades.map((tr, i) => (
                        <Link key={i} href={`/trades/${tr.id}`}
                          className="flex items-center justify-between text-xs group rounded-lg px-1 py-1 hover:bg-tinted transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                              style={tr.side === "long"
                                ? { background: `${SAGE}26`, color: SAGE }
                                : { background: `${BRICK}26`, color: BRICK }}>
                              {tr.side === "long" ? "L" : "S"}
                            </span>
                            <span className="font-mono font-semibold truncate">{tr.symbol}</span>
                            {tr.setup && <span className="text-[9px] text-brand/80 truncate hidden sm:inline">{tr.setup}</span>}
                          </div>
                          <span className="font-mono font-bold tnum" style={{ color: (tr.netPnl ?? tr.pnl) >= 0 ? SAGE : BRICK }}>
                            {(tr.netPnl ?? tr.pnl) >= 0 ? "+" : "−"}${Math.abs(tr.netPnl ?? tr.pnl).toFixed(0)}
                          </span>
                        </Link>
                      ))}
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-stroke">
                        <span className="editorial-label">{t("journal_day_total")}</span>
                        <span className="font-serif font-bold tnum text-base" style={{ color: dayPnl >= 0 ? SAGE : BRICK }}>
                          {dayPnl >= 0 ? "+" : "−"}${Math.abs(dayPnl).toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={handleAutoDraft}
                        disabled={aiDrafting}
                        title={canUseAi ? undefined : t("journal_ai_pro_only")}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-stroke-2 px-3 py-2 text-[11px] font-medium text-ink-3 transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand disabled:opacity-50"
                      >
                        {aiDrafting
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : canUseAi ? <Wand2 className="h-3 w-3" /> : <Lock className="h-3 w-3 text-brand" />}
                        {t("journal_build_from_trades")}
                        {!canUseAi && !aiDrafting && (
                          <span className="chip text-[9px] font-medium" style={{ background: "rgba(240,114,64,0.12)", color: "var(--color-brand)", padding: "1px 5px" }}>PRO</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Daily Goal */}
                <div className="rounded-2xl border border-stroke bg-card p-5">
                  <p className="editorial-label mb-2">{t("journal_daily_goal")}</p>
                  <div className="relative">
                    <Target className="absolute left-3 top-3 h-3.5 w-3.5 text-ink-4 pointer-events-none" />
                    <input
                      value={dailyGoal}
                      onChange={(e) => { setDailyGoal(e.target.value); dirty(); }}
                      placeholder={t("journal_daily_goal_ph")}
                      className="w-full rounded-lg border border-stroke-2 bg-tinted pl-9 pr-3 py-2 text-sm font-serif italic text-ink placeholder:text-ink-5 placeholder:not-italic focus:border-brand focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => { setGoalMet(!goalMet); dirty(); }}
                    className="mt-3 flex items-center gap-2 text-[11px] font-semibold transition-colors"
                    style={{ color: goalMet ? SAGE : "var(--color-ink-4)" }}>
                    <span className={cn(
                      "h-4 w-4 rounded flex items-center justify-center border-2 transition-colors",
                      goalMet ? "" : "border-stroke-2"
                    )} style={goalMet ? { background: SAGE, borderColor: SAGE } : undefined}>
                      {goalMet && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    {goalMet ? t("journal_completed") : t("journal_goal_met")}
                  </button>
                </div>

                {/* Mood + Market + Rules + Rating */}
                <div className="rounded-2xl border border-stroke bg-card p-5 space-y-4">
                  <p className="editorial-label">{t("journal_state_of_mind")}</p>

                  {/* Mood */}
                  <div>
                    <p className="text-[10px] font-semibold text-ink-4 uppercase tracking-wider mb-2">{t("journal_emotional_state")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MOODS.map(({ value, key }) => {
                        const active = emotionalState === value;
                        return (
                          <button key={value}
                            onClick={() => { setEmotionalState(active ? "" : value); dirty(); }}
                            className={cn("chip transition-all cursor-pointer",
                              active
                                ? ""
                                : "text-ink-3 hover:text-ink"
                            )}
                            style={active
                              ? { background: "rgba(240,114,64,0.12)", color: "var(--color-brand)", fontWeight: 600 }
                              : { background: "rgba(255,255,255,0.04)" }}>
                            {t(key).split(" / ")[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Market */}
                  <div>
                    <p className="text-[10px] font-semibold text-ink-4 uppercase tracking-wider mb-2">{t("journal_market_condition")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MARKET_CONDITIONS.map(({ value, Icon, key, hex }) => {
                        const active = marketCondition === value;
                        return (
                          <button key={value}
                            onClick={() => { setMarketCondition(active ? "" : value); dirty(); }}
                            className="chip inline-flex items-center gap-1 cursor-pointer"
                            style={active
                              ? { background: `${hex}1E`, color: hex, fontWeight: 600 }
                              : { background: "rgba(255,255,255,0.04)", color: "var(--color-ink-3)" }}>
                            <Icon className="h-3 w-3" />
                            {t(key as Parameters<typeof t>[0])}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rules + rating */}
                  <div className="pt-3 border-t border-stroke flex items-center justify-between">
                    <button
                      onClick={() => { setRulesFollowed(!rulesFollowed); dirty(); }}
                      className="flex items-center gap-2 text-xs font-medium"
                      style={{ color: rulesFollowed ? SAGE : "var(--color-ink-4)" }}>
                      <span className={cn(
                        "h-4 w-4 rounded flex items-center justify-center border-2",
                        rulesFollowed ? "" : "border-stroke-2"
                      )} style={rulesFollowed ? { background: SAGE, borderColor: SAGE } : undefined}>
                        {rulesFollowed && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </span>
                      ⚑ {t("journal_rules_followed")}
                    </button>
                  </div>

                  {/* Stars */}
                  <div>
                    <p className="text-[10px] font-semibold text-ink-4 uppercase tracking-wider mb-2">{t("journal_rate_day")}</p>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s}
                          onClick={() => { setRating(s === rating ? 0 : s); dirty(); }}
                          onMouseEnter={() => setHoverRating(s)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-0.5">
                          <Star className={cn(
                            "h-6 w-6 transition-all",
                            s <= (hoverRating || rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-ink-5 hover:text-amber-300"
                          )} />
                        </button>
                      ))}
                      {rating > 0 && <span className="ml-2 text-xs font-mono text-ink-3 tnum">{rating}/5</span>}
                    </div>
                  </div>
                </div>

                {/* Screenshots */}
                <div className="rounded-2xl border border-stroke bg-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="editorial-label">{t("journal_screenshots")}</p>
                    {screenshots.length > 0 && (
                      <span className="font-mono text-[10px] text-ink-5 tnum">{screenshots.length}</span>
                    )}
                  </div>
                  {screenshots.length === 0 ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-xl border-2 border-dashed border-stroke-2 py-8 text-center hover:border-brand/40 hover:bg-tinted/30 transition-all group">
                      <ImagePlus className="h-6 w-6 mx-auto mb-2 text-ink-5 group-hover:text-brand transition-colors" />
                      <p className="text-[11px] text-ink-5 font-serif italic">
                        {t("journal_paste_hint")}
                      </p>
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {screenshots.map(url => (
                        <div key={url}
                          className="group relative rounded-lg overflow-hidden border border-stroke-2 aspect-video bg-tinted cursor-zoom-in"
                          onClick={() => setLightboxUrl(url)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="screenshot" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <button onClick={(e) => { e.stopPropagation(); removeScreenshot(url); }}
                            className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-video rounded-lg border-2 border-dashed border-stroke-2 flex flex-col items-center justify-center text-ink-5 hover:text-brand hover:border-brand transition-colors text-[10px]">
                        {uploading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><ImagePlus className="h-4 w-4" /><span className="mt-0.5">{t("journal_add_screenshot")}</span></>}
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </aside>

            </div>
          </div>
        )}

      </main>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <Portal>
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center"
            onClick={() => setLightboxUrl(null)}
          >
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm" />
            <div className="relative max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt="screenshot"
                className="relative max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
              />
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Unsaved changes guard ── */}
      {pendingDate && (
        <Portal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setPendingDate(null)} />
            <div className="relative w-full max-w-sm rounded-xl border border-stroke bg-card shadow-2xl p-6">
              <h3 className="text-base font-semibold text-ink mb-2">{t("journal_unsaved")}</h3>
              <p className="text-sm text-ink-3 mb-5">
                {t("journal_unsaved_desc", { date: displayDate(currentDate, lang) })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPendingDate(null)}
                  className="flex-1 rounded-lg border border-stroke-2 py-2 text-sm text-ink-3 hover:text-ink transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => { setIsDirty(false); setCurrentDate(pendingDate); setPendingDate(null); }}
                  className="flex-1 rounded-lg border py-2 text-sm transition-colors"
                  style={{ borderColor: `${BRICK}4D`, background: `${BRICK}1A`, color: BRICK }}
                >
                  {t("journal_discard")}
                </button>
                <button
                  onClick={async () => { await handleSave(); setCurrentDate(pendingDate); setPendingDate(null); }}
                  className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-hover transition-colors"
                >
                  {t("journal_save_go")}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
