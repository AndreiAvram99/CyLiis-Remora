-- Fields backing a print request: the posted Discord message and a "who's
-- printing this?" claim (member id + display name at claim time).
ALTER TABLE "Event" ADD COLUMN "printMessageId" TEXT;
ALTER TABLE "Event" ADD COLUMN "printClaimedById" TEXT;
ALTER TABLE "Event" ADD COLUMN "printClaimedByName" TEXT;
