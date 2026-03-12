import { PrismaClient } from '@prisma/client';
import { StatValidatorService } from './StatValidatorService';
import {
  assertRestrictedCategoryAvailable,
  assertRestrictedCategoryUniqueness,
  getCategoryLabel
} from './TraitRuleService';

// DTO (Data Transfer Object) para tipar estrictamente lo que entra desde Discord
export interface CreateCharacterDTO {
  discordId: string;
  name: string;      // El "Keko" (Identificador único)
  fullName: string;  // Nombre del PJ
  age?: number;
  moral?: string;
  level?: string;
  traitNames: string[]; // Array de nombres de rasgos (Origen, Nacimiento, Extras)
  createdAt?: Date;  // Optional backdate for migration (DD/MM/YYYY from user)
}

export class CharacterService {
  constructor(private prisma: PrismaClient) {}

  private static readonly BASE_INITIAL_RC = 6;
  private static readonly BASE_INITIAL_CUPOS = 15;
  private static readonly DEFAULT_INITIAL_LEVEL = 'D1';

  private assertRestrictedCategoryUniqueness(traits: Array<{ name: string; category: string }>): void {
    assertRestrictedCategoryUniqueness(traits);
  }

  private assertRestrictedCategoryAvailable(
    existingTraits: Array<{ name: string; category: string }>,
    traitToAdd: { name: string; category: string }
  ): void {
    assertRestrictedCategoryAvailable(existingTraits, traitToAdd, (category, existingName, incomingName) =>
      `⛔ ACCIÓN PROHIBIDA: '${incomingName}' no puede asignarse porque ya tienes '${existingName}' en '${getCategoryLabel(category)}'.`
    );
  }

  /**
   * 🧙‍♂️ Creación Unificada de Ficha (V2)
   * Envuelto en una transacción ACID para evitar datos corruptos.
   */
  async createCharacter(
    data: CreateCharacterDTO,
    txClient?: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
  ) {
    const executeLogic = async (tx: any) => {
      
      // 1. FAIL-FAST: Verificar si el Keko o el DiscordID ya tienen ficha
      const existingChar = await tx.character.findFirst({
        where: {
          OR: [{ name: data.name }, { discordId: data.discordId }]
        }
      });
      if (existingChar) {
        throw new Error(`⛔ ACCIÓN PROHIBIDA: El Keko '${data.name}' o el usuario de Discord ya posee una ficha registrada.`);
      }

      // 2. LECTURA DE RASGOS (SSOT)
      // Buscamos los rasgos exactos en la base de datos (Case-Insensitive si lo configuraste así, pero preferible exacto)
      const traits = await tx.trait.findMany({
        where: { name: { in: data.traitNames } },
        include: { incompatibilitiesA: true, incompatibilitiesB: true }
      });

      if (traits.length !== data.traitNames.length) {
        throw new Error(`⛔ CONFLICTO: Uno o más rasgos proporcionados no existen en el sistema IZANAGI.`);
      }

      this.assertRestrictedCategoryUniqueness(
        traits.map((trait: any) => ({ name: trait.name, category: trait.category }))
      );

      // 3. MOTOR DE VALIDACIÓN DE CONFLICTOS Y CÁLCULO DE BONOS
      let totalRyouBonus = 0;
      let totalRcCost = 0;
      let totalExpBonus = 0;
      let totalSpBonus = 0;
      let totalCuposBonus = 0;
      let statBonuses: Record<string, number> = {};
      const traitIds = traits.map((t: any) => t.id);

      for (const trait of traits) {
        // A. Validar Incompatibilidades
        const conflicts = [...trait.incompatibilitiesA, ...trait.incompatibilitiesB];
        for (const conflict of conflicts) {
          const conflictingTraitId = conflict.traitAId === trait.id ? conflict.traitBId : conflict.traitAId;
          if (traitIds.includes(conflictingTraitId)) {
            const conflictingTrait = traits.find((candidate: any) => candidate.id === conflictingTraitId);
            const conflictingName = conflictingTrait?.name ?? 'otro rasgo seleccionado';
            throw new Error(`⛔ CONFLICTO: El rasgo ${trait.name} es incompatible con el rasgo ${conflictingName}. Elimina uno de los dos.`);
          }
        }

        // B. Sumar costos y bonos iniciales
        totalRcCost += trait.costRC;
        totalRyouBonus += trait.bonusRyou;

        // C. Apply direct stat bonuses via mechanics JSON (e.g., Sabio +2 Chakra)
        // Stat bonuses for traits come from mechanics JSON, not direct fields

        // D. Parse mechanics JSON for secondary bonuses
        if (trait.mechanics && typeof trait.mechanics === 'object') {
          const mech = trait.mechanics as Record<string, unknown>;
          if (mech.bonusExp && typeof mech.bonusExp === 'number') {
            totalExpBonus += mech.bonusExp;
          }
          if (mech.bonusSp && typeof mech.bonusSp === 'number') {
            totalSpBonus += mech.bonusSp;
          }
          if (mech.bonusCupos && typeof mech.bonusCupos === 'number') {
            totalCuposBonus += mech.bonusCupos;
          }
        }
      }

      const initialLevel = data.level ?? CharacterService.DEFAULT_INITIAL_LEVEL;
      const initialSp = StatValidatorService.getInitialSpForLevel(initialLevel);
      const finalRcAtCreation = CharacterService.BASE_INITIAL_RC + totalRcCost;

      if (finalRcAtCreation < 0) {
        throw new Error(`⛔ CONFLICTO: RC inválido al crear la ficha: ${finalRcAtCreation}. Ajusta la selección de rasgos.`);
      }

     // 4. CREACIÓN DE LA FICHA Y RELACIONES
      const newCharacter = await tx.character.create({
        data: {
          discordId: data.discordId,
          name: data.name,
          level: initialLevel,
          // 🚀 SOLUCIÓN: Convertimos undefined a null para satisfacer a Prisma
          fullName: data.fullName ?? null,
          age: data.age ?? null,
          moral: data.moral ?? null,

          ryou: totalRyouBonus,
          rc: finalRcAtCreation,
          exp: totalExpBonus,
          sp: initialSp + totalSpBonus,
          // Base de cupos iniciales (15) + bonos de rasgos que otorguen cupos.
          cupos: CharacterService.BASE_INITIAL_CUPOS + totalCuposBonus,

          // Apply direct stat bonuses from traits
          fuerza: statBonuses['fuerza'] || 0,
          resistencia: statBonuses['resistencia'] || 0,
          velocidad: statBonuses['velocidad'] || 0,
          percepcion: statBonuses['percepcion'] || 0,
          chakra: statBonuses['chakra'] || 0,
          armas: statBonuses['armas'] || 0,
          inteligencia: statBonuses['inteligencia'] || 0,

          ...(data.createdAt ? { createdAt: data.createdAt } : {}),

          traits: {
            create: traits.map((t: any) => ({
              trait: { connect: { id: t.id } }
            }))
          }
        }
      });

      // 5. TRAZABILIDAD (AUDIT LOGS)
      await tx.auditLog.create({
        data: {
          characterId: newCharacter.id,
          category: "Creación de Ficha",
          detail: `Ficha creada. Rasgos asignados: ${data.traitNames.join(', ')}`,
          evidence: "Comando /registro",
          deltaRyou: totalRyouBonus,
          deltaRc: totalRcCost
        }
      });

      return newCharacter;
    };

    if (txClient) {
      return await executeLogic(txClient);
    }

    // 🛡️ LOCK ATÓMICO: Iniciamos la transacción de Prisma
    return await this.prisma.$transaction(executeLogic);
  }

  /**
   * 🧬 Agregar rasgo post-creación (Staff command)
   * Valida incompatibilidades, costos RC, y aplica bonificaciones.
   */
  async addTrait(characterId: string, traitName: string) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Cargar personaje y el rasgo a agregar
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: { traits: { include: { trait: { include: { incompatibilitiesA: true, incompatibilitiesB: true } } } } }
      });

      if (!character) {
        throw new Error('⛔ ACCIÓN PROHIBIDA: Personaje no encontrado.');
      }

      const traitToAdd = await tx.trait.findUnique({
        where: { name: traitName },
        include: { incompatibilitiesA: true, incompatibilitiesB: true }
      });

      if (!traitToAdd) {
        throw new Error(`⛔ CONFLICTO: El rasgo '${traitName}' no existe en el sistema.`);
      }

      // 2. Verificar si ya tiene el rasgo
      if (character.traits.some((ct) => ct.trait.id === traitToAdd.id)) {
        throw new Error(`⛔ CONFLICTO: El personaje ya posee el rasgo '${traitName}'.`);
      }

      // 3. Validar incompatibilidades
      const existingTraitIds = character.traits.map((ct) => ct.trait.id);
      const conflicts = [...traitToAdd.incompatibilitiesA, ...traitToAdd.incompatibilitiesB];
      for (const conflict of conflicts) {
        const conflictingId = conflict.traitAId === traitToAdd.id ? conflict.traitBId : conflict.traitAId;
        if (existingTraitIds.includes(conflictingId)) {
          const conflictingTrait = character.traits.find((ct) => ct.trait.id === conflictingId);
          throw new Error(`⛔ CONFLICTO: '${traitName}' es incompatible con '${conflictingTrait?.trait.name}'.`);
        }
      }

      // 4. Validar restricción global por categoría (Origen, Nacimiento, Moral)
      this.assertRestrictedCategoryAvailable(
        character.traits.map((entry) => ({ name: entry.trait.name, category: entry.trait.category })),
        { name: traitToAdd.name, category: traitToAdd.category }
      );

      // 5. Validar costo RC
      const totalRcNeeded = Math.abs(traitToAdd.costRC);
      if (traitToAdd.costRC > 0 && character.rc < traitToAdd.costRC) {
        throw new Error(`⛔ No hay suficientes RC. Necesitas ${traitToAdd.costRC}, tienes ${character.rc}.`);
      }

      // 6. Calcular bonificaciones
      let rcDelta = -traitToAdd.costRC;
      let statBonuses: Record<string, number> = {};

      // Stat bonuses for traits come from mechanics JSON, not direct fields

      // 7. Aplicar el rasgo y actualizar stats
      const updateData: Record<string, any> = {
        traits: { create: { trait: { connect: { id: traitToAdd.id } } } },
        rc: { increment: rcDelta }
      };

      // Aplicar bonificaciones de stats
      for (const [stat, bonus] of Object.entries(statBonuses)) {
        updateData[stat] = { increment: bonus };
      }

      const updatedCharacter = await tx.character.update({
        where: { id: characterId },
        data: updateData
      });

      // 8. Auditar
      await tx.auditLog.create({
        data: {
          characterId,
          category: 'Rasgo Asignado',
          detail: `Rasgo '${traitName}' agregado. Costo RC: ${traitToAdd.costRC}`,
          evidence: 'Comando /otorgar_rasgo',
          deltaRc: rcDelta
        }
      });

      return updatedCharacter;
    });
  }

  /**
   * 🗑️ Remover rasgo post-creación (Staff command)
   * Revierte bonificaciones y reembolsa RC.
   */
  async removeTrait(characterId: string, traitName: string) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Cargar personaje y el rasgo a remover
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: { traits: { include: { trait: true } } }
      });

      if (!character) {
        throw new Error('⛔ ACCIÓN PROHIBIDA: Personaje no encontrado.');
      }

      const traitToRemove = await tx.trait.findUnique({
        where: { name: traitName }
      });

      if (!traitToRemove) {
        throw new Error(`⛔ CONFLICTO: El rasgo '${traitName}' no existe en el sistema.`);
      }

      // 2. Verificar si el personaje tiene el rasgo
      const hasTraitRecord = character.traits.find((ct) => ct.trait.id === traitToRemove.id);
      if (!hasTraitRecord) {
        throw new Error(`⛔ CONFLICTO: El personaje no posee el rasgo '${traitName}'.`);
      }

      // 3. Revertir bonificaciones
      let rcDelta = traitToRemove.costRC;
      let statReversals: Record<string, number> = {};

      // Stat bonuses for traits come from mechanics JSON, not direct fields

      // 4. Eliminar la relación y actualizar stats
      const updateData: Record<string, any> = {
        traits: { delete: { characterId_traitId: { characterId, traitId: traitToRemove.id } } },
        rc: { increment: rcDelta }
      };

      // Revertir bonificaciones de stats
      for (const [stat, reversal] of Object.entries(statReversals)) {
        updateData[stat] = { increment: reversal };
      }

      const updatedCharacter = await tx.character.update({
        where: { id: characterId },
        data: updateData
      });

      // 5. Auditar
      await tx.auditLog.create({
        data: {
          characterId,
          category: 'Rasgo Removido',
          detail: `Rasgo '${traitName}' removido. Reembolso RC: ${rcDelta}`,
          evidence: 'Comando /otorgar_rasgo',
          deltaRc: rcDelta
        }
      });

      return updatedCharacter;
    });
  }
}