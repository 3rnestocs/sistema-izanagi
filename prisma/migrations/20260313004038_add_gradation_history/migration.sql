-- CreateTable
CREATE TABLE "GradationHistory" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradationHistory_characterId_idx" ON "GradationHistory"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "GradationHistory_characterId_level_key" ON "GradationHistory"("characterId", "level");

-- AddForeignKey
ALTER TABLE "GradationHistory" ADD CONSTRAINT "GradationHistory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
