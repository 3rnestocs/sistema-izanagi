import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { executeWithErrorHandling } from '../utils/errorHandler';

type StoreCurrency = 'RYOU' | 'EXP' | 'PR';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 30;

export const data = new SlashCommandBuilder()
  .setName('listar_tienda')
  .setDescription('Lista items del mercado con filtros y paginación (solo Staff).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
    'listar_tienda',
    async (interaction) => {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Este comando es exclusivo de Staff.');
    }

    const currency = interaction.options.getString('moneda') as StoreCurrency | null;
    const categoryFilter = interaction.options.getString('categoria')?.trim();
    const page = interaction.options.getInteger('pagina') ?? 1;
    const requestedPageSize = interaction.options.getInteger('tamano_pagina') ?? DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

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

    const lines = items.map((item, index) => {
      const displayIndex = skip + index + 1;
      return `**${displayIndex}. ${item.name}** | ${item.type}\n${item.currency} ${item.price}`;
    });

    const filterSummary = [
      `Moneda: ${currency ?? 'TODAS'}`,
      `Categoría: ${categoryFilter ?? 'TODAS'}`
    ].join(' • ');

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🛒 Listado de Tienda (Staff)')
      .setDescription(`${filterSummary}`)
      .addFields(
        { name: 'Ítems', value: lines.join('\n\n'), inline: false },
        { name: 'Página', value: `${page}/${totalPages} (${items.length}/${totalItems} ítems)`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'Error desconocido al listar tienda.',
      errorEphemeral: true
    }
  );
}
