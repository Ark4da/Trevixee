import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/billing/portal
// Stripe customers → 302 to the Stripe Customer Portal (manage card, cancel).
// NowPayments-only customers → 302 to /pricing#renew (crypto subscriptions
// auto-expire at currentPeriodEnd; renewal is a fresh invoice, no portal exists).

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { key: "billing:portal", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const billing = await prisma.billingCustomer.findUnique({ where: { userId } });

  if (!billing || !billing.stripeCustomerId) {
    // Crypto-only or no billing yet → /pricing is the right destination
    // (renew via a new invoice, or upgrade from Free).
    return NextResponse.redirect(`${appUrl}/pricing`);
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${appUrl}/settings?tab=account`,
  });

  return NextResponse.redirect(portalSession.url);
}
