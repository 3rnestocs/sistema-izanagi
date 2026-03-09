import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { SalaryService } from '../services/SalaryService';
import { assertForumPostContext } from '../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../utils/commandThrottle';
import { executeWithErrorHandling, validationError } from '../utils/errorHandler';

const salaryService = new SalaryService(prisma);

export const data = new SlashCommandBuilder()
  .setName('cobrar_sueldo')
  .setDescription('Cobra tu sueldo semanal como personaje');

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    'cobrar_sueldo',
    async (interaction) => {
    assertForumPostContext(interaction, { enforceThreadOwnership: true });

    const character = await prisma.character.findUnique({
      where: { discordId: interaction.user.id },
      select: { id: true, name: true }
    });

    if (!character) {
      throw validationError('No tienes un personaje registrado. Usa `/registro` para crear uno.');
    }

    cleanupExpiredCooldowns();
    consumeCommandCooldown({
      commandName: 'cobrar_sueldo',
      actorId: interaction.user.id
    });

    const result = await salaryService.claimWeeklySalary(character.id);

    const embed = new EmbedBuilder()
      .setColor(0x00AA00)
      .setTitle('💰 Cobro de Sueldo Semanal')
      .setDescription(`**${character.name}** ha cobrado su sueldo semanal.`)
      .addFields(
        { name: 'Sueldo Base', value: `${result.baseSalary} Ryou`, inline: true },
        { name: 'Bonificación Rasgos', value: `${result.bonusRyou} Ryou`, inline: true },
        { name: 'Ingreso Bruto', value: `${result.grossSalary} Ryou`, inline: true },
        {
          name: 'Multiplicador Semanal',
          value: `${result.multiplierGanancia.toFixed(2)}x`,
          inline: true
        },
        {
          name: 'Pérdida por Derrochador',
          value: `${result.derrochadorLoss} Ryou`,
          inline: true
        },
        { name: 'Ryou Recibido', value: `+${result.netDeltaRyou} Ryou`, inline: true },
        { name: 'Total de Ryou', value: `**${result.finalRyou} Ryou**`, inline: false }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
    },
    {
      defer: { ephemeral: false },
      fallbackMessage: 'Error desconocido al cobrar sueldo.',
      errorEphemeral: false
    }
  );
}
