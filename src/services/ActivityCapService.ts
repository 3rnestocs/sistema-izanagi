/**
 * Weekly activity cap enforcement.
 * Validates that activities don't exceed weekly limits and handle mutual exclusivity rules.
 */

import { PrismaClient } from '@prisma/client';
import { WEEKLY_CAPS, COMBAT_CURACION_EXCLUSIVE } from '../config/activityRewards';
import {
  ActivityStatus,
  ActivityType,
  canonicalizeActivityType
} from '../domain/activityDomain';

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
   * Check if a character can register a new activity without exceeding weekly caps.
   * Throws an error if cap is exceeded or mutual exclusivity is violated.
   */
  async enforceWeeklyCaps(characterId: string, activityType: string): Promise<void> {
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
  }
}
