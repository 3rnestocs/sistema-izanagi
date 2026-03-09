import { Character, ActivityRecord } from '@prisma/client';

export interface RewardBreakdown {
  exp: number;
  pr: number;
  ryou: number;
}

export class RewardCalculatorService {
  private readonly RANK_VALUES: Readonly<Record<string, number>> = {
    D: 1,
    C: 2,
    B: 3,
    A: 4,
    S: 5
  };

  private readonly MISSION_REWARDS: Readonly<Record<string, RewardBreakdown>> = {
    D: { exp: 7, pr: 20, ryou: 700 },
    C: { exp: 7, pr: 20, ryou: 700 },
    B: { exp: 15, pr: 45, ryou: 1500 },
    A: { exp: 30, pr: 100, ryou: 7000 },
    S: { exp: 60, pr: 200, ryou: 100000 }
  };

  private readonly COMBAT_PR_REWARD: Readonly<Record<string, number>> = {
    C: 5,
    B: 10,
    A: 20,
    S: 30
  };

  public calculateRewards(
    character: Character & { traits?: any[] },
    activity: ActivityRecord
  ): RewardBreakdown {
    const normalizedType = activity.type.trim();
    const normalizedResult = activity.result?.trim().toUpperCase();

    let baseRewards: RewardBreakdown;

    if (normalizedType === 'Misión') {
      baseRewards = this.calculateMissionRewards(activity.rank, normalizedResult);
    } else if (normalizedType === 'Combate') {
      baseRewards = this.calculateCombatRewards(character.level, activity.rank, normalizedResult);
    } else {
      return { exp: 0, pr: 0, ryou: 0 };
    }

    // Apply trait multipliers if character has traits
    return this.applyTraitMultipliers(baseRewards, character.traits ?? []);
  }

  private calculateMissionRewards(rank: string | null, result: string | undefined): RewardBreakdown {
    if (!rank) {
      throw new Error('⛔ La misión no tiene rango definido.');
    }

    const normalizedRank = rank.toUpperCase();
    const rankReward = this.MISSION_REWARDS[normalizedRank];
    if (!rankReward) {
      throw new Error(`⛔ El rango de misión '${rank}' no es válido para recompensas.`);
    }

    const isSuccess = result === 'EXITOSA' || result === 'VICTORIA';
    if (!isSuccess) {
      return { exp: rankReward.exp, pr: 0, ryou: 0 };
    }

    return rankReward;
  }

  private calculateCombatRewards(
    characterLevel: string,
    enemyRank: string | null,
    result: string | undefined
  ): RewardBreakdown {
    if (result === 'FALLIDA' || result === 'DERROTA') {
      return { exp: 1, pr: 0, ryou: 0 };
    }

    const isVictory = result === 'EXITOSA' || result === 'VICTORIA';
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

    const pr = this.COMBAT_PR_REWARD[enemyRankLetter] ?? 0;
    return { exp, pr, ryou: 0 };
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
      ryou: Math.floor(rewards.ryou * ryouMultiplier)
    };
  }
