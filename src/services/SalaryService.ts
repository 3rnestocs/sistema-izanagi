import { PrismaClient } from '@prisma/client';

export class SalaryService {
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

  /**
   * Claim weekly salary with trait bonuses and multipliers.
   */
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
        const daysLeft = Math.ceil(this.DAYS_BETWEEN_SALARY - elapsedDays);
        throw new Error(`⛔ Ya cobraste el sueldo semanal. Intenta nuevamente en ${daysLeft} día(s).`);
      }

      const baseSalary = this.BASE_SALARIES[character.rank] ?? 0;

      let weeklyTotalMultiplier = 1;
      let weeklyTraitBonusRyou = 0;

      // Apply trait bonuses and multipliers
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

      // Update character
      await tx.character.update({
        where: { id: character.id },
        data: {
          ryou: finalRyou,
          lastSalaryClaim: now
        }
      });

      // Create audit log
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

  /**
   * Get salary info without claiming it.
   */
  async getSalaryInfo(characterId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { traits: { include: { trait: true } } }
    });

    if (!character) {
      throw new Error('Personaje no encontrado.');
    }

    const now = new Date();
    const elapsedMs = now.getTime() - character.lastSalaryClaim.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const canClaim = elapsedDays >= this.DAYS_BETWEEN_SALARY;
    const daysUntilNextClaim = Math.max(0, Math.ceil(this.DAYS_BETWEEN_SALARY - elapsedDays));

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
    const estimatedFinalRyou = Math.floor(totalBeforeMultiplier * weeklyTotalMultiplier);

    return {
      rank: character.rank,
      baseSalary,
      traitBonuses: weeklyTraitBonusRyou,
      grossSalary,
      multiplier: weeklyTotalMultiplier,
      estimatedFinalRyou,
      canClaim,
      daysUntilNextClaim
    };
  }
}
