-- AlterTable
ALTER TABLE "ActivityRecord" ADD COLUMN "claimedExp" INTEGER;
ALTER TABLE "ActivityRecord" ADD COLUMN "claimedPr" INTEGER;
ALTER TABLE "ActivityRecord" ADD COLUMN "claimedRyou" INTEGER;
ALTER TABLE "ActivityRecord" ADD COLUMN "approvalMessageId" TEXT;

-- CreateIndex
CREATE INDEX "ActivityRecord_approvalMessageId_idx" ON "ActivityRecord"("approvalMessageId");
