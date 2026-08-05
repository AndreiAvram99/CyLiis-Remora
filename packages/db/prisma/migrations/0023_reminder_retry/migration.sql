-- Retry bookkeeping for posts Discord refused: how many goes we've had, and
-- when the next one is due. NULL means we've stopped trying.
ALTER TABLE "Reminder" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reminder" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

-- Keeps the retry sweep an index lookup instead of a scan.
CREATE INDEX "Reminder_status_nextAttemptAt_idx" ON "Reminder"("status", "nextAttemptAt");

-- Give failures recorded before this existed one go, but only where the post
-- would still be useful: nobody needs a reminder for a meeting already held.
UPDATE "Reminder" r
SET "nextAttemptAt" = NOW()
FROM "Event" e
WHERE r."eventId" = e."id"
  AND r."status" = 'FAILED'
  AND e."startAt" > NOW();
