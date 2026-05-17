-- Macro intelligence: economic events linked directly to trades.
CREATE TABLE "MacroEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerId" TEXT,
    "title" TEXT NOT NULL,
    "country" TEXT,
    "currency" TEXT,
    "category" TEXT NOT NULL DEFAULT 'economic',
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "actual" TEXT,
    "forecast" TEXT,
    "previous" TEXT,
    "unit" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MacroEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeMacroLink" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "minutesFromEntry" INTEGER,
    "minutesFromExit" INTEGER,
    "riskWindowMins" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeMacroLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MacroEvent_provider_providerId_key" ON "MacroEvent"("provider", "providerId");
CREATE INDEX "MacroEvent_scheduledAt_idx" ON "MacroEvent"("scheduledAt");
CREATE INDEX "MacroEvent_currency_idx" ON "MacroEvent"("currency");
CREATE INDEX "MacroEvent_country_idx" ON "MacroEvent"("country");
CREATE INDEX "MacroEvent_impact_idx" ON "MacroEvent"("impact");

CREATE UNIQUE INDEX "TradeMacroLink_tradeId_eventId_key" ON "TradeMacroLink"("tradeId", "eventId");
CREATE INDEX "TradeMacroLink_tradeId_idx" ON "TradeMacroLink"("tradeId");
CREATE INDEX "TradeMacroLink_eventId_idx" ON "TradeMacroLink"("eventId");
CREATE INDEX "TradeMacroLink_relation_idx" ON "TradeMacroLink"("relation");

ALTER TABLE "TradeMacroLink" ADD CONSTRAINT "TradeMacroLink_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradeMacroLink" ADD CONSTRAINT "TradeMacroLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MacroEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
