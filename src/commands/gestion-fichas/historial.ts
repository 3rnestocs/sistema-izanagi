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

// Aumentamos el límite porque ahora usaremos la 'description' del embed (límite 4096)
const EMBED_DESC_MAX_LEN = 4000; 

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
          : ['Sin eventos registrados en el historial.'];
          
      const auditChunks = chunkByLines(auditLines);

      // Creamos los embeds basándonos en los chunks
      auditChunks.forEach((chunk, i) => {
        const embedTitle = i === 0 
          ? `📜 Historial de ${character.name}` 
          : '...continuación del historial...';

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
          .setLabel('Eliminar mensaje')
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
      fallbackMessage: 'Error al obtener historial.',
      errorEphemeral: true
    }
  );
}