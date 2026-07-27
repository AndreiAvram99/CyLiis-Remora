-- Replace the RsvpStatus enum: drop INTERESTED, add MOTIVATED.
-- Existing INTERESTED rows are remapped to MOTIVATED to satisfy the new type.
ALTER TYPE "RsvpStatus" RENAME TO "RsvpStatus_old";

CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'NO', 'MOTIVATED');

ALTER TABLE "Rsvp"
  ALTER COLUMN "status" TYPE "RsvpStatus"
  USING (
    CASE "status"::text
      WHEN 'INTERESTED' THEN 'MOTIVATED'
      ELSE "status"::text
    END::"RsvpStatus"
  );

DROP TYPE "RsvpStatus_old";
