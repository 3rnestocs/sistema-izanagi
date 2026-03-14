/*
  Warnings:

  - The `status` column on the `PendingPromotion` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TipoOtorgamiento" AS ENUM ('DESARROLLO', 'DESEO_NORMAL', 'DESEO_ESPECIAL');

-- AlterTable (preserve existing status: PENDING, APPROVED, EXPIRED)
ALTER TABLE "PendingPromotion" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PendingPromotion" ALTER COLUMN "status" TYPE "ApprovalStatus" USING (
  CASE "status"
    WHEN 'PENDING' THEN 'PENDING'::"ApprovalStatus"
    WHEN 'APPROVED' THEN 'APPROVED'::"ApprovalStatus"
    WHEN 'EXPIRED' THEN 'EXPIRED'::"ApprovalStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"ApprovalStatus"
    ELSE 'PENDING'::"ApprovalStatus"
  END
);
ALTER TABLE "PendingPromotion" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ApprovalStatus";

-- CreateTable
CREATE TABLE "PendingWish" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "plazaId" TEXT NOT NULL,
    "tipoOtorgamiento" "TipoOtorgamiento" NOT NULL,
    "costoBts" INTEGER NOT NULL DEFAULT 0,
    "costoBes" INTEGER NOT NULL DEFAULT 0,
    "approvalMessageId" TEXT,
    "channelId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingWish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingWish_approvalMessageId_key" ON "PendingWish"("approvalMessageId");

-- CreateIndex
CREATE INDEX "PendingWish_characterId_status_idx" ON "PendingWish"("characterId", "status");

-- CreateIndex
CREATE INDEX "PendingWish_approvalMessageId_idx" ON "PendingWish"("approvalMessageId");

-- AddForeignKey
ALTER TABLE "PendingWish" ADD CONSTRAINT "PendingWish_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
