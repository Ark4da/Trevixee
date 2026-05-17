export const CHECKOUT_PLAN_LABELS = {
  pro_monthly: "Pro monthly",
  pro_annual: "Pro annual",
  team_monthly: "Team monthly",
  team_annual: "Team annual",
} as const;

export type CheckoutPlanKey = keyof typeof CHECKOUT_PLAN_LABELS;
export type PendingCheckoutPlan = { plan: CheckoutPlanKey; seats?: number };

type SearchParamsLike = {
  get(name: string): string | null;
};

export function getPendingCheckoutPlan(params: SearchParamsLike): PendingCheckoutPlan | null {
  const plan = params.get("plan") as CheckoutPlanKey | null;
  if (!plan || !(plan in CHECKOUT_PLAN_LABELS)) return null;

  const rawSeats = Number(params.get("seats"));
  const seats = plan.startsWith("team")
    ? Math.min(50, Math.max(5, Number.isFinite(rawSeats) ? Math.floor(rawSeats) : 5))
    : undefined;

  return { plan, seats };
}

export function formatCheckoutPlanQuery(plan: PendingCheckoutPlan | null) {
  if (!plan) return "";
  const params = new URLSearchParams({ plan: plan.plan });
  if (plan.seats) params.set("seats", String(plan.seats));
  return `?${params.toString()}`;
}
