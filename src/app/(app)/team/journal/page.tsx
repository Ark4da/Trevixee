"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  FileText,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Users2,
} from "lucide-react";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { cn } from "@/lib/utils";
import {
  TeamEmptyShowcase,
  TeamErrorPanel,
  TeamLoadingPanel,
  TeamPageHeader,
  TeamPillButton,
} from "../_components/team-page-visuals";
import { MemberAvatar, MemberDot } from "../_components/member-identity";

type Period = "7d" | "30d" | "90d";

interface TeamJournalMember {
  id: string;
  userId: string;
  role: string;
  name: string;
}

interface TeamJournalTrade {
  id: string;
  symbol: string;
  side: string;
  netPnl: number | null;
  rMultiple: number;
  setup: string | null;
  entryDate: string;
  exitDate: string | null;
  status: string;
  notes: string | null;
}

interface TeamJournalEntry {
  id: string;
  userId: string;
  memberId: string | null;
  userName: string;
  day: string;
  hideAmounts: boolean;
  journal: {
    id: string;
    preMarketNotes: string | null;
    postMarketNotes: string | null;
    marketCondition: string | null;
    emotionalState: string | null;
    rulesFollowed: boolean;
    lessonsLearned: string | null;
    dailyGoal: string | null;
    goalMet: boolean;
    rating: number | null;
    notes: string | null;
    updatedAt: string;
  } | null;
  summary: {
    tradeCount: number;
    closedTradeCount: number;
    winRate: number;
    totalPnl: number | null;
    avgR: number;
  };
  trades: TeamJournalTrade[];
}

interface TeamJournalPayload {
  period: string;
  range: { from: string; to: string };
  members: TeamJournalMember[];
  entries: TeamJournalEntry[];
  stats: {
    journalDays: number;
    tradeDays: number;
    tradeCount: number;
    rulesFollowedPct: number;
    goalMetPct: number;
    totalPnl: number | null;
  };
}

function fmtMoney(value: number | null) {
  if (value === null) return "--";
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function fmtDate(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function textPreview(value: string | null, fallback: string) {
  const text = value?.trim();
  return text ? text : fallback;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">{label}</p>
      </div>
      <p className={cn("font-serif text-[28px] font-bold leading-none tracking-tight tnum", toneClass)}>{value}</p>
      <p className="mt-1 text-[11px] text-ink-5">{hint}</p>
    </div>
  );
}

function TeamJournalGuide({
  isMember,
  memberName,
  onShowMine,
}: {
  isMember: boolean;
  memberName: string | null;
  onShowMine: () => void;
}) {
  return (
    <section className="rounded-2xl border border-stroke bg-card p-5 shadow-deep">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="editorial-label">How this works</p>
          <h2 className="mt-2 text-[16px] font-semibold text-ink">
            One journal. Team review happens automatically.
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-5">
            Members keep writing in their personal Daily Journal and keep logging trades as usual.
            Team Journal joins shared daily notes with trades from the same day, so mentors can review
            the whole trading day without asking anyone to duplicate notes. Private journal entries stay out of this view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link
            href="/journal"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <NotebookPen className="h-4 w-4" />
            Write daily journal
          </Link>
          <Link
            href="/trades"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-stroke bg-tinted px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-lift"
          >
            <TrendingUp className="h-4 w-4 text-brand" />
            Log trades
          </Link>
          {isMember && (
            <button
              type="button"
              onClick={onShowMine}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-stroke bg-tinted px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-lift"
            >
              <MemberDot seed={memberName ?? "me"} name={memberName ?? "Me"} />
              My team journal
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function JournalStatusChip({
  active,
  icon: Icon,
  label,
  activeClass,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  activeClass: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
        active
          ? activeClass
          : "border-stroke bg-tinted text-ink-5"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            "h-3.5 w-3.5",
            rating && value <= rating
              ? "fill-amber-400 text-amber-400"
              : "text-ink-5"
          )}
        />
      ))}
    </div>
  );
}

function TradeRow({ trade }: { trade: TeamJournalTrade }) {
  const positive = trade.netPnl === null ? trade.rMultiple >= 0 : trade.netPnl >= 0;

  return (
    <Link
      href={`/trades/${trade.id}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-stroke px-4 py-3 transition-colors hover:bg-tinted/45"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-md border border-stroke bg-tinted px-2 py-0.5 text-[10px] font-bold text-ink">
            {trade.symbol}
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: trade.side === "long" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
              color: trade.side === "long" ? "#22C55E" : "#EF4444",
            }}
          >
            {trade.side.toUpperCase()}
          </span>
          {trade.setup && (
            <span className="truncate text-[11px] text-ink-5">{trade.setup}</span>
          )}
          {trade.status !== "closed" && (
            <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              {trade.status}
            </span>
          )}
        </div>
        {trade.notes && (
          <p className="mt-1 line-clamp-1 text-[11px] text-ink-5">{trade.notes}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-[12px] font-semibold jb-mono", positive ? "text-[#22C55E]" : "text-[#EF4444]")}>
          {fmtMoney(trade.netPnl)}
        </p>
        <p className={cn("mt-0.5 text-[10px] jb-mono", positive ? "text-[#22C55E]" : "text-[#EF4444]")}>
          {trade.rMultiple >= 0 ? "+" : ""}{trade.rMultiple.toFixed(2)}R
        </p>
      </div>
    </Link>
  );
}

function JournalCard({ entry }: { entry: TeamJournalEntry }) {
  const positive = entry.summary.totalPnl === null
    ? entry.summary.avgR >= 0
    : entry.summary.totalPnl >= 0;
  const journal = entry.journal;

  return (
    <article className="overflow-hidden rounded-2xl border border-stroke bg-card shadow-deep anim-fade-up">
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <MemberAvatar seed={entry.userId} name={entry.userName} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink">{entry.userName}</p>
                <p className="mt-0.5 text-[11px] text-ink-5">{fmtDate(entry.day)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {journal ? <RatingStars rating={journal.rating} /> : null}
              {entry.memberId && (
                <Link
                  href={`/team/members/${entry.memberId}`}
                  className="rounded-lg border border-stroke px-2.5 py-1 text-[11px] font-semibold text-ink-4 transition-colors hover:bg-tinted hover:text-ink"
                >
                  Member
                </Link>
              )}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <JournalStatusChip
              active={Boolean(journal)}
              icon={FileText}
              label={journal ? "Journal written" : "Trades only"}
              activeClass="border-brand/30 bg-brand/10 text-brand"
            />
            <JournalStatusChip
              active={Boolean(journal?.rulesFollowed)}
              icon={ShieldCheck}
              label={journal?.rulesFollowed ? "Rules followed" : "Rules missing"}
              activeClass="border-[#22C55E]/25 bg-[#22C55E]/10 text-[#22C55E]"
            />
            <JournalStatusChip
              active={Boolean(journal?.goalMet)}
              icon={Target}
              label={journal?.goalMet ? "Goal met" : "Goal open"}
              activeClass="border-indigo-400/25 bg-indigo-400/10 text-indigo-300"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-stroke bg-tinted/45 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-5">Trades</p>
              <p className="mt-1 font-serif text-[22px] font-bold leading-none tracking-tight text-ink tnum">{entry.summary.tradeCount}</p>
            </div>
            <div className="rounded-xl border border-stroke bg-tinted/45 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-5">Win</p>
              <p className="mt-1 font-serif text-[22px] font-bold leading-none tracking-tight text-ink tnum">{entry.summary.winRate}%</p>
            </div>
            <div className="rounded-xl border border-stroke bg-tinted/45 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-5">Day P/L</p>
              <p className={cn("mt-1 truncate font-serif text-[22px] font-bold leading-none tracking-tight tnum", positive ? "text-[#22C55E]" : "text-[#EF4444]")}>
                {entry.summary.totalPnl === null ? `${entry.summary.avgR >= 0 ? "+" : ""}${entry.summary.avgR.toFixed(2)}R` : fmtMoney(entry.summary.totalPnl)}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-stroke bg-tinted/35 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-5">Pre-market</p>
              <p className="line-clamp-4 text-[12px] leading-relaxed text-ink-3">
                {textPreview(journal?.preMarketNotes ?? null, "No plan written for this day.")}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-5">Review</p>
              <p className="line-clamp-4 text-[12px] leading-relaxed text-ink-3">
                {textPreview(journal?.postMarketNotes ?? null, "No post-market review yet.")}
              </p>
            </div>
          </div>
          {(journal?.dailyGoal || journal?.lessonsLearned || journal?.notes) && (
            <div className="mt-4 border-t border-stroke pt-3">
              {journal.dailyGoal && (
                <p className="line-clamp-2 text-[12px] text-ink-4">
                  <span className="font-semibold text-ink-5">Goal:</span> {journal.dailyGoal}
                </p>
              )}
              {journal.lessonsLearned && (
                <p className="mt-1 line-clamp-2 text-[12px] text-ink-4">
                  <span className="font-semibold text-ink-5">Lesson:</span> {journal.lessonsLearned}
                </p>
              )}
              {journal.notes && (
                <p className="mt-1 line-clamp-2 text-[12px] text-ink-4">
                  <span className="font-semibold text-ink-5">Note:</span> {journal.notes}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {entry.trades.length > 0 ? (
        <div className="border-t border-stroke">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <p className="flex items-center gap-2 text-[12px] font-semibold text-ink">
              <BookOpenCheck className="h-4 w-4 text-brand" />
              Trades attached to this journal day
            </p>
            {entry.hideAmounts && (
              <span className="rounded-lg border border-stroke bg-tinted px-2 py-1 text-[10px] font-semibold text-ink-5">
                Amounts hidden
              </span>
            )}
          </div>
          {entry.trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))}
        </div>
      ) : (
        <div className="border-t border-stroke px-5 py-4 text-[12px] text-ink-5">
          Journal entry exists, but no trades were logged for this day.
        </div>
      )}
    </article>
  );
}

function EmptyState({ workspaceError }: { workspaceError?: boolean }) {
  return (
    <TeamEmptyShowcase
      eyebrow="Team Journal"
      title="Create one team review system for journal days and trades."
      description={
        workspaceError
          ? "The local workspace API is not reachable right now, so the team journal cannot be displayed."
          : "Select or create a workspace to review each member's daily journal together with the trades from the same day."
      }
      primaryHref="/settings?tab=account"
      primaryLabel="Create workspace"
      secondaryHref="/team/feed"
      secondaryLabel="Open feed"
      icon={NotebookPen}
      checklist={[
        "Daily journal entries by member",
        "Trades attached to the same day",
        "Privacy-safe team P/L",
        "Rules, goals, lessons, and review text",
      ]}
      cards={[
        {
          icon: FileText,
          title: "Journal days",
          text: "Pre-market plan, review, lessons, rules, rating, and goals are visible in one team stream.",
        },
        {
          icon: TrendingUp,
          title: "Trade context",
          text: "Each day pulls the member's trades beside the journal so mentor review is grounded in execution.",
        },
        {
          icon: ShieldCheck,
          title: "Privacy",
          text: "Members who hide amounts still contribute R-multiple and process context without exposing dollars.",
        },
      ]}
    />
  );
}

export default function TeamJournalPage() {
  const { activeWorkspaceId, resolvingWorkspace, workspaceError } = useTeamWorkspace();
  const { data: session } = useSession();
  const [data, setData] = useState<TeamJournalPayload | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [memberUserId, setMemberUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJournal = useCallback(async (workspaceId: string, nextPeriod: Period, userId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        period: nextPeriod,
        limit: "120",
        tzOffset: String(new Date().getTimezoneOffset()),
      });
      if (userId) params.set("userId", userId);
      const res = await fetch(`/api/workspaces/${workspaceId}/journal?${params.toString()}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "Failed to load team journal");
        setData(null);
        return;
      }
      setData(payload);
    } catch {
      setError("Failed to load team journal");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setData(null);
      setMemberUserId(null);
      return;
    }
    fetchJournal(activeWorkspaceId, period, memberUserId);
  }, [activeWorkspaceId, fetchJournal, memberUserId, period]);

  const filteredMember = useMemo(
    () => data?.members.find((member) => member.userId === memberUserId) ?? null,
    [data?.members, memberUserId]
  );
  const myMember = useMemo(
    () => data?.members.find((member) => member.userId === session?.user?.id) ?? null,
    [data?.members, session?.user?.id]
  );

  if (!activeWorkspaceId && !resolvingWorkspace) {
    return <EmptyState workspaceError={workspaceError} />;
  }

  if (resolvingWorkspace) {
    return (
      <TeamLoadingPanel
        title="Loading team journal"
        description="Checking workspace access, member journal entries, and linked trades."
        cards={6}
      />
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <TeamPageHeader
        eyebrow="Team Journal"
        title="Journal"
        description="A shared review stream built from each member's own Daily Journal and trades."
        icon={NotebookPen}
        actions={
          <>
            {data?.members && data.members.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <TeamPillButton active={memberUserId === null} onClick={() => setMemberUserId(null)}>
                  All
                </TeamPillButton>
                {data.members.map((member) => (
                  <TeamPillButton
                    key={member.userId}
                    active={memberUserId === member.userId}
                    onClick={() => setMemberUserId(memberUserId === member.userId ? null : member.userId)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MemberDot seed={member.userId} name={member.name} />
                      {member.name}
                    </span>
                  </TeamPillButton>
                ))}
              </div>
            )}
            <div className="inline-flex rounded-lg border border-stroke bg-card p-0.5 gap-0.5">
              {(["7d", "30d", "90d"] as Period[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setPeriod(option)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
                    period === option ? "bg-tinted text-ink" : "text-ink-4 hover:text-ink"
                  )}
                >
                  {option === "7d" ? "7d" : option === "30d" ? "30d" : "90d"}
                </button>
              ))}
            </div>
            {activeWorkspaceId && (
              <button
                onClick={() => fetchJournal(activeWorkspaceId, period, memberUserId)}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-stroke px-3 text-[12px] font-semibold text-ink-4 transition-colors hover:bg-tinted hover:text-ink disabled:opacity-40"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </button>
            )}
          </>
        }
      />

      {error ? (
        <TeamErrorPanel message={error} onRetry={() => activeWorkspaceId && fetchJournal(activeWorkspaceId, period, memberUserId)} />
      ) : loading || !data ? (
        <TeamLoadingPanel
          title="Loading journal days"
          description="Pairing daily notes with trades from the same team members."
          cards={8}
        />
      ) : (
        <>
          <TeamJournalGuide
            isMember={Boolean(myMember)}
            memberName={myMember?.name ?? null}
            onShowMine={() => {
              if (myMember) setMemberUserId(myMember.userId);
            }}
          />

          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              icon={FileText}
              label="Journal days"
              value={String(data.stats.journalDays)}
              hint={filteredMember ? filteredMember.name : data.period}
              tone="brand"
            />
            <StatCard
              icon={CalendarDays}
              label="Trade days"
              value={String(data.stats.tradeDays)}
              hint={`${data.stats.tradeCount} trades attached`}
              tone="indigo"
            />
            <StatCard
              icon={CheckCircle2}
              label="Rules"
              value={`${data.stats.rulesFollowedPct}%`}
              hint="written days followed"
              tone={data.stats.rulesFollowedPct >= 80 ? "green" : "brand"}
            />
            <StatCard
              icon={data.stats.totalPnl !== null && data.stats.totalPnl < 0 ? TrendingDown : TrendingUp}
              label="Visible P/L"
              value={fmtMoney(data.stats.totalPnl)}
              hint={data.stats.totalPnl === null ? "hidden by members" : `${data.range.from} to ${data.range.to}`}
              tone={data.stats.totalPnl !== null && data.stats.totalPnl < 0 ? "red" : "green"}
            />
          </section>

          {data.entries.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-stroke bg-card p-8 text-center">
              <CircleDashed className="mb-4 h-12 w-12 text-ink-5" />
              <h2 className="text-[15px] font-semibold text-ink">No team journal days yet</h2>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-5">
                When a member writes a daily journal or logs trades, this page will join them into one review card.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  href="/journal"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  <NotebookPen className="h-4 w-4" />
                  Write journal
                </Link>
                <Link
                  href="/trades"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-stroke bg-tinted px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-lift"
                >
                  <TrendingUp className="h-4 w-4 text-brand" />
                  Open trades
                </Link>
              </div>
            </div>
          ) : (
            <section className="space-y-4">
              {data.entries.map((entry) => (
                <JournalCard key={entry.id} entry={entry} />
              ))}
            </section>
          )}
        </>
      )}

      <div className="rounded-xl border border-stroke bg-tinted/35 px-4 py-3">
        <p className="flex items-center gap-2 text-[12px] leading-relaxed text-ink-5">
          <Users2 className="h-4 w-4 shrink-0 text-ink-4" />
          Team journal uses the same member visibility and amount privacy rules as the team feed.
          Personal journal entries also have their own shared/private switch.
        </p>
      </div>
    </div>
  );
}
