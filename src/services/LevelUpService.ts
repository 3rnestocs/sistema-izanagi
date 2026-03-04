import { PrismaClient } from '@prisma/client';

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
    missionBOrHigherAnyResult: number;
    missionASuccess: number;
    missionSSuccess: number;
    missionSAnyResult: number;
    combatWinsVsAOrHigher: number;
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

  private readonly APPROVED_STATUSES = new Set<string>(['APROBADO', 'APROBADA']);
  private readonly SANNIN_DISCOUNT_TARGETS = new Set<string>([
    'JOUNIN',
    'JOUNIN_HANCHOU',
    'GO_IKENBAN',
    'LIDER_DE_CLAN'
  ]);

  private normalizeTargetRank(targetRank: string): string {
    return targetRank
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '_');
  }

  private isMissionType(type: string): boolean {
    return type === 'Misión';
  }

  private isCombatType(type: string): boolean {
    return type === 'Combate';
  }

  private isVictory(result: string | null): boolean {
    if (!result) {
      return false;
    }

    const normalized = result.trim().toUpperCase();
    return normalized === 'EXITOSA' || normalized === 'VICTORIA';
  }

  private isLevelAtLeast(level: string, minRankLetter: 'A' | 'B' | 'S'): boolean {
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

  async checkRankRequirements(characterId: string, targetRank: string): Promise<RequirementCheck> {
    const normalizedTargetRank = this.normalizeTargetRank(targetRank);

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, exp: true, pr: true, level: true, rank: true, title: true }
    });

    if (!character) {
      throw new Error('Personaje no encontrado.');
    }

    const activities = await this.prisma.activityRecord.findMany({
      where: {
        characterId
      },
      select: { type: true, rank: true, result: true, status: true }
    });

    const approvedActivities = activities.filter((activity) => this.APPROVED_STATUSES.has(activity.status.toUpperCase()));

    const missionBOrHigherAnyResult = approvedActivities.filter((activity) => {
      if (!this.isMissionType(activity.type)) {
        return false;
      }

      const activityRank = activity.rank?.toUpperCase();
      return activityRank === 'B' || activityRank === 'A' || activityRank === 'S';
    }).length;

    const missionASuccess = approvedActivities.filter((activity) => {
      if (!this.isMissionType(activity.type) || !this.isVictory(activity.result)) {
        return false;
      }

      const activityRank = activity.rank?.toUpperCase();
      return activityRank === 'A' || activityRank === 'S';
    }).length;

    const missionSSuccess = approvedActivities.filter((activity) => {
      if (!this.isMissionType(activity.type) || !this.isVictory(activity.result)) {
        return false;
      }

      return activity.rank?.toUpperCase() === 'S';
    }).length;

    const missionSAnyResult = approvedActivities.filter((activity) => {
      if (!this.isMissionType(activity.type)) {
        return false;
      }

      return activity.rank?.toUpperCase() === 'S';
    }).length;

    const combatWinsVsAOrHigher = approvedActivities.filter((activity) => {
      if (!this.isCombatType(activity.type) || !this.isVictory(activity.result)) {
        return false;
      }

      const activityRank = activity.rank?.toUpperCase();
      return activityRank === 'A' || activityRank === 'S';
    }).length;

    const missingRequirements: string[] = [];
    const manualRequirements: string[] = [];
    const hasSannin = this.hasSanninTitle(character.title);

    const snapshot = {
      exp: character.exp,
      pr: character.pr,
      level: character.level,
      rank: character.rank,
      missionBOrHigherAnyResult,
      missionASuccess,
      missionSSuccess,
      missionSAnyResult,
      combatWinsVsAOrHigher
    };

    switch (normalizedTargetRank) {
      case 'CHUUNIN': {
        const requiredExp = 120;
        const requiredPr = 400;

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (missionBOrHigherAnyResult < 1) {
          missingRequirements.push('Falta al menos 1 misión Rango B (fallida o exitosa).');
        }
        break;
      }
      case 'TOKUBETSU_JOUNIN': {
        const requiredExp = 220;
        const requiredPr = 700;

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (missionASuccess < 1) {
          missingRequirements.push('Falta cumplir exitosamente al menos 1 misión Rango A.');
        }
        break;
      }
      case 'JOUNIN': {
        const requiredExp = this.applySanninDiscount('JOUNIN', 300, hasSannin);
        const requiredPr = this.applySanninDiscount('JOUNIN', 1100, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (missionASuccess < 2) {
          missingRequirements.push(`Faltan misiones A exitosas (${missionASuccess}/2).`);
        }

        manualRequirements.push('Requiere consentimiento de otro Jounin (o duelo de mérito válido).');
        break;
      }
      case 'ANBU': {
        const requiredExp = 320;
        const requiredPr = 1200;

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (!this.isLevelAtLeast(character.level, 'A')) {
          missingRequirements.push(`Se requiere potencial Rango A o superior (actual: ${character.level}).`);
        }
        break;
      }
      case 'BUNTAICHOO': {
        const requiredExp = 350;
        const requiredPr = 1400;

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (character.rank !== 'ANBU') {
          missingRequirements.push(`Se requiere ser ANBU actualmente (actual: ${character.rank}).`);
        }
        if (missionSSuccess < 1) {
          missingRequirements.push('Falta cumplir exitosamente al menos 1 misión Rango S.');
        }
        break;
      }
      case 'JOUNIN_HANCHOU': {
        const requiredExp = this.applySanninDiscount('JOUNIN_HANCHOU', 350, hasSannin);
        const requiredPr = this.applySanninDiscount('JOUNIN_HANCHOU', 1400, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (character.rank !== 'Jounin') {
          missingRequirements.push(`Se requiere ser Jounin actualmente (actual: ${character.rank}).`);
        }
        if (missionSSuccess < 1) {
          missingRequirements.push('Falta cumplir exitosamente al menos 1 misión Rango S.');
        }
        break;
      }
      case 'GO_IKENBAN': {
        const requiredExp = this.applySanninDiscount('GO_IKENBAN', 380, hasSannin);
        const requiredPr = this.applySanninDiscount('GO_IKENBAN', 1600, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (missionSAnyResult < 1 && combatWinsVsAOrHigher < 1) {
          missingRequirements.push('Falta al menos 1 requisito trazable de Rango S (misión S o combate ganado vs A/S).');
        }

        manualRequirements.push('Requiere validación de “dos saltos temporales” por Staff.');
        break;
      }
      case 'KAGE': {
        const requiredExp = 350;
        const requiredPr = 1800;

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (!this.isLevelAtLeast(character.level, 'S')) {
          missingRequirements.push(`Se requiere potencial Rango S (actual: ${character.level}).`);
        }

        manualRequirements.push('Requiere consentimientos: Jounin Hanchou/Jounin, Buntaichoo/ANBU, Go-Ikenban (mayoría) y líder de clan.');
        break;
      }
      case 'LIDER_DE_CLAN': {
        const requiredExp = this.applySanninDiscount('LIDER_DE_CLAN', 270, hasSannin);
        const requiredPr = this.applySanninDiscount('LIDER_DE_CLAN', 900, hasSannin);

        if (character.exp < requiredExp) {
          missingRequirements.push(`EXP insuficiente (${character.exp}/${requiredExp}).`);
        }
        if (character.pr < requiredPr) {
          missingRequirements.push(`PR insuficiente (${character.pr}/${requiredPr}).`);
        }
        if (!this.isLevelAtLeast(character.level, 'B')) {
          missingRequirements.push(`Se requiere potencial mínimo Rango B (actual: ${character.level}).`);
        }

        manualRequirements.push('Requiere consentimiento de todos los miembros del clan en rangos B/A/S.');
        manualRequirements.push('Si es potencial B, validar externamente “3 requisitos cumplidos”.');
        break;
      }
      default:
        throw new Error(`⛔ El rango objetivo '${targetRank}' no está configurado en el motor.`);
    }

    if (missingRequirements.length > 0) {
      const firstMissingRequirement = missingRequirements[0] ?? 'Requisitos insuficientes.';
      return {
        passed: false,
        reason: firstMissingRequirement,
        missingRequirements,
        manualRequirements,
        snapshot
      };
    }

    if (manualRequirements.length > 0) {
      return {
        passed: false,
        reason: 'Cumple validaciones automáticas, pero faltan requisitos manuales.',
        manualRequirements,
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
