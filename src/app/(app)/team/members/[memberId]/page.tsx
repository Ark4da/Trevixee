"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { GradientAreaChart } from "@/components/ui/gradient-area-chart";
import {
  ArrowLeft, Users2, Crown, ShieldCheck, UserRound,
  Activity, Trophy, Target, BookOpen, TrendingUp, TrendingDown,
  EyeOff, AlertCircle,
} from "lucide-react";

type Period = "7d" | "30d" | "90d";

interface RecentTrade {
  id: string;
  symbol: string;
  side: string;
  netPnl: number | null;
  rMultiple: number;
  setup: string | null;
  entryDate: string;
  exitDate: string | null;
}

interface MemberDetail {
  memberId: string;
  userId: string;
  name: string;
  email: string | null;
  role: string;
  joinedAt: string;
  period: string;
  tradeCount: number;
  winRate: number;
  avgR: number;
  totalPnl: number | null;
  hideAmounts: boolean;
  journalDays: number;
  rulesFollowedPct: number;
  journalConsistencyPct: number;
  pnlByDay: { day: string; pnl: number }[];
  recentTrades: RecentTrade[];
}

function RoleBadge({ role }: { role: string }) {
  const cfg =
    role === "owner"
      ? { Icon: Crown, color: "text-amber-400", bg: "rgba(251,191,36,0.12)", label: "Owner" }
      : role === "mentor"
        ? { Icon: ShieldCheck, color: "text-indigo-400", bg: "rgba(99,102,241,0.12)", label: "Mentor" }
        : { Icon: UserRound, color: "text-ink-4", bg: "rgba(148,148,174,0.12)", label: "Member" };
  return (
    <span
      className="inline-flex items-center gap-1 chip text-[10px]"
      style={{ background: cfg.bg, padding: "2px 7px" }}
    >
      <cfg.Icon className={cn("h-3 w-3", cfg.color)} />
      <span className={cfg.color}>{cfg.label}</span>
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-stroke bg-card p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-ink-5 mb-1.5">{label}</p>
      <p
        className="font-serif text-[26px] font-bold leading-tight"
        style={{
          color: positive === true ? "#22C55E" : positive === false ? "#EF4444" : undefined,
        }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-ink-5 mt-0.5">{sub}</p>}
    </div>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-tinted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

function fmtMoney(n: number | null): string {
  if (n === null) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n >= 0 ? "+" : "−"}$${abs}`;
}

export default function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const router = useRouter();
  const { activeWorkspaceId, darkMode } = useAppStore();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("30d");

  const fetchMember = useCallback(async (p: Period) => {
    if (!activeWorkspaceId || !memberId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${memberId}/detail?period=${p}`);
      if (res.status === 403) {
        setError("This member is in a privacy period.");
        return;
      }
      if (!res.ok) {
        setError("Could not load member details.");
        return;
      }
      const d = await res.json();
      setData(d);
    } catch {
      setError("Could not load member details.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, memberId]);

  useEffect(() => {
    fetchMember(period);
  }, [fetchMember, period]);

  if (!activeWorkspaceId) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center page-enter">
        <Users2 className="h-14 w-14 text-ink-5 mb-4" />
        <h3 className="text-[15px] font-semibold text-ink mb-1.5">No team selected</h3>
        <p className="text-[13px] text-ink-3 max-w-xs leading-relaxed">
          Switch to a team workspace in the sidebar to view this member.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/team/members")}
          className="flex items-center gap-1.5 text-sm text-ink-4 hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to members
        </button>
        <div className="inline-flex rounded-lg border border-stroke bg-card p-0.5 gap-0.5">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                period === p ? "bg-tinted text-ink" : "text-ink-4 hover:text-ink-2"
              )}
            >
              {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="rounded-xl border border-stroke bg-card p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-tinted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-tinted" />
                <div className="h-3 w-32 rounded bg-tinted" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-stroke bg-card p-4 h-24" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-ink">{error}</p>
          <p className="text-[12px] text-ink-4 mt-1">
            Owners and mentors can view members in privacy period.
          </p>
        </div>
      ) : data ? (
        <>
          {/* Header card */}
          <div className="rounded-xl border border-stroke bg-card p-5 flex items-center gap-4 anim-fade-up">
            <div className="h-14 w-14 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-[15px] font-bold shrink-0">
              {data.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-[20px] font-bold text-ink truncate">{data.name}</h1>
                <RoleBadge role={data.role} />
                {data.hideAmounts && (
                  <span className="inline-flex items-center gap-1 chip text-[10px]" style={{ background: "rgba(148,148,174,0.12)", color: "#9494AE", padding: "2px 7px" }}>
                    <EyeOff className="h-3 w-3" />
                    Amounts hidden
                  </span>
                )}
              </div>
              {data.email && <p className="text-[12px] text-ink-5 truncate">{data.email}</p>}
              <p className="text-[11px] text-ink-5 mt-1">
                Joined {new Date(data.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Period note */}
          <div className="rounded-xl border border-stroke bg-tinted/40 px-4 py-2.5 text-[11px] text-ink-4 anim-fade-up">
            Stats below cover the last <span className="text-ink jb-mono">{data.period}</span>. Recent trades show up to 20 latest closed.
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 anim-fade-up">
            <StatTile
              label="Trades"
              value={String(data.tradeCount)}
              sub={`${data.winRate}% win`}
            />
            <StatTile
              label="Avg R"
              value={`${data.avgR >= 0 ? "+" : ""}${data.avgR.toFixed(2)}R`}
              positive={data.avgR >= 0}
            />
            <StatTile
              label="Total P/L"
              value={fmtMoney(data.totalPnl)}
              sub={data.totalPnl === null ? "Hidden by member" : undefined}
              positive={data.totalPnl !== null ? data.totalPnl >= 0 : undefined}
            />
            <StatTile
              label="Journal days"
              value={`${data.journalDays}/30`}
              sub={`${data.journalConsistencyPct}% consistency`}
            />
          </div>

          {/* Equity curve */}
          {data.pnlByDay.length > 1 ? (
            <div className="rounded-xl border border-stroke bg-card p-5 anim-fade-up">
              <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-ink">
                <TrendingUp className="h-4 w-4 text-ink-4" />
                Equity curve · {data.period}
              </h2>
              <GradientAreaChart
                data={data.pnlByDay.reduce<{ label: string; value: number }[]>((pts, pt) => {
                  const prev = pts.at(-1)?.value ?? 0;
                  return pts.concat({
                    label: new Date(pt.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
                    value: Math.round((prev + pt.pnl) * 100) / 100,
                  });
                }, [])}
                dark={darkMode}
                height={180}
                tooltipFormatter={(v) => `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`}
              />
            </div>
          ) : null}

          {/* Discipline breakdown */}
          <div className="rounded-xl border border-stroke bg-card p-5 space-y-4 anim-fade-up">
            <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Discipline breakdown
            </h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    <Target className="h-3 w-3 text-brand" />
                    Rules followed
                  </span>
                  <span className="text-[12px] font-semibold text-brand jb-mono">{data.rulesFollowedPct}%</span>
                </div>
                <ScoreBar value={data.rulesFollowedPct} color="var(--color-brand)" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    <BookOpen className="h-3 w-3 text-indigo-400" />
                    Journal consistency
                  </span>
                  <span className="text-[12px] font-semibold text-indigo-400 jb-mono">{data.journalConsistencyPct}%</span>
                </div>
                <ScoreBar value={data.journalConsistencyPct} color="#6366F1" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    <Activity className="h-3 w-3 text-[#22C55E]" />
                    Win rate
                  </span>
                  <span className="text-[12px] font-semibold jb-mono" style={{ color: data.winRate >= 50 ? "#22C55E" : "#EF4444" }}>{data.winRate}%</span>
                </div>
                <ScoreBar value={data.winRate} color="#22C55E" />
              </div>
            </div>
          </div>

          {/* Recent trades */}
          <div className="rounded-xl border border-stroke bg-card overflow-hidden anim-fade-up">
            <div className="px-5 py-3.5 border-b border-stroke flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
                <Activity className="h-4 w-4 text-ink-4" />
                Recent closed trades
              </h2>
              <span className="text-[11px] text-ink-5">{data.recentTrades.length}</span>
            </div>
            {data.recentTrades.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-ink-4">No closed trades to show.</div>
            ) : (
              <ul className="divide-y divide-stroke">
                {data.recentTrades.map((t) => {
                  const positive = t.netPnl !== null ? t.netPnl >= 0 : t.rMultiple >= 0;
                  return (
                    <li
                      key={t.id}
                      onClick={() => router.push(`/trades/${t.id}`)}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-tinted/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 shrink-0 w-32">
                        <span className="chip text-[10px] font-bold text-ink bg-tinted border border-stroke">{t.symbol}</span>
                        <span
                          className="chip text-[10px] font-semibold"
                          style={{
                            background: t.side === "long" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
                            color: t.side === "long" ? "#22C55E" : "#EF4444",
                          }}
                        >
                          {t.side?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-ink truncate">{t.setup ?? "—"}</p>
                        <p className="text-[10px] text-ink-5">
                          {t.exitDate ? new Date(t.exitDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn("text-[11px] jb-mono", positive ? "text-[#22C55E]" : "text-[#EF4444]")}>
                          {t.rMultiple >= 0 ? "+" : ""}{t.rMultiple.toFixed(2)}R
                        </span>
                        <span className={cn("text-[12px] jb-mono font-semibold w-20 text-right", positive ? "text-[#22C55E]" : "text-[#EF4444]")}>
                          {t.netPnl !== null ? fmtMoney(t.netPnl) : "—"}
                        </span>
                        {positive ? <TrendingUp className="h-3.5 w-3.5 text-[#22C55E]" /> : <TrendingDown className="h-3.5 w-3.5 text-[#EF4444]" />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
