import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../lib/prisma';

const RASGO_CATEGORIES = [
  'Origen',
  'Nacimiento',
  'Físico',
  'Social',
  'Psicológico',
  'Moral'
];

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

interface TraitDisplay {
  name: string;
  costRC: number;
}

function formatSignedRC(costRC: number): string {
  if (costRC > 0) return `+${costRC}`;
  return `${costRC}`;
}

function getCostIndicator(costRC: number): string {
  if (costRC > 0) return '🟢';
  if (costRC < 0) return '🔴';
  return '⚪';
}

function formatTraitLine(trait: TraitDisplay): string {
  const signedCost = formatSignedRC(trait.costRC);
  const indicator = getCostIndicator(trait.costRC);
  return `**${trait.name}** ${indicator} (${signedCost} RC)`;
}

function formatTraitsForEmbed(traits: TraitDisplay[]): string {
  return traits.map((t) => `• ${formatTraitLine(t)}`).join('\n');
}

interface PlazaDisplay {
  name: string;
  costCupos: number;
  slotsLabel: string;
}

const PLAZA_NAME_WIDTH = 20;
const CUPOS_WIDTH = 6;
const PLAZAS_WIDTH = 10;

function formatPlazaTableRow(plaza: PlazaDisplay): string {
  const name = plaza.name.padEnd(PLAZA_NAME_WIDTH);
  const cupos = String(plaza.costCupos).padEnd(CUPOS_WIDTH);
  const plazas = plaza.slotsLabel.padEnd(PLAZAS_WIDTH);
  return `${name} │ ${cupos} │ ${plazas}`;
}

function formatPlazasTable(plazas: PlazaDisplay[]): string {
  const header = `${'Plaza'.padEnd(PLAZA_NAME_WIDTH)} │ ${'Cupos'.padEnd(CUPOS_WIDTH)} │ ${'Plazas'.padEnd(PLAZAS_WIDTH)}`;
  const divider = `${'-'.repeat(PLAZA_NAME_WIDTH)} ┼ ${'-'.repeat(CUPOS_WIDTH)} ┼ ${'-'.repeat(PLAZAS_WIDTH)}`;
  
  const rows = plazas.map(formatPlazaTableRow);
  return `\`\`\`\n${header}\n${divider}\n${rows.join('\n')}\n\`\`\``;
}

export const data = new SlashCommandBuilder()
  .setName('catalogo')
  .setDescription('Consulta el catalogo de rasgos y plazas disponibles para tu personaje.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('rasgos')
      .setDescription('Lista rasgos por categoria')
      .addStringOption((option) =>
        option
          .setName('categoria')
          .setDescription('Categoria de rasgos')
          .setRequired(true)
          .addChoices(...RASGO_CATEGORIES.map((category) => ({ name: category, value: category })))
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('plazas')
      .setDescription('Lista plazas por categoria')
      .addStringOption((option) =>
        option
          .setName('categoria')
          .setDescription('Categoria de plazas')
          .setRequired(true)
          .addChoices(...PLAZA_CATEGORIES.map((category) => ({ name: category, value: category })))
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand === 'rasgos') {
      const categoryFilter = interaction.options.getString('categoria', true);
      const where = { category: { equals: categoryFilter, mode: 'insensitive' as const } };

      const traits = await prisma.trait.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      });

      if (traits.length === 0) {
        throw new Error('No hay rasgos cargados en el sistema.');
      }

      const traitsDisplay: TraitDisplay[] = traits.map((trait) => ({
        name: trait.name,
        costRC: trait.costRC
      }));

      const traitChunks = chunkByItems(
        traitsDisplay,
        (trait) => formatTraitLine(trait).length + 4
      );

      const embeds: EmbedBuilder[] = [];
      traitChunks.forEach((chunk, index) => {
        const embed = new EmbedBuilder()
          .setColor(0x2b90d9)
          .setTitle(`Rasgos - ${categoryFilter}`)
          .setDescription(formatTraitsForEmbed(chunk))
          .setFooter({ text: `Página ${index + 1} de ${traitChunks.length} • Total: ${traits.length} rasgos` })
          .setTimestamp();

        embeds.push(embed);
      });

      return interaction.editReply({ embeds: embeds.slice(0, 10) });
    }

    const rawCategory = interaction.options.getString('categoria', true);
    const requested = normalizeText(rawCategory);

    const distinctCategories = await prisma.plaza.findMany({
      select: { category: true },
      distinct: ['category']
    });

    const resolvedCategory = distinctCategories
      .map((entry) => entry.category)
      .find((category) => normalizeText(category) === requested);

    if (!resolvedCategory) {
      throw new Error(`Categoria no encontrada: ${rawCategory}`);
    }

    const plazas = await prisma.plaza.findMany({
      where: { category: { equals: resolvedCategory, mode: 'insensitive' } },
      orderBy: [{ name: 'asc' }],
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
      throw new Error('No hay plazas que coincidan con ese filtro.');
    }

    const plazasDisplay: PlazaDisplay[] = plazas.map((plaza) => {
      const holdersCount = plaza.characters.length;
      const slotsLabel = plaza.maxHolders === 0
        ? '∞'
        : `${holdersCount}/${plaza.maxHolders}`;

      return {
        name: truncateText(plaza.name, PLAZA_NAME_WIDTH),
        costCupos: plaza.costCupos,
        slotsLabel
      };
    });

    const plazaChunks = chunkByItems(
      plazasDisplay,
      (plaza) => formatPlazaTableRow(plaza).length + 1
    );

    const embeds = plazaChunks.map((chunk, index) =>
      new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`Catálogo de Plazas - ${resolvedCategory}`)
        .setDescription(formatPlazasTable(chunk))
        .setFooter({ text: `Página ${index + 1} de ${plazaChunks.length} • Total: ${plazas.length} plazas` })
        .setTimestamp()
    );

    return interaction.editReply({ embeds: embeds.slice(0, 10) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al consultar catalogo.';
    return interaction.editReply(`❌ ${message}`);
  }
}
