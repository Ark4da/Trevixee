import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEntitlements, CapabilityKey } from "@/lib/entitlements";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getImpersonatedUserId } from "@/lib/impersonation";
import { prisma } from "@/lib/db";

type GateResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

type WorkspaceMemberGateResult =
  | {
      ok: true;
      session: Session;
      member: {
        id: string;
        workspaceId: string;
        userId: string;
        role: string;
        joinedAt: Date;
        privacyPeriodUntil: Date | null;
      };
    }
  | { ok: false; response: NextResponse };

export async function requireCapability(
  cap: CapabilityKey
): Promise<GateResult> {
  const gate = await requireAuth();
  if (!gate.ok) return gate;

  const ents = await getEntitlements(gate.session.user.id);
  if (!ents.capabilities[cap]) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: planToCode(ents.plan, cap) },
        { status: 403 }
      ),
    };
  }

  return gate;
}

export async function requireAuth(): Promise<GateResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const impersonatedUserId = await getImpersonatedUserId();
  if (impersonatedUserId && impersonatedUserId !== session.user.id) {
    const targetUser = await prisma.user.findUnique({
      where: { id: impersonatedUserId },
      select: { id: true, email: true, name: true },
    });
    if (targetUser) {
      session.user = {
        ...session.user,
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      };
    }
  }

  return { ok: true, session };
}

export async function requireWorkspaceMember(
  workspaceId: string,
  cap?: CapabilityKey
): Promise<WorkspaceMemberGateResult> {
  const gate = cap ? await requireCapability(cap) : await requireAuth();
  if (!gate.ok) return gate;

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: gate.session.user.id } },
  });
  if (!member) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  return { ok: true, session: gate.session, member };
}

export async function requireWorkspaceRole(
  workspaceId: string,
  roles: string[],
  cap?: CapabilityKey
): Promise<WorkspaceMemberGateResult> {
  const gate = await requireWorkspaceMember(workspaceId, cap);
  if (!gate.ok) return gate;

  if (!roles.includes(gate.member.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: "forbidden_workspace_role" },
        { status: 403 }
      ),
    };
  }

  return gate;
}

const TEAM_CAPS = new Set<CapabilityKey>([
  "canCreateWorkspace",
  "canInviteMembers",
  "canViewTeamFeed",
  "canViewLeaderboard",
  "canCommentOnMemberTrade",
  "canPinTeamContent",
  "canPushPlaybookToTeam",
  "canRemoveMember",
  "canManageBilling",
]);

function planToCode(
  currentPlan: string,
  cap: CapabilityKey
): string {
  if (TEAM_CAPS.has(cap)) return "requires_team";
  if (currentPlan === "free") return "requires_pro";
  return "requires_higher_plan";
}
