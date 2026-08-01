-- CreateTable
CREATE TABLE "InstagramMessage" (
    "id" TEXT NOT NULL,
    "mid" TEXT NOT NULL,
    "senderId" TEXT,
    "senderHandle" TEXT,
    "text" TEXT,
    "imageUrl" TEXT,
    "attachments" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "readById" TEXT,
    "readByName" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstagramMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramMessage_mid_key" ON "InstagramMessage"("mid");

-- CreateIndex
CREATE INDEX "InstagramMessage_sentAt_idx" ON "InstagramMessage"("sentAt");
