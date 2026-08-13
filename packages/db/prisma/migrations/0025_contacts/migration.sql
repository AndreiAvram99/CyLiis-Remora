-- Our own legal and banking details, one row per guild.
CREATE TABLE "OrgProfile" (
    "guildId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "fiscalCode" TEXT,
    "iban" TEXT,
    "bank" TEXT,
    "representative" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgProfile_pkey" PRIMARY KEY ("guildId")
);

-- Sponsors and event partners. Every channel of contact is optional.
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "person" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_guildId_kind_idx" ON "Contact"("guildId", "kind");
