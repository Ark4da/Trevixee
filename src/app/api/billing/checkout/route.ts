import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { stripe, STRIPE_PLANS, PlanKey } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// Smoke test: POST /api/billing/checkout { plan: "pro_monthly" }
// → 200 { url: "https://checkout.stripe.com/..." }
// Free user clicking Upgrade → redirect to Stripe Checkout
// After payment → webhook sets subscription, /api/billing/checkout?success=1

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "billing:checkout", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const userEmail = gate.session.user.email;

  const body = await req.json();
  const { plan, seats } = body as { plan: PlanKey; seats?: number };

  const planConfig = STRIPE_PLANS[plan];
  if (!planConfig) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!planConfig.priceId) {
    return NextResponse.json(
      { error: "Stripe price is not configured for this plan" },
      { status: 500 }
    );
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe secret key is not configured" },
      { status: 500 }
    );
  }

  const isTeam = plan.startsWith("team");
  const seatCount = isTeam && Number.isFinite(seats) ? Math.floor(Number(seats)) : undefined;
  if (isTeam && (!seatCount || seatCount < 5 || seatCount > 50)) {
    return NextResponse.json(
      { error: "Team plan requires 5–50 seats" },
      { status: 400 }
    );
  }

  // Get or create Stripe customer. Existing rows may be NowPayments-only
  // (stripeCustomerId null) — in that case create the Stripe customer and
  // attach it to the same row so a single user can use both providers.
  let billing = await prisma.billingCustomer.findUnique({ where: { userId } });
  if (!billing || !billing.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: userEmail ?? undefined,
      metadata: { userId },
    });
    if (billing) {
      billing = await prisma.billingCustomer.update({
        where: { userId },
        data: { stripeCustomerId: customer.id, provider: "stripe" },
      });
    } else {
      billing = await prisma.billingCustomer.create({
        data: { userId, stripeCustomerId: customer.id, provider: "stripe" },
      });
    }
  }
  // After the block above, stripeCustomerId is guaranteed to be set.
  const stripeCustomerId = billing.stripeCustomerId!;

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Only offer trial to users who have never had one
  const hasPastTrial = await prisma.subscription.findFirst({
    where: { userId, trialEndsAt: { not: null } },
  });
  const trialDays = hasPastTrial ? undefined : 14;

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [
      {
        price: planConfig.priceId,
        quantity: isTeam ? seatCount : 1,
      },
    ],
    subscription_data: {
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      metadata: { userId, planCode: planConfig.planCode, ...(seatCount ? { seats: String(seatCount) } : {}) },
    },
    automatic_tax: { enabled: true },
    success_url: `${appUrl}/settings?billing=success`,
    cancel_url: `${appUrl}/pricing?billing=canceled`,
    metadata: { userId, planCode: planConfig.planCode, ...(seatCount ? { seats: String(seatCount) } : {}) },
  });

  return NextResponse.json({ url: session.url });
}
