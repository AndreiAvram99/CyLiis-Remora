-- Move print importance/order from the request onto individual files.
CREATE TABLE "PrintFile" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrintFile_eventId_idx" ON "PrintFile"("eventId");

ALTER TABLE "PrintFile"
    ADD CONSTRAINT "PrintFile_eventId_fkey" FOREIGN KEY ("eventId")
    REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" DROP COLUMN "printPriority";
ALTER TABLE "Event" DROP COLUMN "printOrder";
