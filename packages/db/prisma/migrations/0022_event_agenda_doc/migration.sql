-- Google Doc holding a meeting's agenda and resume tabs. Every occurrence of a
-- recurring schedule points at the same document.
ALTER TABLE "Event" ADD COLUMN "agendaDocId" TEXT;
ALTER TABLE "Event" ADD COLUMN "agendaDocUrl" TEXT;
