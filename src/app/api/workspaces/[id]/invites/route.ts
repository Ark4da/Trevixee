import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRole } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id/invites — list pending invites (owner/mentor)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["owner"], "canInviteMembers");
  if (!gate.ok) return gate.response;

  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invites.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  })));
}

// POST /api/workspaces/:id/invites — create invite + send email (owner only)
export async function POST(req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["owner"], "canInviteMembers");
  if (!gate.ok) return gate.response;

  const self = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: gate.session.user.id } },
    include: { workspace: true },
  });
  if (!self) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enforce seat cap (50 max)
  const memberCount = await prisma.workspaceMember.count({ where: { workspaceId } });
  if (memberCount >= 50) {
    return NextResponse.json({ error: "Workspace seat limit (50) reached" }, { status: 400 });
  }

  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const role = ["mentor", "member"].includes(body.role) ? body.role : "member";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);

  const invite = await prisma.workspaceInvite.create({
    data: { workspaceId, email, role, token, expiresAt },
  });

  const inviterName = gate.session.user.name ?? gate.session.user.email ?? "Someone";
  await sendInviteEmail(email, {
    workspaceName: self.workspace.name,
    inviterName,
    token,
    role,
  }).catch(() => {}); // Don't fail the request if email fails

  return NextResponse.json({ id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, { status: 201 });
}
