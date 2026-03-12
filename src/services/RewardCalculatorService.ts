import { Character, ActivityRecord } from '@prisma/client';
import {
  MISSION_REWARDS,
  COMBAT_PR_REWARD,
  CURACION_PR_BY_SEVERITY,
  DESARROLLO_PERSONAL_EXP,
  STANDARD_NARRATION_REWARDS,
  getLogroGeneralEntry,
  getLogroReputacionEntry,
  RewardBreakdown
} from '../config/activityRewards';
import { getHistoricalNarrationRewards } from '../config/historicalNarrations';
import {
  ActivityType,
  canonicalizeActivityType,
  isAutoApprovableType,
  isDestacadoResult,
  isFailureResult,
  isSuccessResult
} from '../domain/activityDomain';

export type { RewardBreakdown };

export class RewardCalculatorService {
  private readonly RANK_VALUES: Readonly<Record<string, number>> = {
    D: 1,
    C: 2,
    B: 3,
    A: 4,
    S: 5
  };

  public calculateRewards(
    character: Character & { traits?: any[] },
    activity: ActivityRecord & { narrationKey?: string | null }
  ): RewardBreakdown {
    const normalizedType = canonicalizeActivityType(activity.type);

    let baseRewards: RewardBreakdown;

    if (normalizedType === ActivityType.MISION) {
      baseRewards = this.calculateMissionRewards(activity.rank, activity.result);
    } else if (normalizedType === ActivityType.COMBATE) {
      baseRewards = this.calculateCombatRewards(character.level, activity.rank, activity.result);
    } else if (normalizedType === ActivityType.CURACION) {
      baseRewards = this.calculateCuracionRewards(activity.rank); // rank stores severidad for Curacion
    } else if (normalizedType === ActivityType.DESARROLLO_PERSONAL) {
      baseRewards = this.calculateDesarrolloPersonalRewards(character.level);
    } else if (normalizedType === ActivityType.CRONICA) {
      baseRewards = this.calculateCronicaRewards(activity.result, activity.narrationKey);
    } else if (normalizedType === ActivityType.EVENTO) {
      baseRewards = this.calculateEventoRewards(activity.result, activity.narrationKey);
    } else if (normalizedType === ActivityType.LOGRO_GENERAL) {
      baseRewards = this.calculateLogroGeneralRewards(activity.narrationKey);
    } else if (normalizedType === ActivityType.LOGRO_REPUTACION) {
      baseRewards = this.calculateLogroReputacionRewards(activity.narrationKey);
    } else if (normalizedType === ActivityType.BALANCE_GENERAL) {
      baseRewards = this.calculateBalanceGeneralRewards(activity.narrationKey);
    } else {
      // MANUAL tier types (Escena, Logro de Saga, Experimento, Timeskip)
      return { exp: 0, pr: 0, ryou: 0 };
    }

    // Apply trait multipliers if character has traits
    return this.applyTraitMultipliers(baseRewards, character.traits ?? []);
  }

  /**
   * Check if an activity type is auto-approvable.
   */
  public isAutoApprovable(type: string | null | undefined): boolean {
    return isAutoApprovableType(type);
  }

  private calculateMissionRewards(rank: string | null, result: string | null | undefined): RewardBreakdown {
    if (!rank) {
      throw new Error('⛔ La misión no tiene rango definido.');
    }

    const normalizedRank = rank.toUpperCase();
    const rankReward = MISSION_REWARDS[normalizedRank];
    if (!rankReward) {
      throw new Error(`⛔ El rango de misión '${rank}' no es válido para recompensas.`);
    }

    const isSuccess = isSuccessResult(result);
    if (!isSuccess) {
      return { exp: rankReward.exp, pr: 0, ryou: 0 };
    }

    return rankReward;
  }

  private calculateCombatRewards(
    characterLevel: string,
    enemyRank: string | null,
    result: string | null | undefined
  ): RewardBreakdown {
    if (isFailureResult(result)) {
      return { exp: 1, pr: 0, ryou: 0 };
    }

    const isVictory = isSuccessResult(result);
    if (!isVictory) {
      return { exp: 0, pr: 0, ryou: 0 };
    }

    if (!enemyRank) {
      throw new Error('⛔ El combate no tiene rango del oponente definido.');
    }

    const myRankLetter = characterLevel.charAt(0).toUpperCase();
    const myRankValue = this.RANK_VALUES[myRankLetter];
    if (!myRankValue) {
      throw new Error(`⛔ El rango actual del personaje ('${characterLevel}') no es válido.`);
    }

    const enemyRankLetter = enemyRank.toUpperCase();
    const enemyRankValue = this.RANK_VALUES[enemyRankLetter];
    if (!enemyRankValue) {
      throw new Error(`⛔ El rango del oponente ('${enemyRank}') no es válido.`);
    }

    let exp = 1;
    if (enemyRankValue === myRankValue) {
      exp = 3;
    } else if (enemyRankValue > myRankValue) {
      exp = 3 + (2 * (enemyRankValue - myRankValue));
    }

    const pr = COMBAT_PR_REWARD[enemyRankLetter] ?? 0;
    return { exp, pr, ryou: 0 };
  }

  /**
   * Calculate rewards for Curación activity.
   * EXP is always 2. PR depends on wound severity stored in rank field.
   */
  private calculateCuracionRewards(severidad: string | null): RewardBreakdown {
    const exp = 2;

    if (!severidad) {
      throw new Error('⛔ La curación no tiene severidad de herida definida.');
    }

    const pr = CURACION_PR_BY_SEVERITY[severidad];
    if (pr === undefined) {
      throw new Error(`⛔ La severidad '${severidad}' no es válida.`);
    }

    return { exp, pr, ryou: 0 };
  }

  /**
   * Calculate rewards for Desarrollo Personal activity.
   * EXP by character level.
   */
  private calculateDesarrolloPersonalRewards(characterLevel: string): RewardBreakdown {
    const levelLetter = characterLevel.charAt(0).toUpperCase();
    const exp = DESARROLLO_PERSONAL_EXP[levelLetter];

    if (exp === undefined) {
      throw new Error(`⛔ El nivel '${characterLevel}' no es válido para Desarrollo Personal.`);
    }

    return { exp, pr: 0, ryou: 0 };
  }

  /**
   * Calculate rewards for Crónica activity.
   * Uses historical catalog if narrationKey matches, otherwise uses standard table.
   */
  private calculateCronicaRewards(resultado: string | null | undefined, narrationKey: string | null | undefined): RewardBreakdown {
    const isDestacado = isDestacadoResult(resultado);

    // Try to lookup in historical catalog
    if (narrationKey) {
      const historical = getHistoricalNarrationRewards(narrationKey);
      if (historical) {
        const participant = historical.participant;
        const destacado = historical.destacado;
        if (isDestacado && (destacado.exp > 0 || destacado.pr > 0)) {
          return {
            exp: participant.exp + destacado.exp,
            pr: participant.pr + destacado.pr,
            ryou: 0
          };
        }
        return participant;
      }
    }

    // Use standard table
    const standard = STANDARD_NARRATION_REWARDS.Cronica;
    if (isDestacado) {
      return {
        exp: standard.participant.exp + standard.destacado.exp,
        pr: standard.participant.pr + standard.destacado.pr,
        ryou: 0
      };
    }
    return standard.participant;
  }

  /**
   * Calculate rewards for Evento activity.
   * Uses historical catalog if narrationKey matches, otherwise uses standard table.
   */
  private calculateEventoRewards(resultado: string | null | undefined, narrationKey: string | null | undefined): RewardBreakdown {
    const isDestacado = isDestacadoResult(resultado);

    // Try to lookup in historical catalog
    if (narrationKey) {
      const historical = getHistoricalNarrationRewards(narrationKey);
      if (historical) {
        const participant = historical.participant;
        const destacado = historical.destacado;
        if (isDestacado && (destacado.exp > 0 || destacado.pr > 0)) {
          return {
            exp: participant.exp + destacado.exp,
            pr: participant.pr + destacado.pr,
            ryou: 0
          };
        }
        return participant;
      }
    }

    // Use standard table
    const standard = STANDARD_NARRATION_REWARDS.Evento;
    if (isDestacado) {
      return {
        exp: standard.participant.exp + standard.destacado.exp,
        pr: standard.participant.pr + standard.destacado.pr,
        ryou: 0
      };
    }
    return standard.participant;
  }

  private calculateLogroGeneralRewards(goalKey: string | null | undefined): RewardBreakdown {
    const logro = getLogroGeneralEntry(goalKey);
    if (!logro) {
      throw new Error('⛔ El logro general seleccionado no existe en el catálogo.');
    }

    // Manual exceptions keep staff-driven flow and should not auto-credit projected rewards.
    if (logro.isManualException) {
      return { exp: 0, pr: 0, ryou: 0 };
    }

    return logro.rewards;
  }

  private calculateLogroReputacionRewards(goalKey: string | null | undefined): RewardBreakdown {
    const logro = getLogroReputacionEntry(goalKey);
    if (!logro) {
      throw new Error('⛔ El logro de reputación seleccionado no existe en el catálogo.');
    }

    return logro.rewards;
  }

  /**
   * Calculate rewards for Balance General activity.
   * Only uses historical catalog (Balance General: entries); no standard table.
   */
  private calculateBalanceGeneralRewards(narrationKey: string | null | undefined): RewardBreakdown {
    if (!narrationKey) {
      return { exp: 0, pr: 0, ryou: 0 };
    }
    const historical = getHistoricalNarrationRewards(narrationKey);
    if (!historical) {
      return { exp: 0, pr: 0, ryou: 0 };
    }
    return historical.participant;
  }

  /**
   * 🧬 Aplicar multiplicadores de rasgos a las recompensas
   * - multiplierGanancia para Ryou (Ambicioso 1.5x)
   * - mechanics.expMultiplier para EXP (Presteza 1.5x, Arrepentimiento 0.5x)
   * - mechanics.prMultiplier para PR (Leyenda 1.25x, Presionado 0.75x)
   */
  private applyTraitMultipliers(
    rewards: RewardBreakdown,
    traits: any[]
  ): RewardBreakdown {
    let ryouMultiplier = 1.0;
    let expMultiplier = 1.0;
    let prMultiplier = 1.0;

    for (const traitRecord of traits) {
      const trait = traitRecord.trait || traitRecord;

      // Aplicar multiplierGanancia para Ryou
      if (trait.multiplierGanancia && typeof trait.multiplierGanancia === 'number') {
        ryouMultiplier *= trait.multiplierGanancia;
      }

      // Aplicar multiplicadores de mechanics
      if (trait.mechanics && typeof trait.mechanics === 'object' && !Array.isArray(trait.mechanics)) {
        const mech = trait.mechanics as Record<string, unknown>;

        if (mech.expMultiplier && typeof mech.expMultiplier === 'number') {
          expMultiplier *= mech.expMultiplier;
        }

        if (mech.prMultiplier && typeof mech.prMultiplier === 'number') {
          prMultiplier *= mech.prMultiplier;
        }
      }
    }

    return {
      exp: Math.floor(rewards.exp * expMultiplier),
      pr: Math.floor(rewards.pr * prMultiplier),
      ryou: Math.floor(rewards.ryou * ryouMultiplier),
      ...(rewards.rc !== undefined && rewards.rc > 0 ? { rc: rewards.rc } : {}),
      ...(rewards.cupos !== undefined && rewards.cupos > 0 ? { cupos: rewards.cupos } : {})
    };
  }
}
