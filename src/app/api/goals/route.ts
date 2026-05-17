import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const goals = await prisma.goal.findMany({
    where: { isActive: true, userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(goals);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.type) {
    return NextResponse.json({ error: "Type is required" }, { status: 400 });
  }
  if (body.target == null || isNaN(parseFloat(body.target))) {
    return NextResponse.json({ error: "Target must be a number" }, { status: 400 });
  }
  const now = new Date();

  let endDate: Date;
  if (body.period === "monthly") {
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else {
    const day = now.getDay();
    const diff = 7 - day;
    endDate = new Date(now);
    endDate.setDate(now.getDate() + diff);
    endDate.setHours(23, 59, 59, 0);
  }

  const goal = await prisma.goal.create({
    data: {
      userId,
      title: body.title,
      type: body.type,
      target: parseFloat(body.target),
      period: body.period || "weekly",
      startDate: now,
      endDate,
      isActive: true,
    },
  });
  return NextResponse.json(goal, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.goal.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
