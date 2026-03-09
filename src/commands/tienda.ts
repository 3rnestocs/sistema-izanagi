import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { assertForumPostContext } from '../utils/channelGuards';
import { executeWithErrorHandling } from '../utils/errorHandler';

type StoreCurrency = 'RYOU' | 'EXP' | 'PR';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 30;

export const data = new SlashCommandBuilder()
  .setName('tienda')
  .setDescription('Explora los ítems del mercado con filtros y paginación.')
  .addStringOption((option) =>
    option
      .setName('moneda')
      .setDescription('Filtrar por moneda')
      .setRequired(false)
      .addChoices(
        { name: 'Ryou', value: 'RYOU' },
        { name: 'EXP', value: 'EXP' },
        { name: 'PR', value: 'PR' }
      )
  )
  .addStringOption((option) =>
    option
      .setName('categoria')
      .setDescription('Filtrar por categoría/tipo (coincidencia parcial)')
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName('pagina')
      .setDescription('Página a consultar')
      .setRequired(false)
      .setMinValue(1)
  )
  .addIntegerOption((option) =>
    option
      .setName('tamano_pagina')
      .setDescription('Cantidad de items por página (máximo 30)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(MAX_PAGE_SIZE)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    'tienda',
    async (interaction) => {
    assertForumPostContext(interaction, { enforceThreadOwnership: true });

    const currency = interaction.options.getString('moneda') as StoreCurrency | null;
    const categoryFilter = interaction.options.getString('categoria')?.trim();
    const page = interaction.options.getInteger('pagina') ?? 1;
    const requestedPageSize = interaction.options.getInteger('tamano_pagina') ?? DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

    // Get user's character for balance display
    const character = await prisma.character.findUnique({
      where: { discordId: interaction.user.id },
      select: { ryou: true, exp: true, pr: true }
    });

    const where: Prisma.ItemWhereInput = {
      ...(currency ? { currency } : {}),
      ...(categoryFilter
        ? {
            type: {
              contains: categoryFilter,
              mode: 'insensitive'
            }
          }
        : {})
    };

    const totalItems = await prisma.item.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (page > totalPages) {
      throw new Error(`⛔ Página fuera de rango. Máximo disponible: ${totalPages}.`);
    }

    const skip = (page - 1) * pageSize;

    const items = await prisma.item.findMany({
      where,
      orderBy: [
        { currency: 'asc' },
        { type: 'asc' },
        { price: 'asc' },
        { name: 'asc' }
      ],
      skip,
      take: pageSize
    });

    if (items.length === 0) {
      throw new Error('ℹ️ No hay items que coincidan con los filtros.');
    }

    // Build embed with items
    const itemFields = items.map((item, index) => {
      const displayIndex = skip + index + 1;
      return `**${displayIndex}. ${item.name}** | ${item.type}\n${item.currency} ${item.price}`;
    });

    const filterSummary = [
      currency ? `Moneda: ${currency}` : null,
      categoryFilter ? `Categoría: ${categoryFilter}` : null
    ]
      .filter(Boolean)
      .join(' • ') || 'Sin filtros';

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🛒 Tienda del Mercado')
      .setDescription(`Explora los ítems disponibles para comprar.\n\n${filterSummary}`)
      .addFields(
        { name: 'Ítems Disponibles', value: itemFields.join('\n\n'), inline: false },
        { name: 'Página', value: `${page}/${totalPages} (${items.length}/${totalItems} ítems)`, inline: true }
      );

    // Add balance info if character exists
    if (character) {
      embed.addFields(
        { name: 'Tu Balance', value: `💰 ${character.ryou} Ryou | 📚 ${character.exp} EXP | 🌟 ${character.pr} PR`, inline: false }
      );
    }

    embed.setTimestamp();

    return interaction.editReply({ embeds: [embed] });
    },
    {
      defer: { ephemeral: false },
      fallbackMessage: 'Error desconocido al listar tienda.',
      errorEphemeral: false
    }
  );
}
