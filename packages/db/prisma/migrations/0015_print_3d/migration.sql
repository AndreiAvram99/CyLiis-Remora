-- Replace print importance with real 3D-printing settings per file.
ALTER TABLE "PrintFile" DROP COLUMN "priority";
ALTER TABLE "PrintFile" ADD COLUMN "filamentType" TEXT NOT NULL DEFAULT 'PLA';
ALTER TABLE "PrintFile" ADD COLUMN "infill" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "PrintFile" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#132884';
ALTER TABLE "PrintFile" ADD COLUMN "wallCount" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "PrintFile" ADD COLUMN "needsSupport" BOOLEAN NOT NULL DEFAULT false;
