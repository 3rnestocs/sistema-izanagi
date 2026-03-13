import { EmbedBuilder } from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import type { ReactionHandler, ReactionApprovalContext } from './ReactionApprovalRouter';
import type { PlazaService } from './PlazaService';
import type { PlazaGrantType } from './PlazaService';

const WISH_EMBED_TITLE = 'Solicitud de Habilidad';

const FOOTER_REGEX =
  /UserID:\s*(\S+)\s*\|\s*PlazaID:\s*(\S+)\s*\|\s*Tipo:\s*(\S+)(?:\s*\|\s*BTS:\s*(\d+))?(?:\s*\|\s*BES:\s*(\d+))?/;

function parseFooter(footerText: string | null): { userId: string; plazaId: string; tipo: string; bts: number; bes: number } | null {
  if (!footerText) return null;
  const match = footerText.match(FOOTER_REGEX);
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
    const parsed = parseFooter(embed.footer?.text ?? null);
    if (!parsed) {
      await this.editEmbedFailure(ctx, 'No se pudo extraer la información del footer.');
      return false;
    }

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
    return true;
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
