import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { captureEvent } from "@/lib/posthog-server";
import { rateLimit } from "@/lib/rate-limit";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "billing:webhook", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  // Pre-register before handling — prevents double-processing if handler succeeds
  // but the DB write fails after. Stripe will retry; the pre-registered record
  // will block re-entry. If this create fails, we return 500 → Stripe retries safely.
  try {
    await prisma.processedStripeEvent.create({
      data: { eventId: event.id, type: event.type },
    });
  } catch {
    // Unique constraint: another worker already claimed this event
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`Webhook handler failed for ${event.type}:`, err);
    // Release the idempotency claim so Stripe can retry a failed handler.
    await prisma.processedStripeEvent.deleteMany({
      where: { eventId: event.id },
    });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) break;
      await syncSubscription(session.subscription as string, session.metadata?.userId);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await upsertSubscription(sub, sub.metadata?.userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status: "canceled", lastSyncAt: new Date() },
      });
      const userId = sub.metadata?.userId;
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { plan: "free" } });
      }
      break;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // v22: subscription is at invoice.parent.subscription_details.subscription
      const subId = getInvoiceSubscriptionId(invoice);
      if (!subId) break;

      if (event.type === "invoice.paid") {
        await syncSubscription(subId);
      } else {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: "past_due", lastSyncAt: new Date() },
        });
      }
      break;
    }
  }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  if (!details) return null;
  const sub = details.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

async function syncSubscription(subscriptionId: string, metaUserId?: string | null) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data"],
  });
  await upsertSubscription(sub, metaUserId ?? sub.metadata?.userId);
}

async function upsertSubscription(sub: Stripe.Subscription, userId?: string | null) {
  if (!userId) {
    const billing = await prisma.billingCustomer.findUnique({
      where: { stripeCustomerId: sub.customer as string },
    });
    userId = billing?.userId;
  }
  if (!userId) {
    console.error("upsertSubscription: could not resolve userId for subscription", sub.id);
    return;
  }

  const VALID_PLAN_CODES = new Set(["pro_monthly", "pro_annual", "team_monthly", "team_annual"]);
  const rawPlanCode = sub.metadata?.planCode ?? sub.items.data[0]?.price?.lookup_key;
  if (!rawPlanCode || !VALID_PLAN_CODES.has(rawPlanCode)) {
    console.error("upsertSubscription: invalid or missing planCode", rawPlanCode, sub.id);
    return;
  }
  const planCode = rawPlanCode;
  const seatCount = sub.items.data[0]?.quantity ?? null;
  const isTeam = planCode.startsWith("team");

  // v22: current_period_end is on the SubscriptionItem, not Subscription
  const periodEnd = sub.items.data[0]?.current_period_end
    ? new Date(sub.items.data[0].current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: {
      status: sub.status,
      planCode,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      seatCount: isTeam ? seatCount : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      lastSyncAt: new Date(),
    },
    create: {
      userId,
      stripeSubscriptionId: sub.id,
      planCode,
      status: sub.status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      seatCount: isTeam ? seatCount : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      lastSyncAt: new Date(),
    },
  });

  const planTier = isTeam ? "team" : "pro";
  const isActive = ["active", "trialing", "past_due"].includes(sub.status);
  await prisma.user.update({
    where: { id: userId },
    data: { plan: isActive ? planTier : "free" },
  });

  // PostHog funnel events
  if (sub.status === "trialing") {
    captureEvent(userId, "trial_started", { plan: planCode }).catch(() => {});
  } else if (sub.status === "active") {
    captureEvent(userId, "subscription_created", { plan: planCode }).catch(() => {});
  } else if (sub.status === "canceled") {
    captureEvent(userId, "subscription_canceled", { plan: planCode }).catch(() => {});
  } else if (sub.status === "past_due") {
    captureEvent(userId, "payment_failed", { plan: planCode }).catch(() => {});
  }
}
