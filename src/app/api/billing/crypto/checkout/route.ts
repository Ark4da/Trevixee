import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { rateLimit } from "@/lib/rate-limit";
import {
  createInvoice,
  isNowPaymentsConfigured,
  NOWPAYMENTS_PLANS,
  type NowPaymentsPlanKey,
} from "@/lib/nowpayments";
import { prisma } from "@/lib/db";

// POST /api/billing/crypto/checkout { plan: "pro_monthly", seats?: 5 }
// → 200 { url: "https://nowpayments.io/payment/..." }
//
// Flow: user clicks "Pay with crypto" → we create a hosted invoice → return its
// URL → client redirects → user pays → IPN handler updates Subscription.

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "billing:crypto:checkout", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  if (!isNowPaymentsConfigured()) {
    return NextResponse.json(
      { error: "Crypto payments not configured" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const plan = body.plan as NowPaymentsPlanKey;
  const seats = body.seats as number | undefined;

  const planConfig = NOWPAYMENTS_PLANS[plan];
  if (!planConfig) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const isTeam = "perSeat" in planConfig && planConfig.perSeat;
  const seatCount = isTeam && Number.isFinite(seats) ? Math.floor(Number(seats)) : 1;
  if (isTeam && (seatCount < 5 || seatCount > 50)) {
    return NextResponse.json(
      { error: "Team plan requires 5–50 seats" },
      { status: 400 }
    );
  }

  // Ensure a BillingCustomer row exists so future webhook lookups succeed.
  // We don't have a NowPayments-side customer concept (their invoices are
  // user-less), so we just track a sentinel id derived from our userId.
  const existing = await prisma.billingCustomer.findUnique({ where: { userId } });
  if (!existing) {
    await prisma.billingCustomer.create({
      data: {
        userId,
        provider: "nowpayments",
        nowpaymentsCustomerId: `np_${userId}`,
      },
    });
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const ipnCallbackUrl =
    process.env.NOWPAYMENTS_IPN_URL ?? `${appUrl}/api/billing/crypto/webhook`;

  try {
    const invoice = await createInvoice({
      plan,
      seats: seatCount,
      userId,
      successUrl: `${appUrl}/settings?billing=crypto_success`,
      cancelUrl: `${appUrl}/pricing?billing=canceled`,
      ipnCallbackUrl,
    });

    return NextResponse.json({
      url: invoice.invoiceUrl,
      invoiceId: invoice.id,
      priceUsd: invoice.priceUsd,
    });
  } catch (err) {
    console.error("NowPayments checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create crypto invoice" },
      { status: 500 }
    );
  }
}
