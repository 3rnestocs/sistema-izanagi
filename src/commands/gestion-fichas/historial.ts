import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { executeWithErrorHandling } from '../../utils/errorHandler';
import { COMMAND_NAMES } from '../../config/commandNames';
import { ActivityStatus } from '../../domain/activityDomain';

const NARRATION_KEY_MAX_LEN = 30;
const EMBED_FIELD_MAX_LEN = 1020; // Discord limit 1024, keep buffer

function truncateText(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  if (maxLen <= 3) return '.'.repeat(Math.max(0, maxLen));
  return `${value.slice(0, maxLen - 3)}...`;
}

function formatActivityLine(activity: {
  type: string;
  rank: string | null;
  result: string | null;
  narrationKey: string | null;
  evidenceUrl: string;
  createdAt: Date;
}): string {
  const date = activity.createdAt.toLocaleDateString('es-ES');
  const rankPart = activity.rank ? ` ${activity.rank}` : '';
  const resultPart = activity.result ? ` ${activity.result}` : '';
  const narrationPart = activity.narrationKey
    ? ` — ${truncateText(activity.narrationKey, NARRATION_KEY_MAX_LEN)}`
    : '';
  return `${date} | ${activity.type}${rankPart}${resultPart}${narrationPart} [Ver](${activity.evidenceUrl})`;
}

function formatAuditLine(log: { category: string; detail: string; createdAt: Date }): string {
  const date = log.createdAt.toLocaleDateString('es-ES');
  const shortCategory = log.category.length > 25 ? truncateText(log.category, 22) + '...' : log.category;
  const truncatedDetail = truncateText(log.detail, 60);
  return `${date} | ${shortCategory}: ${truncatedDetail}`;
}

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.historial)
  .setDescription('Historial de un personaje (actividades, ascensos, eventos)')
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario cuyo historial deseas ver (opcional, por defecto el tuyo)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    COMMAND_NAMES.historial,
    async (interaction) => {
      const targetUser = interaction.options.getUser('usuario') ?? interaction.user;

      if (
        targetUser.id !== interaction.user.id &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        throw new Error('⛔ Solo staff puede ver el historial de otros personajes.');
      }

      const character = await prisma.character.findUnique({
        where: { discordId: targetUser.id }
      });

      if (!character) {
        throw new Error(`⛔ ${targetUser.username} no tiene un personaje registrado.`);
      }

      const [activities, auditLogs] = await Promise.all([
        prisma.activityRecord.findMany({
          where: {
            characterId: character.id,
            status: { in: [ActivityStatus.APROBADO, ActivityStatus.AUTO_APROBADO] }
          },
          orderBy: { createdAt: 'desc' },
          take: 15
        }),
        prisma.auditLog.findMany({
          where: { characterId: character.id },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      ]);

      let activitiesText =
        activities.length > 0
          ? activities.map(formatActivityLine).join('\n')
          : 'Ninguna actividad aprobada.';
      if (activitiesText.length > EMBED_FIELD_MAX_LEN) {
        activitiesText = truncateText(activitiesText, EMBED_FIELD_MAX_LEN - 15) + '\n(truncado)';
      }

      let auditText =
        auditLogs.length > 0
          ? auditLogs.map(formatAuditLine).join('\n')
          : 'Sin eventos registrados.';
      if (auditText.length > EMBED_FIELD_MAX_LEN) {
        auditText = truncateText(auditText, EMBED_FIELD_MAX_LEN - 15) + '\n(truncado)';
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Historial de ${character.name}`)
        .setDescription(`Personaje desde ${character.createdAt.toLocaleDateString('es-ES')}`)
        .addFields(
          {
            name: 'Actividades recientes (últimas 15)',
            value: activitiesText,
            inline: false
          },
          {
            name: 'Ascensos y eventos recientes (últimos 10)',
            value: auditText,
            inline: false
          }
        )
        .setFooter({
          text: 'Última actualización • Usa /historial para refrescar'
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'Error al obtener historial.',
      errorEphemeral: true
    }
  );
}
