import { PrismaClient } from '@prisma/client';
import { StatValidatorService } from './StatValidatorService';
import {
  ActivityStatus,
  ActivityType,
  canonicalizeActivityStatus,
  canonicalizeActivityType,
  isDestacadoResult,
  isSuccessResult
} from '../domain/activityDomain';

interface RequirementCheck {
  passed: boolean;
  reason?: string;
  missingRequirements?: string[];
  manualRequirements?: string[];
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

  private readonly DAYS_BETWEEN_SALARY = 7;

  private readonly BASE_SALARIES: Readonly<Record<string, number>> = {
    Genin: 0,
    Chuunin: 800,
    'Tokubetsu Jounin': 1200,
    Jounin: 1800,
    ANBU: 2400,
    Buntaichoo: 3000,
    'Jounin Hanchou': 3000,
    'Go-Ikenban': 3500,
    Kage: 5000
  };

  private readonly APPROVED_STATUSES = new Set<string>([ActivityStatus.APROBADO, ActivityStatus.AUTO_APROBADO]);
  private readonly NARRATION_TYPES = new Set<string>([ActivityType.EVENTO, ActivityType.CRONICA, ActivityType.ESCENA]);
  private readonly ACHIEVEMENT_TYPES = new Set<string>([ActivityType.LOGRO_GENERAL, ActivityType.LOGRO_SAGA]);

  private readonly SANNIN_DISCOUNT_TARGETS = new Set<string>([
    'JOUNIN',
    'JOUNIN_HANCHOU',
    'GO_IKENBAN',
    'LIDER_DE_CLAN'
  ]);

  private readonly LEVEL_EXP_REQUIREMENTS: Readonly<Record<string, number>> = StatValidatorService.getLevelExpRequirements();

  private readonly RANK_DISPLAY_NAMES: Readonly<Record<string, string>> = {
    CHUUNIN: 'Chuunin',
    TOKUBETSU_JOUNIN: 'Tokubetsu Jounin',
    JOUNIN: 'Jounin',
    ANBU: 'ANBU',
    BUNTAICHOO: 'Buntaichoo',
    JOUNIN_HANCHOU: 'Jounin Hanchou',
    GO_IKENBAN: 'Go-Ikenban',
    LIDER_DE_CLAN: 'Lider de Clan',
    KAGE: 'Kage'
  };

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
    if (!hasSannin || !this.SANNIN_DISCOUNT_TARGETS.has(targetRank)) {
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
    manualRequirements: string[]
  ): RequirementCheck {
    const firstMissing = missingRequirements[0];
    if (firstMissing) {
      return {
        passed: false,
        reason: firstMissing,
        missingRequirements,
        manualRequirements,
        snapshot
      };
    }

    return {
      passed: false,
      reason: 'Cumple validaciones automáticas, pero faltan requisitos manuales.',
      manualRequirements,
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

  async checkRankRequirements(characterId: string, targetRankOrLevel: string): Promise<RequirementCheck> {
    const normalizedTarget = this.normalizeTarget(targetRankOrLevel);
    if (this.isInternalLevel(normalizedTarget)) {
      return this.checkLevelRequirements(characterId, normalizedTarget);
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, exp: true, pr: true, level: true, rank: true, title: true }
    });

    if (!character) {
      throw new Error('Personaje no encontrado.');
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
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if ((metrics.missionB + metrics.missionA + metrics.missionS) < 1) {
          missingRequirements.push('- Falta al menos 1 misión Rango B (fallida o exitosa).');
        }
        break;
      }
      case 'TOKUBETSU_JOUNIN': {
        const requiredExp = 220;
        const requiredPr = 700;

        if (character.exp < requiredExp) {
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if ((metrics.missionASuccess + metrics.missionSSuccess) < 1) {
          missingRequirements.push('- Falta cumplir exitosamente al menos 1 misión Rango A.');
        }
        break;
      }
      case 'JOUNIN': {
        const requiredExp = this.applySanninDiscount('JOUNIN', 300, hasSannin);
        const requiredPr = this.applySanninDiscount('JOUNIN', 1100, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if ((metrics.missionASuccess + metrics.missionSSuccess) < 2) {
          missingRequirements.push(`- Falta cumplir exitosamente al menos 2 misión Rango A/S (${metrics.missionASuccess + metrics.missionSSuccess}/2).`);
        }

        manualRequirements.push('Requiere consentimiento de otro Jounin (o duelo de mérito válido).');
        break;
      }
      case 'ANBU': {
        const requiredExp = 320;
        const requiredPr = 1200;

        if (character.exp < requiredExp) {
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (!this.isLevelAtLeast(character.level, 'A')) {
          missingRequirements.push(`- Se requiere potencial Rango A o superior (actual: ${character.level}).`);
        }
        break;
      }
      case 'BUNTAICHOO': {
        const requiredExp = 350;
        const requiredPr = 1400;

        if (character.exp < requiredExp) {
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (character.rank !== 'ANBU') {
          missingRequirements.push(`- Se requiere ser ANBU actualmente (actual: ${character.rank}).`);
        }
        if (metrics.missionSSuccess < 1) {
          missingRequirements.push('- Falta cumplir exitosamente al menos 1 misión Rango S.');
        }
        break;
      }
      case 'JOUNIN_HANCHOU': {
        const requiredExp = this.applySanninDiscount('JOUNIN_HANCHOU', 350, hasSannin);
        const requiredPr = this.applySanninDiscount('JOUNIN_HANCHOU', 1400, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (character.rank !== 'Jounin') {
          missingRequirements.push(`- Se requiere ser Jounin actualmente (actual: ${character.rank}).`);
        }
        if (metrics.missionSSuccess < 1) {
          missingRequirements.push('- Falta cumplir exitosamente al menos 1 misión Rango S.');
        }
        break;
      }
      case 'GO_IKENBAN': {
        const requiredExp = this.applySanninDiscount('GO_IKENBAN', 380, hasSannin);
        const requiredPr = this.applySanninDiscount('GO_IKENBAN', 1600, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (metrics.missionSAnyResult < 1 && metrics.combatWinsVsAOrHigher < 1) {
          missingRequirements.push('- Falta al menos 1 requisito trazable de Rango S (misión S o combate ganado vs A/S).');
        }

        manualRequirements.push('- Requiere validación de “dos saltos temporales” por Staff.');
        break;
      }
      case 'KAGE': {
        const requiredExp = 350;
        const requiredPr = 1800;

        if (character.exp < requiredExp) {
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (!this.isLevelAtLeast(character.level, 'S')) {
          missingRequirements.push(`- Se requiere potencial Rango S (actual: ${character.level}).`);
        }

        manualRequirements.push('- Requiere consentimientos: Jounin Hanchou/Jounin, Buntaichoo/ANBU, Go-Ikenban (mayoría) y líder de clan.');
        break;
      }
      case 'LIDER_DE_CLAN': {
        const requiredExp = this.applySanninDiscount('LIDER_DE_CLAN', 270, hasSannin);
        const requiredPr = this.applySanninDiscount('LIDER_DE_CLAN', 900, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`- PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (!this.isLevelAtLeast(character.level, 'B')) {
          missingRequirements.push(`- Se requiere potencial mínimo Rango B (actual: ${character.level}).`);
        }

        manualRequirements.push('- Requiere consentimiento de todos los miembros del clan en rangos B/A/S.');
        manualRequirements.push('- Si es potencial B, validar externamente “3 requisitos cumplidos”.');
        break;
      }
      default:
        throw new Error(`⛔ ACCIÓN PROHIBIDA: El rango/cargo objetivo '${targetRankOrLevel}' no está configurado en el motor.`);
    }

    if (missingRequirements.length > 0 || manualRequirements.length > 0) {
      return this.buildFailure(snapshot, missingRequirements, manualRequirements);
    }

    return { passed: true, snapshot };
  }

  async checkLevelRequirements(characterId: string, targetLevel: string): Promise<RequirementCheck> {
    const normalizedTargetLevel = this.normalizeTarget(targetLevel);
    if (!this.isInternalLevel(normalizedTargetLevel)) {
      throw new Error(`⛔ ACCIÓN PROHIBIDA: El nivel '${targetLevel}' no es una gradación válida.`);
    }

    const requiredExp = this.LEVEL_EXP_REQUIREMENTS[normalizedTargetLevel];
    if (requiredExp === undefined) {
      throw new Error(`⛔ ACCIÓN PROHIBIDA: No hay configuración de EXP para el nivel '${targetLevel}'.`);
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, exp: true, pr: true, level: true, rank: true, title: true, createdAt: true }
    });

    if (!character) {
      throw new Error('⛔ ACCIÓN PROHIBIDA: Personaje no encontrado.');
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

    if (character.exp < requiredExp) {
      missingRequirements.push(`- EXP insuficiente (${character.exp}/${requiredExp}).`);
    }

    switch (normalizedTargetLevel) {
      case 'D2':
      case 'D3':
        break;

      case 'C1': {
        const refDateC1 = await this.getAchievedAt(characterId, 'D1', character.createdAt);
        if (!refDateC1) {
          manualRequirements.push('No hay historial de gradación. Requiere revisión manual.');
        } else {
          const daysSinceD = this.calendarDaysBetween(refDateC1, new Date());
          if (daysSinceD < 5) {
            missingRequirements.push(`Faltan días como Rango D para C1 (requiere 5, actualmente ${daysSinceD}).`);
          }
        }

        const optionalMet = [
          metrics.narrations >= 1,
          metrics.combats >= 1,
          metrics.missionD >= 2,
          metrics.achievements >= 2
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push('Falta al menos 2 requisitos adicionales para C1 (narración, combate, 2 misiones D o 2 logros).');
        }
        break;
      }

      case 'C2':
      case 'C3': {
        const refLevelC2C3 = normalizedTargetLevel === 'C2' ? 'C1' : 'C2';
        const refDateC2C3 = await this.getAchievedAt(characterId, refLevelC2C3, character.createdAt);
        if (!refDateC2C3) {
          manualRequirements.push('No hay historial de gradación para verificar días. Requiere revisión manual.');
        } else {
          const daysRequiredC2C3 = 2;
          const daysSince = this.calendarDaysBetween(refDateC2C3, new Date());
          if (daysSince < daysRequiredC2C3) {
            missingRequirements.push(`Faltan días en la gradación previa para ${normalizedTargetLevel} (requiere ${daysRequiredC2C3}, actualmente ${daysSince}).`);
          }
        }

        const optionalMet = [
          metrics.narrations >= 1,
          metrics.highlightedNarrations >= 1,
          metrics.achievements >= 1,
          metrics.combats >= 1,
          metrics.missionC >= 1,
          false // Curar a 2 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push('Falta al menos 2 requisitos adicionales para C2/C3 (narración, destacado, logro, combate, misión C o curar a 2 personajes).');
        }
        break;
      }

      case 'B1': {
        const refDateB1 = await this.getAchievedAt(characterId, 'C1', character.createdAt);
        if (!refDateB1) {
          manualRequirements.push('No hay historial de gradación para verificar días. Requiere revisión manual.');
        } else {
          const daysSinceC = this.calendarDaysBetween(refDateB1, new Date());
          if (daysSinceC < 8) {
            missingRequirements.push(`Faltan días como Rango C para B1 (requiere 8, actualmente ${daysSinceC}).`);
          }
        }

        if (character.pr < 500) {
          missingRequirements.push(`PR insuficiente para B1 (${character.pr}/500).`);
        }

        const missionEquivalent = metrics.missionC + (metrics.missionB * 2) + (metrics.missionA * 2) + (metrics.missionS * 2);
        const optionalMet = [
          metrics.narrations >= 3,
          metrics.highlightedNarrations >= 2,
          missionEquivalent >= 4,
          metrics.combatsVsCOrHigher >= 2,
          false // Curar a 5 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 3) {
          missingRequirements.push('Falta al menos 3 requisitos adicionales para B1 (narraciones, destacados, misiones equivalentes C, combates vs C+ o curar a 5 personajes).');
        }
        break;
      }

      case 'B2':
      case 'B3': {
        const refLevelB2B3 = normalizedTargetLevel === 'B2' ? 'B1' : 'B2';
        const refDateB2B3 = await this.getAchievedAt(characterId, refLevelB2B3, character.createdAt);
        if (!refDateB2B3) {
          manualRequirements.push('No hay historial de gradación para verificar días. Requiere revisión manual.');
        } else {
          const daysRequiredB2B3 = 3;
          const daysSince = this.calendarDaysBetween(refDateB2B3, new Date());
          if (daysSince < daysRequiredB2B3) {
            missingRequirements.push(`Faltan días en la gradación previa para ${normalizedTargetLevel} (requiere ${daysRequiredB2B3}, actualmente ${daysSince}).`);
          }
        }

        const missionEquivalent = this.countMissionEquivalentForB(metrics.missionB, metrics.missionA + metrics.missionS);
        const optionalMet = [
          metrics.narrations >= 1,
          metrics.highlightedNarrations >= 1,
          metrics.achievements >= 1,
          metrics.combatsVsBOrHigher >= 2,
          missionEquivalent >= 1,
          false // Curar a 2 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push('Falta al menos 2 requisitos adicionales para B2/B3 (narración, destacado, logro, 2 combates B+, misión B/A o curar a 2 personajes).');
        }
        break;
      }

      case 'A1': {
        const refDateA1 = await this.getAchievedAt(characterId, 'B1', character.createdAt);
        if (!refDateA1) {
          manualRequirements.push('No hay historial de gradación para verificar días. Requiere revisión manual.');
        } else {
          const daysSinceB = this.calendarDaysBetween(refDateA1, new Date());
          if (daysSinceB < 14) {
            missingRequirements.push(`Faltan días como Rango B para A1 (requiere 14, actualmente ${daysSinceB}).`);
          }
        }

        if (character.pr < 1000) {
          missingRequirements.push(`PR insuficiente para A1 (${character.pr}/1000).`);
        }

        const missionEquivalent = this.countMissionEquivalentForB(metrics.missionB, metrics.missionA + metrics.missionS);
        const optionalMet = [
          metrics.narrations >= 6,
          metrics.highlightedNarrations >= 3,
          missionEquivalent >= 5,
          metrics.combatWinsVsBOrHigher >= 3,
          metrics.achievements >= 8,
          false // Curar a 10 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 3) {
          missingRequirements.push('Falta al menos 3 requisitos adicionales para A1 (narraciones, destacados, misiones B/A, victorias vs B+, logros o curar a 10 personajes).');
        }
        break;
      }

      case 'A2':
      case 'A3': {
        const refLevelA2A3 = normalizedTargetLevel === 'A2' ? 'A1' : 'A2';
        const refDateA2A3 = await this.getAchievedAt(characterId, refLevelA2A3, character.createdAt);
        if (!refDateA2A3) {
          manualRequirements.push('No hay historial de gradación para verificar días. Requiere revisión manual.');
        } else {
          const daysRequiredA2A3 = 6;
          const daysSince = this.calendarDaysBetween(refDateA2A3, new Date());
          if (daysSince < daysRequiredA2A3) {
            missingRequirements.push(`Faltan días en la gradación previa para ${normalizedTargetLevel} (requiere ${daysRequiredA2A3}, actualmente ${daysSince}).`);
          }
        }
        manualRequirements.push('Manual parcial: “obtener 300 PR durante la gradación anterior” no es trazable sin ledger temporal.');

        const missionEquivalent = this.countMissionEquivalentForB(metrics.missionB, metrics.missionA + metrics.missionS);
        const optionalMet = [
          metrics.narrations >= 1,
          metrics.highlightedNarrations >= 1,
          metrics.achievements >= 2,
          metrics.combatsVsAOrHigher >= 1,
          missionEquivalent >= 2,
          false // Curar a 2 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push('Falta al menos 2 requisitos adicionales para A2/A3 (narración, destacado, 2 logros, combate A+, misiones B/A o curar a 2 personajes).');
        }
        break;
      }

      case 'S1': {
        const refDateS1 = await this.getAchievedAt(characterId, 'A1', character.createdAt);
        if (!refDateS1) {
          manualRequirements.push('No hay historial de gradación para verificar días. Requiere revisión manual.');
        } else {
          const daysSinceA = this.calendarDaysBetween(refDateS1, new Date());
          if (daysSinceA < 20) {
            missingRequirements.push(`Faltan días como Rango A para S1 (requiere 20, actualmente ${daysSinceA}).`);
          }
        }

        if (character.pr < 3500) {
          missingRequirements.push(`PR insuficiente para S1 (${character.pr}/3500).`);
        }
        if (metrics.combatWinsVsAOrHigher < 7) {
          missingRequirements.push(`Faltan victorias vs A/S para S1 (${metrics.combatWinsVsAOrHigher}/7).`);
        }
        if ((metrics.missionASuccess >= 5) === false && (metrics.missionSAnyResult >= 3) === false) {
          missingRequirements.push('Para S1 se requiere 5 misiones A exitosas o participar en 3 misiones S.');
        }
        if (metrics.narrations < 10) {
          missingRequirements.push(`Narraciones insuficientes para S1 (${metrics.narrations}/10).`);
        }
        if (metrics.highlightedNarrations < 5) {
          missingRequirements.push(`Destacados insuficientes para S1 (${metrics.highlightedNarrations}/5).`);
        }
        break;
      }

      case 'S2': {
        const refDateS2 = await this.getAchievedAt(characterId, 'S1', character.createdAt);
        if (!refDateS2) {
          manualRequirements.push('No hay historial de gradación para verificar días. Requiere revisión manual.');
        } else {
          const daysSinceS = this.calendarDaysBetween(refDateS2, new Date());
          if (daysSinceS < 10) {
            missingRequirements.push(`Faltan días como Rango S para S2 (requiere 10, actualmente ${daysSinceS}).`);
          }
        }

        const optionalMet = [
          metrics.narrations >= 2,
          metrics.highlightedNarrations >= 1,
          metrics.missionSAnyResult >= 1,
          character.pr >= 500,
          false // Curar a 5 personajes (no trazable automáticamente)
        ].filter(Boolean).length;

        if (optionalMet < 2) {
          missingRequirements.push('Falta al menos 2 requisitos adicionales para S2 (2 narraciones, 1 destacado, 1 misión S, 500 PR o curar a 5 personajes).');
        }
        break;
      }

      default:
        throw new Error(`⛔ El nivel '${targetLevel}' no está configurado en el motor.`);
    }

    if (missingRequirements.length > 0 || manualRequirements.length > 0) {
      return this.buildFailure(snapshot, missingRequirements, manualRequirements);
    }

    return { passed: true, snapshot };
  }

  async applyPromotion(characterId: string, targetRankOrLevel: string, approvedBy: string) {
    const validation = await this.checkRankRequirements(characterId, targetRankOrLevel);
    if (!validation.passed) {
      const details = validation.reason ?? 'Requisitos insuficientes para ascenso.';
      throw new Error(`⛔ Ascenso rechazado: ${details}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { id: true, level: true, rank: true, name: true }
      });

      if (!character) {
        throw new Error('Personaje no encontrado.');
      }

      const normalizedTarget = this.normalizeTarget(targetRankOrLevel);
      const previousLevel = character.level;
      const previousRank = character.rank;

      let nextLevel = character.level;
      let nextRank = character.rank;

      if (this.isInternalLevel(normalizedTarget)) {
        nextLevel = normalizedTarget;
      } else {
        const displayName = this.RANK_DISPLAY_NAMES[normalizedTarget];
        if (!displayName) {
          throw new Error(`⛔ Objetivo '${targetRankOrLevel}' no reconocido por el motor de ascenso.`);
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
          category: 'Ascenso',
          detail: `Ascenso aplicado por ${approvedBy}. Nivel: ${previousLevel} -> ${nextLevel}. Cargo: ${previousRank} -> ${nextRank}. Objetivo: ${targetRankOrLevel}`,
          evidence: 'Comando /ascender'
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
        throw new Error('Personaje no encontrado.');
      }

      const now = new Date();
      const elapsedMs = now.getTime() - character.lastSalaryClaim.getTime();
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
      if (elapsedDays < this.DAYS_BETWEEN_SALARY) {
        throw new Error('⛔ Ya cobraste el sueldo semanal. Intenta nuevamente más tarde.');
      }

      const baseSalary = this.BASE_SALARIES[character.rank] ?? 0;

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
        ? `Cobro semanal: +${grossSalary} Ryou. Multiplicador lunes aplicado (${weeklyTotalMultiplier.toFixed(2)}x): ${multiplierDelta >= 0 ? '+' : ''}${multiplierDelta} Ryou.`
        : `Cobro semanal exitoso: +${grossSalary} Ryou.`;

      await tx.auditLog.create({
        data: {
          characterId,
          category: 'Sueldo Semanal',
          detail: statusDetail,
          evidence: 'Sistema Automatizado',
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
