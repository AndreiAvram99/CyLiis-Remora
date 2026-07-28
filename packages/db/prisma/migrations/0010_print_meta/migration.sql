-- Per-request print metadata: importance, print-queue position and workflow
-- status, all editable from the dashboard.
ALTER TABLE "Event" ADD COLUMN "printPriority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Event" ADD COLUMN "printOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN "printStatus" TEXT NOT NULL DEFAULT 'PENDING';
