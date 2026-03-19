import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { TransactionService } from '../../services/TransactionService';
import { assertForumPostContext } from '../../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../../utils/commandThrottle';
import { executeWithErrorHandling, validationError } from '../../utils/errorHandler';
import { COMMAND_NAMES } from '../../config/commandNames';
import { DATE_OPTION_VARIANTS } from '../../config/uiStrings';
import { getFechaFromOption } from '../../utils/dateParser';

const transactionService = new TransactionService(prisma);

async function publishPublicVenderEmbed(
  interaction: ChatInputCommandInteraction,
  embed: EmbedBuilder
): Promise<void> {
  await interaction.followUp({
    embeds: [embed],
    ephemeral: false
  });
}

export const data = new SlashCommandBuilder()
  .setName('vender')
  .setDescription('Vende ítems de tu inventario por Ryou (50% del valor base)')
  .addStringOption((option) =>
    option
      .setName('fecha')
      .setDescription(DATE_OPTION_VARIANTS.venta)
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('items')
      .setDescription('Ítems a vender, separados por comas (ej: "Kunai, Shuriken, Kunai")')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    COMMAND_NAMES.vender,
    async (interaction) => {
    assertForumPostContext(interaction, { enforceThreadOwnership: true });

    const character = await prisma.character.findUnique({
      where: { discordId: interaction.user.id },
      select: { id: true, name: true }
    });

    if (!character) {
      throw validationError('No tienes un personaje registrado. Usa `/registro` para crear uno.');
    }

    const itemsInput = interaction.options.getString('items', true);
    const itemNames = itemsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (itemNames.length === 0) {
      throw validationError('Debes especificar al menos un ítem para vender.');
    }

    const fechaResult = getFechaFromOption(interaction.options.getString('fecha'));
    if (fechaResult && 'error' in fechaResult) {
      throw validationError(fechaResult.error);
    }

    cleanupExpiredCooldowns();
    consumeCommandCooldown({
      commandName: COMMAND_NAMES.vender,
      actorId: interaction.user.id
    });

    const result = await transactionService.sellItems({
      characterId: character.id,
      itemNames,
      ...(fechaResult && 'date' in fechaResult ? { createdAt: fechaResult.date } : {})
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

    await publishPublicVenderEmbed(interaction, embed);
    return;
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'Error desconocido al vender ítems.',
      errorEphemeral: true
    }
  );
}
