import { EmbedBuilder } from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import { ApprovalStatus } from '@prisma/client';
import type { ReactionHandler, ReactionApprovalContext } from './ReactionApprovalRouter';
import type { PlazaService } from './PlazaService';
import type { PlazaGrantType } from './PlazaService';

const WISH_EMBED_TITLE = 'Solicitud de Habilidad';

const OLD_FOOTER_REGEX =
  /UserID:\s*(\S+)\s*\|\s*PlazaID:\s*(\S+)\s*\|\s*Tipo:\s*(\S+)(?:\s*\|\s*BTS:\s*(\d+))?(?:\s*\|\s*BES:\s*(\d+))?/;

function parseOldFooter(
  footerText: string | null
): { userId: string; plazaId: string; tipo: string; bts: number; bes: number } | null {
  if (!footerText) return null;
  const match = footerText.match(OLD_FOOTER_REGEX);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return {
    userId: match[1],
    plazaId: match[2],
    tipo: match[3],
    bts: parseInt(match[4] ?? '0', 10),
    bes: parseInt(match[5] ?? '0', 10)
  };
}

export class WishApprovalHandler implements ReactionHandler {
  constructor(
    private prisma: PrismaClient,
    private plazaService: PlazaService
  ) {}

  matches(ctx: ReactionApprovalContext): boolean {
    const firstEmbed = ctx.message.embeds?.[0];
    return firstEmbed?.title === WISH_EMBED_TITLE;
  }

  async approve(ctx: ReactionApprovalContext, staffIdentifier: string): Promise<boolean> {
    const embed = ctx.message.embeds?.[0];
    if (!embed) return false;

    const pendingWish = await this.prisma.pendingWish.findUnique({
      where: { approvalMessageId: ctx.messageId },
      include: { character: { select: { id: true, name: true } } }
    });

    if (pendingWish) {
      return this.approveFromDb(ctx, pendingWish, staffIdentifier);
    }

    const parsed = parseOldFooter(embed.footer?.text ?? null);
    if (parsed) {
      return this.approveFromFooter(ctx, parsed, staffIdentifier);
    }

    await this.editEmbedFailure(ctx, 'No se pudo extraer la información del footer.');
    return false;
  }

  private async approveFromDb(
    ctx: ReactionApprovalContext,
    pendingWish: {
      id: string;
      discordId: string;
      plazaId: string;
      tipoOtorgamiento: string;
      costoBts: number;
      costoBes: number;
      character: { id: string; name: string };
    },
    staffIdentifier: string
  ): Promise<boolean> {
    const plaza = await this.prisma.plaza.findUnique({
      where: { id: pendingWish.plazaId },
      select: { id: true, name: true }
    });
    if (!plaza) {
      await this.editEmbedFailure(ctx, `La plaza con ID ${pendingWish.plazaId} no existe.`);
      return false;
    }

    const assignPayload = {
      characterId: pendingWish.character.id,
      plazaName: plaza.name,
      grantType: pendingWish.tipoOtorgamiento as PlazaGrantType,
      evidence: `Aprobado por reacción | Staff: ${staffIdentifier}`,
      ...(pendingWish.costoBts > 0 ? { costoBts: pendingWish.costoBts } : {}),
      ...(pendingWish.costoBes > 0 ? { costoBes: pendingWish.costoBes } : {})
    };

    try {
      await this.plazaService.assignPlaza(assignPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al otorgar habilidad.';
      await this.editEmbedFailure(ctx, message);
      return false;
    }

    await this.prisma.pendingWish.update({
      where: { id: pendingWish.id },
      data: { status: ApprovalStatus.APPROVED }
    });

    const embed = ctx.message.embeds?.[0];
    if (embed) await this.editEmbedSuccess(ctx, embed, staffIdentifier);
    return true;
  }

  private async approveFromFooter(
    ctx: ReactionApprovalContext,
    parsed: { userId: string; plazaId: string; tipo: string; bts: number; bes: number },
    staffIdentifier: string
  ): Promise<boolean> {
    const embed = ctx.message.embeds?.[0];
    if (!embed) return false;

    const character = await this.prisma.character.findUnique({
      where: { discordId: parsed.userId },
      select: { id: true, name: true }
    });
    if (!character) {
      await this.editEmbedFailure(ctx, `Usuario <@${parsed.userId}> no tiene ficha registrada.`);
      return false;
    }

    const plaza = await this.prisma.plaza.findUnique({
      where: { id: parsed.plazaId },
      select: { id: true, name: true }
    });
    if (!plaza) {
      await this.editEmbedFailure(ctx, `La plaza con ID ${parsed.plazaId} no existe.`);
      return false;
    }

    const assignPayload = {
      characterId: character.id,
      plazaName: plaza.name,
      grantType: parsed.tipo as PlazaGrantType,
      evidence: `Aprobado por reacción | Staff: ${staffIdentifier}`,
      ...(parsed.bts > 0 ? { costoBts: parsed.bts } : {}),
      ...(parsed.bes > 0 ? { costoBes: parsed.bes } : {})
    };

    try {
      await this.plazaService.assignPlaza(assignPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al otorgar habilidad.';
      await this.editEmbedFailure(ctx, message);
      return false;
    }

    await this.editEmbedSuccess(ctx, embed, staffIdentifier);
    return true;
  }

  private async editEmbedSuccess(
    ctx: ReactionApprovalContext,
    embed: { fields?: Array<{ name: string; value: string; inline?: boolean }>; footer?: { text: string } | null },
    staffIdentifier: string
  ): Promise<void> {
    const originalFields = (embed.fields ?? []).map((f) => ({
      name: f.name,
      value: f.value,
      inline: f.inline ?? false
    }));
    const successEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Habilidad Otorgada')
      .setFields(
        ...originalFields,
        { name: 'Aprobado por', value: staffIdentifier, inline: false }
      )
      .setTimestamp();
    if (embed.footer?.text) successEmbed.setFooter({ text: embed.footer.text });
    await ctx.message.edit({ embeds: [successEmbed] });
  }

  private async editEmbedFailure(ctx: ReactionApprovalContext, reason: string): Promise<void> {
    const embed = ctx.message.embeds?.[0];
    if (!embed) return;
    try {
      const originalFields = (embed.fields ?? []).map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline ?? false
      }));
      const failedEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ Solicitud rechazada')
        .setFields(
          ...originalFields,
          { name: 'Motivo', value: reason, inline: false }
        )
        .setTimestamp();
      if (embed.footer?.text) failedEmbed.setFooter({ text: embed.footer.text });
      await ctx.message.edit({ embeds: [failedEmbed] });
    } catch (editError) {
      console.error('Error editing wish failure embed:', editError);
    }
  }
}
