import { PrismaClient, Prisma } from '@prisma/client';

export type PlazaGrantType = 'INICIAL' | 'DESARROLLO' | 'DESEO_NORMAL' | 'DESEO_ESPECIAL';

export interface AssignPlazaDTO {
  characterId: string;
  plazaName: string;
  grantType?: PlazaGrantType;
  costoBts?: number;         // Si es una Mejora de Técnica (BTS)
  costoBes?: number;         // Si es una Mejora de Técnica (BES)
  isFreeInheritance?: boolean; // (Uso interno) True para recursividad gratis
  evidence?: string;
}

export class PlazaService {
  constructor(private prisma: PrismaClient) {}

  private readonly DEVELOPABLE_CATEGORY_KEYWORDS = [
    'complement',
    'arma legendaria',
    'invocaci',
    'pacto'
  ];
  private readonly RESTRICTED_TRAIT_CATEGORIES = new Set(['origen', 'nacimiento', 'moral']);

  private normalizeCategory(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      origen: 'Origen',
      nacimiento: 'Nacimiento',
      moral: 'Moral'
    };

    return labels[category] ?? category;
  }

  private isDevelopableCategory(category: string): boolean {
    const normalizedCategory = category.trim().toLowerCase();
    return this.DEVELOPABLE_CATEGORY_KEYWORDS.some((keyword) => normalizedCategory.includes(keyword));
  }

  /**
   * 🌀 Asigna una Plaza a un personaje de forma atómica.
   * Si la Plaza tiene "Hijas", se llama a sí misma recursivamente con cycle detection.
   */
  async assignPlaza(
    data: AssignPlazaDTO, 
    txClient?: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
    visitedPlazaIds: Set<string> = new Set()
  ) {
    // Patrón Unit of Work: Si ya venimos de una transacción (ej. Recursividad o Registro), usamos ese TX. 
    // Si no, abrimos una nueva transacción ACID.
    const db = txClient || this.prisma;

    const executeLogic = async (tx: any) => {
      const grantType = data.grantType ?? 'DESARROLLO';

      // 1. LECTURA DE DATOS
      const character = await tx.character.findUnique({ 
        where: { id: data.characterId },
        include: {
          plazas: { include: { plaza: true } },
          traits: { include: { trait: { select: { id: true, name: true, category: true } } } }
        }
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

      // 🔄 CYCLE DETECTION: Check if this plaza is already being processed
      if (visitedPlazaIds.has(plaza.id)) {
        throw new Error(`⛔ CYCLE DETECTED in plaza inheritance: '${plaza.name}' would create a circular dependency.`);
      }

      // Add this plaza to visited set for this recursion path
      visitedPlazaIds.add(plaza.id);

      // 2. VALIDACIÓN DE DUPLICADOS
      const alreadyHasPlaza = character.plazas.some((cp: any) => cp.plazaId === plaza.id);
      if (alreadyHasPlaza) {
        if (data.isFreeInheritance) return; // Si es herencia, simplemente la ignoramos silenciosamente
        throw new Error(`⛔ El personaje ya posee la habilidad '${plaza.name}'.`);
      }

      // Check if plaza has slots available (maxHolders = 9999 means unlimited)
      if (plaza.maxHolders > 0) {
        const holdersCount = await tx.characterPlaza.count({ where: { plazaId: plaza.id } });
        if (holdersCount >= plaza.maxHolders) {
          throw new Error(`⛔ No quedan plazas para '${plaza.name}'. Cupo máximo: ${plaza.maxHolders}.`);
        }
      }

      // 3. MOTOR DE REGLAS (Fail-Fast)
      const isDevelopable = this.isDevelopableCategory(plaza.category);
      const isSpecialWish = grantType === 'DESEO_ESPECIAL';

      if (data.costoBts && data.costoBes) {
        throw new Error('⛔ No puedes pagar con BTS y BES al mismo tiempo. Usa una sola ruta de costo.');
      }

      if (!data.isFreeInheritance && grantType === 'INICIAL' && isDevelopable) {
        throw new Error(`⛔ REGLA DE DESARROLLO: '${plaza.category}' no puede tomarse como habilidad inicial.`);
      }

      if (!data.isFreeInheritance && grantType === 'DESARROLLO' && !isDevelopable) {
        throw new Error(`⛔ '${plaza.name}' no es una habilidad desarrollable. Usa otro tipo de otorgamiento.`);
      }

      if (isSpecialWish && character.specialWishUsed) {
        throw new Error('⛔ Este personaje ya consumió su único Deseo Especial.');
      }

      // B. Lógica Económica (Cupos, BTS, BES)
      if (!isSpecialWish && !data.isFreeInheritance) {
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

      // 4. COBRO DE RECURSOS Y MARCA DE DESEO ESPECIAL
      let deltaCupos = 0; let deltaBts = 0; let deltaBes = 0;
      
      if (!data.isFreeInheritance) {
        deltaCupos = (!data.costoBts && !data.costoBes && !isSpecialWish) ? -plaza.costCupos : 0;
        deltaBts = data.costoBts ? -data.costoBts : 0;
        deltaBes = data.costoBes ? -data.costoBes : 0;
        
        await tx.character.update({
          where: { id: character.id },
          data: {
            cupos: { increment: deltaCupos },
            bts: { increment: deltaBts },
            bes: { increment: deltaBes },
            specialWishUsed: isSpecialWish ? true : undefined
          }
        });
      }

      // 5. INYECCIÓN DE LA GUÍA
      // Los bonos de stats de plazas se calculan de forma derivada en visualización/lógica efectiva,
      // para no contaminar los contadores de SP invertidos del personaje.
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
            const inheritedTrait = plaza.inheritedTraits.find((it: any) => it.traitId === traitRel.characterId_traitId.traitId)?.trait;
            if (inheritedTrait) {
              const incomingCategory = this.normalizeCategory(inheritedTrait.category);
              if (this.RESTRICTED_TRAIT_CATEGORIES.has(incomingCategory)) {
                const sameCategory = await tx.characterTrait.findFirst({
                  where: {
                    characterId: character.id,
                    trait: { category: inheritedTrait.category }
                  },
                  include: { trait: { select: { name: true } } }
                });

                if (sameCategory) {
                  throw new Error(
                    `⛔ CONFLICTO DE CATEGORIA: '${inheritedTrait.name}' no puede heredarse porque ya tienes '${sameCategory.trait.name}' en '${this.getCategoryLabel(incomingCategory)}'.`
                  );
                }
              }
            }

            await tx.characterTrait.create({ data: { characterId: character.id, traitId: traitRel.characterId_traitId.traitId } });
          }
        }
      }

      // 7. HERENCIA RECURSIVA DE PLAZAS (Ej: Uchiha hereda Katon GRATIS)
      if (plaza.inheritedPlazas && plaza.inheritedPlazas.length > 0) {
        for (const childPlazaRel of plaza.inheritedPlazas) {
          const childPlaza = childPlazaRel.child;
          
          // 🌀 LLAMADA RECURSIVA: Asignamos la hija pasando "isFreeInheritance = true" y visitedPlazaIds
          await this.assignPlaza({
            characterId: character.id,
            plazaName: childPlaza.name,
            isFreeInheritance: true 
          }, tx, visitedPlazaIds);
        }
      }

      // 8. AUDITORÍA
      if (!data.isFreeInheritance) {
        const sourceTag = isSpecialWish
          ? '[DESEO ESPECIAL]'
          : grantType === 'DESEO_NORMAL'
            ? '[DESEO NORMAL]'
            : grantType === 'INICIAL'
              ? '[INICIAL]'
              : '[DESARROLLO]';

        const logDetail = `${sourceTag} Adquisición de: ${plaza.name}`;
        await tx.auditLog.create({
          data: {
            characterId: character.id,
            category: "Gestor Habilidades",
            detail: logDetail,
            evidence: data.evidence ?? "Sistema/Deseos",
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

  /**
   * 🗑️ Remover una Plaza de un personaje.
   * Revierte stat bonuses y elimina rasgos heredados.
   * NO es recursiva para plazas hijas (solo herencia de rasgos).
   */
  async removePlaza(characterId: string, plazaName: string) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Cargar personaje y plaza
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: { plazas: { include: { plaza: true } } }
      });

      if (!character) {
        throw new Error('⛔ Personaje no encontrado.');
      }

      const plaza = await tx.plaza.findUnique({
        where: { name: plazaName },
        include: {
          inheritedTraits: { include: { trait: true } },
          inheritedPlazas: true
        }
      });

      if (!plaza) {
        throw new Error(`⛔ La habilidad '${plazaName}' no existe en el sistema.`);
      }

      // 2. Verificar que el personaje tiene la plaza
      const characterPlaza = character.plazas.find((cp) => cp.plazaId === plaza.id);
      if (!characterPlaza) {
        throw new Error(`⛔ El personaje no posee la habilidad '${plazaName}'.`);
      }

      // 3. Eliminar rasgos heredados
      let traitsRemoved = 0;
      if (plaza.inheritedTraits && plaza.inheritedTraits.length > 0) {
        for (const inheritedTrait of plaza.inheritedTraits) {
          const traitExists = await tx.characterTrait.findUnique({
            where: {
              characterId_traitId: {
                characterId,
                traitId: inheritedTrait.traitId
              }
            }
          });

          if (traitExists) {
            await tx.characterTrait.delete({
              where: {
                characterId_traitId: {
                  characterId,
                  traitId: inheritedTrait.traitId
                }
              }
            });
            traitsRemoved++;
          }
        }
      }

      // 5. Remover la relación CharacterPlaza
      await tx.characterPlaza.delete({
        where: {
          characterId_plazaId: {
            characterId,
            plazaId: plaza.id
          }
        }
      });

      // 6. Reembolsar recursos (inversión original)
      let refundCupos = plaza.costCupos;
      await tx.character.update({
        where: { id: characterId },
        data: {
          cupos: { increment: refundCupos }
        }
      });

      // 7. Auditoría
      const auditDetail =
        traitsRemoved > 0
          ? `Removida: ${plaza.name}. Revertidas ${traitsRemoved} herencias de rasgos. Reembolso: ${refundCupos} cupos.`
          : `Removida: ${plaza.name}. Reembolso: ${refundCupos} cupos.`;

      await tx.auditLog.create({
        data: {
          characterId,
          category: 'Gestor Habilidades',
          detail: auditDetail,
          evidence: 'Comando /retirar_habilidad',
          deltaCupos: refundCupos
        }
      });

      return true;
    });
  }
}