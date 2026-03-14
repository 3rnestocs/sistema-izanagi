import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { SalaryService } from '../../services/SalaryService';
import { assertForumPostContext } from '../../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../../utils/commandThrottle';
import { executeWithErrorHandling, validationError } from '../../utils/errorHandler';
import { COMMAND_NAMES } from '../../config/commandNames';

const salaryService = new SalaryService(prisma);

async function publishPublicSalaryEmbed(
  interaction: ChatInputCommandInteraction,
  embed: EmbedBuilder
): Promise<void> {
  await interaction.followUp({
    embeds: [embed],
    ephemeral: false
  });
}

export const data = new SlashCommandBuilder()
  .setName('cobrar_sueldo')
  .setDescription('Cobra tu sueldo semanal como personaje (solo los lunes, America/Caracas)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    COMMAND_NAMES.cobrar_sueldo,
    async (interaction) => {
      assertForumPostContext(interaction, { enforceThreadOwnership: true });

      const character = await prisma.character.findUnique({
        where: { discordId: interaction.user.id },
        select: { id: true }
      });
      if (!character) {
        throw validationError('No tienes un personaje registrado. Usa `/registro` para crear uno.');
      }

      cleanupExpiredCooldowns();
      consumeCommandCooldown({
        commandName: COMMAND_NAMES.cobrar_sueldo,
        actorId: interaction.user.id
      });

      const result = await salaryService.claimWeeklySalary(interaction.user.id, false);

      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('💰 Cobro de Sueldo Semanal')
        .setDescription(`**${result.characterName}** ha cobrado su sueldo semanal.`)
        .addFields(
          { name: 'Sueldo Base', value: `${result.baseSalary} Ryou`, inline: true },
          { name: 'Bonos de Origen', value: `${result.bonusRyou} Ryou`, inline: true },
          {
            name: 'Multiplicador de Balance',
            value: `${result.multiplierGanancia.toFixed(2)}x`,
            inline: true
          },
          { name: 'Balance Final', value: `**${result.finalRyou} Ryou**`, inline: true },
          { name: 'Bono EXP Semanal', value: `+${result.weeklyExpBonus} EXP`, inline: true }
        )
        .setTimestamp();

      await publishPublicSalaryEmbed(interaction, embed);
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'Error desconocido al cobrar sueldo.',
      errorEphemeral: true
    }
  );
}
