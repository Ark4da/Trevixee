import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id/feed?cursor=&limit=20
// Returns recent team activity: closed trades and journal entries
// Respects privacyPeriodUntil: members inside privacy window are hidden
export async function GET(req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceMember(workspaceId, "canViewTeamFeed");
  if (!gate.ok) return gate.response;

  const url = req.nextUrl;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const filterSymbol = url.searchParams.get("symbol") ?? undefined;
  const filterSetup = url.searchParams.get("setup") ?? undefined;
  const filterSince = url.searchParams.get("since") ?? undefined; // ISO date string

  // Get all members whose privacy period has passed
  const visibleMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      OR: [
        { privacyPeriodUntil: null },
        { privacyPeriodUntil: { lt: new Date() } },
      ],
    },
    select: { userId: true },
  });
  const visibleUserIds = visibleMembers.map((m) => m.userId);

  // Fetch recent trades from visible members
  const trades = await prisma.trade.findMany({
    where: {
      userId: { in: visibleUserIds },
      status: "closed",
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      ...(filterSymbol ? { symbol: { contains: filterSymbol, mode: "insensitive" } } : {}),
      ...(filterSetup ? { setup: { contains: filterSetup, mode: "insensitive" } } : {}),
      ...(filterSince ? { exitDate: { gte: new Date(filterSince) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      symbol: true,
      side: true,
      netPnl: true,
      rMultiple: true,
      entryDate: true,
      exitDate: true,
      createdAt: true,
      setup: true,
      notes: true,
    },
  });

  // Get user display names
  const userIds = [...new Set(trades.map((t) => t.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userSettings = await prisma.userSettings.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, hideAmountsInTeam: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const settingsMap = Object.fromEntries(userSettings.map((s) => [s.userId, s]));

  const feed = trades.map((t) => {
    const u = userMap[t.userId];
    const s = settingsMap[t.userId];
    const hideAmounts = s?.hideAmountsInTeam ?? false;

    return {
      kind: "trade" as const,
      id: t.id,
      userId: t.userId,
      userName: u?.name ?? u?.email?.split("@")[0] ?? "Trader",
      symbol: t.symbol,
      side: t.side,
      netPnl: hideAmounts ? null : t.netPnl,
      rMultiple: t.rMultiple,
      entryDate: t.entryDate,
      exitDate: t.exitDate,
      setup: t.setup,
      notes: t.notes ?? null,
      createdAt: t.createdAt,
    };
  });

  const nextCursor = feed.length === limit ? feed[feed.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({ feed, nextCursor });
}
