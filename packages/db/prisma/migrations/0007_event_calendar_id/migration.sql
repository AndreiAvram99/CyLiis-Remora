-- Track which Google calendar each event was pushed to, so meetings and events
-- can live in separate calendars and still be updated/deleted correctly.
ALTER TABLE "Event" ADD COLUMN "gcalCalendarId" TEXT;
