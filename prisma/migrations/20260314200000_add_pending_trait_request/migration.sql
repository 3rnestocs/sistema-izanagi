-- CreateEnum
CREATE TYPE "TraitOperation" AS ENUM ('ASIGNAR', 'RETIRAR');

-- CreateTable
CREATE TABLE "PendingTraitRequest" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "traitName" TEXT NOT NULL,
    "operation" "TraitOperation" NOT NULL,
    "approvalMessageId" TEXT,
    "channelId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingTraitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingTraitRequest_approvalMessageId_key" ON "PendingTraitRequest"("approvalMessageId");

-- CreateIndex
CREATE INDEX "PendingTraitRequest_characterId_status_idx" ON "PendingTraitRequest"("characterId", "status");

-- CreateIndex
CREATE INDEX "PendingTraitRequest_approvalMessageId_idx" ON "PendingTraitRequest"("approvalMessageId");

-- AddForeignKey
ALTER TABLE "PendingTraitRequest" ADD CONSTRAINT "PendingTraitRequest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
