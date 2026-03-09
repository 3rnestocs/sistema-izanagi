-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "discordId" TEXT,
    "name" TEXT NOT NULL,
    "fullName" TEXT,
    "age" INTEGER,
    "moral" TEXT,
    "level" TEXT NOT NULL DEFAULT 'D1',
    "rank" TEXT NOT NULL DEFAULT 'Genin',
    "isSpecialRank" BOOLEAN NOT NULL DEFAULT false,
    "canCreateNPC" BOOLEAN NOT NULL DEFAULT false,
    "isNpc" BOOLEAN NOT NULL DEFAULT false,
    "isRetired" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "title" TEXT,
    "lastSalaryClaim" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ryou" INTEGER NOT NULL DEFAULT 0,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "pr" INTEGER NOT NULL DEFAULT 0,
    "sp" INTEGER NOT NULL DEFAULT 0,
    "cupos" INTEGER NOT NULL DEFAULT 0,
    "rc" INTEGER NOT NULL DEFAULT 0,
    "bts" INTEGER NOT NULL DEFAULT 0,
    "bes" INTEGER NOT NULL DEFAULT 0,
    "specialWishUsed" BOOLEAN NOT NULL DEFAULT false,
    "fuerza" INTEGER NOT NULL DEFAULT 0,
    "resistencia" INTEGER NOT NULL DEFAULT 0,
    "velocidad" INTEGER NOT NULL DEFAULT 0,
    "percepcion" INTEGER NOT NULL DEFAULT 0,
    "chakra" INTEGER NOT NULL DEFAULT 0,
    "armas" INTEGER NOT NULL DEFAULT 0,
    "inteligencia" INTEGER NOT NULL DEFAULT 0,
    "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterBuildApproval" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "keko" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "sourceChannelId" TEXT NOT NULL,
    "sourceGuildId" TEXT NOT NULL,
    "sourceMessageUrl" TEXT NOT NULL,
    "approvedPlazas" TEXT[],
    "approvedByIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterBuildApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trait" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "costRC" INTEGER NOT NULL DEFAULT 0,
    "bonusRyou" INTEGER NOT NULL DEFAULT 0,
    "multiplierGasto" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "multiplierGanancia" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "minBalanceRule" INTEGER NOT NULL DEFAULT 0,
    "blocksTransfer" BOOLEAN NOT NULL DEFAULT false,
    "mechanics" JSONB,

    CONSTRAINT "Trait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plaza" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "costCupos" INTEGER NOT NULL DEFAULT 0,
    "maxHolders" INTEGER NOT NULL DEFAULT 0,
    "bonusStatName" TEXT,
    "bonusStatValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Plaza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitConflict" (
    "traitAId" TEXT NOT NULL,
    "traitBId" TEXT NOT NULL,

    CONSTRAINT "TraitConflict_pkey" PRIMARY KEY ("traitAId","traitBId")
);

-- CreateTable
CREATE TABLE "CharacterTrait" (
    "characterId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterTrait_pkey" PRIMARY KEY ("characterId","traitId")
);

-- CreateTable
CREATE TABLE "CharacterPlaza" (
    "characterId" TEXT NOT NULL,
    "plazaId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentRank" TEXT NOT NULL DEFAULT 'C',

    CONSTRAINT "CharacterPlaza_pkey" PRIMARY KEY ("characterId","plazaId")
);

-- CreateTable
CREATE TABLE "PlazaTraitInheritance" (
    "plazaId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,

    CONSTRAINT "PlazaTraitInheritance_pkey" PRIMARY KEY ("plazaId","traitId")
);

-- CreateTable
CREATE TABLE "PlazaPlazaInheritance" (
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,

    CONSTRAINT "PlazaPlazaInheritance_pkey" PRIMARY KEY ("parentId","childId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "characterId" TEXT,
    "category" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "deltaRyou" INTEGER NOT NULL DEFAULT 0,
    "deltaExp" INTEGER NOT NULL DEFAULT 0,
    "deltaPr" INTEGER NOT NULL DEFAULT 0,
    "deltaSp" INTEGER NOT NULL DEFAULT 0,
    "deltaCupos" INTEGER NOT NULL DEFAULT 0,
    "deltaRc" INTEGER NOT NULL DEFAULT 0,
    "deltaBts" INTEGER NOT NULL DEFAULT 0,
    "deltaBes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Objeto',
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RYOU',

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRecord" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rank" TEXT,
    "result" TEXT,
    "evidenceUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Character_discordId_key" ON "Character"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Character_approvalId_key" ON "Character"("approvalId");

-- CreateIndex
CREATE INDEX "Character_isNpc_isRetired_idx" ON "Character"("isNpc", "isRetired");

-- CreateIndex
CREATE INDEX "Character_isNpc_createdAt_idx" ON "Character"("isNpc", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterBuildApproval_sourceMessageId_key" ON "CharacterBuildApproval"("sourceMessageId");

-- CreateIndex
CREATE INDEX "CharacterBuildApproval_discordId_isActive_idx" ON "CharacterBuildApproval"("discordId", "isActive");

-- CreateIndex
CREATE INDEX "CharacterBuildApproval_sourceGuildId_sourceChannelId_isActi_idx" ON "CharacterBuildApproval"("sourceGuildId", "sourceChannelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Trait_name_key" ON "Trait"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Plaza_name_key" ON "Plaza"("name");

-- CreateIndex
CREATE INDEX "TraitConflict_traitBId_idx" ON "TraitConflict"("traitBId");

-- CreateIndex
CREATE INDEX "CharacterTrait_traitId_idx" ON "CharacterTrait"("traitId");

-- CreateIndex
CREATE INDEX "CharacterPlaza_plazaId_idx" ON "CharacterPlaza"("plazaId");

-- CreateIndex
CREATE INDEX "PlazaTraitInheritance_traitId_idx" ON "PlazaTraitInheritance"("traitId");

-- CreateIndex
CREATE INDEX "PlazaPlazaInheritance_childId_idx" ON "PlazaPlazaInheritance"("childId");

-- CreateIndex
CREATE INDEX "AuditLog_characterId_idx" ON "AuditLog"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_key" ON "Item"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_itemId_idx" ON "InventoryItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_characterId_itemId_key" ON "InventoryItem"("characterId", "itemId");

-- CreateIndex
CREATE INDEX "ActivityRecord_characterId_type_idx" ON "ActivityRecord"("characterId", "type");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "CharacterBuildApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitConflict" ADD CONSTRAINT "TraitConflict_traitAId_fkey" FOREIGN KEY ("traitAId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitConflict" ADD CONSTRAINT "TraitConflict_traitBId_fkey" FOREIGN KEY ("traitBId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterTrait" ADD CONSTRAINT "CharacterTrait_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterTrait" ADD CONSTRAINT "CharacterTrait_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterPlaza" ADD CONSTRAINT "CharacterPlaza_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterPlaza" ADD CONSTRAINT "CharacterPlaza_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "Plaza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlazaTraitInheritance" ADD CONSTRAINT "PlazaTraitInheritance_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "Plaza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlazaTraitInheritance" ADD CONSTRAINT "PlazaTraitInheritance_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlazaPlazaInheritance" ADD CONSTRAINT "PlazaPlazaInheritance_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Plaza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlazaPlazaInheritance" ADD CONSTRAINT "PlazaPlazaInheritance_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Plaza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecord" ADD CONSTRAINT "ActivityRecord_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
