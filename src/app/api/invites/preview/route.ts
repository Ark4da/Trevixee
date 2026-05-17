import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { prisma } from "@/lib/db";

// GET /api/invites/preview?token=<token>
// Returns public invite info without consuming the token
export async function GET(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: { workspace: true },
  });

  if (!invite) {
    return NextResponse.json({ error: "Приглашение не найдено или недействительно." }, { status: 404 });
  }
  if (invite.revokedAt) {
    return NextResponse.json({ error: "Это приглашение было отозвано." }, { status: 410 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Это приглашение уже было использовано." }, { status: 410 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Срок действия приглашения истёк (7 дней)." }, { status: 410 });
  }

  return NextResponse.json({
    workspaceName: invite.workspace.name,
    role: invite.role,
  });
}
