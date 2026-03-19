import { PrismaClient } from '@prisma/client';
import { AUDIT_LOG_CATEGORY } from '../config/auditLogCategories';
import { EVIDENCE } from '../config/evidenceStrings';
import { NEWBIE_BOOST_CONFIG } from '../config/newbieBoost';
import { AUDIT_ASCENSO_DETAIL, AUDIT_SALARY_SIMPLE, AUDIT_SALARY_WITH_MULTIPLIER } from '../config/auditDetailTemplates';
import { RANK_DISPLAY_NAMES, SANNIN_DISCOUNT_TARGETS } from '../config/rankConfig';
import {
  ERROR_ASCENSO_INSUFFICIENT_REQUIREMENTS,
  ERROR_ASCENSO_REJECTED,
  ERROR_ASCENSO_TARGET_UNRECOGNIZED,
  ERROR_ACTION_PROHIBIDA_CHARACTER_NOT_FOUND,
  ERROR_CHARACTER_NOT_FOUND,
  ERROR_LEVEL_INVALID_GRADATION,
  ERROR_LEVEL_NOT_CONFIGURED,
  ERROR_LEVEL_NO_EXP_CONFIG,
  ERROR_RANK_NOT_CONFIGURED,
  ERROR_SALARY_ALREADY_CLAIMED
} from '../config/serviceErrors';
import { OPTIONAL_REQUIREMENTS } from '../config/requirements';
import {
  ERROR_EXP_INSUFFICIENT,
  ERROR_PR_INSUFFICIENT,
  REASON_MANUAL_REQUIREMENTS,
  REQ_CLAN_CONSENT,
  REQ_CLAN_VALIDATE_3,
  REQ_COMBAT_WINS_A_S_S1,
  REQ_DAYS_A_FOR_S1,
  REQ_DAYS_B_FOR_A1,
  REQ_DAYS_C_FOR_B1,
  REQ_DAYS_D_FOR_C1,
  REQ_DAYS_PREV_GRADATION,
  REQ_DAYS_S_FOR_S2,
  REQ_HIGHLIGHTS_S1,
  REQ_JOUNIN_CONSENT,
  REQ_KAGE_CONSENTS,
  REQ_LEVEL_A_OR_HIGHER,
  REQ_LEVEL_B_OR_HIGHER,
  REQ_LEVEL_S,
  REQ_MANUAL_PR_300_GRADACION,
  REQ_MISSION_A_S_SUCCESS_2,
  REQ_MISSION_A_SUCCESS_1,
  REQ_MISSION_B_1,
  REQ_MISSION_S_SUCCESS_1,
  REQ_NARRATIONS_S1,
  REQ_NO_GRADATION_HISTORY,
  REQ_NO_GRADATION_HISTORY_DAYS,
  REQ_OPTIONAL_A1,
  REQ_OPTIONAL_A2A3,
  REQ_OPTIONAL_B1,
  REQ_OPTIONAL_B2B3,
  REQ_OPTIONAL_C1,
  REQ_OPTIONAL_C2C3,
  REQ_OPTIONAL_S2,
  REQ_PR_A1,
  REQ_PR_B1,
  REQ_PR_S1,
  REQ_RANK_ANBU,
  REQ_RANK_JOUNIN,
  REQ_S1_MISSIONS,
  REQ_S_TRACEABLE,
  REQ_TWO_JUMPS_VALIDATION
} from '../config/requirementMessages';
import { BASE_SALARIES, SALARY_COOLDOWN_DAYS } from '../config/salaryConfig';
import { StatValidatorService } from './StatValidatorService';
import {
  ActivityStatus,
  ActivityType,
  canonicalizeActivityStatus,
  canonicalizeActivityType,
  isDestacadoResult,
  isSuccessResult
} from '../domain/activityDomain';

export interface OptionalRequirement {
  id: string;
  description: string;
  status: 'COMPLETADO' | 'PARCIAL' | 'SIN PROGRESO';
  current?: number;
  required?: number;
}

export interface RequirementCheck {
  passed: boolean;
  promotionState?: 'APPROVED' | 'PENDING_STAFF' | 'BLOCKED';
  reason?: string;
  missingRequirements?: string[];
  manualRequirements?: string[];
  optionalRequirements?: OptionalRequirement[];
  snapshot: {
    exp: number;
    pr: number;
    level: string;
    rank: string;
    missionD: number;
    missionC: number;
    missionB: number;
    missionA: number;
    missionS: number;
    missionASuccess: number;
    missionSSuccess: number;
    missionSAnyResult: number;
    narrations: number;
    highlightedNarrations: number;
    combats: number;
    combatsVsCOrHigher: number;
    combatsVsBOrHigher: number;
    combatsVsAOrHigher: number;
    combatWinsVsAOrHigher: number;
    combatWinsVsBOrHigher: number;
    achievements: number;
  };
}

export class LevelUpService {
  constructor(private prisma: PrismaClient) {}

  private readonly APPROVED_STATUSES = new Set<string>([ActivityStatus.APROBADO, ActivityStatus.AUTO_APROBADO]);
  private readonly NARRATION_TYPES = new Set<string>([ActivityType.EVENTO, ActivityType.CRONICA, ActivityType.ESCENA]);
  private readonly ACHIEVEMENT_TYPES = new Set<string>([ActivityType.LOGRO_GENERAL, ActivityType.LOGRO_SAGA]);

  private readonly LEVEL_EXP_REQUIREMENTS: Readonly<Record<string, number>> = StatValidatorService.getLevelExpRequirements();

  private normalizeTarget(target: string): string {
    return target
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '_');
  }

  private isInternalLevel(target: string): boolean {
    return /^[DCBAS][123]$/.test(target) || target === 'S2';
  }

  private isMissionType(type: string): boolean {
    return canonicalizeActivityType(type) === ActivityType.MISION;
  }

  private isCombatType(type: string): boolean {
    return canonicalizeActivityType(type) === ActivityType.COMBATE;
  }

  private isVictory(result: string | null): boolean {
    return isSuccessResult(result);
  }

  private isHighlighted(result: string | null): boolean {
    return isDestacadoResult(result);
  }

  private isLevelAtLeast(level: string, minRankLetter: 'A' | 'B' | 'C' | 'S'): boolean {
    const levelRankLetter = level.charAt(0).toUpperCase();
    const order: Record<string, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 };
    const currentLevelValue = order[levelRankLetter] ?? 0;
    const minimumLevelValue = order[minRankLetter] ?? 0;
    return currentLevelValue >= minimumLevelValue;
  }

  private hasSanninTitle(title: string | null): boolean {
    if (!title) {
      return false;
    }

    return title.toLowerCase().includes('sannin');
  }

  private applySanninDiscount(targetRank: string, baseValue: number, hasSannin: boolean): number {
    if (!hasSannin || !SANNIN_DISCOUNT_TARGETS.has(targetRank)) {
      return baseValue;
    }

    return Math.ceil(baseValue * 0.5);
  }

  private countMissionEquivalentForB(missionB: number, missionA: number): number {
    return missionB + (missionA * 2);
  }

  /**
   * Returns the date when the character reached the given level.
   * D1 uses Character.createdAt; D2+ use GradationHistory.
   */
  private async getAchievedAt(
    characterId: string,
    level: string,
    characterCreatedAt: Date
  ): Promise<Date | null> {
    if (level === 'D1') {
      return characterCreatedAt;
    }
    const entry = await this.prisma.gradationHistory.findUnique({
      where: { characterId_level: { characterId, level } }
    });
    return entry?.achievedAt ?? null;
  }

  /**
   * Calendar days between two dates (truncated to UTC midnight).
   */
  private calendarDaysBetween(from: Date, to: Date): number {
    const fromDay = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const toDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    return Math.floor((toDay.getTime() - fromDay.getTime()) / 86400000);
  }

  private buildFailure(
    snapshot: RequirementCheck['snapshot'],
    missingRequirements: string[],
    manualRequirements: string[],
    optionalRequirements: OptionalRequirement[] = []
  ): RequirementCheck {
    const promotionState: 'BLOCKED' | 'PENDING_STAFF' = missingRequirements.length > 0 ? 'BLOCKED' : 'PENDING_STAFF';
    const firstMissing = missingRequirements[0];
    if (firstMissing) {
      return {
        passed: false,
        promotionState,
        reason: firstMissing,
        missingRequirements,
        manualRequirements,
        optionalRequirements,
        snapshot
      };
    }

    return {
      passed: false,
      promotionState,
        reason: REASON_MANUAL_REQUIREMENTS,
      manualRequirements,
      optionalRequirements,
      snapshot
    };
  }

  private buildMetrics(
    activities: Array<{ type: string; rank: string | null; result: string | null; status: string }>
  ) {
    const approved = activities.filter((activity) => {
      const normalizedStatus = canonicalizeActivityStatus(activity.status);
      return normalizedStatus ? this.APPROVED_STATUSES.has(normalizedStatus) : false;
    });

    const missionD = approved.filter((activity) => this.isMissionType(activity.type) && activity.rank?.toUpperCase() === 'D').length;
    const missionC = approved.filter((activity) => this.isMissionType(activity.type) && activity.rank?.toUpperCase() === 'C').length;
    const missionB = approved.filter((activity) => this.isMissionType(activity.type) && activity.rank?.toUpperCase() === 'B').length;
    const missionA = approved.filter((activity) => this.isMissionType(activity.type) && activity.rank?.toUpperCase() === 'A').length;
    const missionS = approved.filter((activity) => this.isMissionType(activity.type) && activity.rank?.toUpperCase() === 'S').length;

    const missionASuccess = approved.filter(
      (activity) => this.isMissionType(activity.type) && activity.rank?.toUpperCase() === 'A' && this.isVictory(activity.result)
    ).length;

    const missionSSuccess = approved.filter(
      (activity) => this.isMissionType(activity.type) && activity.rank?.toUpperCase() === 'S' && this.isVictory(activity.result)
    ).length;

    const missionSAnyResult = missionS;

    const narrations = approved.filter((activity) => {
      const type = canonicalizeActivityType(activity.type);
      return type ? this.NARRATION_TYPES.has(type) : false;
    }).length;
    const highlightedNarrations = approved.filter(
      (activity) => {
        const type = canonicalizeActivityType(activity.type);
        return type ? this.NARRATION_TYPES.has(type) && this.isHighlighted(activity.result) : false;
      }
    ).length;

    const combats = approved.filter((activity) => this.isCombatType(activity.type)).length;

    const combatsVsCOrHigher = approved.filter((activity) => {
      if (!this.isCombatType(activity.type)) {
        return false;
      }
      const rank = activity.rank?.toUpperCase();
      return rank === 'C' || rank === 'B' || rank === 'A' || rank === 'S';
    }).length;

    const combatsVsBOrHigher = approved.filter((activity) => {
      if (!this.isCombatType(activity.type)) {
        return false;
      }
      const rank = activity.rank?.toUpperCase();
      return rank === 'B' || rank === 'A' || rank === 'S';
    }).length;

    const combatsVsAOrHigher = approved.filter((activity) => {
      if (!this.isCombatType(activity.type)) {
        return false;
      }
      const rank = activity.rank?.toUpperCase();
      return rank === 'A' || rank === 'S';
    }).length;

    const combatWinsVsAOrHigher = approved.filter((activity) => {
      if (!this.isCombatType(activity.type) || !this.isVictory(activity.result)) {
        return false;
      }
      const rank = activity.rank?.toUpperCase();
      return rank === 'A' || rank === 'S';
    }).length;

    const combatWinsVsBOrHigher = approved.filter((activity) => {
      if (!this.isCombatType(activity.type) || !this.isVictory(activity.result)) {
        return false;
      }
      const rank = activity.rank?.toUpperCase();
      return rank === 'B' || rank === 'A' || rank === 'S';
    }).length;

    const achievements = approved.filter((activity) => {
      const type = canonicalizeActivityType(activity.type);
      return type ? this.ACHIEVEMENT_TYPES.has(type) : false;
    }).length;

    return {
      missionD,
      missionC,
      missionB,
      missionA,
      missionS,
      missionASuccess,
      missionSSuccess,
      missionSAnyResult,
      narrations,
      highlightedNarrations,
      combats,
      combatsVsCOrHigher,
      combatsVsBOrHigher,
      combatsVsAOrHigher,
      combatWinsVsAOrHigher,
      combatWinsVsBOrHigher,
      achievements
    };
  }

  async checkRankRequirements(
    characterId: string,
    targetRankOrLevel: string,
    referenceDate?: Date
  ): Promise<RequirementCheck> {
    const normalizedTarget = this.normalizeTarget(targetRankOrLevel);
    if (this.isInternalLevel(normalizedTarget)) {
      return this.checkLevelRequirements(characterId, normalizedTarget, referenceDate);
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, exp: true, pr: true, level: true, rank: true, title: true }
    });

    if (!character) {
      throw new Error(ERROR_CHARACTER_NOT_FOUND);
    }

    const activities = await this.prisma.activityRecord.findMany({
      where: { characterId },
      select: { type: true, rank: true, result: true, status: true }
    });

    const metrics = this.buildMetrics(activities);
    const hasSannin = this.hasSanninTitle(character.title);

    const snapshot: RequirementCheck['snapshot'] = {
      exp: character.exp,
      pr: character.pr,
      level: character.level,
      rank: character.rank,
      ...metrics
    };

    const missingRequirements: string[] = [];
    const manualRequirements: string[] = [];

    switch (normalizedTarget) {
      case 'CHUUNIN': {
        const requiredExp = 120;
        const requiredPr = 400;

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if ((metrics.missionB + metrics.missionA + metrics.missionS) < 1) {
          missingRequirements.push(REQ_MISSION_B_1);
        }
        break;
      }
      case 'TOKUBETSU_JOUNIN': {
        const requiredExp = 220;
        const requiredPr = 700;

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if ((metrics.missionASuccess + metrics.missionSSuccess) < 1) {
          missingRequirements.push(REQ_MISSION_A_SUCCESS_1);
        }
        break;
      }
      case 'JOUNIN': {
        const requiredExp = this.applySanninDiscount('JOUNIN', 300, hasSannin);
        const requiredPr = this.applySanninDiscount('JOUNIN', 1100, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if ((metrics.missionASuccess + metrics.missionSSuccess) < 2) {
          missingRequirements.push(REQ_MISSION_A_S_SUCCESS_2(metrics.missionASuccess + metrics.missionSSuccess));
        }

        manualRequirements.push(REQ_JOUNIN_CONSENT);
        break;
      }
      case 'ANBU': {
        const requiredExp = 320;
        const requiredPr = 1200;

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if (!this.isLevelAtLeast(character.level, 'A')) {
          missingRequirements.push(REQ_LEVEL_A_OR_HIGHER(character.level));
        }
        break;
      }
      case 'BUNTAICHOO': {
        const requiredExp = 350;
        const requiredPr = 1400;

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if (character.rank !== 'ANBU') {
          missingRequirements.push(REQ_RANK_ANBU(character.rank));
        }
        if (metrics.missionSSuccess < 1) {
          missingRequirements.push(REQ_MISSION_S_SUCCESS_1);
        }
        break;
      }
      case 'JOUNIN_HANCHOU': {
        const requiredExp = this.applySanninDiscount('JOUNIN_HANCHOU', 350, hasSannin);
        const requiredPr = this.applySanninDiscount('JOUNIN_HANCHOU', 1400, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if (character.rank !== 'Jounin') {
          missingRequirements.push(REQ_RANK_JOUNIN(character.rank));
        }
        if (metrics.missionSSuccess < 1) {
          missingRequirements.push(REQ_MISSION_S_SUCCESS_1);
        }
        break;
      }
      case 'GO_IKENBAN': {
        const requiredExp = this.applySanninDiscount('GO_IKENBAN', 380, hasSannin);
        const requiredPr = this.applySanninDiscount('GO_IKENBAN', 1600, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if (metrics.missionSAnyResult < 1 && metrics.combatWinsVsAOrHigher < 1) {
          missingRequirements.push(REQ_S_TRACEABLE);
        }

        manualRequirements.push(REQ_TWO_JUMPS_VALIDATION);
        break;
      }
      case 'KAGE': {
        const requiredExp = 350;
        const requiredPr = 1800;

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if (!this.isLevelAtLeast(character.level, 'S')) {
          missingRequirements.push(REQ_LEVEL_S(character.level));
        }

        manualRequirements.push(REQ_KAGE_CONSENTS);
        break;
      }
      case 'LIDER_DE_CLAN': {
        const requiredExp = this.applySanninDiscount('LIDER_DE_CLAN', 270, hasSannin);
        const requiredPr = this.applySanninDiscount('LIDER_DE_CLAN', 900, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(ERROR_PR_INSUFFICIENT(character.pr, requiredPr));
        }
        if (!this.isLevelAtLeast(character.level, 'B')) {
          missingRequirements.push(REQ_LEVEL_B_OR_HIGHER(character.level));
        }

        manualRequirements.push(REQ_CLAN_CONSENT);
        manualRequirements.push(REQ_CLAN_VALIDATE_3);
        break;
      }
      default:
        throw new Error(ERROR_RANK_NOT_CONFIGURED(targetRankOrLevel));
    }

    if (missingRequirements.length > 0 || manualRequirements.length > 0) {
      return this.buildFailure(snapshot, missingRequirements, manualRequirements, []);
    }

    return { passed: true, promotionState: 'APPROVED' as const, snapshot };
  }

  async checkLevelRequirements(
    characterId: string,
    targetLevel: string,
    referenceDate?: Date
  ): Promise<RequirementCheck> {
    const refDate = referenceDate ?? new Date();
    const normalizedTargetLevel = this.normalizeTarget(targetLevel);
    if (!this.isInternalLevel(normalizedTargetLevel)) {
      throw new Error(ERROR_LEVEL_INVALID_GRADATION(targetLevel));
    }

    const requiredExp = this.LEVEL_EXP_REQUIREMENTS[normalizedTargetLevel];
    if (requiredExp === undefined) {
      throw new Error(ERROR_LEVEL_NO_EXP_CONFIG(targetLevel));
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, exp: true, pr: true, level: true, rank: true, title: true, createdAt: true }
    });

    if (!character) {
      throw new Error(ERROR_ACTION_PROHIBIDA_CHARACTER_NOT_FOUND);
    }

    const activities = await this.prisma.activityRecord.findMany({
      where: { characterId },
      select: { type: true, rank: true, result: true, status: true }
    });

    const metrics = this.buildMetrics(activities);
    const snapshot: RequirementCheck['snapshot'] = {
      exp: character.exp,
      pr: character.pr,
      level: character.level,
      rank: character.rank,
      ...metrics
    };

    const missingRequirements: string[] = [];
    const manualRequirements: string[] = [];
    let optionalRequirements: OptionalRequirement[] = [];

    if (character.exp < requiredExp) {
      missingRequirements.push(ERROR_EXP_INSUFFICIENT(character.exp, requiredExp));
    }

    const toStatus = (current: number, required: number): 'COMPLETADO' | 'PARCIAL' | 'SIN PROGRESO' =>
      current >= required ? 'COMPLETADO' : current > 0 ? 'PARCIAL' : 'SIN PROGRESO';

    const skipTimeGate = NEWBIE_BOOST_CONFIG.enabled && NEWBIE_BOOST_CONFIG.canBypassTimeRequirement(normalizedTargetLevel);

    switch (normalizedTargetLevel) {
      case 'D2':
      case 'D3':
        break;

      case 'C1': {
        const refDateC1 = await this.getAchievedAt(characterId, 'D1', character.createdAt);
        if (!refDateC1) {
          manualRequirements.push(REQ_NO_GRADATION_HISTORY);
        } else if (!skipTimeGate) {
          const daysSinceD = this.calendarDaysBetween(refDateC1, refDate);
          if (daysSinceD < 5) {
            missingRequirements.push(REQ_DAYS_D_FOR_C1(daysSinceD));
          }
        }

        optionalRequirements = [
          { id: OPTIONAL_REQUIREMENTS.NARRATION_1, description: '1 narración', status: toStatus(metrics.narrations, 1), current: metrics.narrations, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.COMBAT_1, description: '1 combate', status: toStatus(metrics.combats, 1), current: metrics.combats, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.MISSION_D_2, description: '2 misiones D', status: toStatus(metrics.missionD, 2), current: metrics.missionD, required: 2 },
          { id: OPTIONAL_REQUIREMENTS.ACHIEVEMENTS_2, description: '2 logros', status: toStatus(metrics.achievements, 2), current: metrics.achievements, required: 2 }
        ];

        const optionalMet = [
          metrics.narrations >= 1,
          metrics.combats >= 1,
          metrics.missionD >= 2,
          metrics.achievements >= 2
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push(REQ_OPTIONAL_C1);
        }
        break;
      }

      case 'C2':
      case 'C3': {
        const refLevelC2C3 = normalizedTargetLevel === 'C2' ? 'C1' : 'C2';
        const refDateC2C3 = await this.getAchievedAt(characterId, refLevelC2C3, character.createdAt);
        if (!refDateC2C3) {
          manualRequirements.push(REQ_NO_GRADATION_HISTORY_DAYS);
        } else if (!skipTimeGate) {
          const daysRequiredC2C3 = 2;
          const daysSince = this.calendarDaysBetween(refDateC2C3, refDate);
          if (daysSince < daysRequiredC2C3) {
            missingRequirements.push(REQ_DAYS_PREV_GRADATION(normalizedTargetLevel, daysRequiredC2C3, daysSince));
          }
        }

        optionalRequirements = [
          { id: OPTIONAL_REQUIREMENTS.NARRATION_1, description: '1 narración', status: toStatus(metrics.narrations, 1), current: metrics.narrations, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.HIGHLIGHT_1, description: '1 destacado', status: toStatus(metrics.highlightedNarrations, 1), current: metrics.highlightedNarrations, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.ACHIEVEMENT_1, description: '1 logro', status: toStatus(metrics.achievements, 1), current: metrics.achievements, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.COMBAT_1, description: '1 combate', status: toStatus(metrics.combats, 1), current: metrics.combats, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.MISSION_C_1, description: '1 misión C', status: toStatus(metrics.missionC, 1), current: metrics.missionC, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.CURE_2, description: 'Curar a 2 personajes', status: 'SIN PROGRESO' as const, current: 0, required: 2 }
        ];

        const optionalMet = [
          metrics.narrations >= 1,
          metrics.highlightedNarrations >= 1,
          metrics.achievements >= 1,
          metrics.combats >= 1,
          metrics.missionC >= 1,
          false // Curar a 2 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push(REQ_OPTIONAL_C2C3);
        }
        break;
      }

      case 'B1': {
        const refDateB1 = await this.getAchievedAt(characterId, 'C1', character.createdAt);
        if (!refDateB1) {
          manualRequirements.push(REQ_NO_GRADATION_HISTORY_DAYS);
        } else if (!skipTimeGate) {
          const daysSinceC = this.calendarDaysBetween(refDateB1, refDate);
          if (daysSinceC < 8) {
            missingRequirements.push(REQ_DAYS_C_FOR_B1(daysSinceC));
          }
        }

        if (character.pr < 500) {
          missingRequirements.push(REQ_PR_B1(character.pr));
        }

        const missionEquivalentB1 = metrics.missionC + (metrics.missionB * 2) + (metrics.missionA * 2) + (metrics.missionS * 2);
        optionalRequirements = [
          { id: OPTIONAL_REQUIREMENTS.NARRATIONS_3, description: '3 narraciones', status: toStatus(metrics.narrations, 3), current: metrics.narrations, required: 3 },
          { id: OPTIONAL_REQUIREMENTS.HIGHLIGHTS_2, description: '2 destacados', status: toStatus(metrics.highlightedNarrations, 2), current: metrics.highlightedNarrations, required: 2 },
          { id: OPTIONAL_REQUIREMENTS.MISSION_EQUIVALENT_4, description: 'Misiones C ≥ 4 (B cuenta como 2)', status: toStatus(missionEquivalentB1, 4), current: missionEquivalentB1, required: 4 },
          { id: OPTIONAL_REQUIREMENTS.COMBATS_C_PLUS_2, description: '2 combates vs C+', status: toStatus(metrics.combatsVsCOrHigher, 2), current: metrics.combatsVsCOrHigher, required: 2 },
          { id: OPTIONAL_REQUIREMENTS.CURE_5, description: 'Curar a 5 personajes', status: 'SIN PROGRESO' as const, current: 0, required: 5 }
        ];

        const optionalMet = [
          metrics.narrations >= 3,
          metrics.highlightedNarrations >= 2,
          missionEquivalentB1 >= 4,
          metrics.combatsVsCOrHigher >= 2,
          false // Curar a 5 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 3) {
          missingRequirements.push(REQ_OPTIONAL_B1);
        }
        break;
      }

      case 'B2':
      case 'B3': {
        const refLevelB2B3 = normalizedTargetLevel === 'B2' ? 'B1' : 'B2';
        const refDateB2B3 = await this.getAchievedAt(characterId, refLevelB2B3, character.createdAt);
        if (!refDateB2B3) {
          manualRequirements.push(REQ_NO_GRADATION_HISTORY_DAYS);
        } else if (!skipTimeGate) {
          const daysRequiredB2B3 = 3;
          const daysSince = this.calendarDaysBetween(refDateB2B3, refDate);
          if (daysSince < daysRequiredB2B3) {
            missingRequirements.push(REQ_DAYS_PREV_GRADATION(normalizedTargetLevel, daysRequiredB2B3, daysSince));
          }
        }

        const missionEquivalentB2B3 = this.countMissionEquivalentForB(metrics.missionB, metrics.missionA + metrics.missionS);
        optionalRequirements = [
          { id: OPTIONAL_REQUIREMENTS.NARRATION_1, description: '1 narración', status: toStatus(metrics.narrations, 1), current: metrics.narrations, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.HIGHLIGHT_1, description: '1 destacado', status: toStatus(metrics.highlightedNarrations, 1), current: metrics.highlightedNarrations, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.ACHIEVEMENT_1, description: '1 logro', status: toStatus(metrics.achievements, 1), current: metrics.achievements, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.COMBATS_B_PLUS_2, description: '2 combates vs B+', status: toStatus(metrics.combatsVsBOrHigher, 2), current: metrics.combatsVsBOrHigher, required: 2 },
          { id: OPTIONAL_REQUIREMENTS.MISSION_EQUIVALENT_B2B3_1, description: '1 misión B/A', status: toStatus(missionEquivalentB2B3, 1), current: missionEquivalentB2B3, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.CURE_2, description: 'Curar a 2 personajes', status: 'SIN PROGRESO' as const, current: 0, required: 2 }
        ];

        const optionalMet = [
          metrics.narrations >= 1,
          metrics.highlightedNarrations >= 1,
          metrics.achievements >= 1,
          metrics.combatsVsBOrHigher >= 2,
          missionEquivalentB2B3 >= 1,
          false // Curar a 2 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push(REQ_OPTIONAL_B2B3);
        }
        break;
      }

      case 'A1': {
        const refDateA1 = await this.getAchievedAt(characterId, 'B1', character.createdAt);
        if (!refDateA1) {
          manualRequirements.push(REQ_NO_GRADATION_HISTORY_DAYS);
        } else if (!skipTimeGate) {
          const daysSinceB = this.calendarDaysBetween(refDateA1, refDate);
          if (daysSinceB < 14) {
            missingRequirements.push(REQ_DAYS_B_FOR_A1(daysSinceB));
          }
        }

        if (character.pr < 1000) {
          missingRequirements.push(REQ_PR_A1(character.pr));
        }

        const missionEquivalentA1 = this.countMissionEquivalentForB(metrics.missionB, metrics.missionA + metrics.missionS);
        optionalRequirements = [
          { id: OPTIONAL_REQUIREMENTS.NARRATIONS_6, description: '6 narraciones', status: toStatus(metrics.narrations, 6), current: metrics.narrations, required: 6 },
          { id: OPTIONAL_REQUIREMENTS.HIGHLIGHTS_3, description: '3 destacados', status: toStatus(metrics.highlightedNarrations, 3), current: metrics.highlightedNarrations, required: 3 },
          { id: OPTIONAL_REQUIREMENTS.MISSION_EQUIVALENT_A1_5, description: 'Misiones B/A ≥ 5', status: toStatus(missionEquivalentA1, 5), current: missionEquivalentA1, required: 5 },
          { id: OPTIONAL_REQUIREMENTS.COMBAT_WINS_B_PLUS_3, description: '3 victorias vs B+', status: toStatus(metrics.combatWinsVsBOrHigher, 3), current: metrics.combatWinsVsBOrHigher, required: 3 },
          { id: OPTIONAL_REQUIREMENTS.ACHIEVEMENTS_8, description: '8 logros', status: toStatus(metrics.achievements, 8), current: metrics.achievements, required: 8 },
          { id: OPTIONAL_REQUIREMENTS.CURE_10, description: 'Curar a 10 personajes', status: 'SIN PROGRESO' as const, current: 0, required: 10 }
        ];

        const optionalMet = [
          metrics.narrations >= 6,
          metrics.highlightedNarrations >= 3,
          missionEquivalentA1 >= 5,
          metrics.combatWinsVsBOrHigher >= 3,
          metrics.achievements >= 8,
          false // Curar a 10 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 3) {
          missingRequirements.push(REQ_OPTIONAL_A1);
        }
        break;
      }

      case 'A2':
      case 'A3': {
        const refLevelA2A3 = normalizedTargetLevel === 'A2' ? 'A1' : 'A2';
        const refDateA2A3 = await this.getAchievedAt(characterId, refLevelA2A3, character.createdAt);
        if (!refDateA2A3) {
          manualRequirements.push(REQ_NO_GRADATION_HISTORY_DAYS);
        } else if (!skipTimeGate) {
          const daysRequiredA2A3 = 6;
          const daysSince = this.calendarDaysBetween(refDateA2A3, refDate);
          if (daysSince < daysRequiredA2A3) {
            missingRequirements.push(REQ_DAYS_PREV_GRADATION(normalizedTargetLevel, daysRequiredA2A3, daysSince));
          }
        }
        manualRequirements.push(REQ_MANUAL_PR_300_GRADACION);

        const missionEquivalentA2A3 = this.countMissionEquivalentForB(metrics.missionB, metrics.missionA + metrics.missionS);
        optionalRequirements = [
          { id: OPTIONAL_REQUIREMENTS.NARRATION_1, description: '1 narración', status: toStatus(metrics.narrations, 1), current: metrics.narrations, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.HIGHLIGHT_1, description: '1 destacado', status: toStatus(metrics.highlightedNarrations, 1), current: metrics.highlightedNarrations, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.ACHIEVEMENTS_2, description: '2 logros', status: toStatus(metrics.achievements, 2), current: metrics.achievements, required: 2 },
          { id: OPTIONAL_REQUIREMENTS.COMBAT_A_PLUS_1, description: '1 combate vs A+', status: toStatus(metrics.combatsVsAOrHigher, 1), current: metrics.combatsVsAOrHigher, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.MISSION_EQUIVALENT_A2A3_2, description: '2 misiones B/A', status: toStatus(missionEquivalentA2A3, 2), current: missionEquivalentA2A3, required: 2 },
          { id: OPTIONAL_REQUIREMENTS.CURE_2, description: 'Curar a 2 personajes', status: 'SIN PROGRESO' as const, current: 0, required: 2 }
        ];

        const optionalMet = [
          metrics.narrations >= 1,
          metrics.highlightedNarrations >= 1,
          metrics.achievements >= 2,
          metrics.combatsVsAOrHigher >= 1,
          missionEquivalentA2A3 >= 2,
          false // Curar a 2 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push(REQ_OPTIONAL_A2A3);
        }
        break;
      }

      case 'S1': {
        const refDateS1 = await this.getAchievedAt(characterId, 'A1', character.createdAt);
        if (!refDateS1) {
          manualRequirements.push(REQ_NO_GRADATION_HISTORY_DAYS);
        } else if (!skipTimeGate) {
          const daysSinceA = this.calendarDaysBetween(refDateS1, refDate);
          if (daysSinceA < 20) {
            missingRequirements.push(REQ_DAYS_A_FOR_S1(daysSinceA));
          }
        }

        if (character.pr < 3500) {
          missingRequirements.push(REQ_PR_S1(character.pr));
        }
        if (metrics.combatWinsVsAOrHigher < 7) {
          missingRequirements.push(REQ_COMBAT_WINS_A_S_S1(metrics.combatWinsVsAOrHigher));
        }
        if ((metrics.missionASuccess >= 5) === false && (metrics.missionSAnyResult >= 3) === false) {
          missingRequirements.push(REQ_S1_MISSIONS);
        }
        if (metrics.narrations < 10) {
          missingRequirements.push(REQ_NARRATIONS_S1(metrics.narrations));
        }
        if (metrics.highlightedNarrations < 5) {
          missingRequirements.push(REQ_HIGHLIGHTS_S1(metrics.highlightedNarrations));
        }
        break;
      }

      case 'S2': {
        const refDateS2 = await this.getAchievedAt(characterId, 'S1', character.createdAt);
        if (!refDateS2) {
          manualRequirements.push(REQ_NO_GRADATION_HISTORY_DAYS);
        } else if (!skipTimeGate) {
          const daysSinceS = this.calendarDaysBetween(refDateS2, refDate);
          if (daysSinceS < 10) {
            missingRequirements.push(REQ_DAYS_S_FOR_S2(daysSinceS));
          }
        }

        optionalRequirements = [
          { id: OPTIONAL_REQUIREMENTS.NARRATIONS_2, description: '2 narraciones', status: toStatus(metrics.narrations, 2), current: metrics.narrations, required: 2 },
          { id: OPTIONAL_REQUIREMENTS.HIGHLIGHT_1, description: '1 destacado', status: toStatus(metrics.highlightedNarrations, 1), current: metrics.highlightedNarrations, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.MISSION_S_1, description: '1 misión S', status: toStatus(metrics.missionSAnyResult, 1), current: metrics.missionSAnyResult, required: 1 },
          { id: OPTIONAL_REQUIREMENTS.PR_500, description: '500 PR', status: character.pr >= 500 ? 'COMPLETADO' as const : character.pr > 0 ? 'PARCIAL' as const : 'SIN PROGRESO', current: character.pr, required: 500 },
          { id: OPTIONAL_REQUIREMENTS.CURE_5, description: 'Curar a 5 personajes', status: 'SIN PROGRESO' as const, current: 0, required: 5 }
        ];

        const optionalMet = [
          metrics.narrations >= 2,
          metrics.highlightedNarrations >= 1,
          metrics.missionSAnyResult >= 1,
          character.pr >= 500,
          false // Curar a 5 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push(REQ_OPTIONAL_S2);
        }
        break;
      }

      default:
        throw new Error(ERROR_LEVEL_NOT_CONFIGURED(targetLevel));
    }

    if (missingRequirements.length > 0 || manualRequirements.length > 0) {
      return this.buildFailure(snapshot, missingRequirements, manualRequirements, optionalRequirements);
    }

    return { passed: true, promotionState: 'APPROVED' as const, snapshot };
  }

  async applyPromotion(characterId: string, targetRankOrLevel: string, approvedBy: string) {
    const validation = await this.checkRankRequirements(characterId, targetRankOrLevel);
    if (!validation.passed) {
      const details = validation.reason ?? ERROR_ASCENSO_INSUFFICIENT_REQUIREMENTS;
      throw new Error(ERROR_ASCENSO_REJECTED(details));
    }

    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { id: true, level: true, rank: true, name: true }
      });

      if (!character) {
        throw new Error(ERROR_CHARACTER_NOT_FOUND);
      }

      const normalizedTarget = this.normalizeTarget(targetRankOrLevel);
      const previousLevel = character.level;
      const previousRank = character.rank;

      let nextLevel = character.level;
      let nextRank = character.rank;

      if (this.isInternalLevel(normalizedTarget)) {
        nextLevel = normalizedTarget;
      } else {
        const displayName = RANK_DISPLAY_NAMES[normalizedTarget];
        if (!displayName) {
          throw new Error(ERROR_ASCENSO_TARGET_UNRECOGNIZED(targetRankOrLevel));
        }
        nextRank = displayName;
      }

      await tx.character.update({
        where: { id: character.id },
        data: {
          level: nextLevel,
          rank: nextRank
        }
      });

      await tx.auditLog.create({
        data: {
          characterId: character.id,
          category: AUDIT_LOG_CATEGORY.ASCENSO,
          detail: AUDIT_ASCENSO_DETAIL(approvedBy, previousLevel, nextLevel, previousRank, nextRank, targetRankOrLevel),
          evidence: EVIDENCE.COMANDO_ASCENDER
        }
      });

      return {
        success: true,
        characterName: character.name,
        previousLevel,
        nextLevel,
        previousRank,
        nextRank,
        targetApplied: targetRankOrLevel
      };
    });
  }

  async claimWeeklySalary(characterId: string) {
    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: { traits: { include: { trait: true } } }
      });

      if (!character) {
        throw new Error(ERROR_CHARACTER_NOT_FOUND);
      }

      const now = new Date();
      const elapsedMs = now.getTime() - character.lastSalaryClaim.getTime();
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
      if (elapsedDays < SALARY_COOLDOWN_DAYS) {
        throw new Error(ERROR_SALARY_ALREADY_CLAIMED);
      }

      const baseSalary = BASE_SALARIES[character.rank] ?? 0;

      let weeklyTotalMultiplier = 1;
      let weeklyTraitBonusRyou = 0;

      for (const characterTrait of character.traits) {
        const mechanics = characterTrait.trait.mechanics;
        if (mechanics && typeof mechanics === 'object' && !Array.isArray(mechanics)) {
          const weeklyBonus = (mechanics as Record<string, unknown>).weeklyRyouBonus;
          if (typeof weeklyBonus === 'number' && Number.isFinite(weeklyBonus)) {
            weeklyTraitBonusRyou += Math.floor(weeklyBonus);
          }

          const mondayMultiplier = (mechanics as Record<string, unknown>).mondayTotalMultiplier;
          if (typeof mondayMultiplier === 'number' && Number.isFinite(mondayMultiplier) && mondayMultiplier > 0) {
            weeklyTotalMultiplier *= mondayMultiplier;
          }
        }
      }

      const grossSalary = baseSalary + weeklyTraitBonusRyou;
      const totalBeforeMultiplier = character.ryou + grossSalary;
      const finalRyou = Math.floor(totalBeforeMultiplier * weeklyTotalMultiplier);
      const netDeltaRyou = finalRyou - character.ryou;
      const multiplierDelta = finalRyou - totalBeforeMultiplier;

      await tx.character.update({
        where: { id: character.id },
        data: {
          ryou: finalRyou,
          lastSalaryClaim: now
        }
      });

      const statusDetail = multiplierDelta !== 0
        ? AUDIT_SALARY_WITH_MULTIPLIER(grossSalary, weeklyTotalMultiplier, multiplierDelta)
        : AUDIT_SALARY_SIMPLE(grossSalary);

      await tx.auditLog.create({
        data: {
          characterId,
          category: AUDIT_LOG_CATEGORY.SUELDO_SEMANAL,
          detail: statusDetail,
          evidence: EVIDENCE.SISTEMA_AUTOMATIZADO,
          deltaRyou: netDeltaRyou
        }
      });

      return {
        success: true,
        baseSalary,
        bonusRyou: weeklyTraitBonusRyou,
        multiplierGanancia: weeklyTotalMultiplier,
        grossSalary,
        derrochadorLoss: multiplierDelta < 0 ? Math.abs(multiplierDelta) : 0,
        finalRyou,
        netDeltaRyou
      };
    });
  }
}
