-- AlterTable
ALTER TABLE "Event" ADD COLUMN "mentionRoleIds" TEXT[],
ADD COLUMN "mentionUserIds" TEXT[],
ADD COLUMN "mentionEveryone" BOOLEAN NOT NULL DEFAULT false;
