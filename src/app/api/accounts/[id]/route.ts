import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const { id } = await params;
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.account.update({
    where: { id },
    data: {
      name: body.name?.trim() || account.name,
      kind: body.kind || account.kind,
      broker: body.broker !== undefined ? (body.broker?.trim() || null) : account.broker,
      currency: body.currency || account.currency,
      balance: body.balance !== undefined ? parseFloat(body.balance) : account.balance,
      isActive: body.isActive !== undefined ? !!body.isActive : account.isActive,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const { id } = await params;
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.trade.updateMany({
    where: { userId, accountId: id },
    data: { accountId: null },
  });
  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
