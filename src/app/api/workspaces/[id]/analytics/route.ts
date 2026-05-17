import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id/analytics?period=7d|30d|90d
// Workspace-wide aggregate stats: cumulative discipline, P/L distribution,
// top setups, contributor counts. Respects hideAmountsInTeam (per member) and privacy period.
export async function GET(req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceMember(workspaceId, "canViewLeaderboard");
  if (!gate.ok) return gate.response;

  const url = req.nextUrl;
  const periodParam = url.searchParams.get("period");
  const days = periodParam === "90d" ? 90 : periodParam === "7d" ? 7 : 30;
  const since = new Date(Date.now() - days * 86_400_000);

  // Visible members (privacy period passed)
  const visibleMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      OR: [
        { privacyPeriodUntil: null },
        { privacyPeriodUntil: { lt: new Date() } },
      ],
    },
    select: { id: true, userId: true, role: true },
  });
  const visibleUserIds = visibleMembers.map((m) => m.userId);

  // Total members in workspace (including those in privacy period)
  const totalMembers = await prisma.workspaceMember.count({ where: { workspaceId } });

  if (visibleUserIds.length === 0) {
    return NextResponse.json({
      period: `${days}d`,
      totalMembers,
      visibleMembers: 0,
      activeContributors: 0,
      tradeCount: 0,
      totalPnl: null,
      avgWinRate: 0,
      avgRMultiple: 0,
      avgRulesFollowedPct: 0,
      avgJournalConsistencyPct: 0,
      pinnedCount: 0,
      bySetup: [],
      byMember: [],
      pnlByDay: [],
    });
  }

  const [trades, journalEntries, settingsList, pins] = await Promise.all([
    prisma.trade.findMany({
      where: {
        userId: { in: visibleUserIds },
        status: "closed",
        exitDate: { gte: since },
      },
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
      },
    }),
    prisma.journalEntry.findMany({
      where: { userId: { in: visibleUserIds }, date: { gte: since } },
      select: { userId: true, rulesFollowed: true },
    }),
    prisma.userSettings.findMany({
      where: { userId: { in: visibleUserIds } },
      select: { userId: true, hideAmountsInTeam: true },
    }),
    prisma.pinnedTeamContent.count({ where: { workspaceId } }),
  ]);
  const hideAmountsByUser = new Map(settingsList.map((s) => [s.userId, s.hideAmountsInTeam]));

  // P/L excludes amounts from members who hid them
  let totalPnl = 0;
  let pnlVisible = false;
  for (const t of trades) {
    if (!hideAmountsByUser.get(t.userId)) {
      totalPnl += t.netPnl;
      pnlVisible = true;
    }
  }

  const tradeCount = trades.length;
  const wins = trades.filter((t) => t.netPnl > 0).length;
  const winRate = tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0;
  const avgR =
    tradeCount > 0
      ? trades.reduce((s, t) => s + t.rMultiple, 0) / tradeCount
      : 0;

  const totalJournalDays = journalEntries.length;
  const rulesFollowedDays = journalEntries.filter((j) => j.rulesFollowed).length;
  const avgRulesFollowedPct =
    totalJournalDays > 0 ? Math.round((rulesFollowedDays / totalJournalDays) * 100) : 0;
  const avgJournalConsistencyPct = Math.min(
    100,
    Math.round((totalJournalDays / (visibleUserIds.length * days)) * 100)
  );

  // Top setups
  const setupAgg = new Map<
    string,
    {
      count: number;
      totalR: number;
      wins: number;
      grossWin: number;
      grossLoss: number;
      holdMinutes: number;
      holdCount: number;
      trades: {
        id: string;
        symbol: string;
        side: string;
        netPnl: number | null;
        rMultiple: number;
        exitDate: Date | null;
      }[];
    }
  >();
  for (const t of trades) {
    const key = t.setup?.trim() || "Unspecified";
    const hideAmounts = hideAmountsByUser.get(t.userId) ?? false;
    const cur = setupAgg.get(key) ?? {
      count: 0,
      totalR: 0,
      wins: 0,
      grossWin: 0,
      grossLoss: 0,
      holdMinutes: 0,
      holdCount: 0,
      trades: [],
    };
    cur.count += 1;
    cur.totalR += t.rMultiple;
    if (t.netPnl > 0) cur.wins += 1;
    if (!hideAmounts && t.netPnl > 0) cur.grossWin += t.netPnl;
    if (!hideAmounts && t.netPnl < 0) cur.grossLoss += Math.abs(t.netPnl);
    if (t.entryDate && t.exitDate) {
      cur.holdMinutes += Math.max(0, t.exitDate.getTime() - t.entryDate.getTime()) / 60_000;
      cur.holdCount += 1;
    }
    cur.trades.push({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      netPnl: hideAmounts ? null : Math.round(t.netPnl * 100) / 100,
      rMultiple: t.rMultiple,
      exitDate: t.exitDate,
    });
    setupAgg.set(key, cur);
  }
  const bySetup = Array.from(setupAgg.entries())
    .map(([setup, agg]) => ({
      setup,
      count: agg.count,
      avgR: Math.round((agg.totalR / agg.count) * 100) / 100,
      winRate: Math.round((agg.wins / agg.count) * 100),
      avgHoldMinutes:
        agg.holdCount > 0 ? Math.round(agg.holdMinutes / agg.holdCount) : null,
      profitFactor:
        agg.grossLoss > 0
          ? Math.round((agg.grossWin / agg.grossLoss) * 100) / 100
          : agg.grossWin > 0
            ? null
            : 0,
      trades: agg.trades
        .sort((a, b) => (b.exitDate?.getTime() ?? 0) - (a.exitDate?.getTime() ?? 0))
        .slice(0, 12)
        .map((trade) => ({
          ...trade,
          exitDate: trade.exitDate,
        })),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Per-member contribution
  const users = await prisma.user.findMany({
    where: { id: { in: visibleUserIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const memberIdByUserId = Object.fromEntries(visibleMembers.map((m) => [m.userId, m.id]));

  const byMember = visibleUserIds
    .map((uid) => {
      const userTrades = trades.filter((t) => t.userId === uid);
      const u = userMap[uid];
      const wins = userTrades.filter((t) => t.netPnl > 0).length;
      return {
        memberId: memberIdByUserId[uid] ?? null,
        userId: uid,
        name: u?.name ?? u?.email?.split("@")[0] ?? "Trader",
        tradeCount: userTrades.length,
        winRate: userTrades.length > 0 ? Math.round((wins / userTrades.length) * 100) : 0,
        avgR:
          userTrades.length > 0
            ? Math.round(
                (userTrades.reduce((s, t) => s + t.rMultiple, 0) / userTrades.length) * 100
              ) / 100
            : 0,
      };
    })
    .filter((m) => m.tradeCount > 0)
    .sort((a, b) => b.tradeCount - a.tradeCount);

  // Daily PnL series (visible only)
  const pnlByDayMap = new Map<string, number>();
  for (const t of trades) {
    if (hideAmountsByUser.get(t.userId)) continue;
    if (!t.exitDate) continue;
    const day = t.exitDate.toISOString().slice(0, 10);
    pnlByDayMap.set(day, (pnlByDayMap.get(day) ?? 0) + t.netPnl);
  }
  const pnlByDay = Array.from(pnlByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, pnl]) => ({ day, pnl: Math.round(pnl * 100) / 100 }));

  const pnlByMemberDayMap = new Map<string, Record<string, number | string>>();
  for (const t of trades) {
    if (hideAmountsByUser.get(t.userId)) continue;
    if (!t.exitDate) continue;
    const day = t.exitDate.toISOString().slice(0, 10);
    const row = pnlByMemberDayMap.get(day) ?? { day };
    row[t.userId] = Number(row[t.userId] ?? 0) + t.netPnl;
    pnlByMemberDayMap.set(day, row);
  }
  const pnlByMemberDay = Array.from(pnlByMemberDayMap.values())
    .sort((a, b) => String(a.day).localeCompare(String(b.day)))
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === "number" ? Math.round(value * 100) / 100 : value,
        ])
      )
    );
  const visibleAmountMembers = visibleUserIds
    .filter((uid) => !hideAmountsByUser.get(uid))
    .map((uid) => ({
      userId: uid,
      name: userMap[uid]?.name ?? userMap[uid]?.email?.split("@")[0] ?? "Trader",
    }));

  return NextResponse.json({
    period: `${days}d`,
    totalMembers,
    visibleMembers: visibleUserIds.length,
    activeContributors: byMember.length,
    tradeCount,
    totalPnl: pnlVisible ? Math.round(totalPnl * 100) / 100 : null,
    avgWinRate: winRate,
    avgRMultiple: Math.round(avgR * 100) / 100,
    avgRulesFollowedPct,
    avgJournalConsistencyPct,
    pinnedCount: pins,
    bySetup,
    byMember,
    pnlByDay,
    pnlByMemberDay,
    visibleAmountMembers,
  });
}
