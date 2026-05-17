import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { prisma } from "@/lib/db";

// POST /api/invites/accept { token }
// Smoke test: valid token → 200 { workspaceId }; expired/revoked → 400; already member → 200
export async function POST(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json();
  const token = (body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: { workspace: true },
  });

  if (!invite || invite.revokedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 400 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Invite already used" }, { status: 400 });
  }

  const workspaceId = invite.workspaceId;

  // Seat cap check
  const memberCount = await prisma.workspaceMember.count({ where: { workspaceId } });
  if (memberCount >= 50) {
    return NextResponse.json({ error: "Workspace is full (50 seat limit)" }, { status: 400 });
  }

  // Idempotent: already a member
  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!existing) {
    const ownerSettings = await prisma.userSettings.findUnique({
      where: { userId: invite.workspace.ownerUserId },
      select: { privacyPeriodDays: true },
    });
    const privacyDays = Math.max(0, Math.min(ownerSettings?.privacyPeriodDays ?? 0, 90));
    const privacyPeriodUntil = privacyDays > 0
      ? new Date(Date.now() + privacyDays * 86_400_000)
      : null;

    await prisma.workspaceMember.create({
      data: { workspaceId, userId, role: invite.role, privacyPeriodUntil },
    });
  }

  await prisma.workspaceInvite.update({
    where: { token },
    data: { acceptedAt: new Date(), acceptedByUserId: userId },
  });

  return NextResponse.json({ workspaceId, workspaceName: invite.workspace.name });
}
