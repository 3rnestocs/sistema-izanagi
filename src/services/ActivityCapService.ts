/**
 * Weekly activity cap enforcement.
 * Validates that activities don't exceed weekly limits and handle mutual exclusivity rules.
 */

import { PrismaClient } from '@prisma/client';
import {
  WEEKLY_CAPS,
  COMBAT_CURACION_EXCLUSIVE,
  MISSION_WEEKLY_SLOTS,
  MISSION_DAILY_LIMIT,
  MISSION_SLOT_COST,
  MISSION_MAX_RANK_BY_CARGO
} from '../config/activityRewards';
import {
  ActivityStatus,
  ActivityType,
  canonicalizeActivityType
} from '../domain/activityDomain';

const RANK_ORDER = ['D', 'C', 'B', 'A', 'S'];

function rankGreaterOrEqual(a: string, b: string): boolean {
  const ai = RANK_ORDER.indexOf(a);
  const bi = RANK_ORDER.indexOf(b);
  if (ai === -1 || bi === -1) return false;
  return ai >= bi;
}

export interface EnforceCapsOptions {
  character?: { rank: string; isExiled?: boolean };
  missionRank?: string;
  createdAtOverride?: Date;
}

export interface EnforceCapsResult {
  slotsRemaining?: number;
}

export class ActivityCapService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get the start of the current week (Monday 00:00).
   * Assumes server is in UTC or a configured timezone.
   */
  private getWeekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday=0, Monday=1
    const weekStart = new Date(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Get the start of the given date (00:00 UTC).
   */
  private getDayStart(d: Date): Date {
    const start = new Date(d);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Check if a character can register a new activity without exceeding weekly caps.
   * Throws an error if cap is exceeded or mutual exclusivity is violated.
   * For missions: returns slotsRemaining for display.
   */
  async enforceWeeklyCaps(
    characterId: string,
    activityType: string,
    options?: EnforceCapsOptions
  ): Promise<EnforceCapsResult | void> {
    const normalizedRequestedType = canonicalizeActivityType(activityType);
    if (!normalizedRequestedType) return;

    const weekStart = this.getWeekStart();

    // Query approved activities this week
    const approvedActivities = await this.prisma.activityRecord.findMany({
      where: {
        characterId,
        status: { in: [ActivityStatus.APROBADO, ActivityStatus.AUTO_APROBADO] },
        createdAt: { gte: weekStart }
      }
    });

    // Count by type
    const combatCount = approvedActivities.filter(
      a => canonicalizeActivityType(a.type) === ActivityType.COMBATE
    ).length;
    const curacionCount = approvedActivities.filter(
      a => canonicalizeActivityType(a.type) === ActivityType.CURACION
    ).length;

    // Check combat cap
    if (normalizedRequestedType === ActivityType.COMBATE && combatCount >= WEEKLY_CAPS[ActivityType.COMBATE]) {
      throw new Error(
        `⛔ Ya realizaste el máximo de ${WEEKLY_CAPS[ActivityType.COMBATE]} combates esta semana. Intenta de nuevo el próximo lunes.`
      );
    }

    // Check curacion cap
    if (normalizedRequestedType === ActivityType.CURACION && curacionCount >= WEEKLY_CAPS[ActivityType.CURACION]) {
      throw new Error(
        `⛔ Ya realizaste el máximo de ${WEEKLY_CAPS[ActivityType.CURACION]} curaciones esta semana. Intenta de nuevo el próximo lunes.`
      );
    }

    // Check mutual exclusivity if enabled
    if (COMBAT_CURACION_EXCLUSIVE) {
      if (normalizedRequestedType === ActivityType.COMBATE && curacionCount > 0) {
        throw new Error(
          '⛔ No puedes hacer combates en una semana en la que ya realizaste curaciones. Intenta de nuevo el próximo lunes.'
        );
      }

      if (normalizedRequestedType === ActivityType.CURACION && combatCount > 0) {
        throw new Error(
          '⛔ No puedes hacer curaciones en una semana en la que ya realizaste combates. Intenta de nuevo el próximo lunes.'
        );
      }
    }

    // Mission caps: weekly slots, daily limit, rank-gated access
    if (normalizedRequestedType === ActivityType.MISION) {
      const missionRank = options?.missionRank;
      if (!missionRank || !['D', 'C', 'B', 'A', 'S'].includes(missionRank)) {
        throw new Error('⛔ Rango de misión inválido.');
      }

      let character = options?.character;
      if (!character) {
        const c = await this.prisma.character.findUnique({
          where: { id: characterId }
        });
        if (!c) throw new Error('⛔ Personaje no encontrado.');
        character = { rank: c.rank, isExiled: c.isExiled };
      }

      const maxRankForCargo = MISSION_MAX_RANK_BY_CARGO[character.rank];
      if (!maxRankForCargo) {
        throw new Error(`⛔ Tu cargo (${character.rank}) no tiene misiones asignadas. Contacta al staff.`);
      }

      // Rank-gated: normal = mission rank <= max; exiled = mission rank >= min (inverted)
      const missionRankIdx = RANK_ORDER.indexOf(missionRank);
      const maxRankIdx = RANK_ORDER.indexOf(maxRankForCargo);
      if (missionRankIdx === -1 || maxRankIdx === -1) {
        throw new Error('⛔ Rango no reconocido.');
      }
      if (character.isExiled) {
        if (missionRankIdx < maxRankIdx) {
          throw new Error(
            `⛔ Como exiliado, solo puedes registrar misiones de rango ${maxRankForCargo} o superior. Rango ${missionRank} no permitido.`
          );
        }
      } else {
        if (missionRankIdx > maxRankIdx) {
          throw new Error(
            `⛔ Tu cargo (${character.rank}) solo permite misiones hasta rango ${maxRankForCargo}. No puedes registrar misiones ${missionRank}.`
          );
        }
      }

      const refDate = options?.createdAtOverride ?? new Date();
      const weekStartForRef = this.getWeekStartForDate(refDate);
      const weekEndForRef = new Date(weekStartForRef);
      weekEndForRef.setUTCDate(weekEndForRef.getUTCDate() + 7);
      const dayStartForRef = this.getDayStart(refDate);
      const dayEndForRef = new Date(dayStartForRef);
      dayEndForRef.setUTCDate(dayEndForRef.getUTCDate() + 1);

      const approvedMissionsThisWeek = await this.prisma.activityRecord.findMany({
        where: {
          characterId,
          type: ActivityType.MISION,
          status: { in: [ActivityStatus.APROBADO, ActivityStatus.AUTO_APROBADO] },
          createdAt: { gte: weekStartForRef, lt: weekEndForRef }
        }
      });

      const usedSlots = approvedMissionsThisWeek.reduce(
        (sum, m) => sum + (MISSION_SLOT_COST[m.rank ?? 'D'] ?? 1),
        0
      );
      const slotCost = MISSION_SLOT_COST[missionRank] ?? 1;
      if (usedSlots + slotCost > MISSION_WEEKLY_SLOTS) {
        throw new Error(
          `⛔ No tienes suficientes cupos de misión esta semana. Usados: ${usedSlots}/${MISSION_WEEKLY_SLOTS}. Esta misión requiere ${slotCost} cupo(s).`
        );
      }

      const missionsOnTargetDay = approvedMissionsThisWeek.filter(
        m => m.createdAt >= dayStartForRef && m.createdAt < dayEndForRef
      );
      if (missionsOnTargetDay.length >= MISSION_DAILY_LIMIT) {
        throw new Error(
          `⛔ Ya registraste una misión para el ${dayStartForRef.toLocaleDateString('es-ES')}. Máximo 1 misión por día.`
        );
      }

      const slotsRemaining = MISSION_WEEKLY_SLOTS - usedSlots - slotCost;
      return { slotsRemaining };
    }
  }

  private getWeekStartForDate(d: Date): Date {
    const dayOfWeek = d.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(d);
    weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart;
  }
}
