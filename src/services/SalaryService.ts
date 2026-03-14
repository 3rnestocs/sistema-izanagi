import { PrismaClient } from '@prisma/client';
import {
  BASE_SALARIES,
  SALARY_COOLDOWN_DAYS,
  WEEKLY_EXP_BONUS
} from '../config/salaryConfig';
import { isMondayInTimezone } from '../utils/dateParser';

export class SalaryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Claim weekly salary with trait bonuses and multipliers.
   * @param discordId Discord user ID (used to find character)
   * @param forceOverride If true, skip Monday and cooldown checks (staff use)
   */
  async claimWeeklySalary(discordId: string, forceOverride = false) {
    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { discordId },
        include: { traits: { include: { trait: true } } }
      });

      if (!character) {
        throw new Error('Personaje no encontrado.');
      }

      const now = new Date();

      if (!forceOverride) {
        if (!isMondayInTimezone(now)) {
          throw new Error(
            '⛔ Solo puedes cobrar el sueldo semanal los lunes (zona horaria: America/Caracas).'
          );
        }

        const elapsedMs = now.getTime() - character.lastSalaryClaim.getTime();
        const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
        if (elapsedDays < SALARY_COOLDOWN_DAYS) {
          const daysLeft = Math.ceil(SALARY_COOLDOWN_DAYS - elapsedDays);
          throw new Error(
            `⛔ Ya cobraste el sueldo semanal. Intenta nuevamente en ${daysLeft} día(s).`
          );
        }
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
          lastSalaryClaim: now
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
          evidence: forceOverride ? 'Comando /forzar_sueldo' : 'Sistema Automatizado',
          deltaRyou: actualRyouEarnedOrLost,
          deltaExp: WEEKLY_EXP_BONUS
        }
      });

      return {
        success: true,
        characterName: character.name,
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

    const now = new Date();
    const elapsedMs = now.getTime() - character.lastSalaryClaim.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const canClaim = elapsedDays >= SALARY_COOLDOWN_DAYS;
    const daysUntilNextClaim = Math.max(
      0,
      Math.ceil(SALARY_COOLDOWN_DAYS - elapsedDays)
    );

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
      canClaim,
      daysUntilNextClaim,
      isMonday: isMondayInTimezone()
    };
  }
}
