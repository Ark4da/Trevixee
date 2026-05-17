import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// POST /api/workspaces/:id/leave — leave a workspace (non-owner only)
// Owner must first transfer ownership or delete the workspace.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceMember(workspaceId);
  if (!gate.ok) return gate.response;
  const membership = gate.member;

  if (membership.role === "owner") {
    return NextResponse.json(
      { error: "Owners cannot leave — delete the workspace or transfer ownership first" },
      { status: 400 }
    );
  }

  await prisma.workspaceMember.delete({ where: { id: membership.id } });
  return new NextResponse(null, { status: 204 });
}
