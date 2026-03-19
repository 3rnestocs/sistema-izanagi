/**
 * Bono de Novatos: multiplicador de EXP/PR y bypass de tiempo de espera.
 * Techos configurables vía .env. Usa StatValidatorService como SSOT de progresión.
 */
import { StatValidatorService } from '../services/StatValidatorService';
import type { InternalLevel } from '../services/StatValidatorService';

const levelOrder = Object.keys(StatValidatorService.getLevelExpRequirements()) as InternalLevel[];
const rankOrder = [...new Set(levelOrder.map((l) => l.charAt(0)))];

export const NEWBIE_BOOST_CONFIG = {
  enabled: (process.env.ENABLE_NEWBIE_BOOST ?? 'false').toLowerCase() === 'true',
  multiplier: parseFloat(process.env.NEWBIE_BOOST_MULTIPLIER ?? '2.5'),
  maxExp: parseInt(process.env.NEWBIE_BOOST_MAX_EXP ?? '250', 10),
  maxPr: parseInt(process.env.NEWBIE_BOOST_MAX_PR ?? '500', 10),
  rewardMaxRank: (process.env.NEWBIE_BOOST_REWARD_MAX_RANK ?? 'C').toUpperCase(),
  timeBypassMaxLevel: (process.env.NEWBIE_BOOST_TIME_MAX_LEVEL ?? 'B1').toUpperCase(),

  /** Si el rango actual del personaje recibe el bono de EXP/PR. */
  isEligibleForReward: (characterLevel: string) => {
    const rankLetter = characterLevel.charAt(0).toUpperCase();
    const characterRankIndex = rankOrder.indexOf(rankLetter);
    const maxRankIndex = rankOrder.indexOf(NEWBIE_BOOST_CONFIG.rewardMaxRank);
    return characterRankIndex !== -1 && characterRankIndex <= maxRankIndex;
  },

  /** Si el nivel al que intenta ascender puede omitir días de espera. */
  canBypassTimeRequirement: (targetLevel: string) => {
    const targetIndex = levelOrder.indexOf(targetLevel as InternalLevel);
    const maxLevelIndex = levelOrder.indexOf(NEWBIE_BOOST_CONFIG.timeBypassMaxLevel as InternalLevel);
    return targetIndex !== -1 && targetIndex <= maxLevelIndex;
  }
};
