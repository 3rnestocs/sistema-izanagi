import { PrismaClient } from '@prisma/client';
import { AUDIT_LOG_CATEGORY } from '../config/auditLogCategories';
import { EVIDENCE } from '../config/evidenceStrings';
import {
  ERROR_CHARACTER_NOT_FOUND,
  ERROR_FORCE_ASCENSO_SAME_OR_LOWER,
  ERROR_INVALID_LEVEL,
  ERROR_INVALID_RANK
} from '../config/serviceErrors';
import { StatValidatorService } from './StatValidatorService';
import { LevelUpService, type RequirementCheck, type OptionalRequirement } from './LevelUpService';
import {
  ActivityType,
  ActivityStatus,
  ActivityResult,
  canonicalizeActivityType,
  canonicalizeActivityStatus,
  canonicalizeActivityResult,
  isSuccessResult
} from '../domain/activityDomain';

export class PromotionService {
  public static readonly LEVEL_ORDER = ['D1', 'D2', 'D3', 'C1', 'C2', 'C3', 'B1', 'B2', 'B3', 'A1', 'A2', 'A3', 'S1', 'S2'];

  private levelUpService: LevelUpService;

  constructor(private prisma: PrismaClient) {
    this.levelUpService = new LevelUpService(prisma);
  }

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

  private readonly MIN_PR_BY_LEVEL: Record<string, number> = {
    'B1': 500, 'B2': 500, 'B3': 500,
    'A1': 1000, 'A2': 1000, 'A3': 1000,
    'S1': 3500, 'S2': 3500
  };

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

  private async buildMetrics(character: any): Promise<RequirementCheck['snapshot']> {
    const activities = await this.prisma.activityRecord.findMany({
      where: { characterId: character.id }
    });

    const approvedActivities = activities.filter((a) => {
      const status = canonicalizeActivityStatus(a.status);
      return status ? this.APPROVED_STATUSES.has(status) : false;
    });

    const metrics = {
      exp: character.exp,
      pr: character.pr,
      level: character.level,
      rank: character.rank,
      missionD: approvedActivities.filter(a => canonicalizeActivityType(a.type) === ActivityType.MISION && a.rank === 'D').length,
      missionC: approvedActivities.filter(a => canonicalizeActivityType(a.type) === ActivityType.MISION && a.rank === 'C').length,
      missionB: approvedActivities.filter(a => canonicalizeActivityType(a.type) === ActivityType.MISION && a.rank === 'B').length,
      missionA: approvedActivities.filter(a => canonicalizeActivityType(a.type) === ActivityType.MISION && a.rank === 'A').length,
      missionS: approvedActivities.filter(a => canonicalizeActivityType(a.type) === ActivityType.MISION && a.rank === 'S').length,
      missionASuccess: approvedActivities.filter(
        a => canonicalizeActivityType(a.type) === ActivityType.MISION && a.rank === 'A' && isSuccessResult(a.result)
      ).length,
      missionSSuccess: approvedActivities.filter(
        a => canonicalizeActivityType(a.type) === ActivityType.MISION && a.rank === 'S' && isSuccessResult(a.result)
      ).length,
      missionSAnyResult: approvedActivities.filter(a => canonicalizeActivityType(a.type) === ActivityType.MISION && a.rank === 'S').length,
      narrations: approvedActivities.filter(a => {
        const type = canonicalizeActivityType(a.type);
        return type ? this.NARRATION_TYPES.has(type) : false;
      }).length,
      highlightedNarrations: approvedActivities.filter(a => {
        const type = canonicalizeActivityType(a.type);
        return type ? this.NARRATION_TYPES.has(type) && canonicalizeActivityResult(a.result) === ActivityResult.DESTACADO : false;
      }).length,
      combats: approvedActivities.filter(a => canonicalizeActivityType(a.type) === ActivityType.COMBATE).length,
      combatsVsCOrHigher: approvedActivities.filter(
        a => canonicalizeActivityType(a.type) === ActivityType.COMBATE && ['C', 'B', 'A', 'S'].includes(a.rank || '')
      ).length,
      combatsVsBOrHigher: approvedActivities.filter(
        a => canonicalizeActivityType(a.type) === ActivityType.COMBATE && ['B', 'A', 'S'].includes(a.rank || '')
      ).length,
      combatsVsAOrHigher: approvedActivities.filter(
        a => canonicalizeActivityType(a.type) === ActivityType.COMBATE && ['A', 'S'].includes(a.rank || '')
      ).length,
      combatWinsVsAOrHigher: approvedActivities.filter(
        a => canonicalizeActivityType(a.type) === ActivityType.COMBATE && ['A', 'S'].includes(a.rank || '') && isSuccessResult(a.result)
      ).length,
      combatWinsVsBOrHigher: approvedActivities.filter(
        a => canonicalizeActivityType(a.type) === ActivityType.COMBATE && ['B', 'A', 'S'].includes(a.rank || '') && isSuccessResult(a.result)
      ).length,
      achievements: approvedActivities.filter(a => {
        const type = canonicalizeActivityType(a.type);
        return type ? this.ACHIEVEMENT_TYPES.has(type) : false;
      }).length
    };

    return metrics;
  }

  async checkRankRequirements(
    characterId: string,
    targetRank: string,
    referenceDate?: Date
  ): Promise<RequirementCheck> {
    return this.levelUpService.checkRankRequirements(characterId, targetRank, referenceDate);
  }

  async checkLevelRequirements(
    characterId: string,
    targetLevel: string,
    referenceDate?: Date
  ): Promise<RequirementCheck> {
    return this.levelUpService.checkLevelRequirements(characterId, targetLevel, referenceDate);
  }

  async applyPromotion(
    characterId: string,
    targetType: 'rank' | 'level',
    target: string,
    promotedAt?: Date
  ): Promise<{ spGranted?: number }> {
    let spGranted: number | undefined;
    await this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({ where: { id: characterId } });
      if (!character) throw new Error(ERROR_CHARACTER_NOT_FOUND);

      if (targetType === 'level') {
        spGranted = StatValidatorService.getInitialSpForLevel(target);
        await tx.character.update({
          where: { id: characterId },
          data: {
            level: target,
            sp: { increment: spGranted }
          }
        });
        const achievedAt = promotedAt ?? new Date();
        await tx.gradationHistory.upsert({
          where: {
            characterId_level: { characterId, level: target }
          },
          create: { characterId, level: target, achievedAt },
          update: { achievedAt }
        });
      } else {
        const displayName = this.RANK_DISPLAY_NAMES[this.normalizeTarget(target)];
        if (!displayName) throw new Error(ERROR_INVALID_RANK(target));

        await tx.character.update({
          where: { id: characterId },
          data: { rank: displayName }
        });
      }

      await tx.auditLog.create({
        data: {
          characterId,
          category: AUDIT_LOG_CATEGORY.ASCENSO,
          detail: `${targetType === 'rank' ? 'Ascenso de rango' : 'Ascenso de nivel'}: ${target}`,
          evidence: EVIDENCE.COMANDO_ASCENDER,
          ...(spGranted !== undefined ? { deltaSp: spGranted } : {}),
          ...(promotedAt && { createdAt: promotedAt })
        }
      });
    });
    return spGranted !== undefined ? { spGranted } : {};
  }

  private applySanninDiscount(character: any, pr: number): number {
    if (character.title && character.title.toLowerCase().includes('sannin')) {
      return Math.floor(pr * 0.75);
    }
    return pr;
  }

  async forceLevelPromotion(
    characterId: string,
    targetLevel: string,
    approvedBy: string,
    promotedAt: Date = new Date()
  ) {
    const normalizedTarget = this.normalizeTarget(targetLevel);
    if (!this.isInternalLevel(normalizedTarget)) {
      throw new Error(ERROR_INVALID_LEVEL(targetLevel));
    }

    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error(ERROR_CHARACTER_NOT_FOUND);

      const currentIndex = PromotionService.LEVEL_ORDER.indexOf(character.level);
      const targetIndex = PromotionService.LEVEL_ORDER.indexOf(normalizedTarget);

      if (targetIndex <= currentIndex) {
        throw new Error(ERROR_FORCE_ASCENSO_SAME_OR_LOWER(character.level));
      }

      // 1. Calcular SP acumulado y registrar historiales intermedios
      let totalSpGranted = 0;
      for (let i = currentIndex + 1; i <= targetIndex; i++) {
        const stepLevel = PromotionService.LEVEL_ORDER[i]!;

        const stepSp = StatValidatorService.getInitialSpForLevel(stepLevel) ?? 0;
        totalSpGranted += stepSp;

        await tx.gradationHistory.upsert({
          where: { characterId_level: { characterId, level: stepLevel } },
          create: { characterId, level: stepLevel, achievedAt: promotedAt },
          update: { achievedAt: promotedAt }
        });
      }

      // 2. Calcular topes de EXP y PR requeridos
      const requiredExp = this.LEVEL_EXP_REQUIREMENTS[normalizedTarget] ?? 0;
      const requiredPr = this.MIN_PR_BY_LEVEL[normalizedTarget] ?? 0;

      const deltaExp = character.exp < requiredExp ? requiredExp - character.exp : 0;
      const deltaPr = character.pr < requiredPr ? requiredPr - character.pr : 0;

      // 3. Aplicar actualización al personaje
      await tx.character.update({
        where: { id: characterId },
        data: {
          level: normalizedTarget,
          sp: { increment: totalSpGranted },
          exp: { increment: deltaExp },
          pr: { increment: deltaPr }
        }
      });

      // 4. Auditar el movimiento administrativo
        await tx.auditLog.create({
        data: {
          characterId: character.id,
          category: AUDIT_LOG_CATEGORY.AJUSTE_RECURSOS,
          detail: `Ascenso FORZADO por ${approvedBy}. Nivel: ${character.level} -> ${normalizedTarget}. SP Otorgados: ${totalSpGranted}. Ajuste base: +${deltaExp} EXP, +${deltaPr} PR.`,
          evidence: EVIDENCE.COMANDO_FORZAR_ASCENSO,
          deltaSp: totalSpGranted,
          deltaExp: deltaExp,
          deltaPr: deltaPr,
          createdAt: promotedAt
        }
      });

      return {
        previousLevel: character.level,
        newLevel: normalizedTarget,
        spGranted: totalSpGranted,
        expGranted: deltaExp,
        prGranted: deltaPr
      };
    });
  }
}
