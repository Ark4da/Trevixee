import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { prisma } from "@/lib/db";

// GET /api/trades/maemfe — list MAE/MFE records for the authenticated user's trades
// POST /api/trades/maemfe — upsert MAE/MFE for a trade

export async function GET(_req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  // Get tradeIds belonging to user
  const trades = await prisma.trade.findMany({
    where: { userId },
    select: { id: true },
  });
  const tradeIds = trades.map((t) => t.id);

  const records = await prisma.tradeMaeMfe.findMany({
    where: { tradeId: { in: tradeIds } },
    orderBy: { computedAt: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json();
  const { tradeId, mae, mfe } = body as { tradeId: string; mae: number; mfe: number };

  if (!tradeId || typeof mae !== "number" || typeof mfe !== "number") {
    return NextResponse.json({ error: "tradeId, mae, mfe required" }, { status: 400 });
  }

  // Verify trade ownership
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade || trade.userId !== userId) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  const record = await prisma.tradeMaeMfe.upsert({
    where: { tradeId },
    create: { tradeId, mae, mfe },
    update: { mae, mfe, computedAt: new Date() },
  });

  return NextResponse.json(record);
}
