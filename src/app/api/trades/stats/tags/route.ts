import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/guards";
import { prisma } from "@/lib/db";

// GET /api/trades/stats/tags?from=&to=
// Pro-gated. Returns per-setup/tag breakdown: count, winRate, avgR, totalPnl
// Smoke test: Free user → 403; Pro user → [{setup, count, wins, winRate, avgR, totalPnl}]

export async function GET(req: NextRequest) {
  const gate = await requireCapability("canUseTagBreakdown");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  const accountId = searchParams.get("accountId");

  const where: Record<string, unknown> = {
    userId,
    status: "closed",
    ...(from || to
      ? {
          exitDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        }
      : {}),
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
    select: { setup: true, netPnl: true, rMultiple: true, exitDate: true },
  });

  // Group by setup (null → "Untagged")
  const map = new Map<string, { count: number; wins: number; totalPnl: number; totalR: number }>();

  for (const t of trades) {
    const key = t.setup?.trim() || "Untagged";
    const existing = map.get(key) ?? { count: 0, wins: 0, totalPnl: 0, totalR: 0 };
    existing.count++;
    if (t.netPnl > 0) existing.wins++;
    existing.totalPnl += t.netPnl;
    existing.totalR   += t.rMultiple;
    map.set(key, existing);
  }

  const rows = Array.from(map.entries())
    .map(([setup, s]) => ({
      setup,
      count:    s.count,
      wins:     s.wins,
      winRate:  s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0,
      avgR:     s.count > 0 ? Math.round((s.totalR / s.count) * 100) / 100 : 0,
      totalPnl: Math.round(s.totalPnl * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json(rows);
}
