-- Add a PRINT schedule type: a file to be printed that gets posted to a channel
-- with no reminders/RSVP. Isolated in its own migration so Postgres can commit
-- the new enum value before it's referenced.
ALTER TYPE "EventKind" ADD VALUE IF NOT EXISTS 'PRINT';
