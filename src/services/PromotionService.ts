import { PrismaClient } from '@prisma/client';
import { StatValidatorService } from './StatValidatorService';
import { LevelUpService } from './LevelUpService';
import {
  ActivityType,
  ActivityStatus,
  ActivityResult,
  canonicalizeActivityType,
  canonicalizeActivityStatus,
  canonicalizeActivityResult,
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
    achievements: number;
  };
}

export class PromotionService {
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
      achievements: approvedActivities.filter(a => {
        const type = canonicalizeActivityType(a.type);
        return type ? this.ACHIEVEMENT_TYPES.has(type) : false;
      }).length
    };

    return metrics;
  }

  async checkRankRequirements(characterId: string, targetRank: string): Promise<RequirementCheck> {
    return this.levelUpService.checkRankRequirements(characterId, targetRank);
  }

  async checkLevelRequirements(characterId: string, targetLevel: string): Promise<RequirementCheck> {
    return this.levelUpService.checkLevelRequirements(characterId, targetLevel);
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
      if (!character) throw new Error('Personaje no encontrado.');

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
        if (!displayName) throw new Error(`Rango no válido: ${target}`);

        await tx.character.update({
          where: { id: characterId },
          data: { rank: displayName }
        });
      }

      await tx.auditLog.create({
        data: {
          characterId,
          category: 'Ascenso',
          detail: `${targetType === 'rank' ? 'Ascenso de rango' : 'Ascenso de nivel'}: ${target}`,
          evidence: 'Comando /ascender',
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
}
