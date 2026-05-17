import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/guards";

type Params = { params: Promise<{ id: string; pinId: string }> };

// DELETE /api/workspaces/:id/pins/:pinId
// Mentor/owner unpins team content.
export async function DELETE(_req: Request, { params }: Params) {
  const { id: workspaceId, pinId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["owner", "mentor"], "canPinTeamContent");
  if (!gate.ok) return gate.response;

  await prisma.pinnedTeamContent.deleteMany({
    where: { id: pinId, workspaceId },
  });

  return NextResponse.json({ ok: true });
}
