import { Character, Trait } from '@prisma/client';

export type InternalLevel = 'D1' | 'D2' | 'D3' | 'C1' | 'C2' | 'C3' | 'B1' | 'B2' | 'B3' | 'A1' | 'A2' | 'A3' | 'S1' | 'S2';

export interface LevelProgressionEntry {
  rankLetter: 'D' | 'C' | 'B' | 'A' | 'S';
  expRequired: number;
  spGranted: number;
}

export type NonChakraStatName = 'fuerza' | 'resistencia' | 'velocidad' | 'percepcion' | 'inteligencia' | 'armas';
export type StatName = NonChakraStatName | 'chakra';

export interface StatDisplayValue {
  current: number;
  cap: number | null;
  formatted: string;
}

export interface StatBonusBreakdown {
  traitBonus?: number;
  traitGradationBonus?: number;
  plazaBonus?: number;
  externalBonus?: number;
}

export interface StatInvestmentDTO {
  fuerza?: number | undefined;
  resistencia?: number | undefined;
  velocidad?: number | undefined;
  percepcion?: number | undefined;
  chakra?: number | undefined;
  inteligencia?: number | undefined;
  armas?: number | undefined;
}

export class StatValidatorService {
  private readonly CHAKRA_MULTIPLIER = 2;
  private readonly CHAKRA_MAX_FLAT = 20;
  private readonly LIMITED_STATS: Set<StatName> = new Set(['resistencia']);

  // 📚 SSOT de progresión interna (EXP/SP por nivel)
  private static readonly LEVEL_PROGRESSION: Record<InternalLevel, LevelProgressionEntry> = {
    D1: { rankLetter: 'D', expRequired: 0, spGranted: 3 },
    D2: { rankLetter: 'D', expRequired: 40, spGranted: 1 },
    D3: { rankLetter: 'D', expRequired: 80, spGranted: 1 },
    C1: { rankLetter: 'C', expRequired: 100, spGranted: 2 },
    C2: { rankLetter: 'C', expRequired: 150, spGranted: 1 },
    C3: { rankLetter: 'C', expRequired: 200, spGranted: 1 },
    B1: { rankLetter: 'B', expRequired: 250, spGranted: 2 },
    B2: { rankLetter: 'B', expRequired: 325, spGranted: 1 },
    B3: { rankLetter: 'B', expRequired: 400, spGranted: 1 },
    A1: { rankLetter: 'A', expRequired: 500, spGranted: 4 },
    A2: { rankLetter: 'A', expRequired: 700, spGranted: 1 },
    A3: { rankLetter: 'A', expRequired: 900, spGranted: 1 },
    S1: { rankLetter: 'S', expRequired: 1000, spGranted: 1 },
    S2: { rankLetter: 'S', expRequired: 1300, spGranted: 1 }
  };

  // 📈 MATRIZ DE ESCALAS (SSOT)
  // Índice:      0, 1, 2,  3,  4,  5,   6 (GP)
  private readonly SCALES: Record<NonChakraStatName, number[]> = {
    fuerza:       [1, 5, 8, 12, 16, 20, 99], // 99 representa el GPF
    resistencia:  [1, 4, 8, 12, 16, 20, 99], // 99 representa el GPR
    velocidad:    [1, 3, 7, 13, 17, 20, 99],
    percepcion:   [1, 3, 6, 12, 16, 20, 99],
    inteligencia: [1, 3, 6, 12, 16, 20, 99],
    armas:        [1, 3, 5,  8, 10, 12, 99]
  };

  // 🧬 ÍNDICES BASE POR RANGO (0-based)
  // Determina en qué punto de la escala empieza el personaje "gratis" por su rango
  private readonly RANK_BASES: Record<string, Record<string, number>> = {
    "D": { fuerza: 0, resistencia: 1, velocidad: 0, percepcion: 0, inteligencia: 0, armas: 0 },
    "C": { fuerza: 0, resistencia: 1, velocidad: 0, percepcion: 1, inteligencia: 0, armas: 1 },
    "B": { fuerza: 0, resistencia: 1, velocidad: 1, percepcion: 1, inteligencia: 1, armas: 1 },
    "A": { fuerza: 1, resistencia: 1, velocidad: 1, percepcion: 1, inteligencia: 1, armas: 1 },
    "S": { fuerza: 1, resistencia: 1, velocidad: 1, percepcion: 1, inteligencia: 2, armas: 2 }
  };

  // 🛑 LÍMITES MÁXIMOS DE ÍNDICE POR RANGO (Caps)
  private readonly RANK_CAPS: Record<string, number | null> = {
    "D": 2, // 3ra escala
    "C": 3, // 4ta escala
    "B": 4, // 5ta escala (Regla asimétrica permite uno en 5)
    "A": null, // Sin límite de escala por rango (solo restringe SP disponible)
    "S": null  // Sin límite de escala por rango (solo restringe SP disponible)
  };

  private readonly STAT_SCALE_CAPS: Record<NonChakraStatName, number> = {
    fuerza: 20,
    resistencia: 20,
    velocidad: 20,
    percepcion: 20,
    inteligencia: 20,
    armas: 12
  };

  public static getLevelProgression(level: string): LevelProgressionEntry {
    const normalizedLevel = level.trim().toUpperCase() as InternalLevel;
    const entry = this.LEVEL_PROGRESSION[normalizedLevel];
    if (!entry) {
      throw new Error(`Nivel no reconocido para progresión: ${level}`);
    }
    return entry;
  }

  public static getLevelExpRequirements(): Record<InternalLevel, number> {
    const requirements = {} as Record<InternalLevel, number>;
    (Object.keys(this.LEVEL_PROGRESSION) as InternalLevel[]).forEach((level) => {
      requirements[level] = this.LEVEL_PROGRESSION[level].expRequired;
    });
    return requirements;
  }

  public static getInitialSpForLevel(level: string): number {
    return this.getLevelProgression(level).spGranted;
  }

  public getRankLetterFromLevel(level: string): string {
    return level.charAt(0).toUpperCase();
  }

  public getDisplayValueForStat(level: string, statName: StatName, investedPoints: number): StatDisplayValue {
    return this.getEffectiveDisplayValueForStat(level, statName, investedPoints);
  }

  public getEffectiveDisplayValueForStat(
    level: string,
    statName: StatName,
    investedPoints: number,
    bonusBreakdown: StatBonusBreakdown = {}
  ): StatDisplayValue {
    const traitBonus = bonusBreakdown.traitBonus ?? 0;
    const traitGradationBonus = bonusBreakdown.traitGradationBonus ?? 0;
    const plazaBonus = bonusBreakdown.plazaBonus ?? 0;
    const externalBonus = bonusBreakdown.externalBonus ?? 0;

    if (statName === 'chakra') {
      const baseCurrent = 2 + (investedPoints * this.CHAKRA_MULTIPLIER) + traitBonus;
      const current = Math.min(baseCurrent, this.CHAKRA_MAX_FLAT);
      const bonusLabel = externalBonus !== 0 ? ` (${externalBonus > 0 ? '+' : ''}${externalBonus})` : '';
      return {
        current,
        cap: this.CHAKRA_MAX_FLAT,
        formatted: `${current}/${this.CHAKRA_MAX_FLAT}${bonusLabel}`
      };
    }

    const rankLetter = this.getRankLetterFromLevel(level);
    const baseIndices = (this.RANK_BASES[rankLetter] || this.RANK_BASES['D']) as Record<NonChakraStatName, number>;
    const scale = this.SCALES[statName];
    const baseIndex = baseIndices[statName] ?? 0;
    const projectedIndex = Math.max(0, baseIndex + investedPoints + traitGradationBonus);
    const boundedIndex = Math.min(projectedIndex, scale.length - 1);
    const baseCurrent = (scale[boundedIndex] ?? scale[scale.length - 1] ?? 0) + traitBonus;
    const cap = this.STAT_SCALE_CAPS[statName];
    const rawCurrent = baseCurrent + plazaBonus;
    const current = this.LIMITED_STATS.has(statName)
      ? Math.min(rawCurrent, cap)
      : rawCurrent;
    const bonusLabel = this.LIMITED_STATS.has(statName) && plazaBonus !== 0
      ? ` (${plazaBonus > 0 ? '+' : ''}${plazaBonus})`
      : '';

    return {
      current,
      cap,
      formatted: `${current}/${cap}${bonusLabel}`
    };
  }

  public calculateNewStats(
    character: Character, 
    characterTraits: Trait[], 
    investment: StatInvestmentDTO
  ) {
    const totalSpToInvest = Object.values(investment).reduce((sum, val) => sum + (val || 0), 0);
    if (totalSpToInvest <= 0) throw new Error("⛔ Debes invertir al menos 1 SP.");
    if (totalSpToInvest > character.sp) {
      throw new Error(`⛔ FONDOS INSUFICIENTES: Requieres ${totalSpToInvest} SP, tienes ${character.sp}.`);
    }

    // 1. Extraer Mecánicas de Rasgos (Bloqueos y Golden Points)
    const blockedStats = new Set<string>();
    const authorizedGPs = new Set<string>();
    const traitGradationBonuses: Record<NonChakraStatName, number> = {
      fuerza: 0,
      resistencia: 0,
      velocidad: 0,
      percepcion: 0,
      inteligencia: 0,
      armas: 0
    };
    let traitChakraBonus = 0;

    for (const trait of characterTraits) {
      if (trait.mechanics && typeof trait.mechanics === 'object') {
        const mech = trait.mechanics as Record<string, unknown>;
        if (Array.isArray(mech.blockedStats)) {
          mech.blockedStats.forEach((stat: string) => blockedStats.add(stat.toLowerCase()));
        }
        if (typeof mech.grantedGP === 'string') {
          authorizedGPs.add(mech.grantedGP.toLowerCase());
        }
        if (typeof mech.bonusChakra === 'number') {
          traitChakraBonus += mech.bonusChakra;
        }
        if (mech.bonusGradations && typeof mech.bonusGradations === 'object' && !Array.isArray(mech.bonusGradations)) {
          for (const [rawKey, rawValue] of Object.entries(mech.bonusGradations as Record<string, unknown>)) {
            if (typeof rawValue !== 'number') {
              continue;
            }

            const normalizedKey = rawKey
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase();

            if (normalizedKey in traitGradationBonuses) {
              traitGradationBonuses[normalizedKey as NonChakraStatName] += rawValue;
            }
          }
        }
      }
    }

    const rankLetter = character.level.charAt(0).toUpperCase();
    const isAsymmetric = rankLetter === "B";
    const hasUnlimitedScaleCaps = rankLetter === 'A' || rankLetter === 'S';
    const rankCapNormal = this.RANK_CAPS[rankLetter] ?? 2;
    const baseIndices = this.RANK_BASES[rankLetter] || this.RANK_BASES["D"];

    let statsAtMaxScale = 0; // Para la regla del Rango B

    // Clonamos los SP invertidos actuales
    const newInvestedSP = {
      fuerza: character.fuerza + (investment.fuerza || 0),
      velocidad: character.velocidad + (investment.velocidad || 0),
      armas: character.armas + (investment.armas || 0),
      percepcion: character.percepcion + (investment.percepcion || 0),
      inteligencia: character.inteligencia + (investment.inteligencia || 0),
      resistencia: character.resistencia + (investment.resistencia || 0),
      chakra: character.chakra // Se maneja aparte
    };

    // Aplicar excepción del Chakra
    if (investment.chakra && investment.chakra > 0) {
      newInvestedSP.chakra += investment.chakra;
    }
    const finalChakraPoints = 2 + (newInvestedSP.chakra * this.CHAKRA_MULTIPLIER) + traitChakraBonus;
    if (finalChakraPoints > this.CHAKRA_MAX_FLAT) {
      throw new Error(`⛔ LÍMITE SUPERADO: El Chakra no puede exceder los ${this.CHAKRA_MAX_FLAT} puntos.`);
    }

    // 2. Motor de Validación Escalar
    for (const [statName, totalSpInvested] of Object.entries(newInvestedSP)) {
      if (statName === 'chakra') continue; // El chakra no usa escalas
      
      const investedAmount = investment[statName as keyof StatInvestmentDTO] || 0;
      const baseIndex = baseIndices?.[statName as keyof typeof baseIndices] || 0;
      const traitGradation = traitGradationBonuses[statName as NonChakraStatName] || 0;
      
      // ÍNDICE PROYECTADO = Base del Rango + Total de SP Invertidos históricamente
      const projectedIndex = baseIndex + totalSpInvested + traitGradation;

      // A. Validar Bloqueos por Rasgo (Ej: Torpeza)
      if (investedAmount > 0 && blockedStats.has(statName)) {
        throw new Error(`⛔ BLOQUEO: Tus rasgos te impiden invertir en '${statName.toUpperCase()}'.`);
      }

      // B. Validar Golden Point (7ma Escala = Índice 6)
      if (hasUnlimitedScaleCaps) {
        continue;
      }

      if (projectedIndex === 6) {
        if (!authorizedGPs.has(statName)) {
          throw new Error(`⛔ GOLDEN POINT: No posees el Rasgo de Autorización requerido para alcanzar el GP de ${statName.toUpperCase()}.`);
        }
        continue; // Si tiene permiso, es legal, pasa al siguiente stat.
      }

      // C. Validar Exceso Absoluto (Más allá del GP)
      if (projectedIndex > 6) {
        throw new Error(`⛔ LÍMITE ABSOLUTO: No existen escalas más allá del Golden Point en ${statName.toUpperCase()}.`);
      }

      // D. Validar Regla Asimétrica (Rango B)
      if (isAsymmetric) {
        if (projectedIndex > 5) {
          throw new Error(`⛔ LÍMITE RANGO B: El máximo permitido es la Escala 5. Fallo en ${statName.toUpperCase()}.`);
        }
        if (projectedIndex === 5) {
          statsAtMaxScale++;
          if (statsAtMaxScale > 1) {
            throw new Error(`⛔ REGLA DE RANGO B: Solo UN stat (además de Chakra) puede llegar a su última escala. Ya tienes otro al máximo.`);
          }
        }
      } 
      // E. Validar Caps Normales (D, C, A, S)
      else {
        if (projectedIndex > rankCapNormal) {
          throw new Error(`⛔ LÍMITE DE RANGO: Tu tope para Rango ${rankLetter} es la escala índice ${rankCapNormal}. Fallo en ${statName.toUpperCase()}.`);
        }
      }
    }

    return {
      newInvestedSP, // Esto es lo que se guardará en Prisma (UPDATE Character SET fuerza = newInvestedSP.fuerza...)
      spSpent: totalSpToInvest,
      remainingSp: character.sp - totalSpToInvest
    };
  }
}