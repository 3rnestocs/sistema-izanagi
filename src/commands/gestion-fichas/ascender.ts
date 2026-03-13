import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { PromotionService } from '../../services/PromotionService';
import { type OptionalRequirement } from '../../services/LevelUpService';
import { executeWithErrorHandling } from '../../utils/errorHandler';
import { getFechaFromOption } from '../../utils/dateParser';

const promotionService = new PromotionService(prisma);

function isInternalLevel(objective: string): boolean {
  return /^[DCBAS][123]$/.test(objective) || objective === 'S2';
}

const TARGET_CHOICES: Array<{ name: string; value: string }> = [
  { name: 'Nivel D2', value: 'D2' },
  { name: 'Nivel D3', value: 'D3' },
  { name: 'Nivel C1', value: 'C1' },
  { name: 'Nivel C2', value: 'C2' },
  { name: 'Nivel C3', value: 'C3' },
  { name: 'Nivel B1', value: 'B1' },
  { name: 'Nivel B2', value: 'B2' },
  { name: 'Nivel B3', value: 'B3' },
  { name: 'Nivel A1', value: 'A1' },
  { name: 'Nivel A2', value: 'A2' },
  { name: 'Nivel A3', value: 'A3' },
  { name: 'Nivel S1', value: 'S1' },
  { name: 'Nivel S2', value: 'S2' },
  { name: 'Cargo Chuunin', value: 'Chuunin' },
  { name: 'Cargo Tokubetsu Jounin', value: 'Tokubetsu Jounin' },
  { name: 'Cargo Jounin', value: 'Jounin' },
  { name: 'Cargo ANBU', value: 'ANBU' },
  { name: 'Cargo Buntaichoo', value: 'Buntaichoo' },
  { name: 'Cargo Jounin Hanchou', value: 'Jounin Hanchou' },
  { name: 'Cargo Go-Ikenban', value: 'Go-Ikenban' },
  { name: 'Cargo Líder de Clan', value: 'Lider de Clan' },
  { name: 'Cargo Kage', value: 'Kage' }
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
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario al que se le aplicará el ascenso')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('objetivo')
      .setDescription('Nivel o cargo de destino')
      .setRequired(true)
      .addChoices(...TARGET_CHOICES)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    'ascender',
    async (interaction) => {
      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      const targetUser = interaction.options.getUser('usuario', true);
      const objective = interaction.options.getString('objetivo', true);

      if (!isStaff && targetUser.id !== interaction.user.id) {
        throw new Error('⛔ Solo puedes ascendarte a ti mismo. El staff puede ascender a otros.');
      }

      const character = await prisma.character.findUnique({
        where: { discordId: targetUser.id },
        select: { id: true, name: true, level: true, rank: true }
      });

      if (!character) {
        throw new Error(`⛔ ${targetUser.username} no tiene ficha registrada.`);
      }

      const targetType = isInternalLevel(objective) ? 'level' : 'rank';
      const check =
        targetType === 'level'
          ? await promotionService.checkLevelRequirements(character.id, objective)
          : await promotionService.checkRankRequirements(character.id, objective);

      if (check.passed) {
        // APPROVED: proceed to promotion
      } else if (check.promotionState === 'BLOCKED') {
        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ No cumples los requisitos')
          .setDescription(
            `**Personaje:** ${character.name} (<@${targetUser.id}>)\n**Objetivo:** ${objective}\n**Estado actual:** ${character.level} | ${character.rank}`
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
        if (!isStaff) {
          await interaction.editReply({
            content: '⏳ Tu ascenso está pendiente de validación. Se ha publicado un mensaje en el canal para que el Staff lo revise.'
          });

          const staffEmbed = new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle('⏳ Ascenso pendiente de validación')
            .setDescription(
              `**Personaje:** ${character.name} (<@${targetUser.id}>)\n**Objetivo:** ${objective}\n**Estado actual:** ${character.level} | ${character.rank}`
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
            text: 'Un miembro del Staff debe verificar los requisitos anteriores y aplicar el ascenso con /ascender si procede.'
          });

          return interaction.followUp({ embeds: [staffEmbed], ephemeral: false });
        }
        // Staff: fall through to apply promotion
      } else {
        throw new Error(`⛔ No cumples los requisitos: ${check.reason ?? 'Revisa los requisitos de ascenso.'}`);
      }

      const fechaResult = getFechaFromOption(interaction.options.getString('fecha'));
      if (fechaResult && 'error' in fechaResult) {
        throw new Error(`⛔ ${fechaResult.error}`);
      }
      if (!fechaResult || !('date' in fechaResult)) {
        throw new Error('⛔ Debes indicar una fecha válida (DD/MM/YYYY o "hoy").');
      }
      const promotedAt = fechaResult.date;

      const result = await promotionService.applyPromotion(character.id, targetType, objective, promotedAt);

      const fechaFormateada = `${String(promotedAt.getUTCDate()).padStart(2, '0')}/${String(promotedAt.getUTCMonth() + 1).padStart(2, '0')}/${promotedAt.getUTCFullYear()}`;

      const successEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Ascenso aplicado')
        .addFields(
          { name: 'Personaje', value: character.name, inline: true },
          { name: 'Objetivo', value: objective, inline: true },
          { name: 'Nivel anterior', value: character.level, inline: true },
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
