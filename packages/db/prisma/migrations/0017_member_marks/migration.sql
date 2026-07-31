-- Manual black/white marks awarded by the master account.
CREATE TABLE "MemberMark" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberMark_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberMark_guildId_idx" ON "MemberMark"("guildId");
CREATE INDEX "MemberMark_userId_idx" ON "MemberMark"("userId");
