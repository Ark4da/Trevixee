import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, requireWorkspaceRole } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id — workspace overview (member-gated)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const gate = await requireWorkspaceMember(id, "canViewTeamFeed");
  if (!gate.ok) return gate.response;

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    ownerUserId: workspace.ownerUserId,
    memberCount: workspace._count.members,
    role: gate.member.role,
  });
}

// PATCH /api/workspaces/:id — update name (owner only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const gate = await requireWorkspaceRole(id, ["owner"], "canManageBilling");
  if (!gate.ok) return gate.response;

  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Name required (max 60 chars)" }, { status: 400 });
  }

  const updated = await prisma.workspace.update({ where: { id }, data: { name } });
  return NextResponse.json({ id: updated.id, name: updated.name });
}

// DELETE /api/workspaces/:id — owner only
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const gate = await requireWorkspaceRole(id, ["owner"], "canManageBilling");
  if (!gate.ok) return gate.response;

  await prisma.workspace.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
