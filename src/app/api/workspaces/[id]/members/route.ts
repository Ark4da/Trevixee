import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id/members — list members (member-gated)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceMember(workspaceId, "canViewTeamFeed");
  if (!gate.ok) return gate.response;
  const viewer = gate.member;
  const canSeeRosterEmails = ["owner", "mentor"].includes(viewer.role);

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      // Pull user display info without exposing sensitive fields
    },
    orderBy: { joinedAt: "asc" },
  });

  // Fetch user info separately to control exposure
  const userIds = members.map((m) => m.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return NextResponse.json(
    members.map((m) => {
      const u = userMap[m.userId];
      const canSeeEmail = canSeeRosterEmails || m.userId === viewer.userId;
      return {
        id: m.id,
        userId: m.userId,
        name: u?.name ?? u?.email?.split("@")[0] ?? "Trader",
        email: canSeeEmail ? u?.email ?? null : null,
        role: m.role,
        joinedAt: m.joinedAt,
      };
    })
  );
}
