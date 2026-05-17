import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRole } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string; memberId: string }> };

// PATCH /api/workspaces/:id/members/:memberId — change role (owner only, member↔mentor)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: workspaceId, memberId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["owner"], "canRemoveMember");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json().catch(() => ({}));
  const newRole: string = body.role;
  if (!["member", "mentor"].includes(newRole)) {
    return NextResponse.json({ error: "Role must be member or mentor" }, { status: 400 });
  }

  const target = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
  if (!target || target.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.userId === userId) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role: newRole },
  });
  return NextResponse.json({ id: updated.id, role: updated.role });
}

// DELETE /api/workspaces/:id/members/:memberId — kick member (owner only)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: workspaceId, memberId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["owner"], "canRemoveMember");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
  });
  if (!target || target.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.userId === userId) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  await prisma.workspaceMember.delete({ where: { id: memberId } });
  return new NextResponse(null, { status: 204 });
}
