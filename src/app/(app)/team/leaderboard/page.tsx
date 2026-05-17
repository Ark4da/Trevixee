"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { cn } from "@/lib/utils";
import { Trophy, Crown, TrendingUp, BookOpen, Target, Info, ShieldCheck } from "lucide-react";
import {
  TeamEmptyShowcase,
  TeamLoadingPanel,
} from "../_components/team-page-visuals";

interface LeaderRow {
  rank: number;
  memberId: string;
  userId: string;
  name: string;
  role: string;
  rulesFollowedPct: number;
  journalConsistencyPct: number;
  rExpectancy: number;
  tradeCount: number;
  journalDays: number;
  score: number;
}

type Period = "weekly" | "monthly";

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const tone =
      rank === 1
        ? "border-amber-400/40 bg-amber-400/12 text-amber-400"
        : rank === 2
          ? "border-slate-400/30 bg-slate-400/10 text-slate-300"
          : "border-orange-700/30 bg-orange-700/10 text-orange-300";
    return (
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-bold jb-mono", tone)}>
        {rank}
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-stroke bg-tinted text-[11px] font-bold text-ink-4 jb-mono">
      {rank}
    </span>
  );
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-tinted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export default function TeamLeaderboardPage() {
  const { activeWorkspaceId, resolvingWorkspace, workspaceError } = useTeamWorkspace();
  const router = useRouter();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [period, setPeriod] = useState<Period>("weekly");
  const [loading, setLoading] = useState(false);
  const [periodStart, setPeriodStart] = useState<string>("");

  const fetchLeaderboard = useCallback(async (wsId: string, p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/leaderboard?period=${p}`);
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.rows ?? []);
      setPeriodStart(data.periodStart ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) { setRows([]); return; }
    fetchLeaderboard(activeWorkspaceId, period);
  }, [activeWorkspaceId, period, fetchLeaderboard]);

  const periodLabel = periodStart
    ? new Date(periodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "";

  if (!activeWorkspaceId && !resolvingWorkspace) {
    return (
      <TeamEmptyShowcase
        eyebrow="Рейтинг Team Plan"
        title="Сделай рейтинг инструментом дисциплины, не гонкой P/L."
        description={
          workspaceError
            ? "Локальный workspace API сейчас недоступен, поэтому рейтинг команды не отображается."
            : "Выбери командный workspace, чтобы увидеть рейтинг по правилам, journaling и expectancy."
        }
        primaryHref="/settings?tab=account"
        primaryLabel="Создать workspace"
        secondaryHref="/team/analytics"
        secondaryLabel="Открыть аналитику"
        icon={Trophy}
        checklist={[
          "Проверить переключатели недели и месяца",
          "Проверить формулу рейтинга дисциплины",
          "Проверить пьедестал top-3",
          "Проверить строки участников",
        ]}
        cards={[
          { icon: Target, title: "Соблюдение правил", text: "Главный вес рейтинга у соблюдения правил, а не у случайного P/L." },
          { icon: BookOpen, title: "Регулярность журнала", text: "Рейтинг поощряет регулярный журнал и процесс разбора." },
          { icon: TrendingUp, title: "R-expectancy", text: "Expectancy учитывается как качество исполнения, но не доминирует." },
        ]}
      />
    );
  }

  if (resolvingWorkspace) {
    return (
      <TeamLoadingPanel
        title="Загружаю рейтинг"
        description="Собираю правила, journaling и expectancy по участникам."
        cards={4}
      />
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="pt-2 pb-5 border-b border-stroke flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="editorial-label">Team Discipline</p>
          <h1 className="font-serif text-[36px] leading-[0.98] tracking-[-0.03em] font-bold mt-2">
            Leaderboard<span className="text-brand">.</span>
          </h1>
          {periodLabel && (
            <p className="text-[12px] text-ink-5 mt-1.5">
              Since {periodLabel} · ranked by discipline, not P&amp;L
            </p>
          )}
        </div>

        {/* Period toggle */}
        <div className="inline-flex rounded-lg border border-stroke bg-card p-0.5 gap-0.5">
          {(["weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-colors capitalize",
                period === p ? "bg-tinted text-ink" : "text-ink-4 hover:text-ink-2"
              )}
            >
              {p === "weekly" ? "This week" : "This month"}
            </button>
          ))}
        </div>
      </div>

      {/* Scoring legend */}
      <div className="rounded-2xl border border-stroke bg-card px-5 py-3.5 shadow-deep flex flex-wrap items-center gap-5 anim-fade-up">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-4">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Discipline score =
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {[
            { icon: ShieldCheck,   color: "text-brand",     label: "40% Rules followed" },
            { icon: BookOpen, color: "text-indigo-400", label: "40% Journal consistency" },
            { icon: TrendingUp, color: "text-[#22C55E]", label: "20% R-expectancy" },
          ].map(({ icon: Icon, color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-ink-4">
              <Icon className={cn("h-3 w-3 shrink-0", color)} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Podium (top 3) */}
      {!loading && rows.length >= 2 && (
        <div className="grid grid-cols-1 gap-3 anim-fade-up delay-100 md:grid-cols-3">
          {/* 2nd */}
          <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep flex flex-col items-center gap-2 md:mt-8">
            <div className="h-10 w-10 rounded-full bg-[#94A3B8]/20 border border-[#94A3B8]/30 flex items-center justify-center text-[#94A3B8] text-[12px] font-bold">
              {rows[1]?.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="rounded-full border border-slate-400/30 bg-slate-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-300">Rank 2</span>
            <p className="text-[12px] font-semibold text-ink text-center truncate w-full">{rows[1]?.name}</p>
            <p className="font-serif text-[30px] font-bold leading-none tracking-tight text-ink tnum">{rows[1]?.score}</p>
            <p className="text-[10px] text-ink-5">score</p>
          </div>
          {/* 1st */}
          {rows[0] && (
            <div className="rounded-2xl border border-amber-400/30 bg-card p-5 flex flex-col items-center gap-2 shadow-deep relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #F59E0B, transparent)" }} />
              <div className="h-12 w-12 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 text-[13px] font-bold">
                {rows[0].name.slice(0, 2).toUpperCase()}
              </div>
              <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-400">Rank 1</span>
              <p className="text-[13px] font-semibold text-ink text-center truncate w-full">{rows[0].name}</p>
              <p className="font-serif text-[34px] font-bold leading-none tracking-tight text-ink tnum">{rows[0].score}</p>
              <p className="text-[10px] text-ink-5">score</p>
              {rows[0].role === "owner" && <Crown className="h-3.5 w-3.5 text-amber-400 absolute top-3 right-3" />}
            </div>
          )}
          {/* 3rd */}
          {rows[2] ? (
            <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep flex flex-col items-center gap-2 md:mt-12">
              <div className="h-9 w-9 rounded-full bg-amber-700/20 border border-amber-700/30 flex items-center justify-center text-amber-700 text-[11px] font-bold">
                {rows[2].name.slice(0, 2).toUpperCase()}
              </div>
              <span className="rounded-full border border-orange-700/30 bg-orange-700/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-orange-300">Rank 3</span>
              <p className="text-[12px] font-semibold text-ink text-center truncate w-full">{rows[2].name}</p>
              <p className="font-serif text-[28px] font-bold leading-none tracking-tight text-ink tnum">{rows[2].score}</p>
              <p className="text-[10px] text-ink-5">score</p>
            </div>
          ) : <div />}
        </div>
      )}

      {/* Full table */}
      <div className="rounded-2xl border border-stroke bg-card overflow-hidden shadow-deep anim-fade-up delay-200">
        <div className="px-5 py-3.5 border-b border-stroke flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            Full standings
          </h2>
          <span className="text-[11px] text-ink-5">{rows.length} traders</span>
        </div>

        {loading ? (
          <div className="p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-6 w-6 rounded-full bg-tinted" />
                <div className="h-9 w-9 rounded-full bg-tinted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-tinted" />
                  <div className="h-1.5 w-full rounded bg-tinted" />
                </div>
                <div className="h-5 w-10 rounded bg-tinted" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-ink-4">
            No data yet for this period
          </div>
        ) : (
          <ul className="divide-y divide-stroke">
            {rows.map((row, i) => (
              <li
                key={row.userId}
                onClick={() => router.push(`/team/members/${row.memberId}`)}
                className="px-5 py-4 hover:bg-tinted/40 transition-colors anim-fade-up cursor-pointer"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-7 flex items-center justify-center shrink-0">
                    <RankBadge rank={row.rank} />
                  </div>
                  <div className="h-9 w-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-[11px] font-bold shrink-0">
                    {row.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-medium text-ink truncate">{row.name}</span>
                      <span className="text-[10px] text-ink-5">{row.tradeCount} trades · {row.journalDays}d journal</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-ink-5">Rules</span>
                          <span className="text-[10px] font-semibold text-brand jb-mono">{row.rulesFollowedPct}%</span>
                        </div>
                        <ScoreBar value={row.rulesFollowedPct} color="var(--color-brand)" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-ink-5">Journal</span>
                          <span className="text-[10px] font-semibold text-indigo-400 jb-mono">{row.journalConsistencyPct}%</span>
                        </div>
                        <ScoreBar value={row.journalConsistencyPct} color="#6366F1" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-ink-5">R-exp.</span>
                          <span className={cn("text-[10px] font-semibold jb-mono", row.rExpectancy >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                            {row.rExpectancy >= 0 ? "+" : ""}{row.rExpectancy}
                          </span>
                        </div>
                        <ScoreBar value={Math.max(0, row.rExpectancy * 33)} color="#22C55E" />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-serif text-[22px] font-bold text-ink leading-none tracking-tight tnum">{row.score}</p>
                    <p className="text-[10px] text-ink-5 mt-0.5">score</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
