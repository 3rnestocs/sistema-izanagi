import { Prisma, PrismaClient } from '@prisma/client';
import { RewardCalculatorService } from './RewardCalculatorService';
import { ActivityStatus } from '../domain/activityDomain';

const rewardCalculatorService = new RewardCalculatorService();

export class ActivityApprovalService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Approve a pending activity by Discord message ID (staff reacted with checkmark).
   * Returns true if approval was applied, false if no-op (not found, already processed, or no rewards).
   */
  async approveActivityByMessageId(messageId: string, staffUserTag: string): Promise<boolean> {
    const activityRecord = await this.prisma.activityRecord.findFirst({
      where: {
        approvalMessageId: messageId,
        status: ActivityStatus.PENDIENTE
      },
      include: { character: true }
    });

    if (!activityRecord) {
      return false;
    }

    let rewards: { exp: number; pr: number; ryou: number; rc?: number; cupos?: number };

    if (
      activityRecord.claimedExp !== null ||
      activityRecord.claimedPr !== null ||
      activityRecord.claimedRyou !== null
    ) {
      rewards = {
        exp: activityRecord.claimedExp ?? 0,
        pr: activityRecord.claimedPr ?? 0,
        ryou: activityRecord.claimedRyou ?? 0
      };
    } else {
      rewards = rewardCalculatorService.calculateRewards(
        activityRecord.character as any,
        activityRecord as any
      );
    }

    if (rewards.exp === 0 && rewards.pr === 0 && rewards.ryou === 0 && (rewards.rc ?? 0) === 0 && (rewards.cupos ?? 0) === 0) {
      return false;
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updateData: Record<string, { increment: number }> = {
        exp: { increment: rewards.exp },
        pr: { increment: rewards.pr },
        ryou: { increment: rewards.ryou }
      };
      if (rewards.rc && rewards.rc > 0) updateData.rc = { increment: rewards.rc };
      if (rewards.cupos && rewards.cupos > 0) updateData.cupos = { increment: rewards.cupos };

      await tx.character.update({
        where: { id: activityRecord.characterId },
        data: updateData
      });

      await tx.activityRecord.update({
        where: { id: activityRecord.id },
        data: { status: ActivityStatus.APROBADO }
      });

      const auditData: Record<string, number> = {
        deltaExp: rewards.exp,
        deltaPr: rewards.pr,
        deltaRyou: rewards.ryou
      };
      if (rewards.rc && rewards.rc > 0) auditData.deltaRc = rewards.rc;
      if (rewards.cupos && rewards.cupos > 0) auditData.deltaCupos = rewards.cupos;

      await tx.auditLog.create({
        data: {
          characterId: activityRecord.characterId,
          category: 'Aprobación de Actividad',
          detail: `Registro ${activityRecord.id} (${activityRecord.type}) aprobado por reacción de ${staffUserTag}. Recompensas => EXP:${rewards.exp}, PR:${rewards.pr}, RYOU:${rewards.ryou}` +
            (rewards.rc ? `, RC:${rewards.rc}` : '') +
            (rewards.cupos ? `, Cupos:${rewards.cupos}` : ''),
          evidence: activityRecord.evidenceUrl,
          ...auditData
        }
      });
    });

    return true;
  }
}
