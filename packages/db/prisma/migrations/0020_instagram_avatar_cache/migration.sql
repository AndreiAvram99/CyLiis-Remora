-- CreateTable
CREATE TABLE "InstagramAvatar" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramAvatar_pkey" PRIMARY KEY ("id")
);
