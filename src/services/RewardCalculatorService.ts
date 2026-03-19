import { Character, ActivityRecord } from '@prisma/client';
import {
  MISSION_REWARDS,
  COMBAT_PR_REWARD,
  CURACION_PR_BY_SEVERITY,
  DESARROLLO_PERSONAL_EXP,
  STANDARD_NARRATION_REWARDS,
  getLogroGeneralEntry,
  getLogroReputacionEntry,
  RewardBreakdown,
  DetailedRewardBreakdown,
  RewardDetail,
  roundHalfUp
} from '../config/activityRewards';
import { getHistoricalNarrationRewards } from '../config/historicalNarrations';
import { NEWBIE_BOOST_CONFIG } from '../config/newbieBoost';
import {
  BONUS_NEWBIE,
  ERROR_CHARACTER_LEVEL_INVALID,
  ERROR_COMBAT_NO_ENEMY_RANK,
  ERROR_CURACION_NO_SEVERITY,
  ERROR_ENEMY_RANK_INVALID,
  ERROR_LEVEL_INVALID_DESARROLLO,
  ERROR_LOGRO_GENERAL_NOT_FOUND,
  ERROR_LOGRO_REPUTACION_NOT_FOUND,
  ERROR_MISSION_NO_RANK,
  ERROR_MISSION_RANK_INVALID,
  ERROR_SEVERITY_INVALID
} from '../config/serviceErrors';
import {
  ActivityType,
  canonicalizeActivityType,
  isAutoApprovableType,
  isDestacadoResult,
  isFailureResult,
  isSuccessResult
} from '../domain/activityDomain';

export type { RewardBreakdown, DetailedRewardBreakdown, RewardDetail };

export class RewardCalculatorService {
  private readonly RANK_VALUES: Readonly<Record<string, number>> = {
    D: 1,
    C: 2,
    B: 3,
    A: 4,
    S: 5
  };

  /**
   * Base EXP/PR/Ryou from activity rules only (no newbie, no traits).
   * MANUAL tier or unknown type → null (matches previous {0,0,0} / empty detailed behavior).
   */
  private resolveActivityBaseRewards(
    character: Character & { traits?: any[] },
    activity: ActivityRecord & { narrationKey?: string | null }
  ): RewardBreakdown | null {
    const normalizedType = canonicalizeActivityType(activity.type);
    if (!normalizedType) return null;

    if (normalizedType === ActivityType.MISION) {
      return this.calculateMissionRewards(activity.rank, activity.result);
    }
    if (normalizedType === ActivityType.COMBATE) {
      return this.calculateCombatRewards(character.level, activity.rank, activity.result);
    }
    if (normalizedType === ActivityType.CURACION) {
      return this.calculateCuracionRewards(activity.rank);
    }
    if (normalizedType === ActivityType.DESARROLLO_PERSONAL) {
      return this.calculateDesarrolloPersonalRewards(character.level);
    }
    if (normalizedType === ActivityType.CRONICA) {
      return this.calculateCronicaRewards(activity.result, activity.narrationKey);
    }
    if (normalizedType === ActivityType.EVENTO) {
      return this.calculateEventoRewards(activity.result, activity.narrationKey);
    }
    if (normalizedType === ActivityType.LOGRO_GENERAL) {
      return this.calculateLogroGeneralRewards(activity.narrationKey);
    }
    if (normalizedType === ActivityType.LOGRO_REPUTACION) {
      return this.calculateLogroReputacionRewards(activity.narrationKey);
    }
    if (normalizedType === ActivityType.BALANCE_GENERAL) {
      return this.calculateBalanceGeneralRewards(activity.narrationKey);
    }
    return null;
  }

  /**
   * Novato: multiplica EXP/PR base antes de rasgos; flags indican si entró la rama (misma semántica que antes).
   */
  private applyNewbieBoostLayer(
    character: Character,
    base: RewardBreakdown
  ): {
    mockForTraits: RewardBreakdown;
    newbieExpActive: boolean;
    newbiePrActive: boolean;
  } {
    let boostedExp = base.exp;
    let boostedPr = base.pr;
    let newbieExpActive = false;
    let newbiePrActive = false;

    if (NEWBIE_BOOST_CONFIG.enabled && NEWBIE_BOOST_CONFIG.isEligibleForReward(character.level)) {
      if (character.exp < NEWBIE_BOOST_CONFIG.maxExp && base.exp > 0) {
        boostedExp = Math.floor(base.exp * NEWBIE_BOOST_CONFIG.multiplier);
        newbieExpActive = true;
      }
      if (character.pr < NEWBIE_BOOST_CONFIG.maxPr && base.pr > 0) {
        boostedPr = Math.floor(base.pr * NEWBIE_BOOST_CONFIG.multiplier);
        newbiePrActive = true;
      }
    }

    return {
      mockForTraits: { ...base, exp: boostedExp, pr: boostedPr },
      newbieExpActive,
      newbiePrActive
    };
  }

  /** Bono novato → multiplicadores de rasgo → ajuste de desglose para embed/auditoría. */
  private buildDetailedFromBaseRewards(
    character: Character & { traits?: any[] },
    baseRewards: RewardBreakdown,
    traits: any[]
  ): DetailedRewardBreakdown {
    const { mockForTraits, newbieExpActive, newbiePrActive } = this.applyNewbieBoostLayer(character, baseRewards);
    const details = this.applyTraitMultipliersWithDetails(mockForTraits, traits);

    if (newbieExpActive) {
      const newbieBonusAmount = mockForTraits.exp - baseRewards.exp;
      details.exp.bonus += newbieBonusAmount;
      details.exp.base = baseRewards.exp;
      details.exp.source = details.exp.source ? `${BONUS_NEWBIE}, ${details.exp.source}` : BONUS_NEWBIE;
    }

    if (newbiePrActive) {
      const newbieBonusAmount = mockForTraits.pr - baseRewards.pr;
      details.pr.bonus += newbieBonusAmount;
      details.pr.base = baseRewards.pr;
      details.pr.source = details.pr.source ? `${BONUS_NEWBIE}, ${details.pr.source}` : BONUS_NEWBIE;
    }

    return details;
  }

  public calculateRewards(
    character: Character & { traits?: any[] },
    activity: ActivityRecord & { narrationKey?: string | null }
  ): RewardBreakdown {
    const baseRewards = this.resolveActivityBaseRewards(character, activity);
    if (!baseRewards) {
      return { exp: 0, pr: 0, ryou: 0 };
    }

    const { mockForTraits } = this.applyNewbieBoostLayer(character, baseRewards);
    return this.applyTraitMultipliers(mockForTraits, character.traits ?? []);
  }

  /**
   * Like calculateRewards but returns per-resource breakdown (base, bonus, total, source) for embed display.
   */
  public calculateDetailedRewards(
    character: Character & { traits?: any[] },
    activity: ActivityRecord & { narrationKey?: string | null }
  ): DetailedRewardBreakdown {
    const baseRewards = this.resolveActivityBaseRewards(character, activity);
    if (!baseRewards) {
      return {
        exp: { base: 0, bonus: 0, total: 0 },
        pr: { base: 0, bonus: 0, total: 0 },
        ryou: { base: 0, bonus: 0, total: 0 }
      };
    }
    return this.buildDetailedFromBaseRewards(character, baseRewards, character.traits ?? []);
  }

  /**
   * Apply trait multipliers to user-claimed rewards (Escena, Timeskip, etc.).
   * Treats claimed values as base; returns DetailedRewardBreakdown for display/approval.
   */
  public applyTraitsToClaimedRewards(
    character: Character & { traits?: any[] },
    claimed: {
      exp?: number | null;
      pr?: number | null;
      ryou?: number | null;
      rc?: number | null;
      cupos?: number | null;
      bts?: number | null;
    }
  ): DetailedRewardBreakdown {
    const base: RewardBreakdown = {
      exp: claimed.exp ?? 0,
      pr: claimed.pr ?? 0,
      ryou: claimed.ryou ?? 0
    };
    if ((claimed.rc ?? 0) > 0) base.rc = claimed.rc!;
    if ((claimed.cupos ?? 0) > 0) base.cupos = claimed.cupos!;
    if ((claimed.bts ?? 0) > 0) base.bts = claimed.bts!;

    return this.buildDetailedFromBaseRewards(character, base, character.traits ?? []);
  }

  /**
   * Check if an activity type is auto-approvable.
   */
  public isAutoApprovable(type: string | null | undefined): boolean {
    return isAutoApprovableType(type);
  }

  private calculateMissionRewards(rank: string | null, result: string | null | undefined): RewardBreakdown {
    if (!rank) {
      throw new Error(ERROR_MISSION_NO_RANK);
    }

    const normalizedRank = rank.toUpperCase();
    const rankReward = MISSION_REWARDS[normalizedRank];
    if (!rankReward) {
      throw new Error(ERROR_MISSION_RANK_INVALID(rank));
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
      throw new Error(ERROR_COMBAT_NO_ENEMY_RANK);
    }

    const myRankLetter = characterLevel.charAt(0).toUpperCase();
    const myRankValue = this.RANK_VALUES[myRankLetter];
    if (!myRankValue) {
      throw new Error(ERROR_CHARACTER_LEVEL_INVALID(characterLevel));
    }

    const enemyRankLetter = enemyRank.toUpperCase();
    const enemyRankValue = this.RANK_VALUES[enemyRankLetter];
    if (!enemyRankValue) {
      throw new Error(ERROR_ENEMY_RANK_INVALID(enemyRank));
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
      throw new Error(ERROR_CURACION_NO_SEVERITY);
    }

    const pr = CURACION_PR_BY_SEVERITY[severidad];
    if (pr === undefined) {
      throw new Error(ERROR_SEVERITY_INVALID(severidad));
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
      throw new Error(ERROR_LEVEL_INVALID_DESARROLLO(characterLevel));
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
    const standard = STANDARD_NARRATION_REWARDS[ActivityType.CRONICA];
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
    const standard = STANDARD_NARRATION_REWARDS[ActivityType.EVENTO];
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
      throw new Error(ERROR_LOGRO_GENERAL_NOT_FOUND);
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
      throw new Error(ERROR_LOGRO_REPUTACION_NOT_FOUND);
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
   * 🧬 Aplicar multiplicadores de rasgos a las recompensas de actividad.
   * Rounding: < 0.5 stays, >= 0.5 goes up (e.g. 1.4→1, 4.5→5).
   */
  private applyTraitMultipliers(
    rewards: RewardBreakdown,
    traits: any[]
  ): RewardBreakdown {
    const detailed = this.applyTraitMultipliersWithDetails(rewards, traits);
    return {
      exp: detailed.exp.total,
      pr: detailed.pr.total,
      ryou: detailed.ryou.total,
      ...(detailed.rc !== undefined && detailed.rc > 0 ? { rc: detailed.rc } : {}),
      ...(detailed.cupos !== undefined && detailed.cupos > 0 ? { cupos: detailed.cupos } : {})
    };
  }

  /**
   * Returns per-resource breakdown with base, bonus (trait contribution), total, and source trait name(s).
   */
  private applyTraitMultipliersWithDetails(
    rewards: RewardBreakdown,
    traits: any[]
  ): DetailedRewardBreakdown {
    let expMultiplier = 1.0;
    let prMultiplier = 1.0;
    const expSources: string[] = [];
    const prSources: string[] = [];

    for (const traitRecord of traits) {
      const trait = traitRecord.trait || traitRecord;
      const name = trait.name as string | undefined;

      if (trait.mechanics && typeof trait.mechanics === 'object' && !Array.isArray(trait.mechanics)) {
        const mech = trait.mechanics as Record<string, unknown>;

        if (mech.expMultiplier && typeof mech.expMultiplier === 'number') {
          expMultiplier *= mech.expMultiplier;
          if (name) expSources.push(name);
        }

        if (mech.prMultiplier && typeof mech.prMultiplier === 'number') {
          prMultiplier *= mech.prMultiplier;
          if (name) prSources.push(name);
        }
      }
    }

    const expTotal = roundHalfUp(rewards.exp * expMultiplier);
    const prTotal = roundHalfUp(rewards.pr * prMultiplier);
    const expBonus = expTotal - rewards.exp;
    const prBonus = prTotal - rewards.pr;

    return {
      exp: {
        base: rewards.exp,
        bonus: expBonus,
        total: expTotal,
        ...(expSources.length > 0 ? { source: expSources.join(', ') } : {})
      },
      pr: {
        base: rewards.pr,
        bonus: prBonus,
        total: prTotal,
        ...(prSources.length > 0 ? { source: prSources.join(', ') } : {})
      },
      ryou: {
        base: rewards.ryou,
        bonus: 0,
        total: rewards.ryou
      },
      ...(rewards.rc !== undefined && rewards.rc > 0 ? { rc: rewards.rc } : {}),
      ...(rewards.cupos !== undefined && rewards.cupos > 0 ? { cupos: rewards.cupos } : {}),
      ...(rewards.bts !== undefined && rewards.bts > 0 ? { bts: rewards.bts } : {})
    };
  }
}
