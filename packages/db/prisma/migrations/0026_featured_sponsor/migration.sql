-- A main sponsor earns its own frame at the top of the list.
ALTER TABLE "Contact" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
