-- Add NowPayments support: provider field on BillingCustomer + Subscription,
-- nullable Stripe-specific IDs, generic externalId, and a separate idempotency
-- table for NowPayments IPN events.

-- 1. BillingCustomer: make stripeCustomerId nullable, add nowpayments fields.
ALTER TABLE "BillingCustomer"
  ALTER COLUMN "stripeCustomerId" DROP NOT NULL;

ALTER TABLE "BillingCustomer"
  ADD COLUMN "nowpaymentsCustomerId" TEXT,
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';

CREATE UNIQUE INDEX "BillingCustomer_nowpaymentsCustomerId_key"
  ON "BillingCustomer"("nowpaymentsCustomerId");

-- 2. Subscription: make stripeSubscriptionId nullable, add provider + externalId.
ALTER TABLE "Subscription"
  ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL;

ALTER TABLE "Subscription"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "Subscription_externalId_key"
  ON "Subscription"("externalId");

-- 3. ProcessedNowPaymentsEvent: idempotency for NowPayments IPN callbacks.
CREATE TABLE "ProcessedNowPaymentsEvent" (
  "paymentId"   TEXT PRIMARY KEY,
  "status"      TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
