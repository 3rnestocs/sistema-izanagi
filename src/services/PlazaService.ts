import { PrismaClient, Prisma } from '@prisma/client';

export interface AssignPlazaDTO {
  characterId: string;
  plazaName: string;
  isInitialBuild?: boolean;  // True si viene del comando /registro
  isSpecialWish?: boolean;   // True si el Staff usa su "Deseo Especial"
  costoBts?: number;         // Si es una Mejora de Técnica (BTS)
  costoBes?: number;         // Si es una Mejora de Técnica (BES)
  isFreeInheritance?: boolean; // (Uso interno) True para recursividad gratis
}

export class PlazaService {
  constructor(private prisma: PrismaClient) {}

  // 🗂️ Categorías SSOT
  private readonly INITIAL_CATEGORIES = ["Elemento", "Clan", "Especial", "Bijuu"];
  private readonly DEVELOPABLE_CATEGORIES = ["Complementario", "Invocación", "Arma Legendaria"];

  /**
   * 🌀 Asigna una Plaza a un personaje de forma atómica.
   * Si la Plaza tiene "Hijas", se llama a sí misma recursivamente.
   */
  async assignPlaza(data: AssignPlazaDTO, txClient?: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) {
    // Patrón Unit of Work: Si ya venimos de una transacción (ej. Recursividad o Registro), usamos ese TX. 
    // Si no, abrimos una nueva transacción ACID.
    const db = txClient || this.prisma;

    const executeLogic = async (tx: any) => {
      // 1. LECTURA DE DATOS
      const character = await tx.character.findUnique({ 
        where: { id: data.characterId },
        include: { plazas: { include: { plaza: true } } } 
      });
      if (!character) throw new Error("⛔ Personaje no encontrado.");

      const plaza = await tx.plaza.findUnique({
        where: { name: data.plazaName },
        include: {
          inheritedTraits: { include: { trait: true } },
          inheritedPlazas: { include: { child: true } }
        }
      });
      if (!plaza) throw new Error(`⛔ La guía/plaza '${data.plazaName}' no existe en el sistema.`);

      // 2. VALIDACIÓN DE DUPLICADOS
      const alreadyHasPlaza = character.plazas.some((cp: any) => cp.plazaId === plaza.id);
      if (alreadyHasPlaza) {
        if (data.isFreeInheritance) return; // Si es herencia, simplemente la ignoramos silenciosamente
        throw new Error(`⛔ El personaje ya posee la habilidad '${plaza.name}'.`);
      }

      // 3. MOTOR DE REGLAS (Fail-Fast)
      if (!data.isSpecialWish) {
        // A. Validación de Categoría de Inicio
        if (data.isInitialBuild && this.DEVELOPABLE_CATEGORIES.includes(plaza.category)) {
          throw new Error(`⛔ REGLA DE DESARROLLO: Las habilidades de categoría '${plaza.category}' no pueden tomarse en la creación del personaje.`);
        }

        // B. Lógica Económica (Cupos, BTS, BES)
        if (!data.isFreeInheritance) {
          if (data.costoBts && character.bts < data.costoBts) {
            throw new Error(`⛔ FONDOS INSUFICIENTES: Necesitas ${data.costoBts} BTS. Tienes ${character.bts}.`);
          }
          if (data.costoBes && character.bes < data.costoBes) {
            throw new Error(`⛔ FONDOS INSUFICIENTES: Necesitas ${data.costoBes} BES. Tienes ${character.bes}.`);
          }
          if (!data.costoBts && !data.costoBes && character.cupos < plaza.costCupos) {
            throw new Error(`⛔ CUPOS INSUFICIENTES: La habilidad cuesta ${plaza.costCupos} cupos y tienes ${character.cupos}.`);
          }
        }
      }

      // 4. COBRO DE RECURSOS Y MARCA DE DESEO ESPECIAL
      let deltaCupos = 0; let deltaBts = 0; let deltaBes = 0;
      
      if (!data.isFreeInheritance) {
        deltaCupos = (!data.costoBts && !data.costoBes && !data.isSpecialWish) ? -plaza.costCupos : 0;
        deltaBts = data.costoBts ? -data.costoBts : 0;
        deltaBes = data.costoBes ? -data.costoBes : 0;
        
        await tx.character.update({
          where: { id: character.id },
          data: {
            cupos: { increment: deltaCupos },
            bts: { increment: deltaBts },
            bes: { increment: deltaBes },
            specialWishUsed: data.isSpecialWish ? true : undefined
          }
        });
      }

      // 5. INYECCIÓN DE LA GUÍA Y SUS BONOS DE STATS
      // Preparamos la inyección del bono si la plaza otorga uno (Ej: +2 Ninjutsu)
      const statUpdateObj: any = {};
      if (plaza.bonusStatName && plaza.bonusStatValue !== 0) {
        const statKey = plaza.bonusStatName.toLowerCase();
        statUpdateObj[statKey] = { increment: plaza.bonusStatValue };
        
        await tx.character.update({
          where: { id: character.id },
          data: statUpdateObj
        });
      }

      // Creamos la relación en la tabla intermedia
      await tx.characterPlaza.create({
        data: {
          characterId: character.id,
          plazaId: plaza.id,
          currentRank: "C" // Nivel inicial por defecto, editable por el Staff después
        }
      });

      // 6. HERENCIA RECURSIVA DE RASGOS (Ej: Rasgos extra de un Clan)
      if (plaza.inheritedTraits && plaza.inheritedTraits.length > 0) {
        const traitsToConnect = plaza.inheritedTraits.map((it: any) => ({
          characterId_traitId: { characterId: character.id, traitId: it.traitId }
        }));
        
        // Asignamos los rasgos heredados omitiendo duplicados (onConflict: Do Nothing equivalente)
        for (const traitRel of traitsToConnect) {
          const hasTrait = await tx.characterTrait.findUnique({ where: { characterId_traitId: traitRel.characterId_traitId } });
          if (!hasTrait) {
            await tx.characterTrait.create({ data: { characterId: character.id, traitId: traitRel.characterId_traitId.traitId } });
          }
        }
      }

      // 7. HERENCIA RECURSIVA DE PLAZAS (Ej: Uchiha hereda Katon GRATIS)
      if (plaza.inheritedPlazas && plaza.inheritedPlazas.length > 0) {
        for (const childPlazaRel of plaza.inheritedPlazas) {
          const childPlaza = childPlazaRel.child;
          
          // 🌀 LLAMADA RECURSIVA: Asignamos la hija pasando "isFreeInheritance = true"
          await this.assignPlaza({
            characterId: character.id,
            plazaName: childPlaza.name,
            isFreeInheritance: true 
          }, tx);
        }
      }

      // 8. AUDITORÍA
      if (!data.isFreeInheritance) {
        const logDetail = data.isSpecialWish ? `[DESEO ESPECIAL] Adquisición de: ${plaza.name}` : `Adquisición de: ${plaza.name}`;
        await tx.auditLog.create({
          data: {
            characterId: character.id,
            category: "Gestor Habilidades",
            detail: logDetail,
            evidence: "Sistema/Deseos",
            deltaCupos: deltaCupos,
            deltaBts: deltaBts,
            deltaBes: deltaBes
          }
        });
      }

      return true;
    };

    // Si ya estamos en una transacción, ejecutamos la lógica. Si no, abrimos una nueva.
    if (txClient) {
      return await executeLogic(txClient);
    } else {
      return await this.prisma.$transaction(executeLogic);
    }
  }
}