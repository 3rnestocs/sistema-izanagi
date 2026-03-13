import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { PromotionService } from '../../services/PromotionService';
import { StatValidatorService } from '../../services/StatValidatorService';
import { type OptionalRequirement } from '../../services/LevelUpService';
import { executeWithErrorHandling } from '../../utils/errorHandler';
import { getFechaFromOption } from '../../utils/dateParser';
import { assertForumPostContext } from '../../utils/channelGuards';

const promotionService = new PromotionService(prisma);

const CARGO_CHOICES: Array<{ name: string; value: string }> = [
  { name: 'Chuunin', value: 'Chuunin' },
  { name: 'Tokubetsu Jounin', value: 'Tokubetsu Jounin' },
  { name: 'Jounin', value: 'Jounin' },
  { name: 'ANBU', value: 'ANBU' },
  { name: 'Buntaichoo', value: 'Buntaichoo' },
  { name: 'Jounin Hanchou', value: 'Jounin Hanchou' },
  { name: 'Go-Ikenban', value: 'Go-Ikenban' },
  { name: 'Líder de Clan', value: 'Lider de Clan' },
  { name: 'Kage', value: 'Kage' }
];

function formatOptionalStatus(opt: OptionalRequirement): string {
  if (opt.status === 'COMPLETADO') return '✅ COMPLETADO';
  if (opt.status === 'PARCIAL' && opt.current !== undefined && opt.required !== undefined) {
    return `⚠️ PARCIAL (${opt.current}/${opt.required})`;
  }
  return '❌ SIN_PROGRESO';
}

function formatSnapshotForEmbed(snapshot: {
  exp: number;
  pr: number;
  missionD: number;
  missionC: number;
  missionB: number;
  missionA: number;
  missionS: number;
  missionASuccess: number;
  missionSSuccess: number;
  narrations: number;
  highlightedNarrations: number;
  combats: number;
  combatsVsCOrHigher: number;
  combatsVsBOrHigher: number;
  combatsVsAOrHigher: number;
  combatWinsVsAOrHigher: number;
  combatWinsVsBOrHigher: number;
  achievements: number;
}): string {
  return [
    `EXP: ${snapshot.exp} | PR: ${snapshot.pr}`,
    `Misiones D/C/B/A/S: ${snapshot.missionD}/${snapshot.missionC}/${snapshot.missionB}/${snapshot.missionA}/${snapshot.missionS}`,
    `Misiones A exitosas: ${snapshot.missionASuccess} | S exitosas: ${snapshot.missionSSuccess}`,
    `Narraciones: ${snapshot.narrations} (Destacadas: ${snapshot.highlightedNarrations})`,
    `Combates: ${snapshot.combats} (vs C+: ${snapshot.combatsVsCOrHigher}, vs B+: ${snapshot.combatsVsBOrHigher}, vs A+: ${snapshot.combatsVsAOrHigher})`,
    `Victorias vs A+: ${snapshot.combatWinsVsAOrHigher} | vs B+: ${snapshot.combatWinsVsBOrHigher}`,
    `Logros: ${snapshot.achievements}`
  ].join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('ascender')
  .setDescription('Aplica un ascenso de nivel o cargo cuando los requisitos automáticos se cumplen.')
  .addStringOption((option) =>
    option
      .setName('fecha')
      .setDescription('Fecha del ascenso (en formato DD/MM/YYYY o escribe "hoy").')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('cargo')
      .setDescription('Cargo de destino (opcional). Si no especificas, se aplica ascenso al siguiente nivel.')
      .setRequired(false)
      .addChoices(...CARGO_CHOICES)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    'ascender',
    async (interaction) => {
      // Guard: must be in a gestion thread
      assertForumPostContext(interaction, {
        enforceThreadOwnership: true,
        invalidForumMessage: '⛔ Debes ejecutar este comando en tu thread de gestión dentro del foro de fichas.',
        invalidThreadOwnershipMessage: '⛔ Debes ejecutar este comando en tu propio thread de gestión.'
      });

      const cargo = interaction.options.getString('cargo');

      const character = await prisma.character.findUnique({
        where: { discordId: interaction.user.id },
        select: { id: true, name: true, level: true, rank: true }
      });

      if (!character) {
        throw new Error(`⛔ No tienes ficha registrada.`);
      }

      // Guard: check for existing PENDING promotion
      const existingPending = await prisma.pendingPromotion.findFirst({
        where: {
          characterId: character.id,
          status: 'PENDING'
        }
      });

      if (existingPending) {
        throw new Error('⛔ Ya tienes un ascenso pendiente de validación. Espera a que el Staff lo apruebe.');
      }

      let targetType: 'level' | 'rank';
      let objective: string;

      if (cargo) {
        targetType = 'rank';
        objective = cargo;
      } else {
        const nextLevel = StatValidatorService.getNextLevel(character.level);
        if (!nextLevel) {
          throw new Error(
            `⛔ Ya estás en el nivel máximo (S2). Usa la opción \`cargo\` para ascender de cargo.`
          );
        }
        targetType = 'level';
        objective = nextLevel;
      }

      const fechaResult = getFechaFromOption(interaction.options.getString('fecha'));
      if (fechaResult && 'error' in fechaResult) {
        throw new Error(`⛔ ${fechaResult.error}`);
      }
      if (!fechaResult || !('date' in fechaResult)) {
        throw new Error('⛔ Debes indicar una fecha válida (DD/MM/YYYY o "hoy").');
      }
      const promotedAt = fechaResult.date;

      const check =
        targetType === 'level'
          ? await promotionService.checkLevelRequirements(character.id, objective, promotedAt)
          : await promotionService.checkRankRequirements(character.id, objective, promotedAt);

      if (check.passed) {
        // APPROVED: proceed to promotion
      } else if (check.promotionState === 'BLOCKED') {
        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ No cumples los requisitos')
          .setDescription(
            `**Personaje:** ${character.name}\n**Objetivo:** ${objective}\n**Estado actual:** ${character.level} | ${character.rank}`
          );

        if (check.missingRequirements && check.missingRequirements.length > 0) {
          embed.addFields({
            name: 'Requisitos faltantes',
            value: check.missingRequirements.map((r) => r.replace(/^\s*-\s*/, '• ')).join('\n'),
            inline: false
          });
        }

        if (check.optionalRequirements && check.optionalRequirements.length > 0) {
          const optionalLines = check.optionalRequirements
            .map((opt) => `${opt.description} (${formatOptionalStatus(opt)})`)
            .join('\n');
          embed.addFields({
            name: 'Requisitos opcionales (cumple al menos el mínimo requerido)',
            value: optionalLines,
            inline: false
          });
        }

        return interaction.editReply({ embeds: [embed] });
      } else if (check.promotionState === 'PENDING_STAFF') {
        // Create PendingPromotion record
        const pending = await prisma.pendingPromotion.create({
          data: {
            characterId: character.id,
            discordId: interaction.user.id,
            targetType,
            target: objective,
            channelId: interaction.channelId ?? '',
            manualRequirements: check.manualRequirements ?? []
          }
        });

        const staffEmbed = new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle('⏳ Ascenso pendiente de validación')
          .setDescription(
            `**Personaje:** ${character.name} (<@${interaction.user.id}>)\n**Objetivo:** ${objective}\n**Estado actual:** ${character.level} | ${character.rank}`
          )
          .addFields({
            name: 'Verificación manual requerida',
            value: (check.manualRequirements ?? []).map((r) => `• ${r.replace(/^\s*-\s*/, '')}`).join('\n'),
            inline: false
          })
          .addFields({
            name: 'Métricas del personaje',
            value: formatSnapshotForEmbed(check.snapshot),
            inline: false
          });

        if (check.optionalRequirements && check.optionalRequirements.length > 0) {
          const optionalLines = check.optionalRequirements
            .map((opt) => `${opt.description} (${formatOptionalStatus(opt)})`)
            .join('\n');
          staffEmbed.addFields({
            name: 'Requisitos opcionales (completados)',
            value: optionalLines,
            inline: false
          });
        }

        staffEmbed.setFooter({
          text: `Staff puede aprobar este ascenso reaccionando con ✅ — ID: ${pending.id}`
        });

        // Publish the embed as a non-ephemeral message
        const publishedMessage = await interaction.editReply({ embeds: [staffEmbed] });

        // Save the message ID
        await prisma.pendingPromotion.update({
          where: { id: pending.id },
          data: { approvalMessageId: publishedMessage.id }
        });

        return;
      } else {
        throw new Error(`⛔ No cumples los requisitos: ${check.reason ?? 'Revisa los requisitos de ascenso.'}`);
      }

      const result = await promotionService.applyPromotion(character.id, targetType, objective, promotedAt);

      const fechaFormateada = `${String(promotedAt.getUTCDate()).padStart(2, '0')}/${String(promotedAt.getUTCMonth() + 1).padStart(2, '0')}/${promotedAt.getUTCFullYear()}`;

      const successEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Ascenso aplicado')
        .addFields(
          { name: 'Usuario', value: character.name, inline: true },
          { name: 'Nuevo rango', value: objective, inline: true },
          { name: 'Rango anterior', value: character.level, inline: true },
          { name: 'Cargo anterior', value: character.rank, inline: true },
          { name: 'Fecha', value: fechaFormateada, inline: true }
        );

      if (result.spGranted !== undefined) {
        successEmbed.addFields({ name: 'SP otorgados', value: `+${result.spGranted}`, inline: true });
      }

      return interaction.editReply({ embeds: [successEmbed] });
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'Error desconocido al aplicar ascenso.',
      errorEphemeral: true
    }
  );
}
