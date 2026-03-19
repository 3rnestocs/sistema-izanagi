import { Prisma, PrismaClient } from '@prisma/client';
import { AUDIT_LOG_CATEGORY } from '../config/auditLogCategories';
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
      include: {
        character: {
          include: { traits: { include: { trait: true } } }
        }
      }
    });

    if (!activityRecord) {
      return false;
    }

    let rewards: { exp: number; pr: number; ryou: number; rc?: number; cupos?: number; bts?: number; sp?: number };

    const hasClaimed =
      activityRecord.claimedExp !== null ||
      activityRecord.claimedPr !== null ||
      activityRecord.claimedRyou !== null ||
      activityRecord.claimedRc !== null ||
      activityRecord.claimedCupos !== null ||
      activityRecord.claimedBts !== null ||
      activityRecord.claimedSp !== null;

    if (hasClaimed) {
      const claimedDetailed = rewardCalculatorService.applyTraitsToClaimedRewards(
        activityRecord.character as any,
        {
          exp: activityRecord.claimedExp,
          pr: activityRecord.claimedPr,
          ryou: activityRecord.claimedRyou,
          rc: activityRecord.claimedRc,
          cupos: activityRecord.claimedCupos,
          bts: activityRecord.claimedBts,
          sp: activityRecord.claimedSp
        }
      );
      rewards = {
        exp: claimedDetailed.exp.total,
        pr: claimedDetailed.pr.total,
        ryou: claimedDetailed.ryou.total,
        rc: claimedDetailed.rc ?? 0,
        cupos: claimedDetailed.cupos ?? 0,
        bts: claimedDetailed.bts ?? 0,
        sp: claimedDetailed.sp ?? 0
      };
    } else {
      rewards = rewardCalculatorService.calculateRewards(
        activityRecord.character as any,
        activityRecord as any
      );
    }

    if (
      rewards.exp === 0 &&
      rewards.pr === 0 &&
      rewards.ryou === 0 &&
      (rewards.rc ?? 0) === 0 &&
      (rewards.cupos ?? 0) === 0 &&
      (rewards.bts ?? 0) === 0 &&
      (rewards.sp ?? 0) === 0
    ) {
      return false;
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updateData: Record<string, { increment: number }> = {
        exp: { increment: rewards.exp },
        pr: { increment: rewards.pr },
        ryou: { increment: rewards.ryou }
      };
      if ((rewards.rc ?? 0) > 0) updateData.rc = { increment: rewards.rc! };
      if ((rewards.cupos ?? 0) > 0) updateData.cupos = { increment: rewards.cupos! };
      if ((rewards.bts ?? 0) > 0) updateData.bts = { increment: rewards.bts! };
      if ((rewards.sp ?? 0) > 0) updateData.sp = { increment: rewards.sp! };

      await tx.character.update({
        where: { id: activityRecord.characterId },
        data: updateData
      });

      await tx.activityRecord.update({
        where: { id: activityRecord.id },
        data: { status: ActivityStatus.APROBADO }
      });

      const rewardParts: string[] = [];
      if (rewards.exp > 0) rewardParts.push(`EXP:${rewards.exp}`);
      if (rewards.pr > 0) rewardParts.push(`PR:${rewards.pr}`);
      if (rewards.ryou > 0) rewardParts.push(`RYOU:${rewards.ryou}`);
      if ((rewards.rc ?? 0) > 0) rewardParts.push(`RC:${rewards.rc}`);
      if ((rewards.cupos ?? 0) > 0) rewardParts.push(`Cupos:${rewards.cupos}`);
      if ((rewards.bts ?? 0) > 0) rewardParts.push(`BTS:${rewards.bts}`);
      if ((rewards.sp ?? 0) > 0) rewardParts.push(`SP:${rewards.sp}`);

      const auditData: Record<string, number> = {
        deltaExp: rewards.exp,
        deltaPr: rewards.pr,
        deltaRyou: rewards.ryou
      };
      if ((rewards.rc ?? 0) > 0) auditData.deltaRc = rewards.rc!;
      if ((rewards.cupos ?? 0) > 0) auditData.deltaCupos = rewards.cupos!;
      if ((rewards.bts ?? 0) > 0) auditData.deltaBts = rewards.bts!;
      if ((rewards.sp ?? 0) > 0) auditData.deltaSp = rewards.sp!;

      const rewardsText = rewardParts.length > 0 ? rewardParts.join(', ') : 'ninguna';

      await tx.auditLog.create({
        data: {
          characterId: activityRecord.characterId,
          category: AUDIT_LOG_CATEGORY.APROBACION_ACTIVIDAD,
          detail: `Registro ${activityRecord.id} (${activityRecord.type}) aprobado por reacción de ${staffUserTag}. Recompensas => ${rewardsText}`,
          evidence: activityRecord.evidenceUrl,
          ...auditData
        }
      });
    });

    return true;
  }
}
