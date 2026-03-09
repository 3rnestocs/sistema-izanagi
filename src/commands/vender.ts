import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { TransactionService } from '../services/TransactionService';

const transactionService = new TransactionService(prisma);

export const data = new SlashCommandBuilder()
  .setName('vender')
  .setDescription('Vende ítems de tu inventario por Ryou (50% del valor base)')
  .addStringOption((option) =>
    option
      .setName('items')
      .setDescription('Ítems a vender, separados por comas (ej: "Kunai, Shuriken, Kunai")')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  try {
    const character = await prisma.character.findUnique({
      where: { discordId: interaction.user.id },
      select: { id: true, name: true }
    });

    if (!character) {
      throw new Error('⛔ No tienes un personaje registrado. Usa `/registro` para crear uno.');
    }

    const itemsInput = interaction.options.getString('items', true);
    const itemNames = itemsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (itemNames.length === 0) {
      throw new Error('⛔ Debes especificar al menos un ítem para vender.');
    }

    const result = await transactionService.sellItems({
      characterId: character.id,
      itemNames
    });

    const itemDetails = result.itemsSold
      .map((sale) => `• **${sale.itemName}** ×${sale.quantity} → ${sale.sellPrice} Ryou (${(sale.sellPrice / sale.quantity).toFixed(0)} c/u)`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x00AA00)
      .setTitle('💸 Venta de Ítems')
      .setDescription(`**${character.name}** ha vendido ítems al mercado.`)
      .addFields(
        { name: 'Ítems Vendidos', value: itemDetails, inline: false },
        { name: 'Total Ganado', value: `**+${result.totalRyouGained} Ryou**`, inline: false }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al vender ítems.';
    return interaction.editReply(`❌ ${message}`);
  }
}
