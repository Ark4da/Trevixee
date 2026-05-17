import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { endOfUtcDay, startOfUtcDay } from "@/lib/date";
import { getEntitlements } from "@/lib/entitlements";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (date) {
    const dayStartUtc = startOfUtcDay(date);
    if (!dayStartUtc) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const entry = await prisma.journalEntry.findUnique({
      where: { userId_date: { userId, date: dayStartUtc } },
    });
    return NextResponse.json(entry);
  }

  const ents = await getEntitlements(userId);
  const historyFloor = ents.maxHistoryDays > 0
    ? new Date(Date.now() - ents.maxHistoryDays * 86_400_000)
    : null;

  const where: Record<string, unknown> = { userId };
  {
    const dateFilter: Record<string, unknown> = {};
    if (historyFloor) dateFilter.gte = historyFloor;
    if (from) {
      const start = startOfUtcDay(from);
      if (start) {
        dateFilter.gte = historyFloor
          ? new Date(Math.max(historyFloor.getTime(), start.getTime()))
          : start;
      }
    }
    if (to) {
      const end = endOfUtcDay(to);
      if (end) dateFilter.lte = end;
    }
    if (Object.keys(dateFilter).length) where.date = dateFilter;
  }
  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: { date: "desc" },
    take: 60,
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const dateStr = body.date;
  const dateObj = startOfUtcDay(dateStr);
  if (!dateObj) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const existing = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId, date: dateObj } },
  });

  if (existing) {
    const entry = await prisma.journalEntry.update({
      where: { userId_date: { userId, date: dateObj } },
      data: {
        preMarketNotes: body.preMarketNotes ?? existing.preMarketNotes,
        postMarketNotes: body.postMarketNotes ?? existing.postMarketNotes,
        marketCondition: body.marketCondition ?? existing.marketCondition,
        emotionalState: body.emotionalState ?? existing.emotionalState,
        rulesFollowed: body.rulesFollowed ?? existing.rulesFollowed,
        lessonsLearned: body.lessonsLearned ?? existing.lessonsLearned,
        dailyGoal: body.dailyGoal ?? existing.dailyGoal,
        goalMet: body.goalMet ?? existing.goalMet,
        rating: body.rating ?? existing.rating,
        notes: body.notes ?? existing.notes,
        sharedWithTeam: typeof body.sharedWithTeam === "boolean" ? body.sharedWithTeam : existing.sharedWithTeam,
      },
    });
    return NextResponse.json(entry);
  }

  const entry = await prisma.journalEntry.create({
    data: {
      userId,
      date: dateObj,
      preMarketNotes: body.preMarketNotes || null,
      postMarketNotes: body.postMarketNotes || null,
      marketCondition: body.marketCondition || null,
      emotionalState: body.emotionalState || null,
      rulesFollowed: body.rulesFollowed ?? true,
      lessonsLearned: body.lessonsLearned || null,
      dailyGoal: body.dailyGoal || null,
      goalMet: body.goalMet ?? false,
      rating: body.rating || null,
      notes: body.notes || null,
      sharedWithTeam: typeof body.sharedWithTeam === "boolean" ? body.sharedWithTeam : true,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
