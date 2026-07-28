-- How many pieces of each document to print (defaults to a single copy).
ALTER TABLE "PrintFile" ADD COLUMN "copies" INTEGER NOT NULL DEFAULT 1;
