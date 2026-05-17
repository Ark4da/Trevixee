import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/notebook-links?tradeId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const tradeId = url.searchParams.get("tradeId");
  const journalId = url.searchParams.get("journalId");

  const where: Record<string, unknown> = { userId };
  if (tradeId) where.tradeId = tradeId;
  if (journalId) where.journalId = journalId;

  const links = await prisma.notebookLink.findMany({
    where,
    include: { note: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(links);
}

// POST /api/notebook-links  { noteId, tradeId?, journalId? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const { noteId, tradeId, journalId } = body as {
    noteId: string;
    tradeId?: string;
    journalId?: string;
  };

  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });
  if (!tradeId && !journalId) return NextResponse.json({ error: "tradeId or journalId required" }, { status: 400 });

  // Check note belongs to user
  const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  if (tradeId) {
    const trade = await prisma.trade.findFirst({
      where: { id: tradeId, userId },
      select: { id: true },
    });
    if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  if (journalId) {
    const journal = await prisma.journalEntry.findFirst({
      where: { id: journalId, userId },
      select: { id: true },
    });
    if (!journal) return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
  }

  // Avoid duplicates
  const existing = await prisma.notebookLink.findFirst({
    where: { userId, noteId, tradeId: tradeId || null, journalId: journalId || null },
  });
  if (existing) {
    const trade = existing.tradeId
      ? await prisma.trade.findFirst({
          where: { id: existing.tradeId, userId },
          select: { id: true, symbol: true, pnl: true, netPnl: true, entryDate: true, side: true },
        })
      : null;
    return NextResponse.json({ ...existing, trade });
  }

  const link = await prisma.notebookLink.create({
    data: { userId, noteId, tradeId: tradeId || null, journalId: journalId || null },
  });

  const trade = link.tradeId
    ? await prisma.trade.findFirst({
        where: { id: link.tradeId, userId },
        select: { id: true, symbol: true, pnl: true, netPnl: true, entryDate: true, side: true },
      })
    : null;

  return NextResponse.json({ ...link, trade }, { status: 201 });
}

// DELETE /api/notebook-links?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.notebookLink.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
