import { PrismaClient } from '@prisma/client';

// DTO (Data Transfer Object) para tipar estrictamente lo que entra desde Discord
export interface CreateCharacterDTO {
  discordId: string;
  name: string;      // El "Keko" (Identificador único)
  fullName: string;  // Nombre del PJ
  age?: number;
  moral?: string;
  traitNames: string[]; // Array de nombres de rasgos (Origen, Nacimiento, Extras)
}

export class CharacterService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 🧙‍♂️ Creación Unificada de Ficha (V2)
   * Envuelto en una transacción ACID para evitar datos corruptos.
   */
  async createCharacter(data: CreateCharacterDTO) {
    // 🛡️ LOCK ATÓMICO: Iniciamos la transacción de Prisma
    return await this.prisma.$transaction(async (tx) => {
      
      // 1. FAIL-FAST: Verificar si el Keko o el DiscordID ya tienen ficha
      const existingChar = await tx.character.findFirst({
        where: {
          OR: [{ name: data.name }, { discordId: data.discordId }]
        }
      });
      if (existingChar) {
        throw new Error(`⛔ ERROR DE CAPA 8: El Keko '${data.name}' o el usuario de Discord ya posee una ficha registrada.`);
      }

      // 2. LECTURA DE RASGOS (SSOT)
      // Buscamos los rasgos exactos en la base de datos (Case-Insensitive si lo configuraste así, pero preferible exacto)
      const traits = await tx.trait.findMany({
        where: { name: { in: data.traitNames } },
        include: { incompatibilitiesA: true, incompatibilitiesB: true }
      });

      if (traits.length !== data.traitNames.length) {
        throw new Error(`⛔ ERROR DB: Uno o más rasgos proporcionados no existen en el sistema IZANAGI.`);
      }

      // 3. MOTOR DE VALIDACIÓN DE CONFLICTOS Y CÁLCULO DE BONOS
      let totalRyouBonus = 0;
      let totalRcCost = 0;
      let totalExpBonus = 0;
      let totalSpBonus = 0;
      let totalCuposBonus = 0;
      let statBonuses: Record<string, number> = {};
      const traitIds = traits.map(t => t.id);

      for (const trait of traits) {
        // A. Validar Incompatibilidades
        const conflicts = [...trait.incompatibilitiesA, ...trait.incompatibilitiesB];
        for (const conflict of conflicts) {
          const conflictingTraitId = conflict.traitAId === trait.id ? conflict.traitBId : conflict.traitAId;
          if (traitIds.includes(conflictingTraitId)) {
            throw new Error(`⛔ CONFLICTO DETECTADO: El rasgo '${trait.name}' es incompatible con otro rasgo seleccionado.`);
          }
        }

        // B. Sumar costos y bonos iniciales
        totalRcCost += trait.costRC;
        totalRyouBonus += trait.bonusRyou;

        // C. Apply direct stat bonuses (e.g., Sabio +2 Chakra)
        if (trait.bonusStatName && trait.bonusStatValue !== 0) {
          const statKey = trait.bonusStatName.toLowerCase();
          statBonuses[statKey] = (statBonuses[statKey] || 0) + trait.bonusStatValue;
        }

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

     // 4. CREACIÓN DE LA FICHA Y RELACIONES
      const newCharacter = await tx.character.create({
        data: {
          discordId: data.discordId,
          name: data.name,
          // 🚀 SOLUCIÓN: Convertimos undefined a null para satisfacer a Prisma
          fullName: data.fullName ?? null, 
          age: data.age ?? null,           
          moral: data.moral ?? null,       
          
          ryou: totalRyouBonus, 
          rc: totalRcCost,
          exp: totalExpBonus,
          sp: totalSpBonus,
          cupos: totalCuposBonus,
          
          // Apply direct stat bonuses from traits
          fuerza: statBonuses['fuerza'] || 0,
          resistencia: statBonuses['resistencia'] || 0,
          velocidad: statBonuses['velocidad'] || 0,
          percepcion: statBonuses['percepcion'] || 0,
          chakra: statBonuses['chakra'] || 0,
          armas: statBonuses['armas'] || 0,
          inteligencia: statBonuses['inteligencia'] || 0,
          
          traits: {
            create: traits.map(t => ({
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
    });
  }
}