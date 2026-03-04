import { PrismaClient } from '@prisma/client';

interface RequirementCheck {
  passed: boolean;
  reason?: string;
  snapshot: {
    exp: number;
    pr: number;
    approvedMissions: number;
    approvedAchievements: number;
  };
}

interface RankRequirement {
  requiredExp: number;
  requiredPr: number;
  minApprovedMissions: number;
  minApprovedAchievements: number;
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

  private readonly RANK_REQUIREMENTS: Readonly<Record<string, RankRequirement>> = {
    CHUUNIN: {
      requiredExp: 120,
      requiredPr: 400,
      minApprovedMissions: 1,
      minApprovedAchievements: 0
    },
    TOKUBETSU_JOUNIN: {
      requiredExp: 220,
      requiredPr: 700,
      minApprovedMissions: 2,
      minApprovedAchievements: 0
    },
    JOUNIN: {
      requiredExp: 350,
      requiredPr: 1200,
      minApprovedMissions: 4,
      minApprovedAchievements: 1
    },
    ANBU: {
      requiredExp: 500,
      requiredPr: 1800,
      minApprovedMissions: 6,
      minApprovedAchievements: 2
    }
  };

  private readonly APPROVED_STATUSES = new Set<string>(['APROBADO', 'APROBADA']);
  private readonly ACHIEVEMENT_TYPES = new Set<string>(['Logro General', 'Logro de Saga']);

  private normalizeTargetRank(targetRank: string): string {
    return targetRank
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '_');
  }

  async checkRankRequirements(characterId: string, targetRank: string): Promise<RequirementCheck> {
    const normalizedTargetRank = this.normalizeTargetRank(targetRank);
    const requirements = this.RANK_REQUIREMENTS[normalizedTargetRank];

    if (!requirements) {
      throw new Error(`⛔ El rango objetivo '${targetRank}' no está configurado en el motor.`);
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, exp: true, pr: true }
    });

    if (!character) {
      throw new Error('Personaje no encontrado.');
    }

    const approvedActivities = await this.prisma.activityRecord.findMany({
      where: {
        characterId,
        OR: [{ status: 'APROBADO' }, { status: 'APROBADA' }]
      },
      select: { type: true }
    });

    const approvedMissions = approvedActivities.filter((activity) => activity.type === 'Misión').length;
    const approvedAchievements = approvedActivities.filter((activity) => this.ACHIEVEMENT_TYPES.has(activity.type)).length;

    const snapshot = {
      exp: character.exp,
      pr: character.pr,
      approvedMissions,
      approvedAchievements
    };

    if (character.exp < requirements.requiredExp) {
      return {
        passed: false,
        reason: `EXP insuficiente (${character.exp}/${requirements.requiredExp}).`,
        snapshot
      };
    }

    if (character.pr < requirements.requiredPr) {
      return {
        passed: false,
        reason: `PR insuficiente (${character.pr}/${requirements.requiredPr}).`,
        snapshot
      };
    }

    if (approvedMissions < requirements.minApprovedMissions) {
      return {
        passed: false,
        reason: `Misiones aprobadas insuficientes (${approvedMissions}/${requirements.minApprovedMissions}).`,
        snapshot
      };
    }

    if (approvedAchievements < requirements.minApprovedAchievements) {
      return {
        passed: false,
        reason: `Logros aprobados insuficientes (${approvedAchievements}/${requirements.minApprovedAchievements}).`,
        snapshot
      };
    }

    return { passed: true, snapshot };
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

      let multiplierGanancia = 1;
      let bonusRyou = 0;
      let hasDerrochador = false;

      for (const characterTrait of character.traits) {
        multiplierGanancia *= characterTrait.trait.multiplierGanancia;
        bonusRyou += characterTrait.trait.bonusRyou;

        if (characterTrait.trait.name.toLowerCase().includes('derrochador')) {
          hasDerrochador = true;
        }
      }

      const grossSalary = Math.floor((baseSalary + bonusRyou) * multiplierGanancia);
      const totalBeforeDerrochador = character.ryou + grossSalary;

      const derrochadorLoss = hasDerrochador ? Math.floor(totalBeforeDerrochador / 2) : 0;
      const finalRyou = totalBeforeDerrochador - derrochadorLoss;
      const netDeltaRyou = finalRyou - character.ryou;

      await tx.character.update({
        where: { id: character.id },
        data: {
          ryou: finalRyou,
          lastSalaryClaim: now
        }
      });

      const statusDetail = hasDerrochador
        ? `Cobro semanal: +${grossSalary} Ryou, penalización Derrochador: -${derrochadorLoss}.`
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
        bonusRyou,
        multiplierGanancia,
        grossSalary,
        derrochadorLoss,
        finalRyou,
        netDeltaRyou
      };
    });
  }
}
