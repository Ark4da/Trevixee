import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/guards";
import { prisma } from "@/lib/db";
import {
  endOfOffsetDay,
  startOfOffsetDay,
  toOffsetDayKey,
} from "@/lib/date";

type Params = { params: Promise<{ id: string }> };

type JournalTrade = {
  id: string;
  symbol: string;
  side: string;
  netPnl: number | null;
  rMultiple: number;
  setup: string | null;
  entryDate: Date;
  exitDate: Date | null;
  status: string;
  notes: string | null;
};

function displayName(user?: { name: string | null; email: string | null }) {
  return user?.name ?? user?.email?.split("@")[0] ?? "Trader";
}

function parsePeriod(raw: string | null) {
  if (raw === "7d") return 7;
  if (raw === "90d") return 90;
  return 30;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function dayKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceMember(workspaceId, "canViewTeamFeed");
  if (!gate.ok) return gate.response;

  const url = req.nextUrl;
  const periodDays = parsePeriod(url.searchParams.get("period"));
  const filterUserId = url.searchParams.get("userId");
  const tzOffsetRaw = Number(url.searchParams.get("tzOffset"));
  const tzOffset = Number.isFinite(tzOffsetRaw) ? tzOffsetRaw : 0;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 80), 160);

  const now = new Date();
  const toKey = toOffsetDayKey(now, tzOffset);
  const fromDate = new Date(now.getTime() - (periodDays - 1) * 86_400_000);
  const fromKey = toOffsetDayKey(fromDate, tzOffset);
  const rangeStart = startOfOffsetDay(fromKey, tzOffset);
  const rangeEnd = endOfOffsetDay(toKey, tzOffset);

  if (!rangeStart || !rangeEnd) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      OR: [
        { privacyPeriodUntil: null },
        { privacyPeriodUntil: { lt: now } },
      ],
    },
    select: { id: true, userId: true, role: true },
    orderBy: { joinedAt: "asc" },
  });

  let visibleUserIds = workspaceMembers.map((member) => member.userId);
  if (filterUserId) {
    visibleUserIds = visibleUserIds.filter((userId) => userId === filterUserId);
  }

  if (visibleUserIds.length === 0) {
    return NextResponse.json({
      period: `${periodDays}d`,
      range: { from: fromKey, to: toKey },
      members: [],
      entries: [],
      stats: {
        journalDays: 0,
        tradeDays: 0,
        tradeCount: 0,
        rulesFollowedPct: 0,
        goalMetPct: 0,
        totalPnl: null,
      },
    });
  }

  const [users, settings, journals, trades] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: visibleUserIds } },
      select: { id: true, name: true, email: true },
    }),
    prisma.userSettings.findMany({
      where: { userId: { in: visibleUserIds } },
      select: { userId: true, hideAmountsInTeam: true },
    }),
    prisma.journalEntry.findMany({
      where: {
        userId: { in: visibleUserIds },
        sharedWithTeam: true,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        userId: true,
        date: true,
        preMarketNotes: true,
        postMarketNotes: true,
        marketCondition: true,
        emotionalState: true,
        rulesFollowed: true,
        lessonsLearned: true,
        dailyGoal: true,
        goalMet: true,
        rating: true,
        notes: true,
        updatedAt: true,
      },
    }),
    prisma.trade.findMany({
      where: {
        userId: { in: visibleUserIds },
        entryDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { entryDate: "desc" },
      select: {
        id: true,
        userId: true,
        symbol: true,
        side: true,
        netPnl: true,
        rMultiple: true,
        setup: true,
        entryDate: true,
        exitDate: true,
        status: true,
        notes: true,
      },
    }),
  ]);

  const userMap = new Map(users.map((user) => [user.id, user]));
  const memberMap = new Map(workspaceMembers.map((member) => [member.userId, member]));
  const settingsMap = new Map(settings.map((setting) => [setting.userId, setting]));
  const grouped = new Map<
    string,
    {
      userId: string;
      day: string;
      journal: (typeof journals)[number] | null;
      trades: JournalTrade[];
      sortAt: Date;
    }
  >();

  for (const journal of journals) {
    const day = dayKeyFromDate(journal.date);
    const key = `${journal.userId}:${day}`;
    grouped.set(key, {
      userId: journal.userId,
      day,
      journal,
      trades: [],
      sortAt: journal.updatedAt,
    });
  }

  for (const trade of trades) {
    const day = toOffsetDayKey(trade.entryDate, tzOffset);
    const key = `${trade.userId}:${day}`;
    const existing =
      grouped.get(key) ??
      {
        userId: trade.userId,
        day,
        journal: null,
        trades: [],
        sortAt: trade.entryDate,
      };
    existing.trades.push(trade);
    if (trade.entryDate > existing.sortAt) existing.sortAt = trade.entryDate;
    grouped.set(key, existing);
  }

  const members = workspaceMembers.map((member) => ({
    id: member.id,
    userId: member.userId,
    role: member.role,
    name: displayName(userMap.get(member.userId)),
  }));

  const entries = [...grouped.values()]
    .map((group) => {
      const hideAmounts = settingsMap.get(group.userId)?.hideAmountsInTeam ?? false;
      const closedTrades = group.trades.filter((trade) => trade.status === "closed");
      const tradeCount = group.trades.length;
      const wins = closedTrades.filter((trade) => (trade.netPnl ?? 0) > 0).length;
      const totalPnl = hideAmounts
        ? null
        : round2(closedTrades.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0));
      const avgR = closedTrades.length
        ? round2(closedTrades.reduce((sum, trade) => sum + trade.rMultiple, 0) / closedTrades.length)
        : 0;

      return {
        id: group.journal?.id ?? `${group.userId}:${group.day}`,
        userId: group.userId,
        memberId: memberMap.get(group.userId)?.id ?? null,
        userName: displayName(userMap.get(group.userId)),
        day: group.day,
        sortAt: group.sortAt,
        hideAmounts,
        journal: group.journal
          ? {
              id: group.journal.id,
              preMarketNotes: group.journal.preMarketNotes,
              postMarketNotes: group.journal.postMarketNotes,
              marketCondition: group.journal.marketCondition,
              emotionalState: group.journal.emotionalState,
              rulesFollowed: group.journal.rulesFollowed,
              lessonsLearned: group.journal.lessonsLearned,
              dailyGoal: group.journal.dailyGoal,
              goalMet: group.journal.goalMet,
              rating: group.journal.rating,
              notes: group.journal.notes,
              updatedAt: group.journal.updatedAt,
            }
          : null,
        summary: {
          tradeCount,
          closedTradeCount: closedTrades.length,
          winRate: closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0,
          totalPnl,
          avgR,
        },
        trades: group.trades.map((trade) => ({
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          netPnl: hideAmounts || trade.status !== "closed" ? null : round2(trade.netPnl ?? 0),
          rMultiple: round2(trade.rMultiple),
          setup: trade.setup,
          entryDate: trade.entryDate,
          exitDate: trade.exitDate,
          status: trade.status,
          notes: trade.notes,
        })),
      };
    })
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
    .slice(0, limit);

  const journalRows = entries.filter((entry) => entry.journal);
  const rowsWithTrades = entries.filter((entry) => entry.summary.tradeCount > 0);
  const visiblePnlRows = entries.filter((entry) => entry.summary.totalPnl !== null);
  const rulesFollowed = journalRows.filter((entry) => entry.journal?.rulesFollowed).length;
  const goalsMet = journalRows.filter((entry) => entry.journal?.goalMet).length;

  return NextResponse.json({
    period: `${periodDays}d`,
    range: { from: fromKey, to: toKey },
    members,
    entries,
    stats: {
      journalDays: journalRows.length,
      tradeDays: rowsWithTrades.length,
      tradeCount: entries.reduce((sum, entry) => sum + entry.summary.tradeCount, 0),
      rulesFollowedPct: journalRows.length ? Math.round((rulesFollowed / journalRows.length) * 100) : 0,
      goalMetPct: journalRows.length ? Math.round((goalsMet / journalRows.length) * 100) : 0,
      totalPnl: visiblePnlRows.length
        ? round2(visiblePnlRows.reduce((sum, entry) => sum + (entry.summary.totalPnl ?? 0), 0))
        : null,
    },
  });
}
