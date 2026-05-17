-- Sync schema additions that existed in prisma/schema.prisma but were missing
-- from the migration history applied in production.

ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "playbookId" TEXT;

CREATE TABLE IF NOT EXISTS "NotebookLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "tradeId" TEXT,
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotebookLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotebookLink_tradeId_idx" ON "NotebookLink"("tradeId");
CREATE INDEX IF NOT EXISTS "NotebookLink_noteId_idx" ON "NotebookLink"("noteId");
CREATE INDEX IF NOT EXISTS "NotebookLink_userId_idx" ON "NotebookLink"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'NotebookLink_noteId_fkey'
  ) THEN
    ALTER TABLE "NotebookLink"
      ADD CONSTRAINT "NotebookLink_noteId_fkey"
      FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RuleViolation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "note" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleViolation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RuleViolation_userId_idx" ON "RuleViolation"("userId");
CREATE INDEX IF NOT EXISTS "RuleViolation_tradeId_idx" ON "RuleViolation"("tradeId");
