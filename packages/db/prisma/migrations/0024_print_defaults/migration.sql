-- Slicer settings a new print file starts with, editable in Settings.
ALTER TABLE "Guild" ADD COLUMN "printFilament" TEXT NOT NULL DEFAULT 'PLA';
ALTER TABLE "Guild" ADD COLUMN "printInfill" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Guild" ADD COLUMN "printWallCount" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Guild" ADD COLUMN "printColor" TEXT NOT NULL DEFAULT '#132884';
ALTER TABLE "Guild" ADD COLUMN "printSupport" BOOLEAN NOT NULL DEFAULT false;
