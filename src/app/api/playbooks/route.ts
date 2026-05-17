import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";

export async function GET(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const playbooks = await prisma.playbook.findMany({
    where: { userId },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const trades = await prisma.trade.findMany({ where: { status: "closed", userId } });

  const enriched = playbooks.map((pb) => {
    const matched = trades.filter((t) => t.playbookId === pb.id || t.setup === pb.name);
    const wins = matched.filter((t) => t.pnl > 0).length;
    const totalPnl = matched.reduce((s, t) => s + t.pnl, 0);
    const avgR = matched.length > 0
      ? matched.reduce((s, t) => s + t.rMultiple, 0) / matched.length
      : 0;
    return {
      ...pb,
      totalTrades: matched.length,
      winRate: matched.length > 0 ? Math.round((wins / matched.length) * 1000) / 10 : 0,
      totalPnl: Math.round(totalPnl * 100) / 100,
      avgR: Math.round(avgR * 100) / 100,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const playbook = await prisma.playbook.create({
    data: {
      userId,
      name: body.name,
      description: body.description || null,
      market: body.market || "futures",
      timeframe: body.timeframe || null,
      tags: body.tags || null,
      isActive: body.isActive ?? true,
      isReadOnly: false,
      rules: {
        create: (body.rules || []).map((r: { type: string; text: string }, i: number) => ({
          type: r.type, text: r.text, sortOrder: i,
        })),
      },
    },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(playbook, { status: 201 });
}
