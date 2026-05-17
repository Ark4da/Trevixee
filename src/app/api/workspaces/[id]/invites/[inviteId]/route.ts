import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRole } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string; inviteId: string }> };

// DELETE /api/workspaces/:id/invites/:inviteId — revoke (owner only)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: workspaceId, inviteId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["owner"], "canInviteMembers");
  if (!gate.ok) return gate.response;

  const invite = await prisma.workspaceInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.workspaceInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
