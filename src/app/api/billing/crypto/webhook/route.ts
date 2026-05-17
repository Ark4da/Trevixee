import { NextRequest, NextResponse } from "next/server";
import {
  verifyIpnSignature,
  parseOrderId,
  NOWPAYMENTS_PLANS,
  type NowPaymentsIpnPayload,
} from "@/lib/nowpayments";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { captureEvent } from "@/lib/posthog-server";

// POST /api/billing/crypto/webhook
// NowPayments IPN endpoint.
//
// Headers:  x-nowpayments-sig (HMAC-SHA512 of sorted JSON body, hex)
// Body:     NowPaymentsIpnPayload  (see lib/nowpayments.ts)
//
// On `payment_status: "finished"` (or "confirmed"/"sending" for fast UX) we
// upsert the Subscription as active for one billing period, set User.plan,
// and record idempotency.
//
// NowPayments sends multiple IPNs per payment (one per status transition).
// We accept each one but only one will land us in the "finished" branch.

const TERMINAL_SUCCESS = new Set(["finished", "confirmed", "sending"]);
const TERMINAL_FAILURE = new Set(["failed", "expired", "refunded"]);
const PARTIAL = new Set(["partially_paid"]);

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "billing:crypto:webhook", limit: 240, windowMs: 60_000 });
  if (limited) return limited;

  const sig = req.headers.get("x-nowpayments-sig");
  const rawBody = await req.text();

  if (!verifyIpnSignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: NowPaymentsIpnPayload;
  try {
    payload = JSON.parse(rawBody) as NowPaymentsIpnPayload;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const paymentId = String(payload.payment_id);
  const status = payload.payment_status;
  const meta = parseOrderId(payload.order_id);

  if (!meta) {
    console.error("NowPayments IPN: malformed order_id", payload.order_id);
    // 200 so NowPayments stops retrying — we can't recover this
    return NextResponse.json({ received: true, ignored: "bad_order_id" });
  }

  // Idempotency: pre-claim the (paymentId, status) combination. We allow
  // multiple status updates per payment, so the key is paymentId-only and
  // we update its `status` column on each new transition.
  const existing = await prisma.processedNowPaymentsEvent.findUnique({
    where: { paymentId },
  });
  if (existing && existing.status === status) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  await prisma.processedNowPaymentsEvent.upsert({
    where: { paymentId },
    update: { status, processedAt: new Date() },
    create: { paymentId, status },
  });

  try {
    await handleStatus(payload, meta);
  } catch (err) {
    console.error(`NowPayments IPN handler failed (paymentId=${paymentId}):`, err);
    // Roll back the idempotency claim so a retry can succeed.
    await prisma.processedNowPaymentsEvent.deleteMany({ where: { paymentId } });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleStatus(
  payload: NowPaymentsIpnPayload,
  meta: { userId: string; planCode: string; seats: number }
) {
  const status = payload.payment_status;
  const { userId, planCode, seats } = meta;

  if (TERMINAL_FAILURE.has(status)) {
    await prisma.subscription.updateMany({
      where: { externalId: String(payload.payment_id), provider: "nowpayments" },
      data: { status: status === "refunded" ? "canceled" : "past_due", lastSyncAt: new Date() },
    });
    captureEvent(userId, "payment_failed", { plan: planCode, provider: "nowpayments" }).catch(() => {});
    return;
  }

  if (PARTIAL.has(status)) {
    // Underpaid invoice — leave subscription pending; do not grant access.
    return;
  }

  if (!TERMINAL_SUCCESS.has(status)) {
    // "waiting" / "confirming" — payment in flight, nothing to do yet.
    return;
  }

  // Successful payment → grant access for one period.
  const planMeta = NOWPAYMENTS_PLANS[planCode as keyof typeof NOWPAYMENTS_PLANS];
  if (!planMeta) {
    console.error("NowPayments IPN: unknown planCode", planCode);
    return;
  }

  const isTeam = planCode.startsWith("team");
  const periodEnd = new Date(Date.now() + planMeta.periodDays * 86_400_000);
  const externalId = String(payload.payment_id);

  // Upsert by externalId (the NowPayments payment_id is unique per invoice).
  // If user repays for renewal, a new payment_id arrives and we create a new row.
  await prisma.subscription.upsert({
    where: { externalId },
    update: {
      status: "active",
      currentPeriodEnd: periodEnd,
      lastSyncAt: new Date(),
    },
    create: {
      userId,
      provider: "nowpayments",
      externalId,
      planCode,
      status: "active",
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true, // crypto payments don't auto-renew
      seatCount: isTeam ? seats : null,
      trialEndsAt: null,
      lastSyncAt: new Date(),
    },
  });

  // Mark all previous active crypto subscriptions for this user as canceled
  // (a successful new payment supersedes the old one).
  await prisma.subscription.updateMany({
    where: {
      userId,
      provider: "nowpayments",
      externalId: { not: externalId },
      status: "active",
    },
    data: { status: "canceled", lastSyncAt: new Date() },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { plan: isTeam ? "team" : "pro" },
  });

  captureEvent(userId, "subscription_created", {
    plan: planCode,
    provider: "nowpayments",
    payment_id: externalId,
  }).catch(() => {});
}
