import { Message, EmbedBuilder } from 'discord.js';
import { PrismaClient, Prisma } from '@prisma/client';
import { PromotionService } from './PromotionService';

export class PromotionApprovalService {
  private promotionService: PromotionService;

  constructor(private prisma: PrismaClient) {
    this.promotionService = new PromotionService(prisma);
  }

  /**
   * Approve a pending promotion by Discord message ID (staff reacted with ✅).
   * Re-validates requirements at approval time. If valid, applies the promotion and edits the embed.
   * If invalid (re-validation fails), marks as EXPIRED and edits the embed to show expiry.
   * Returns true if approval was applied successfully.
   */
  async approveByMessageId(
    messageId: string,
    staffTag: string,
    discordMessage: Message
  ): Promise<boolean> {
    const pending = await this.prisma.pendingPromotion.findFirst({
      where: {
        approvalMessageId: messageId,
        status: 'PENDING'
      },
      include: {
        character: true
      }
    });

    if (!pending || !pending.character) {
      return false;
    }

    const { characterId, targetType, target } = pending;

    // Re-validate requirements
    let check: Awaited<ReturnType<PromotionService['checkLevelRequirements']>> | Awaited<ReturnType<PromotionService['checkRankRequirements']>>;

    try {
      if (targetType === 'level') {
        check = await this.promotionService.checkLevelRequirements(characterId, target);
      } else {
        check = await this.promotionService.checkRankRequirements(characterId, target);
      }
    } catch (error) {
      // If check fails (e.g., target not found), mark as expired
      await this.prisma.pendingPromotion.update({
        where: { id: pending.id },
        data: { status: 'EXPIRED' }
      });

      // Edit the embed to show expiry
      try {
        const expiredEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ Ascenso expirado')
          .setDescription(
            `**Personaje:** ${pending.character.name}\n**Objetivo:** ${target}\n\nLos requisitos ya no son válidos o el objetivo no existe.`
          )
          .setFooter({ text: `ID: ${pending.id}` })
          .setTimestamp();

        await discordMessage.edit({ embeds: [expiredEmbed] });
      } catch (editError) {
        console.error('Error editing expiry embed:', editError);
      }

      return false;
    }

    // Check if still valid
    if (!check.passed) {
      // Mark as expired if re-validation failed
      await this.prisma.pendingPromotion.update({
        where: { id: pending.id },
        data: { status: 'EXPIRED' }
      });

      // Edit the embed to show expiry
      try {
        const expiredEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ Ascenso expirado')
          .setDescription(
            `**Personaje:** ${pending.character.name}\n**Objetivo:** ${target}\n\nLos requisitos han cambiado desde la solicitud original y ya no se cumplen.`
          )
          .setFooter({ text: `ID: ${pending.id}` })
          .setTimestamp();

        await discordMessage.edit({ embeds: [expiredEmbed] });
      } catch (editError) {
        console.error('Error editing expiry embed:', editError);
      }

      return false;
    }

    // Apply the promotion
    try {
      const promotedAt = new Date();
      await this.promotionService.applyPromotion(characterId, targetType as 'level' | 'rank', target, promotedAt);

      // Mark as approved
      await this.prisma.pendingPromotion.update({
        where: { id: pending.id },
        data: {
          status: 'APPROVED',
          approvedAt: promotedAt
        }
      });

      // Edit the embed to show approval
      try {
        const approvedEmbed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('✅ Ascenso aprobado')
          .setDescription(
            `**Personaje:** ${pending.character.name}\n**Objetivo:** ${target}\n**Aprobado:** Sí`
          )
          .addFields(
            { name: 'Aprobado por', value: staffTag, inline: true },
            { name: 'Fecha de aprobación', value: promotedAt.toLocaleString('es-ES'), inline: true }
          )
          .setFooter({ text: `ID: ${pending.id}` })
          .setTimestamp();

        await discordMessage.edit({ embeds: [approvedEmbed] });
      } catch (editError) {
        console.error('Error editing approval embed:', editError);
      }

      return true;
    } catch (error) {
      console.error('Error applying promotion:', error);
      return false;
    }
  }
}
