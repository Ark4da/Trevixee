import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/me/privacy — fetch current user's team privacy settings.
// hideAmountsInTeam is personal. privacyPeriodDays is used when this user owns
// a workspace and invites new members.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { hideAmountsInTeam: true, privacyPeriodDays: true },
  });

  return NextResponse.json({
    hideAmountsInTeam: settings?.hideAmountsInTeam ?? false,
    privacyPeriodDays: settings?.privacyPeriodDays ?? 0,
  });
}

// PATCH /api/me/privacy — update hideAmountsInTeam and/or owner invite privacy window.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: { hideAmountsInTeam?: boolean; privacyPeriodDays?: number } = {};

  if (typeof body.hideAmountsInTeam === "boolean") {
    updates.hideAmountsInTeam = body.hideAmountsInTeam;
  }
  if (typeof body.privacyPeriodDays === "number" && body.privacyPeriodDays >= 0) {
    updates.privacyPeriodDays = Math.min(Math.round(body.privacyPeriodDays), 90);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: updates,
    create: { userId: session.user.id, ...updates },
    select: { hideAmountsInTeam: true, privacyPeriodDays: true },
  });

  return NextResponse.json(updated);
}
