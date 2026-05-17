import { prisma } from "@/lib/db";

export type CapabilityKey =
  | "canUseCsvImport"
  | "canUseBrokerImport"
  | "canExportData"
  | "canUseAdvancedReports"
  | "canUseAdvancedBacktesting"
  | "canUseMaeMfe"
  | "canUseTagBreakdown"
  | "canUseTimeHeatmap"
  | "canUseCustomDateRange"
  | "canUseAiTradeReview"
  | "canUseMultiAccount"
  | "canUseTradingViewWebhook"
  | "canUseAdvancedAlerts"
  | "canUseWeaknessCurriculum"
  | "canCreateWorkspace"
  | "canInviteMembers"
  | "canViewTeamFeed"
  | "canViewLeaderboard"
  | "canCommentOnMemberTrade"
  | "canPinTeamContent"
  | "canPushPlaybookToTeam"
  | "canRemoveMember"
  | "canManageBilling";

export interface Entitlements {
  plan: "free" | "pro" | "team";
  status: "active" | "trialing" | "past_due" | "canceled" | "free";
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  maxHistoryDays: number;
  maxAccounts: number;
  maxWorkspaces: number;
  maxSeats: number;
  capabilities: Record<CapabilityKey, boolean>;
}

export type EntitlementSnapshot = Omit<Entitlements, "trialEndsAt" | "currentPeriodEnd"> & {
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

export function toEntitlementSnapshot(entitlements: Entitlements): EntitlementSnapshot {
  return {
    ...entitlements,
    trialEndsAt: entitlements.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: entitlements.currentPeriodEnd?.toISOString() ?? null,
  };
}

function hasLifetimePro(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (process.env.LIFETIME_PRO_EMAILS ?? "")
    .split(",")
    .map((value) => value.toLowerCase().trim())
    .filter(Boolean)
    .includes(normalized);
}

const FREE_CAPS: Record<CapabilityKey, boolean> = {
  canUseCsvImport: false,
  canUseBrokerImport: false,
  canExportData: false,
  canUseAdvancedReports: false,
  canUseAdvancedBacktesting: false,
  canUseMaeMfe: true,
  canUseTagBreakdown: false,
  canUseTimeHeatmap: false,
  canUseCustomDateRange: false,
  canUseAiTradeReview: false,
  canUseMultiAccount: false,
  canUseTradingViewWebhook: false,
  canUseAdvancedAlerts: false,
  canUseWeaknessCurriculum: false,
  canCreateWorkspace: false,
  canInviteMembers: false,
  canViewTeamFeed: false,
  canViewLeaderboard: false,
  canCommentOnMemberTrade: false,
  canPinTeamContent: false,
  canPushPlaybookToTeam: false,
  canRemoveMember: false,
  canManageBilling: false,
};

const PRO_CAPS: Record<CapabilityKey, boolean> = {
  ...FREE_CAPS,
  canUseCsvImport: true,
  canUseBrokerImport: true,
  canExportData: true,
  canUseAdvancedReports: true,
  canUseAdvancedBacktesting: true,
  canUseMaeMfe: true,
  canUseTagBreakdown: true,
  canUseTimeHeatmap: true,
  canUseCustomDateRange: true,
  canUseAiTradeReview: true,
  canUseMultiAccount: true,
  canUseTradingViewWebhook: true,
  canUseAdvancedAlerts: true,
  canUseWeaknessCurriculum: true,
};

const TEAM_CAPS: Record<CapabilityKey, boolean> = {
  ...PRO_CAPS,
  canCreateWorkspace: true,
  canInviteMembers: true,
  canViewTeamFeed: true,
  canViewLeaderboard: true,
  canManageBilling: true,
};

function resolveCaps(
  baseCaps: Record<CapabilityKey, boolean>,
  role?: string
): Record<CapabilityKey, boolean> {
  if (role === "owner") {
    return {
      ...baseCaps,
      canCommentOnMemberTrade: true,
      canPinTeamContent: true,
      canPushPlaybookToTeam: true,
      canRemoveMember: true,
      canManageBilling: true,
    };
  }
  if (role === "mentor") {
    return {
      ...baseCaps,
      canCommentOnMemberTrade: true,
      canPinTeamContent: true,
      canPushPlaybookToTeam: true,
    };
  }
  return baseCaps;
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const [user, subscription, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, plan: true } }),
    prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "trialing", "past_due"] },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { joinedAt: "asc" },
      select: { role: true },
    }),
  ]);
  const membership = pickHighestRole(memberships.map((m) => m.role));

  if (!user) {
    if (membership) return buildInheritedTeam(membership.role);
    return buildFree();
  }

  if (hasLifetimePro(user.email)) return buildPro();

  const activeSub = subscription && isSubActive(subscription);

  if (!activeSub) {
    // No active subscription row — but User.plan may be a valid denormalized cache
    // (e.g., webhook set it but Subscription row hasn't been synced yet, or grace period).
    // Subscription row is always the source of truth; User.plan is a secondary signal only
    // when the subscription row is genuinely absent (not expired/canceled).
    if (!subscription && user.plan === "team") return buildTeam(membership?.role);
    if (!subscription && user.plan === "pro") return buildPro();
    return buildFree();
  }

  const planCode = subscription!.planCode;
  const status = subscription!.status as Entitlements["status"];
  const trialEndsAt = subscription!.trialEndsAt;
  const currentPeriodEnd = subscription!.currentPeriodEnd;

  if (planCode.startsWith("team")) {
    return {
      plan: "team",
      status,
      trialEndsAt,
      currentPeriodEnd,
      maxHistoryDays: 0,
      maxAccounts: 999,
      maxWorkspaces: 5,
      maxSeats: 50,
      capabilities: resolveCaps(TEAM_CAPS, membership?.role),
    };
  }

  if (planCode.startsWith("pro")) {
    return {
      plan: "pro",
      status,
      trialEndsAt,
      currentPeriodEnd,
      maxHistoryDays: 0,
      maxAccounts: 999,
      maxWorkspaces: 0,
      maxSeats: 0,
      capabilities: PRO_CAPS,
    };
  }

  if (membership) return buildInheritedTeam(membership.role);
  return buildFree();
}

function isSubActive(sub: { status: string; currentPeriodEnd: Date }): boolean {
  const now = new Date();
  if (sub.status === "canceled") return false;
  if (sub.status === "past_due") {
    // 3-day grace period
    const graceCutoff = new Date(sub.currentPeriodEnd);
    graceCutoff.setDate(graceCutoff.getDate() + 3);
    return now < graceCutoff;
  }
  if (!["active", "trialing"].includes(sub.status)) return false;
  return new Date(sub.currentPeriodEnd) > now;
}

function buildFree(): Entitlements {
  return {
    plan: "free",
    status: "free",
    trialEndsAt: null,
    currentPeriodEnd: null,
    maxHistoryDays: 62,
    maxAccounts: 1,
    maxWorkspaces: 0,
    maxSeats: 0,
    capabilities: FREE_CAPS,
  };
}

function buildPro(): Entitlements {
  return {
    plan: "pro",
    status: "active",
    trialEndsAt: null,
    currentPeriodEnd: null,
    maxHistoryDays: 0,
    maxAccounts: 999,
    maxWorkspaces: 0,
    maxSeats: 0,
    capabilities: PRO_CAPS,
  };
}

function buildTeam(role?: string): Entitlements {
  return {
    plan: "team",
    status: "active",
    trialEndsAt: null,
    currentPeriodEnd: null,
    maxHistoryDays: 0,
    maxAccounts: 999,
    maxWorkspaces: 5,
    maxSeats: 50,
    capabilities: resolveCaps(TEAM_CAPS, role),
  };
}

function pickHighestRole(roles: string[]): { role: string } | null {
  if (roles.includes("owner")) return { role: "owner" };
  if (roles.includes("mentor")) return { role: "mentor" };
  if (roles.includes("member")) return { role: "member" };
  return roles[0] ? { role: roles[0] } : null;
}

function buildInheritedTeam(role: string): Entitlements {
  const caps: Record<CapabilityKey, boolean> = {
    ...PRO_CAPS,
    canCreateWorkspace: false,
    canInviteMembers: role === "owner",
    canViewTeamFeed: true,
    canViewLeaderboard: true,
    canManageBilling: role === "owner",
    canRemoveMember: role === "owner",
    canCommentOnMemberTrade: role === "owner" || role === "mentor",
    canPinTeamContent: role === "owner" || role === "mentor",
    canPushPlaybookToTeam: role === "owner" || role === "mentor",
  };

  return {
    plan: "team",
    status: "active",
    trialEndsAt: null,
    currentPeriodEnd: null,
    maxHistoryDays: 0,
    maxAccounts: 999,
    maxWorkspaces: 0,
    maxSeats: 50,
    capabilities: caps,
  };
}
