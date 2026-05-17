import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/guards";
import { prisma } from "@/lib/db";

// GET /api/trades/stats/heatmap?from=&to=
// Pro-gated. Returns day-of-week × hour-of-day performance matrix.
// Smoke test: Free → 403; Pro → { cells: [{dow, hour, count, winRate, avgPnl}] }

const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export async function GET(req: NextRequest) {
  const gate = await requireCapability("canUseTimeHeatmap");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  const accountId = searchParams.get("accountId");

  const where: Record<string, unknown> = {
    userId,
    status: "closed",
    exitDate: { not: null },
    ...(from || to ? { exitDate: {
      not: null,
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    }} : {}),
  };
  if (accountId && accountId !== "all") {
    if (accountId === "unassigned") {
      where.accountId = null;
    } else {
      const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
      if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      where.accountId = accountId;
    }
  }

  const trades = await prisma.trade.findMany({
    where,
    select: { exitDate: true, netPnl: true },
  });

  // Build 7×24 grid indexed by [dow][hour]
  type Cell = { count: number; wins: number; totalPnl: number };
  const grid: Cell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ count: 0, wins: 0, totalPnl: 0 }))
  );

  for (const t of trades) {
    if (!t.exitDate) continue;
    const d = new Date(t.exitDate);
    const dow  = d.getDay();       // 0=Sun … 6=Sat
    const hour = d.getHours();
    grid[dow][hour].count++;
    if (t.netPnl > 0) grid[dow][hour].wins++;
    grid[dow][hour].totalPnl += t.netPnl;
  }

  const cells = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const c = grid[dow][hour];
      if (c.count === 0) continue;
      cells.push({
        dow,
        dowLabel: DOW_LABELS[dow],
        hour,
        count:   c.count,
        winRate: Math.round((c.wins / c.count) * 100),
        avgPnl:  Math.round((c.totalPnl / c.count) * 100) / 100,
      });
    }
  }

  return NextResponse.json({ cells });
}
