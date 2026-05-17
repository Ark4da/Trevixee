import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id/leaderboard?period=weekly|monthly
// Ranks by DISCIPLINE metrics only: rules_followed_pct, journal_consistency, r_expectancy
// NO $ PnL ranking — this is by design
export async function GET(req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceMember(workspaceId, "canViewLeaderboard");
  if (!gate.ok) return gate.response;

  const url = req.nextUrl;
  const period = url.searchParams.get("period") === "monthly" ? "monthly" : "weekly";

  const now = new Date();
  const periodStart = new Date(now);
  if (period === "weekly") {
    periodStart.setDate(now.getDate() - now.getDay()); // start of week (Sunday)
    periodStart.setHours(0, 0, 0, 0);
  } else {
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
  }

  // Get visible members (privacy period passed + still members of this workspace)
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      OR: [
        { privacyPeriodUntil: null },
        { privacyPeriodUntil: { lt: new Date() } },
      ],
    },
    select: { id: true, userId: true, role: true },
  });

  const memberUserIds = members.map((m) => m.userId);

  // Fetch users
  const users = await prisma.user.findMany({
    where: { id: { in: memberUserIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  // Journal entries in period: count total days and rules-followed days
  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      userId: { in: memberUserIds },
      date: { gte: periodStart, lte: now },
    },
    select: { userId: true, rulesFollowed: true, date: true },
  });

  // Trades in period for R expectancy
  const trades = await prisma.trade.findMany({
    where: {
      userId: { in: memberUserIds },
      status: "closed",
      exitDate: { gte: periodStart, lte: now },
    },
    select: { userId: true, rMultiple: true },
  });

  // Days since periodStart
  const daysSincePeriodStart = Math.max(
    1,
    Math.ceil((now.getTime() - periodStart.getTime()) / 86_400_000)
  );

  type Row = {
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
  };

  const rows: Row[] = memberUserIds.map((uid) => {
    const jEntries = journalEntries.filter((j) => j.userId === uid);
    const userTrades = trades.filter((t) => t.userId === uid);
    const member = members.find((m) => m.userId === uid)!;

    const journalDays = jEntries.length;
    const rulesFollowedDays = jEntries.filter((j) => j.rulesFollowed).length;
    const rulesFollowedPct = journalDays > 0 ? (rulesFollowedDays / journalDays) * 100 : 0;
    const journalConsistencyPct = (journalDays / daysSincePeriodStart) * 100;

    const tradeCount = userTrades.length;
    const rExpectancy =
      tradeCount > 0
        ? userTrades.reduce((sum, t) => sum + t.rMultiple, 0) / tradeCount
        : 0;

    // Composite discipline score (weighted):
    // 40% rules followed, 40% journal consistency, 20% R expectancy (normalized to 0-100)
    const rScore = Math.min(Math.max((rExpectancy / 3) * 100, 0), 100);
    const score = rulesFollowedPct * 0.4 + journalConsistencyPct * 0.4 + rScore * 0.2;

    const u = userMap[uid];
    return {
      memberId: member.id,
      userId: uid,
      name: u?.name ?? u?.email?.split("@")[0] ?? "Trader",
      role: member.role,
      rulesFollowedPct: Math.round(rulesFollowedPct),
      journalConsistencyPct: Math.round(journalConsistencyPct),
      rExpectancy: Math.round(rExpectancy * 100) / 100,
      tradeCount,
      journalDays,
      score: Math.round(score),
    };
  });

  rows.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    period,
    periodStart: periodStart.toISOString(),
    rows: rows.map((r, i) => ({ rank: i + 1, ...r })),
  });
}
