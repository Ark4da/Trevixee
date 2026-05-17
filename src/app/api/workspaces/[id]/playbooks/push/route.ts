/**
 * POST /api/workspaces/:id/playbooks/push
 * Mentor pushes a playbook template to all members of a workspace.
 * Members get a read-only copy with the note it was pushed by mentor.
 * Requires: workspace membership + role = mentor or owner.
 */
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRole } from "@/lib/guards";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["mentor", "owner"], "canPushPlaybookToTeam");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json();
  const { playbookId } = body;
  if (!playbookId) return NextResponse.json({ error: "playbookId required" }, { status: 400 });

  // Fetch the source playbook (must belong to the caller)
  const source = await prisma.playbook.findFirst({
    where: { id: playbookId, userId },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

  // Get all workspace members (excluding the mentor themselves)
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { not: userId } },
  });

  if (members.length === 0) {
    return NextResponse.json({ pushed: 0, message: "No other members to push to" });
  }

  // Create a copy for each member
  const pushed = await Promise.all(
    members.map(async (m) => {
      const copy = await prisma.playbook.create({
        data: {
          userId: m.userId,
          name: source.name,
          description: `[Pushed by team mentor] ${source.description || ""}`.trim(),
          market: source.market,
          timeframe: source.timeframe,
          tags: source.tags,
          isActive: true,
          isReadOnly: true,
          sourcePlaybookId: source.id,
          pushedByUserId: userId,
          pushedAt: new Date(),
          rules: {
            create: source.rules.map(r => ({
              type: r.type,
              text: r.text,
              sortOrder: r.sortOrder,
            })),
          },
        },
      });
      return copy.id;
    })
  );

  return NextResponse.json({ pushed: pushed.length });
}
