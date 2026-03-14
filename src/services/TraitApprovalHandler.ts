import { EmbedBuilder } from 'discord.js';
import type { ReactionHandler, ReactionApprovalContext } from './ReactionApprovalRouter';
import type { CharacterService } from './CharacterService';
import { prisma } from '../lib/prisma';
import { ApprovalStatus, TraitOperation } from '@prisma/client';

const EMBED_TITLE = 'Solicitud de Rasgo';
const COLOR_APPROVED = 0x57f287;
const COLOR_REJECTED = 0xed4245;

export class TraitApprovalHandler implements ReactionHandler {
  constructor(private characterService: CharacterService) {}

  matches(ctx: ReactionApprovalContext): boolean {
    const firstEmbed = ctx.message.embeds?.[0];
    return ctx.message.embeds.length > 0 && firstEmbed?.title === EMBED_TITLE;
  }

  async approve(ctx: ReactionApprovalContext, staffIdentifier: string): Promise<boolean> {
    const record = await prisma.pendingTraitRequest.findFirst({
      where: { approvalMessageId: ctx.messageId, status: ApprovalStatus.PENDING }
    });

    if (!record) return false;

    try {
      if (record.operation === TraitOperation.ASIGNAR) {
        await this.characterService.addTrait(record.characterId, record.traitName);
      } else {
        await this.characterService.removeTrait(record.characterId, record.traitName);
      }

      await prisma.pendingTraitRequest.update({
        where: { id: record.id },
        data: { status: ApprovalStatus.APPROVED }
      });

      const embed = ctx.message.embeds?.[0];
      const originalFields = (embed?.fields ?? []).map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline ?? false
      }));
      const successEmbed = new EmbedBuilder()
        .setColor(COLOR_APPROVED)
        .setTitle('Rasgo Procesado')
        .setFields(
          ...originalFields,
          { name: 'Aprobado por', value: staffIdentifier, inline: false }
        )
        .setTimestamp();
      if (embed?.footer?.text) successEmbed.setFooter({ text: embed.footer.text });
      await ctx.message.edit({ embeds: [successEmbed] });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al procesar rasgo.';
      await prisma.pendingTraitRequest.update({
        where: { id: record.id },
        data: { status: ApprovalStatus.REJECTED }
      });

      const embed = ctx.message.embeds?.[0];
      const originalFields = (embed?.fields ?? []).map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline ?? false
      }));
      const failedEmbed = new EmbedBuilder()
        .setColor(COLOR_REJECTED)
        .setTitle('Solicitud Rechazada')
        .setFields(
          ...originalFields,
          { name: 'Motivo', value: message, inline: false }
        )
        .setTimestamp();
      if (embed?.footer?.text) failedEmbed.setFooter({ text: embed.footer.text });
      await ctx.message.edit({ embeds: [failedEmbed] });
      return false;
    }
  }
}
