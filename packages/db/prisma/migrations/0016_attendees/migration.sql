-- Cached guild roster used by the meeting attendee picker.
CREATE TABLE "GuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "roles" TEXT[],
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuildMember_guildId_idx" ON "GuildMember"("guildId");

-- Members expected at a meeting; absences are derived against Rsvp.
CREATE TABLE "EventInvitee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvitee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventInvitee_eventId_userId_key" ON "EventInvitee"("eventId", "userId");
CREATE INDEX "EventInvitee_eventId_idx" ON "EventInvitee"("eventId");
CREATE INDEX "EventInvitee_userId_idx" ON "EventInvitee"("userId");

ALTER TABLE "EventInvitee" ADD CONSTRAINT "EventInvitee_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
