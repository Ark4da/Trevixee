import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");

  const where: Record<string, unknown> = { userId };
  if (category && category !== "all") where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { content: { contains: search } },
      { tags: { contains: search } },
    ];
  }

  const notes = await prisma.note.findMany({
    where,
    include: { links: { select: { id: true, tradeId: true, journalId: true } } },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  // Batch-fetch trade symbols for all linked tradeIds
  const tradeIds = [...new Set(
    notes.flatMap((n) => n.links.map((l) => l.tradeId).filter(Boolean) as string[])
  )];
  const tradesMap: Record<string, { symbol: string; pnl: number; netPnl: number; entryDate: Date; side: string }> = {};
  if (tradeIds.length > 0) {
    const trades = await prisma.trade.findMany({
      where: { id: { in: tradeIds }, userId },
      select: { id: true, symbol: true, pnl: true, netPnl: true, entryDate: true, side: true },
    });
    for (const tr of trades) tradesMap[tr.id] = tr;
  }

  const result = notes.map((n) => ({
    ...n,
    links: n.links.map((l) => ({
      ...l,
      trade: l.tradeId ? (tradesMap[l.tradeId] ?? null) : null,
    })),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const note = await prisma.note.create({
    data: {
      userId,
      title: body.title || "Untitled",
      content: body.content || "",
      category: body.category || "general",
      tags: body.tags || null,
      isPinned: body.isPinned ?? false,
    },
  });
  return NextResponse.json(note, { status: 201 });
}
