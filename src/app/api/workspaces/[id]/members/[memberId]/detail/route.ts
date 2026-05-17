import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string; memberId: string }> };

// GET /api/workspaces/:id/members/:memberId/detail?period=7d|30d|90d
// Returns aggregated stats for a single member, respecting privacy period and hideAmountsInTeam.
export async function GET(req: NextRequest, { params }: Params) {
  const { id: workspaceId, memberId } = await params;
  const rawPeriod = req.nextUrl.searchParams.get("period") ?? "30d";
  const periodDays = rawPeriod === "7d" ? 7 : rawPeriod === "90d" ? 90 : 30;
  const periodLabel = `${periodDays}d`;
  const gate = await requireWorkspaceMember(workspaceId, "canViewLeaderboard");
  if (!gate.ok) return gate.response;
  const viewer = gate.member;

  // Find target member row by memberId (which is WorkspaceMember.id)
  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
  });
  if (!target || target.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Privacy period: if still active and viewer is not owner/mentor, block
  if (
    target.privacyPeriodUntil &&
    target.privacyPeriodUntil > new Date() &&
    !["owner", "mentor"].includes(viewer.role)
  ) {
    return NextResponse.json({ error: "Member data is in privacy period" }, { status: 403 });
  }

  const targetUserId = target.userId;
  const canSeeEmail = ["owner", "mentor"].includes(viewer.role) || viewer.userId === targetUserId;

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { name: true, email: true },
  });
  const settings = await prisma.userSettings.findUnique({
    where: { userId: targetUserId },
    select: { hideAmountsInTeam: true },
  });
  const hideAmounts = settings?.hideAmountsInTeam ?? false;

  const sinceDate = new Date(Date.now() - periodDays * 86_400_000);

  const [trades30d, journalEntries30d, recentTrades] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: targetUserId, status: "closed", exitDate: { gte: sinceDate } },
      select: { netPnl: true, rMultiple: true, entryDate: true, exitDate: true },
    }),
    prisma.journalEntry.findMany({
      where: { userId: targetUserId, date: { gte: sinceDate } },
      select: { rulesFollowed: true, date: true },
    }),
    prisma.trade.findMany({
      where: { userId: targetUserId, status: "closed" },
      orderBy: { exitDate: "desc" },
      take: 20,
      select: {
        id: true,
        symbol: true,
        side: true,
        netPnl: true,
        rMultiple: true,
        setup: true,
        entryDate: true,
        exitDate: true,
      },
    }),
  ]);

  const tradeCount = trades30d.length;
  const wins = trades30d.filter((t) => t.netPnl > 0).length;
  const totalPnl = trades30d.reduce((s, t) => s + t.netPnl, 0);
  const avgR = tradeCount > 0
    ? trades30d.reduce((s, t) => s + t.rMultiple, 0) / tradeCount
    : 0;
  const winRate = tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0;

  const journalDays = journalEntries30d.length;
  const rulesFollowedDays = journalEntries30d.filter((j) => j.rulesFollowed).length;
  const rulesFollowedPct = journalDays > 0
    ? Math.round((rulesFollowedDays / journalDays) * 100)
    : 0;
  const journalConsistencyPct = Math.round((journalDays / periodDays) * 100);

  // Build daily P/L buckets for equity curve (only if amounts are visible)
  const pnlByDay: { day: string; pnl: number }[] = [];
  if (!hideAmounts) {
    const dayMap = new Map<string, number>();
    for (const t of trades30d) {
      if (!t.exitDate) continue;
      const day = t.exitDate.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + t.netPnl);
    }
    const sorted = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [day, pnl] of sorted) {
      pnlByDay.push({ day, pnl: Math.round(pnl * 100) / 100 });
    }
  }

  return NextResponse.json({
    memberId: target.id,
    userId: targetUserId,
    name: user?.name ?? user?.email?.split("@")[0] ?? "Trader",
    email: canSeeEmail ? user?.email ?? null : null,
    role: target.role,
    joinedAt: target.joinedAt,
    period: periodLabel,
    tradeCount,
    winRate,
    avgR: Math.round(avgR * 100) / 100,
    totalPnl: hideAmounts ? null : Math.round(totalPnl * 100) / 100,
    hideAmounts,
    journalDays,
    rulesFollowedPct,
    journalConsistencyPct,
    pnlByDay,
    recentTrades: recentTrades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      netPnl: hideAmounts ? null : t.netPnl,
      rMultiple: t.rMultiple,
      setup: t.setup,
      entryDate: t.entryDate,
      exitDate: t.exitDate,
    })),
  });
}
