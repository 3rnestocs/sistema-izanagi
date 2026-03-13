-- CreateTable
CREATE TABLE "PendingPromotion" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "approvalMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "manualRequirements" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PendingPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingPromotion_approvalMessageId_key" ON "PendingPromotion"("approvalMessageId");

-- CreateIndex
CREATE INDEX "PendingPromotion_characterId_status_idx" ON "PendingPromotion"("characterId", "status");

-- CreateIndex
CREATE INDEX "PendingPromotion_approvalMessageId_idx" ON "PendingPromotion"("approvalMessageId");

-- AddForeignKey
ALTER TABLE "PendingPromotion" ADD CONSTRAINT "PendingPromotion_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
