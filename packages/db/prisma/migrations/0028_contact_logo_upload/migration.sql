-- Uploaded logos live in the database, so they survive a redeploy.
CREATE TABLE "ContactLogo" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactLogo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactLogo_contactId_tone_key" ON "ContactLogo"("contactId", "tone");

ALTER TABLE "ContactLogo" ADD CONSTRAINT "ContactLogo_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
