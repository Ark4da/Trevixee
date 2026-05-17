import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/violations?since=<ISO date>
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const since   = searchParams.get("since");
  const tradeId = searchParams.get("tradeId");

  const violations = await prisma.ruleViolation.findMany({
    where: {
      userId: session.user.id,
      ...(since   ? { detectedAt: { gte: new Date(since) } } : {}),
      ...(tradeId ? { tradeId } : {}),
    },
    orderBy: { detectedAt: "desc" },
    take: 200,
  });

  return NextResponse.json(violations);
}

// POST /api/violations
// Body: { tradeId, playbookId, ruleId, note? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tradeId, playbookId, ruleId, note } = body;

  if (!tradeId || !playbookId || !ruleId) {
    return NextResponse.json({ error: "tradeId, playbookId, ruleId are required" }, { status: 400 });
  }

  // Verify trade belongs to user
  const trade = await prisma.trade.findFirst({ where: { id: tradeId, userId: session.user.id } });
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  // Verify playbook belongs to user
  const playbook = await prisma.playbook.findFirst({ where: { id: playbookId, userId: session.user.id } });
  if (!playbook) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

  // Prevent duplicates
  const existing = await prisma.ruleViolation.findFirst({ where: { tradeId, ruleId, userId: session.user.id } });
  if (existing) return NextResponse.json(existing);

  const violation = await prisma.ruleViolation.create({
    data: { userId: session.user.id, tradeId, playbookId, ruleId, note: note ?? null },
  });

  return NextResponse.json(violation, { status: 201 });
}
