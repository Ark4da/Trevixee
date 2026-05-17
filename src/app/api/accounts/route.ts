import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getEntitlements } from "@/lib/entitlements";
import { requireAuth } from "@/lib/guards";

export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const ent = await getEntitlements(userId);
  const existing = await prisma.account.count({ where: { userId } });

  // Free plan: max 1 account
  if (!ent.capabilities.canUseMultiAccount && existing >= 1) {
    return NextResponse.json({ error: "forbidden", code: "requires_pro" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      userId,
      name: body.name.trim(),
      kind: body.kind || "live",
      broker: body.broker?.trim() || null,
      currency: body.currency || "USD",
      balance: body.balance ? parseFloat(body.balance) : 0,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
