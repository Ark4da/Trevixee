import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const { id } = await params;
  const playbook = await prisma.playbook.findFirst({
    where: { id, userId },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
  });
  if (!playbook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(playbook);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const { id } = await params;
  const existing = await prisma.playbook.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isReadOnly) {
    return NextResponse.json({ error: "Read-only playbooks cannot be edited" }, { status: 403 });
  }

  const body = await req.json();
  await prisma.playbookRule.deleteMany({ where: { playbookId: id } });

  const playbook = await prisma.playbook.update({
    where: { id, userId },
    data: {
      name: body.name,
      description: body.description || null,
      market: body.market || "futures",
      timeframe: body.timeframe || null,
      tags: body.tags || null,
      isActive: body.isActive ?? true,
      rules: {
        create: (body.rules || []).map((r: { type: string; text: string }, i: number) => ({
          type: r.type, text: r.text, sortOrder: i,
        })),
      },
    },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(playbook);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const { id } = await params;
  const existing = await prisma.playbook.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isReadOnly) {
    return NextResponse.json({ error: "Read-only playbooks cannot be deleted" }, { status: 403 });
  }
  await prisma.playbook.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
