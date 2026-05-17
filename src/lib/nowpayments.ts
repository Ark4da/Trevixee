import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// NowPayments client
// Docs: https://documenter.getpostman.com/view/7907941/S1a32n38
//
// Flow we use (one-shot crypto invoices, NOT recurring subscriptions):
//   1. POST /v1/invoice  → returns invoice_url (hosted checkout page)
//   2. User pays in any supported coin (BTC/ETH/USDT/...)
//   3. NowPayments calls our IPN webhook with payment status updates
//   4. We verify HMAC-SHA512 signature, mark Subscription active for one period
//
// For renewal we email the user 7 days before currentPeriodEnd with a new link.
// ─────────────────────────────────────────────────────────────────────────────

const SANDBOX = process.env.NOWPAYMENTS_SANDBOX === "true";
const API_BASE = SANDBOX
  ? "https://api-sandbox.nowpayments.io/v1"
  : "https://api.nowpayments.io/v1";

// Period length per plan (used to compute Subscription.currentPeriodEnd
// after a successful payment).
export const NOWPAYMENTS_PLANS = {
  pro_monthly: {
    planCode: "pro_monthly",
    priceUsd: 19,
    periodDays: 30,
    title: "Trevixe Pro · Monthly",
  },
  pro_annual: {
    planCode: "pro_annual",
    priceUsd: 144, // 12 × $12
    periodDays: 365,
    title: "Trevixe Pro · Annual",
  },
  team_monthly: {
    planCode: "team_monthly",
    priceUsd: 15,
    periodDays: 30,
    title: "Trevixe Team · Monthly",
    perSeat: true,
  },
  team_annual: {
    planCode: "team_annual",
    priceUsd: 120,
    periodDays: 365,
    title: "Trevixe Team · Annual",
    perSeat: true,
  },
} as const;

export type NowPaymentsPlanKey = keyof typeof NOWPAYMENTS_PLANS;

export interface CreateInvoiceArgs {
  plan: NowPaymentsPlanKey;
  /** Multiplier for team plans (5–50). Ignored for pro plans. */
  seats?: number;
  /** App user id. Stored in order_id so we can resolve them in the IPN handler. */
  userId: string;
  /** Where the hosted checkout returns the user after payment. */
  successUrl: string;
  /** Where the user lands if they cancel. */
  cancelUrl: string;
  /** Where NowPayments sends IPN callbacks (HTTPS only). */
  ipnCallbackUrl: string;
}

export interface CreateInvoiceResult {
  /** NowPayments invoice id (numeric) — we store it in Subscription.externalId. */
  id: string;
  /** Hosted checkout URL — user is redirected here. */
  invoiceUrl: string;
  /** Total to charge in USD (informational). */
  priceUsd: number;
}

/** Create a hosted invoice. Returns the URL the user should be redirected to. */
export async function createInvoice(args: CreateInvoiceArgs): Promise<CreateInvoiceResult> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error("NOWPAYMENTS_API_KEY is not set");

  const plan = NOWPAYMENTS_PLANS[args.plan];
  if (!plan) throw new Error(`Unknown plan: ${args.plan}`);

  const isTeam = "perSeat" in plan && plan.perSeat;
  const seats = isTeam ? Math.max(5, Math.min(50, Math.floor(args.seats ?? 5))) : 1;
  const priceUsd = plan.priceUsd * seats;

  // order_id encodes the metadata we need on the IPN side. NowPayments echoes it back.
  // Format: "<userId>:<planCode>:<seats>:<nonce>"
  const nonce = crypto.randomBytes(8).toString("hex");
  const orderId = `${args.userId}:${plan.planCode}:${seats}:${nonce}`;

  const body = {
    price_amount: priceUsd,
    price_currency: "usd",
    order_id: orderId,
    order_description: isTeam
      ? `${plan.title} (${seats} seats)`
      : plan.title,
    ipn_callback_url: args.ipnCallbackUrl,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    is_fee_paid_by_user: false,
  };

  const res = await fetch(`${API_BASE}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`NowPayments invoice failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as { id: number | string; invoice_url: string };
  return {
    id: String(data.id),
    invoiceUrl: data.invoice_url,
    priceUsd,
  };
}

/** Poll a payment by id (mainly used as a recovery path if IPN missed). */
export async function getPayment(paymentId: string) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error("NOWPAYMENTS_API_KEY is not set");
  const res = await fetch(`${API_BASE}/payment/${paymentId}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`NowPayments getPayment failed: ${res.status} ${txt}`);
  }
  return res.json() as Promise<NowPaymentsIpnPayload>;
}

// ─────────────────────────────────────────────────────────────────────────────
// IPN signature verification
//
// NowPayments signs IPN bodies with HMAC-SHA512. The signature is in the
// `x-nowpayments-sig` header. The signed message is the JSON-stringified body
// with keys SORTED ALPHABETICALLY at every level. The shared secret is the
// IPN Secret from the NowPayments dashboard (NOT the API key).
//
// Constant-time compare prevents timing attacks.
// ─────────────────────────────────────────────────────────────────────────────

/** Recursively sort object keys alphabetically for canonical JSON serialization. */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function verifyIpnSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const sortedJson = JSON.stringify(sortKeysDeep(parsed));
  const expected = crypto
    .createHmac("sha512", secret)
    .update(sortedJson)
    .digest("hex");

  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────────────────────
// IPN payload typing (subset we actually use)
// ─────────────────────────────────────────────────────────────────────────────

export interface NowPaymentsIpnPayload {
  payment_id: number | string;
  payment_status: NowPaymentsStatus;
  pay_address?: string;
  price_amount: number;
  price_currency: string;
  pay_amount?: number;
  actually_paid?: number;
  pay_currency?: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: number | string;
  outcome_amount?: number;
  outcome_currency?: string;
}

export type NowPaymentsStatus =
  | "waiting"
  | "confirming"
  | "confirmed"
  | "sending"
  | "partially_paid"
  | "finished"
  | "failed"
  | "refunded"
  | "expired";

/** Parse our order_id format. Returns null if malformed. */
export function parseOrderId(orderId: string | undefined | null): {
  userId: string;
  planCode: string;
  seats: number;
} | null {
  if (!orderId) return null;
  const parts = orderId.split(":");
  if (parts.length < 3) return null;
  const [userId, planCode, seatsStr] = parts;
  const seats = Number(seatsStr);
  if (!userId || !planCode || !Number.isFinite(seats)) return null;
  return { userId, planCode, seats };
}

export function isNowPaymentsConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET);
}
