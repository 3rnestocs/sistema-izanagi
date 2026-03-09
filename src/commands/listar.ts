import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { handleCommandError } from '../utils/errorHandler';

const PLAZA_CATEGORIES = [
  'Elementos',
  'Clanes',
  'Especiales',
  'Bijuu'
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function truncateText(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  if (maxLen <= 3) return '.'.repeat(Math.max(0, maxLen));
  return `${value.slice(0, maxLen - 3)}...`;
}

function chunkByItems<T>(items: T[], getSize: (item: T) => number, maxSize = 1000): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentSize = 0;

  for (const item of items) {
    const itemSize = getSize(item);
    if (currentSize + itemSize > maxSize && current.length > 0) {
      chunks.push(current);
      current = [item];
      currentSize = itemSize;
    } else {
      current.push(item);
      currentSize += itemSize;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

interface ActivePlazaDisplay {
  name: string;
  users: string;
}

const PLAZA_NAME_WIDTH = 20;
const USUARIOS_WIDTH = 40;

function formatActivePlazaTableRow(plaza: ActivePlazaDisplay): string {
  const name = plaza.name.padEnd(PLAZA_NAME_WIDTH);
  const users = plaza.users.padEnd(USUARIOS_WIDTH);
  return `${name} │ ${users}`;
}

function formatActivePlazasTable(plazas: ActivePlazaDisplay[]): string {
  const header = `${'Plaza'.padEnd(PLAZA_NAME_WIDTH)} │ ${'Usuarios'.padEnd(USUARIOS_WIDTH)}`;
  const divider = `${'-'.repeat(PLAZA_NAME_WIDTH)} ┼ ${'-'.repeat(USUARIOS_WIDTH)}`;
  const rows = plazas.map(formatActivePlazaTableRow);
  return `\`\`\`\n${header}\n${divider}\n${rows.join('\n')}\n\`\`\``;
}

export const data = new SlashCommandBuilder()
  .setName('listar')
  .setDescription('Listados utiles del sistema.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('plazas')
      .setDescription('Lista plazas activas (solo con al menos 1 usuario).')
      .addStringOption((option) =>
        option
          .setName('categoria')
          .setDescription('Filtra por categoria de plaza')
          .setRequired(false)
          .addChoices(...PLAZA_CATEGORIES.map((category) => ({ name: category, value: category })))
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand !== 'plazas') {
      throw new Error('Subcomando no soportado.');
    }

    const rawCategory = interaction.options.getString('categoria');
    let resolvedCategory: string | null = null;

    if (rawCategory) {
      const requested = normalizeText(rawCategory);
      const distinctCategories = await prisma.plaza.findMany({
        select: { category: true },
        distinct: ['category']
      });

      resolvedCategory = distinctCategories
        .map((entry) => entry.category)
        .find((category) => normalizeText(category) === requested) ?? null;

      if (!resolvedCategory) {
        throw new Error(`Categoria no encontrada: ${rawCategory}`);
      }
    }

    const plazas = await prisma.plaza.findMany({
      where: {
        ...(resolvedCategory
          ? { category: { equals: resolvedCategory, mode: 'insensitive' as const } }
          : {}),
        characters: {
          some: {}
        }
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        characters: {
          include: {
            character: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (plazas.length === 0) {
      return interaction.editReply('ℹ️ No hay plazas activas para ese filtro.');
    }

    const activePlazas: ActivePlazaDisplay[] = plazas.map((plaza) => {
      const holders = plaza.characters
        .map((cp) => cp.character.name)
        .sort((a, b) => a.localeCompare(b, 'es'));

      return {
        name: truncateText(plaza.name, PLAZA_NAME_WIDTH),
        users: truncateText(holders.join(', '), USUARIOS_WIDTH)
      };
    });

    const plazaChunks = chunkByItems(
      activePlazas,
      (plaza) => formatActivePlazaTableRow(plaza).length + 1,
      1000
    );

    const embeds = plazaChunks.map((chunk, index) =>
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(resolvedCategory ? `Plazas Activas - ${resolvedCategory}` : 'Plazas Activas')
        .setDescription(formatActivePlazasTable(chunk))
        .setFooter({ text: `Página ${index + 1} de ${plazaChunks.length} • Total: ${plazas.length} plazas activas` })
        .setTimestamp()
    );

    return interaction.editReply({ embeds: embeds.slice(0, 10) });
  } catch (error: unknown) {
    await handleCommandError(error, interaction, {
      commandName: 'listar',
      fallbackMessage: 'Error desconocido al listar plazas activas.',
      ephemeral: true
    });
    return;
  }
}
