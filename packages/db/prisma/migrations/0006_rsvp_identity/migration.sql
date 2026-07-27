-- Capture the member's guild display name and avatar so the dashboard can show
-- who's who instead of a raw Discord username.
ALTER TABLE "Rsvp" ADD COLUMN "displayName" TEXT;
ALTER TABLE "Rsvp" ADD COLUMN "avatarUrl" TEXT;
