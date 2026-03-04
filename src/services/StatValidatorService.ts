import { Character, Trait } from '@prisma/client';

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

  // 📈 MATRIZ DE ESCALAS (SSOT)
  // Índice:      0, 1, 2,  3,  4,  5,   6 (GP)
  private readonly SCALES: Record<string, number[]> = {
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
  private readonly RANK_CAPS: Record<string, number> = {
    "D": 2, // 3ra escala
    "C": 3, // 4ta escala
    "B": 4, // 5ta escala (Regla asimétrica permite uno en 5)
    "A": 5, // 6ta escala (Máximo normal 20/20)
    "S": 5  // El S no tiene límite de SP, pero su tope normal sigue siendo la escala 6. El índice 6 (GP) requiere autorización.
  };

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

    for (const trait of characterTraits) {
      if (trait.mechanics && typeof trait.mechanics === 'object') {
        const mech = trait.mechanics as any;
        if (Array.isArray(mech.blockedStats)) {
          mech.blockedStats.forEach((stat: string) => blockedStats.add(stat.toLowerCase()));
        }
        if (typeof mech.grantedGP === 'string') {
          authorizedGPs.add(mech.grantedGP.toLowerCase());
        }
      }
    }

    const rankLetter = character.level.charAt(0).toUpperCase();
    const isAsymmetric = rankLetter === "B";
    const rankCapNormal = this.RANK_CAPS[rankLetter] || 2;
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
    const finalChakraPoints = 2 + (newInvestedSP.chakra * this.CHAKRA_MULTIPLIER);
    if (finalChakraPoints > this.CHAKRA_MAX_FLAT) {
      throw new Error(`⛔ LÍMITE SUPERADO: El Chakra no puede exceder los ${this.CHAKRA_MAX_FLAT} puntos.`);
    }

    // 2. Motor de Validación Escalar
    for (const [statName, totalSpInvested] of Object.entries(newInvestedSP)) {
      if (statName === 'chakra') continue; // El chakra no usa escalas
      
      const investedAmount = investment[statName as keyof StatInvestmentDTO] || 0;
      const baseIndex = baseIndices?.[statName as keyof typeof baseIndices] || 0;
      
      // ÍNDICE PROYECTADO = Base del Rango + Total de SP Invertidos históricamente
      const projectedIndex = baseIndex + totalSpInvested;

      // A. Validar Bloqueos por Rasgo (Ej: Torpeza)
      if (investedAmount > 0 && blockedStats.has(statName)) {
        throw new Error(`⛔ BLOQUEO: Tus rasgos te impiden invertir en '${statName.toUpperCase()}'.`);
      }

      // B. Validar Golden Point (7ma Escala = Índice 6)
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