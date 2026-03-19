import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { executeWithErrorHandling } from '../../utils/errorHandler';
import { COMMAND_NAMES } from '../../config/commandNames';
import { ActivityStatus } from '../../domain/activityDomain';

const EMBED_FIELD_MAX_LEN = 1020;

function chunkByLines(lines: string[], maxSize = EMBED_FIELD_MAX_LEN): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentSize = 0;

  for (const line of lines) {
    const lineSize = line.length + 1;
    if (currentSize + lineSize > maxSize && current.length > 0) {
      chunks.push(current);
      current = [line];
      currentSize = lineSize;
    } else {
      current.push(line);
      currentSize += lineSize;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
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
  const narrationPart = activity.narrationKey ? ` — ${activity.narrationKey}` : '';
  return `${date} | ${activity.type}${rankPart}${resultPart}${narrationPart} [Ver](${activity.evidenceUrl})`;
}

function formatAuditLine(log: { category: string; detail: string; createdAt: Date }): string {
  const date = log.createdAt.toLocaleDateString('es-ES');
  return `${date} | ${log.category}: ${log.detail}`;
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

      const embeds: EmbedBuilder[] = [];

      const headerEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📜 Historial de ${character.name}`)
        .setDescription(`👤 Personaje desde ${character.createdAt.toLocaleDateString('es-ES')}`)
        .setTimestamp();
      embeds.push(headerEmbed);

      const activityLines =
        activities.length > 0
          ? activities.map(formatActivityLine)
          : ['Ninguna actividad aprobada.'];
      const activityChunks = chunkByLines(activityLines);

      activityChunks.forEach((chunk, i) => {
        const name =
          activityChunks.length > 1
            ? `📋 Actividades recientes (últimas 15) — Página ${i + 1}/${activityChunks.length}`
            : '📋 Actividades recientes (últimas 15)';
        embeds.push(
          new EmbedBuilder()
            .setColor(0x43b581)
            .addFields({ name, value: chunk.join('\n'), inline: false })
            .setTimestamp()
        );
      });

      const auditLines =
        auditLogs.length > 0
          ? auditLogs.map(formatAuditLine)
          : ['Sin eventos registrados.'];
      const auditChunks = chunkByLines(auditLines);

      auditChunks.forEach((chunk, i) => {
        const name =
          auditChunks.length > 1
            ? `⚔️ Ascensos y eventos recientes (últimos 10) — Página ${i + 1}/${auditChunks.length}`
            : '⚔️ Ascensos y eventos recientes (últimos 10)';
        embeds.push(
          new EmbedBuilder()
            .setColor(0xfaa61a)
            .addFields({ name, value: chunk.join('\n'), inline: false })
            .setTimestamp()
        );
      });

      const deleteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`historial_delete:${interaction.user.id}`)
          .setLabel('Eliminar mensaje')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗑️')
      );

      return interaction.editReply({
        embeds: embeds.slice(0, 10),
        components: [deleteRow]
      });
    },
    {
      defer: { ephemeral: false },
      fallbackMessage: 'Error al obtener historial.',
      errorEphemeral: true
    }
  );
}
