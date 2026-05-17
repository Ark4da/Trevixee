"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Layers3,
  NotebookPen,
  Rss,
  Settings,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { useAppStore } from "@/store";
import { GradientAreaChart } from "@/components/ui/gradient-area-chart";
import { MemberAvatar } from "./_components/member-identity";

interface TeamDashboard {
  today: {
    tradedMembers: number;
    totalPnl: number | null;
    ruleViolations: {
      id: string;
      userId: string;
      name: string;
      note: string | null;
      detectedAt: string;
    }[];
    dailyLimitWarnings: {
      userId: string;
      name: string;
      pnl: number;
      limit: number;
    }[];
  };
  activity: {
    kind: "trade" | "journal" | "rule";
    id: string;
    userId: string;
    userName: string;
    label: string;
    value: number | null;
    rMultiple: number | null;
    createdAt: string;
  }[];
  pnlByDay: {
    day: string;
    pnl: number;
  }[];
  weeklyTop: {
    userId: string;
    name: string;
    tradeCount: number;
    avgR: number;
    winRate: number;
  }[];
  risk: {
    openRisk: number | null;
    visibleOpenPositions: number;
    hiddenMembers: number;
  };
  quickLinks: { label: string; href: string }[];
}

function fmtMoney(value: number | null) {
  if (value === null) return "--";
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value >= 0 ? "+" : "-"}$${abs}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "red" | "brand" | "indigo";
}) {
  const toneClass =
    tone === "green"
      ? "text-[#22C55E]"
      : tone === "red"
        ? "text-[#EF4444]"
        : tone === "indigo"
          ? "text-indigo-400"
          : "text-brand";

  return (
    <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep anim-fade-up">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", toneClass)} />
        <p className="text-[10px] font-medium uppercase tracking-widest text-ink-5">
          {label}
        </p>
      </div>
      <p className={cn("font-serif text-[30px] font-bold leading-none tracking-tight tnum", toneClass)}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-ink-5">{sub}</p>}
    </div>
  );
}

function TeamLoadingState() {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-stroke bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/20 bg-brand/10">
            <Clock3 className="h-5 w-5 animate-pulse text-brand" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink">Loading team workspace</p>
            <p className="mt-1 text-[12px] text-ink-5">Checking team access, members, and dashboard data.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-stroke bg-card p-4">
            <div className="mb-3 h-3 w-20 rounded bg-tinted" />
            <div className="h-7 w-24 rounded bg-tinted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamEmptyState({ workspaceError }: { workspaceError: boolean }) {
  const lang = useAppStore((state) => state.lang);
  const copy = lang === "ru"
    ? {
        badge: "Командное пространство Team Plan",
        title: "Собери торговую комнату до прихода команды.",
        errorText: "Локальный workspace API сейчас недоступен, поэтому живые командные данные не отображаются.",
        emptyText: "Создай или выбери командный workspace, чтобы проверить ленту, участников, рейтинг и аналитику.",
        create: "Создать workspace",
        preview: "Открыть ленту",
        checklist: "Проверка функций",
        checklistTitle: "Базовые функции Team Plan",
        checks: [
          "Создание и выбор командного пространства",
          "Права ленты: комментарии, закрепления, действия ментора",
          "Навигация: участники, рейтинг, аналитика",
          "Безопасное скрытие денежных сумм",
        ],
        cards: [
          {
            icon: Rss,
            title: "Лента команды",
            text: "Общие сделки, заметки, закрепления ментора и комментарии в одном потоке обзора.",
          },
          {
            icon: Users2,
            title: "Обзор участников",
            text: "Дисциплина, сетапы, win rate и последние закрытые сделки каждого трейдера.",
          },
          {
            icon: BarChart3,
            title: "Командная аналитика",
            text: "Сравнение сетапов, поведения, стабильности и риска без раскрытия скрытых сумм.",
          },
        ],
      }
    : {
        badge: "Team Plan workspace",
        title: "Build the trading room before the team arrives.",
        errorText: "The local workspace API is not reachable right now, so live team data cannot be displayed.",
        emptyText: "Create or select a team workspace to test the feed, member reviews, leaderboard, and analytics.",
        create: "Create workspace",
        preview: "Preview feed",
        checklist: "QA checklist",
        checklistTitle: "Team Plan basics",
        checks: [
          "Workspace creation and selection",
          "Feed permissions: comments, pins, mentor actions",
          "Members, leaderboard, analytics navigation",
          "Privacy-safe hidden amounts",
        ],
        cards: [
          {
            icon: Rss,
            title: "Team feed",
            text: "Shared trades, journal notes, mentor pins, and comments in one review stream.",
          },
          {
            icon: Users2,
            title: "Member review",
            text: "Scan discipline, setups, win rate, and recent closed trades per trader.",
          },
          {
            icon: BarChart3,
            title: "Team analytics",
            text: "Compare setups, behavior, consistency, and risk without exposing hidden dollar amounts.",
          },
        ],
      };
  const cards = [
    ...copy.cards,
  ];

  return (
    <div className="space-y-5 page-enter">
      <section className="overflow-hidden rounded-2xl border border-stroke bg-card">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-7">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand">
                <Sparkles className="h-3.5 w-3.5" />
                {copy.badge}
              </div>
              <h1 className="max-w-xl font-serif text-[40px] font-bold leading-none text-ink">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-ink-4">
                {workspaceError ? copy.errorText : copy.emptyText}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/settings?tab=account"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                <Settings className="h-4 w-4" />
                {copy.create}
              </Link>
              <Link
                href="/team/feed"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-stroke bg-tinted px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-lift"
              >
                <Rss className="h-4 w-4 text-brand" />
                {copy.preview}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-stroke bg-tinted/45 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-5">{copy.checklist}</p>
                <p className="mt-1 text-[13px] font-semibold text-ink">{copy.checklistTitle}</p>
              </div>
              <Layers3 className="h-5 w-5 text-brand" />
            </div>
            <div className="space-y-2.5">
              {copy.checks.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-stroke bg-card px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E]" />
                  <span className="text-[12px] font-medium text-ink-3">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-stroke bg-card p-5">
            <card.icon className="mb-4 h-5 w-5 text-brand" />
            <h2 className="text-[14px] font-semibold text-ink">{card.title}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-5">{card.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function TeamDashboardPage() {
  const { activeWorkspaceId, resolvingWorkspace, workspaceError } = useTeamWorkspace();
  const darkMode = useAppStore((state) => state.darkMode);
  const [data, setData] = useState<TeamDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (workspaceId: string) => {
    setLoading(true);
    setErrorCode(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/dashboard`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorCode(payload?.code ?? "error");
        setData(null);
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setData(null);
      setErrorCode(null);
      return;
    }
    fetchDashboard(activeWorkspaceId);
  }, [activeWorkspaceId, fetchDashboard]);

  if (!activeWorkspaceId && !resolvingWorkspace) {
    return <TeamEmptyState workspaceError={workspaceError} />;
  }

  if (errorCode === "requires_team" || errorCode === "requires_higher_plan") {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-center page-enter">
        <ShieldAlert className="mb-4 h-14 w-14 text-brand" />
        <h3 className="mb-1.5 text-[15px] font-semibold text-ink">Team dashboard is locked</h3>
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-3">
          Upgrade to Team to unlock shared activity, risk, members, and mentor workflow.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Upgrade
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="overflow-hidden rounded-2xl border border-stroke bg-card">
        <div className="flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <p className="editorial-label">Team Overview</p>
            <h1 className="mt-2 font-serif text-[40px] font-bold leading-none text-ink">
              Dashboard<span className="text-brand">.</span>
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-5">
              Last 24 hours, current week, and shared risk across visible members.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Feed", href: "/team/feed", icon: Rss },
              { label: "Journal", href: "/team/journal", icon: NotebookPen },
              { label: "Members", href: "/team/members", icon: Users2 },
              { label: "Analytics", href: "/team/analytics", icon: BarChart3 },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-stroke bg-tinted px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-lift"
              >
                <item.icon className="h-4 w-4 text-brand" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {loading || !data ? (
        <TeamLoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              icon={Users2}
              label="Traded today"
              value={String(data.today.tradedMembers)}
              sub="visible members"
              tone="indigo"
            />
            <MetricCard
              icon={BarChart3}
              label="Team P/L"
              value={fmtMoney(data.today.totalPnl)}
              sub={data.today.totalPnl === null ? "Hidden by members" : "today"}
              tone={data.today.totalPnl !== null && data.today.totalPnl < 0 ? "red" : "green"}
            />
            <MetricCard
              icon={AlertTriangle}
              label="Rule breaks"
              value={String(data.today.ruleViolations.length)}
              sub="detected today"
              tone={data.today.ruleViolations.length > 0 ? "red" : "brand"}
            />
            <MetricCard
              icon={Activity}
              label="Open risk"
              value={fmtMoney(data.risk.openRisk)}
              sub={`${data.risk.visibleOpenPositions} visible open positions`}
              tone={data.risk.openRisk !== null && data.risk.openRisk > 0 ? "red" : "brand"}
            />
          </div>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="min-w-0 rounded-2xl border border-stroke bg-card p-6 shadow-deep anim-fade-up">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="editorial-label">Team Equity</p>
                  <h2 className="mt-1 text-[16px] font-semibold text-ink">30-day visible P/L curve</h2>
                </div>
                {data.today.totalPnl !== null && (
                  <span className={cn(
                    "rounded-lg border border-stroke bg-tinted px-3 py-1.5 text-[12px] font-semibold jb-mono",
                    data.today.totalPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                  )}>
                    Today {fmtMoney(data.today.totalPnl)}
                  </span>
                )}
              </div>
              {data.pnlByDay.length > 1 ? (
                <GradientAreaChart
                  data={data.pnlByDay.map((point) => ({
                    label: new Date(point.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
                    value: point.pnl,
                  }))}
                  dark={darkMode}
                  height={214}
                  tooltipFormatter={fmtMoney}
                />
              ) : (
                <div className="flex h-[214px] items-center justify-center text-[12px] text-ink-5">
                  Not enough visible P/L for a curve yet.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep anim-fade-up">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="editorial-label">Risk Room</p>
                  <h2 className="mt-1 text-[16px] font-semibold text-ink">What needs attention</h2>
                </div>
                <AlertTriangle className={cn(
                  "h-5 w-5",
                  data.today.ruleViolations.length || data.today.dailyLimitWarnings.length ? "text-[#EF4444]" : "text-[#22C55E]"
                )} />
              </div>
              <div className="space-y-3">
                {[
                  {
                    label: "Rule breaks",
                    value: String(data.today.ruleViolations.length),
                    hint: data.today.ruleViolations[0]?.note ?? "No violations detected today",
                    danger: data.today.ruleViolations.length > 0,
                  },
                  {
                    label: "Daily loss warnings",
                    value: String(data.today.dailyLimitWarnings.length),
                    hint: data.today.dailyLimitWarnings[0]?.name ?? "No member is past the limit",
                    danger: data.today.dailyLimitWarnings.length > 0,
                  },
                  {
                    label: "Hidden amounts",
                    value: String(data.risk.hiddenMembers),
                    hint: "Privacy-safe members excluded from dollar aggregates",
                    danger: false,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-stroke bg-tinted/45 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-5">{item.label}</p>
                      <span className={cn("font-serif text-[22px] font-bold leading-none tracking-tight tnum", item.danger ? "text-[#EF4444]" : "text-ink")}>
                        {item.value}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-ink-4">{item.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-xl border border-stroke bg-card p-5 anim-fade-up">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <Rss className="h-4 w-4 text-ink-4" />
                  Last 24 hours
                </h2>
                <Link href="/team/feed" className="text-[12px] font-medium text-brand hover:text-brand-hover">
                  Open feed
                </Link>
              </div>
              {data.activity.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-ink-4">No team activity in the last 24 hours.</div>
              ) : (
                <ul className="divide-y divide-stroke">
                  {data.activity.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-3">
                      <MemberAvatar seed={item.userId} name={item.userName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {item.userName} <span className="font-normal text-ink-4">{item.label}</span>
                        </p>
                        <p className="text-[11px] text-ink-5">{timeAgo(item.createdAt)}</p>
                      </div>
                      {item.value !== null ? (
                        <span className={cn("shrink-0 text-[12px] font-semibold jb-mono", item.value >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                          {fmtMoney(item.value)}
                        </span>
                      ) : item.rMultiple !== null ? (
                        <span className={cn("shrink-0 text-[12px] font-semibold jb-mono", item.rMultiple >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                          {item.rMultiple >= 0 ? "+" : ""}{item.rMultiple.toFixed(2)}R
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-stroke bg-card p-5 anim-fade-up">
              <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Trophy className="h-4 w-4 text-amber-400" />
                Top this week
              </h2>
              {data.weeklyTop.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-ink-4">No closed trades this week.</div>
              ) : (
                <ul className="space-y-3">
                  {data.weeklyTop.map((member, index) => (
                    <li key={member.userId} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stroke bg-tinted text-[11px] font-bold text-ink-3">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{member.name}</p>
                        <p className="text-[11px] text-ink-5">
                          {member.tradeCount} trades · {member.winRate}% win
                        </p>
                      </div>
                      <span className={cn("text-[13px] font-semibold jb-mono", member.avgR >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                        {member.avgR >= 0 ? "+" : ""}{member.avgR.toFixed(2)}R
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {data.today.dailyLimitWarnings.length > 0 && (
            <section className="anim-fade-up">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
                  Daily limit warnings
                </h2>
                <ul className="space-y-2">
                  {data.today.dailyLimitWarnings.map((warning) => (
                    <li key={warning.userId} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="text-ink-3">{warning.name}</span>
                      <span className="font-semibold text-[#EF4444] jb-mono">
                        {fmtMoney(warning.pnl)} / -${warning.limit.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

        </>
      )}
    </div>
  );
}
