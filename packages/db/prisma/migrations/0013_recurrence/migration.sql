-- Meetings carry a duration (endAt derived); events are all-day date ranges.
-- Both can recur, materialized as separate occurrences sharing a seriesId so
-- past attendance is preserved.
ALTER TABLE "Event" ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "durationMinutes" INTEGER;
ALTER TABLE "Event" ADD COLUMN "recurrence" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Event" ADD COLUMN "recurrenceActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Event" ADD COLUMN "seriesId" TEXT;

CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");
