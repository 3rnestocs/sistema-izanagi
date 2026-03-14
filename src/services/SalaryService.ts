import { PrismaClient } from '@prisma/client';
import {
  BASE_SALARIES,
  WEEKLY_EXP_BONUS
} from '../config/salaryConfig';
import { toDateOnlyUTC } from '../utils/dateParser';

export class SalaryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Claim weekly salary with trait bonuses and multipliers.
   * @param discordId Discord user ID (used to find character)
   * @param claimDate The Monday date for which the salary is claimed (normalized to 00:00:00)
   */
  async claimWeeklySalary(discordId: string, claimDate: Date) {
    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { discordId },
        include: { traits: { include: { trait: true } } }
      });

      if (!character) {
        throw new Error('Personaje no encontrado.');
      }

      const claimDateNorm = toDateOnlyUTC(claimDate);
      const createdAtNorm = toDateOnlyUTC(character.createdAt);
      const lastClaimNorm = toDateOnlyUTC(character.lastSalaryClaim);

      if (claimDateNorm.getTime() < createdAtNorm.getTime()) {
        throw new Error('No puedes cobrar sueldos de fechas anteriores a la creación de tu personaje.');
      }

      if (claimDateNorm.getTime() === lastClaimNorm.getTime()) {
        const fmt = claimDateNorm.toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        throw new Error(`Ya has cobrado el sueldo correspondiente a la semana del ${fmt}.`);
      }

      const baseSalary = BASE_SALARIES[character.rank] ?? 0;

      let traitFlatBonus = 0;
      let traitMultiplier = 1;

      for (const { trait } of character.traits) {
        traitFlatBonus += trait.bonusRyou ?? 0;

        if (
          typeof trait.multiplierGanancia === 'number' &&
          trait.multiplierGanancia > 1
        ) {
          traitMultiplier *= trait.multiplierGanancia;
        }

        const mechanics = trait.mechanics;
        if (mechanics && typeof mechanics === 'object' && !Array.isArray(mechanics)) {
          const mondayMultiplier = (mechanics as Record<string, unknown>)
            .mondayTotalMultiplier;
          if (
            typeof mondayMultiplier === 'number' &&
            Number.isFinite(mondayMultiplier) &&
            mondayMultiplier > 0
          ) {
            traitMultiplier *= mondayMultiplier;
          }
        }
      }

      const grossIncome = baseSalary + traitFlatBonus;
      const newBalanceBeforeMultiplier = character.ryou + grossIncome;
      const finalRyouBalance = Math.floor(
        newBalanceBeforeMultiplier * traitMultiplier
      );
      const actualRyouEarnedOrLost = finalRyouBalance - character.ryou;
      const multiplierDelta = finalRyouBalance - newBalanceBeforeMultiplier;

      await tx.character.update({
        where: { id: character.id },
        data: {
          ryou: finalRyouBalance,
          exp: { increment: WEEKLY_EXP_BONUS },
          lastSalaryClaim: claimDateNorm
        }
      });

      const statusDetail =
        multiplierDelta !== 0
          ? `Cobro semanal: +${grossIncome} Ryou, +${WEEKLY_EXP_BONUS} EXP (bono semanal). Multiplicador aplicado (${traitMultiplier.toFixed(2)}x): ${multiplierDelta >= 0 ? '+' : ''}${multiplierDelta} Ryou.`
          : `Cobro semanal exitoso: +${grossIncome} Ryou, +${WEEKLY_EXP_BONUS} EXP (bono semanal).`;

      await tx.auditLog.create({
        data: {
          characterId: character.id,
          category: 'Sueldo Semanal',
          detail: statusDetail,
          evidence: 'Sistema Automatizado',
          deltaRyou: actualRyouEarnedOrLost,
          deltaExp: WEEKLY_EXP_BONUS
        }
      });

      return {
        success: true,
        characterName: character.name,
        claimDate: claimDateNorm,
        baseSalary,
        bonusRyou: traitFlatBonus,
        multiplierGanancia: traitMultiplier,
        grossSalary: grossIncome,
        derrochadorLoss: multiplierDelta < 0 ? Math.abs(multiplierDelta) : 0,
        finalRyou: finalRyouBalance,
        netDeltaRyou: actualRyouEarnedOrLost,
        weeklyExpBonus: WEEKLY_EXP_BONUS
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

    const baseSalary = BASE_SALARIES[character.rank] ?? 0;

    let traitFlatBonus = 0;
    let traitMultiplier = 1;

    for (const { trait } of character.traits) {
      traitFlatBonus += trait.bonusRyou ?? 0;

      if (
        typeof trait.multiplierGanancia === 'number' &&
        trait.multiplierGanancia > 1
      ) {
        traitMultiplier *= trait.multiplierGanancia;
      }

      const mechanics = trait.mechanics;
      if (mechanics && typeof mechanics === 'object' && !Array.isArray(mechanics)) {
        const mondayMultiplier = (mechanics as Record<string, unknown>)
          .mondayTotalMultiplier;
        if (
          typeof mondayMultiplier === 'number' &&
          Number.isFinite(mondayMultiplier) &&
          mondayMultiplier > 0
        ) {
          traitMultiplier *= mondayMultiplier;
        }
      }
    }

    const grossIncome = baseSalary + traitFlatBonus;
    const newBalanceBeforeMultiplier = character.ryou + grossIncome;
    const estimatedFinalRyou = Math.floor(
      newBalanceBeforeMultiplier * traitMultiplier
    );

    return {
      rank: character.rank,
      baseSalary,
      traitBonuses: traitFlatBonus,
      grossSalary: grossIncome,
      multiplier: traitMultiplier,
      estimatedFinalRyou,
      weeklyExpBonus: WEEKLY_EXP_BONUS,
      lastSalaryClaim: character.lastSalaryClaim
    };
  }
}
