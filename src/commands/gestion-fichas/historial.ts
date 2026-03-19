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
import { RESOURCE_LABEL_MAP } from '../../services/ResourceAdjustmentService';
import { LOGRO_GENERAL_CATALOG } from '../../config/activityRewards';
import {
  ERROR_STAFF_ONLY_HISTORIAL,
  ERROR_NO_CHARACTER,
  HISTORIAL_EMPTY,
  HISTORIAL_CONTINUATION,
  BUTTON_DELETE_MESSAGE,
  ERROR_HISTORIAL_FETCH
} from '../../config/uiStrings';

const EMBED_DESC_MAX_LEN = 4000;

const RESOURCE_PATTERN = new RegExp(
  `(${Object.keys(RESOURCE_LABEL_MAP).join('|')})[:=]\\s*(-?\\d+)`,
  'gi'
);

function chunkByLines(lines: string[], maxSize = EMBED_DESC_MAX_LEN): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentSize = 0;

  for (const line of lines) {
    const lineSize = line.length + 1; // +1 por el salto de línea
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

function formatAuditLine(log: { category: string; detail: string; createdAt: Date }): string {
  const date = log.createdAt.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
  const dateTag = `\`${date}\``;

  let icon = '🔹';
  let title = log.category;
  let body = log.detail;

  if (log.category.includes('Actividad')) {
    icon = '📜';
    const typeMatch = body.match(/\((.*?)\)/) || body.match(/Actividad (.*?) (auto-)?aprobada/);
    const type = typeMatch ? typeMatch[1] : 'Actividad';

    const rewardsMatch = body.match(/Recompensas[^\w]+(.*)/);
    const rewardsText = rewardsMatch?.[1] ?? 'Ninguna';
    const rewards = rewardsText.replace(RESOURCE_PATTERN, (_, resource, amount) => {
      const num = Number(amount);
      const sign = num > 0 ? '+' : '';
      const resourceKey = resource.toLowerCase() as keyof typeof RESOURCE_LABEL_MAP;
      const label = RESOURCE_LABEL_MAP[resourceKey] ?? resource;
      return `${sign}${num} ${label}`;
    });

    title = type ?? 'Actividad';
    body = rewards;
  } else if (log.category === 'Ascenso') {
    icon = '🌟';
    title = 'Ascenso';
    body = body.replace('Ascenso de nivel: ', 'Nivel ').replace('Ascenso de rango: ', 'Cargo ');
    const ascensoParts = body.split('. Objetivo:');
    body = (ascensoParts[0] ?? body) as string;
  } else if (log.category.includes('Rasgo')) {
    icon = '🧬';
    title = log.category;
    body = body.replace(' agregado.', '').replace(' removido.', '').replace('Costo RC', 'RC');
  } else if (
    log.category.includes('Stats') ||
    log.category.includes('Recursos') ||
    log.category.includes('Sueldo')
  ) {
    icon = '⚙️';
    title = log.category.includes('Sueldo') ? 'Sueldo' : 'Ajuste de Recursos';
    body = body.replace('Inversión: ', '');
  } else if (log.category.includes('Habilidad') || log.category.includes('Gestor')) {
    icon = '🔥';
    title = 'Habilidad';
    body = body.replace('[INICIAL] Adquisición de: ', '');
  } else if (log.category === 'Creación de Ficha') {
    icon = '🐣';
    title = 'Ficha Creada';
    body = `${LOGRO_GENERAL_CATALOG[0]?.key ?? 'Bienvenido al Shinobi Sekai'}.`;
  }

  return `${dateTag} ${icon} **${title}** | ${body}`;
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
        throw new Error(ERROR_STAFF_ONLY_HISTORIAL);
      }

      const character = await prisma.character.findUnique({
        where: { discordId: targetUser.id }
      });

      if (!character) {
        throw new Error(ERROR_NO_CHARACTER(targetUser.username));
      }

      // Solo traemos el AuditLog (ya contiene todas las actividades, ascensos y compras)
      // Aumentamos considerablemente el límite de 10 a 100.
      const auditLogs = await prisma.auditLog.findMany({
        where: { characterId: character.id },
        orderBy: { createdAt: 'desc' },
        take: 100 
      });

      const embeds: EmbedBuilder[] = [];

      const auditLines =
        auditLogs.length > 0
          ? auditLogs.map(formatAuditLine)
          : [HISTORIAL_EMPTY];
          
      const auditChunks = chunkByLines(auditLines);

      // Creamos los embeds basándonos en los chunks
      auditChunks.forEach((chunk, i) => {
        const embedTitle = i === 0 
          ? `📜 Historial de ${character.name}` 
          : HISTORIAL_CONTINUATION;

        embeds.push(
          new EmbedBuilder()
            .setColor(0xfaa61a) // Amarillo institucional
            .setTitle(embedTitle)
            .setDescription(chunk.join('\n'))
            // Solo ponemos el timestamp en el último bloque para no repetirlo
            .setTimestamp(i === auditChunks.length - 1 ? new Date() : null) 
        );
      });

      const deleteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`historial_delete:${interaction.user.id}`)
          .setLabel(BUTTON_DELETE_MESSAGE)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗑️')
      );

      // Discord permite un máximo de 10 embeds por mensaje.
      return interaction.editReply({
        embeds: embeds.slice(0, 10),
        components: [deleteRow]
      });
    },
    {
      defer: { ephemeral: false },
      fallbackMessage: ERROR_HISTORIAL_FETCH,
      errorEphemeral: true
    }
  );
}