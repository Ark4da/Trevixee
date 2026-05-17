"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Info, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightItem {
  title: string;
  detail: string;
  metric?: string;
  severity: "good" | "warn" | "bad" | "neutral";
}

interface InsightsResponse {
  generatedAt: string;
  tradesAnalyzed: number;
  windowDays: number;
  insights: InsightItem[];
  aiPowered: boolean;
}

const SEV: Record<InsightItem["severity"], { bg: string; color: string; border: string; Icon: React.ElementType }> = {
  good:    { bg: "rgba(34,197,94,0.08)",   color: "#22C55E", border: "rgba(34,197,94,0.2)",   Icon: CheckCircle2 },
  warn:    { bg: "rgba(176,128,80,0.09)",  color: "#B08050", border: "rgba(176,128,80,0.2)",  Icon: AlertTriangle },
  bad:     { bg: "rgba(239,68,68,0.08)",   color: "#EF4444", border: "rgba(239,68,68,0.2)",   Icon: AlertTriangle },
  neutral: { bg: "rgba(99,102,241,0.08)",  color: "#6366F1", border: "rgba(99,102,241,0.18)", Icon: Info },
};

const WINDOWS = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y",  days: 365 },
];

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex gap-3 rounded-xl border border-stroke-2 bg-tinted p-3">
          <div className="h-7 w-7 rounded-md bg-stroke shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3 w-2/5 rounded bg-stroke" />
            <div className="h-2.5 w-full rounded bg-stroke" />
            <div className="h-2.5 w-3/4 rounded bg-stroke" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AiInsightsWidget() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (windowDays = days) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/insights?days=${windowDays}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json() as InsightsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  const changeWindow = (d: number) => {
    setDays(d);
    load(d);
  };

  return (
    <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <h3 className="text-sm font-semibold text-ink">Pattern Radar</h3>
            {data?.generatedAt && !loading && (
              <span className="text-[11px] text-ink-5">{timeAgo(data.generatedAt)}</span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-ink-5">
            Короткие сигналы из статистики. Глубокий разбор — в Trevixe Lens.
          </p>
          {data?.aiPowered && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
              <Zap className="h-2.5 w-2.5" /> AI
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Window selector */}
          <div className="flex rounded-lg border border-stroke bg-tinted p-0.5 gap-0.5">
            {WINDOWS.map(w => (
              <button
                key={w.days}
                onClick={() => changeWindow(w.days)}
                disabled={loading}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors",
                  days === w.days
                    ? "bg-brand text-white"
                    : "text-ink-5 hover:text-ink"
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          {!data ? (
            <button
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Analyze
            </button>
          ) : (
            <button
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stroke bg-tinted px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:bg-card transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {/* States */}
      {loading && <Skeleton />}

      {!loading && error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/08 px-4 py-3">
          <p className="text-[12px] text-red-400">{error}</p>
          <button onClick={() => load()} className="mt-2 text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors">
            Retry →
          </button>
        </div>
      )}

      {!loading && !data && !error && (
        <div className="rounded-xl border border-dashed border-stroke-2 p-6 text-center">
          <Sparkles className="mx-auto mb-3 h-7 w-7 text-ink-5 opacity-40" />
          <p className="text-[13px] text-ink-4">Нажми Analyze, чтобы получить короткие сигналы по сделкам за выбранный период.</p>
        </div>
      )}

      {!loading && data && data.tradesAnalyzed === 0 && (
        <p className="text-[13px] text-ink-4">{data.insights[0]?.detail ?? "No trades to analyze."}</p>
      )}

      {!loading && data && data.tradesAnalyzed > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-ink-5">
              {data.tradesAnalyzed} trades · last {data.windowDays}d
            </p>
            <Link
              href={`/sage?prompt=${encodeURIComponent(`Разбери мои AI insights за последние ${data.windowDays} дней и помоги превратить их в правила.`)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stroke bg-tinted px-2.5 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:border-brand/30 hover:text-ink"
            >
              Разобрать в AI
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {data.insights.map((ins, idx) => {
              const s = SEV[ins.severity] ?? SEV.neutral;
              const Icon = s.Icon;
              return (
                <li
                  key={idx}
                  className="flex min-h-[132px] flex-col rounded-xl p-3"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center" style={{ background: `${s.color}20` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                    </div>
                    {ins.metric && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold"
                        style={{ background: `${s.color}18`, color: s.color }}
                      >
                        {ins.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-ink leading-snug">{ins.title}</p>
                  <p className="pattern-radar-detail mt-1 text-[12px] text-ink-3 leading-relaxed">{ins.detail}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <style>{`
        .pattern-radar-detail {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
