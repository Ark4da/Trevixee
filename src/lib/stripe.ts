import Stripe from "stripe";

function createStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

let _stripe: Stripe | undefined;
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) _stripe = createStripeClient();
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const STRIPE_PLANS = {
  pro_monthly: {
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
    planCode: "pro_monthly",
  },
  pro_annual: {
    priceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "",
    planCode: "pro_annual",
  },
  team_monthly: {
    priceId: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID ?? "",
    planCode: "team_monthly",
  },
  team_annual: {
    priceId: process.env.STRIPE_TEAM_ANNUAL_PRICE_ID ?? "",
    planCode: "team_annual",
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;
