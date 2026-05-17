import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/guards";

type Params = { params: Promise<{ id: string }> };

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function displayName(user?: { name: string | null; email: string | null }) {
  return user?.name ?? user?.email?.split("@")[0] ?? "Trader";
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceMember(workspaceId, "canViewTeamFeed");
  if (!gate.ok) return gate.response;

  const now = new Date();
  const todayStart = startOfDay(now);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { id: true, userId: true, role: true, privacyPeriodUntil: true },
  });
  const visibleMembers = members.filter(
    (m) => !m.privacyPeriodUntil || m.privacyPeriodUntil < now
  );
  const visibleUserIds = visibleMembers.map((m) => m.userId);

  if (visibleUserIds.length === 0) {
    return NextResponse.json({
      today: {
        tradedMembers: 0,
        totalPnl: null,
        ruleViolations: [],
        dailyLimitWarnings: [],
      },
      activity: [],
      pnlByDay: [],
      weeklyTop: [],
      risk: { openRisk: null, visibleOpenPositions: 0, hiddenMembers: members.length },
      quickLinks: [
        { label: "Team Feed", href: "/team/feed" },
        { label: "Team Journal", href: "/team/journal" },
        { label: "Members", href: "/team/members" },
        { label: "Analytics", href: "/team/analytics" },
      ],
    });
  }

  const chartStart = new Date(now);
  chartStart.setDate(now.getDate() - 29);
  chartStart.setHours(0, 0, 0, 0);

  const [users, settings, tradesToday, recentTrades, journals24h, violationsToday, openTrades, chartTrades] =
    await Promise.all([
      prisma.user.findMany({
        where: { id: { in: visibleUserIds } },
        select: { id: true, name: true, email: true },
      }),
      prisma.userSettings.findMany({
        where: { userId: { in: visibleUserIds } },
        select: {
          userId: true,
          hideAmountsInTeam: true,
          maxDailyLoss: true,
        },
      }),
      prisma.trade.findMany({
        where: {
          userId: { in: visibleUserIds },
          status: "closed",
          exitDate: { gte: todayStart, lte: now },
        },
        select: { userId: true, netPnl: true, rMultiple: true },
      }),
      prisma.trade.findMany({
        where: {
          userId: { in: visibleUserIds },
          status: "closed",
          createdAt: { gte: since24h },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          userId: true,
          symbol: true,
          side: true,
          netPnl: true,
          rMultiple: true,
          createdAt: true,
        },
      }),
      prisma.journalEntry.findMany({
        where: { userId: { in: visibleUserIds }, updatedAt: { gte: since24h } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, userId: true, updatedAt: true, rulesFollowed: true },
      }),
      prisma.ruleViolation.findMany({
        where: { userId: { in: visibleUserIds }, detectedAt: { gte: todayStart } },
        orderBy: { detectedAt: "desc" },
        select: { id: true, userId: true, note: true, detectedAt: true },
      }),
      prisma.trade.findMany({
        where: { userId: { in: visibleUserIds }, status: "open" },
        select: {
          id: true,
          userId: true,
          entryPrice: true,
          stopLoss: true,
          quantity: true,
        },
      }),
      prisma.trade.findMany({
        where: {
          userId: { in: visibleUserIds },
          status: "closed",
          exitDate: { gte: chartStart, lte: now },
        },
        select: { userId: true, netPnl: true, exitDate: true },
      }),
    ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const settingsMap = new Map(settings.map((s) => [s.userId, s]));
  const visibleAmountUserIds = visibleUserIds.filter(
    (uid) => !settingsMap.get(uid)?.hideAmountsInTeam
  );
  const hiddenMembers = visibleUserIds.length - visibleAmountUserIds.length;

  let totalPnl = 0;
  let hasVisiblePnl = false;
  const tradedMemberIds = new Set(tradesToday.map((t) => t.userId));
  for (const trade of tradesToday) {
    if (settingsMap.get(trade.userId)?.hideAmountsInTeam) continue;
    totalPnl += trade.netPnl;
    hasVisiblePnl = true;
  }

  const dailyLimitWarnings = visibleAmountUserIds
    .map((userId) => {
      const maxDailyLoss = settingsMap.get(userId)?.maxDailyLoss ?? 0;
      if (maxDailyLoss <= 0) return null;
      const pnl = tradesToday
        .filter((t) => t.userId === userId)
        .reduce((sum, t) => sum + t.netPnl, 0);
      if (pnl > -maxDailyLoss) return null;
      return {
        userId,
        name: displayName(userMap.get(userId)),
        pnl: Math.round(pnl * 100) / 100,
        limit: maxDailyLoss,
      };
    })
    .filter(Boolean);

  const weeklyTrades = await prisma.trade.findMany({
    where: {
      userId: { in: visibleUserIds },
      status: "closed",
      exitDate: { gte: weekStart, lte: now },
    },
    select: { userId: true, rMultiple: true, netPnl: true },
  });

  const weeklyTop = visibleUserIds
    .map((userId) => {
      const userTrades = weeklyTrades.filter((t) => t.userId === userId);
      const count = userTrades.length;
      const avgR = count
        ? userTrades.reduce((sum, t) => sum + t.rMultiple, 0) / count
        : 0;
      const wins = userTrades.filter((t) => t.netPnl > 0).length;
      return {
        userId,
        name: displayName(userMap.get(userId)),
        tradeCount: count,
        avgR: Math.round(avgR * 100) / 100,
        winRate: count ? Math.round((wins / count) * 100) : 0,
      };
    })
    .filter((row) => row.tradeCount > 0)
    .sort((a, b) => b.avgR - a.avgR)
    .slice(0, 3);

  const tradeActivity = recentTrades.map((trade) => {
    const hideAmounts = settingsMap.get(trade.userId)?.hideAmountsInTeam ?? false;
    return {
      kind: "trade" as const,
      id: trade.id,
      userId: trade.userId,
      userName: displayName(userMap.get(trade.userId)),
      label: `${trade.symbol} ${trade.side.toUpperCase()}`,
      value: hideAmounts ? null : Math.round(trade.netPnl * 100) / 100,
      rMultiple: trade.rMultiple,
      createdAt: trade.createdAt,
    };
  });

  const journalActivity = journals24h.map((journal) => ({
    kind: "journal" as const,
    id: journal.id,
    userId: journal.userId,
    userName: displayName(userMap.get(journal.userId)),
    label: journal.rulesFollowed ? "Journal updated" : "Journal flagged rules",
    value: null,
    rMultiple: null,
    createdAt: journal.updatedAt,
  }));

  const violationActivity = violationsToday.slice(0, 5).map((violation) => ({
    kind: "rule" as const,
    id: violation.id,
    userId: violation.userId,
    userName: displayName(userMap.get(violation.userId)),
    label: violation.note ?? "Rule violation",
    value: null,
    rMultiple: null,
    createdAt: violation.detectedAt,
  }));

  const pnlByDayMap = new Map<string, number>();
  for (const trade of chartTrades) {
    if (settingsMap.get(trade.userId)?.hideAmountsInTeam) continue;
    if (!trade.exitDate) continue;
    const day = trade.exitDate.toISOString().slice(0, 10);
    pnlByDayMap.set(day, (pnlByDayMap.get(day) ?? 0) + trade.netPnl);
  }
  let runningPnl = 0;
  const pnlByDay: { day: string; pnl: number }[] = [];
  for (let index = 0; index < 30; index += 1) {
    const date = new Date(chartStart);
    date.setDate(chartStart.getDate() + index);
    const day = date.toISOString().slice(0, 10);
    runningPnl += pnlByDayMap.get(day) ?? 0;
    pnlByDay.push({ day, pnl: Math.round(runningPnl * 100) / 100 });
  }

  let openRisk = 0;
  let visibleOpenPositions = 0;
  for (const trade of openTrades) {
    if (settingsMap.get(trade.userId)?.hideAmountsInTeam) continue;
    if (trade.stopLoss == null) continue;
    openRisk += Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity;
    visibleOpenPositions += 1;
  }

  return NextResponse.json({
    today: {
      tradedMembers: tradedMemberIds.size,
      totalPnl: hasVisiblePnl ? Math.round(totalPnl * 100) / 100 : null,
      ruleViolations: violationsToday.map((v) => ({
        id: v.id,
        userId: v.userId,
        name: displayName(userMap.get(v.userId)),
        note: v.note,
        detectedAt: v.detectedAt,
      })),
      dailyLimitWarnings,
    },
    activity: [...tradeActivity, ...journalActivity, ...violationActivity]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
    pnlByDay,
    weeklyTop,
    risk: {
      openRisk: visibleOpenPositions > 0 ? Math.round(openRisk * 100) / 100 : null,
      visibleOpenPositions,
      hiddenMembers,
    },
    quickLinks: [
      { label: "Team Feed", href: "/team/feed" },
      { label: "Team Journal", href: "/team/journal" },
      { label: "Members", href: "/team/members" },
      { label: "Analytics", href: "/team/analytics" },
    ],
  });
}
