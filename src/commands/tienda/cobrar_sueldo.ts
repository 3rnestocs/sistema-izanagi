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
import {
  FIELD_WEEK_OF,
  FIELD_BASE_SALARY,
  FIELD_ORIGIN_BONUS,
  FIELD_BALANCE_MULTIPLIER,
  FIELD_FINAL_BALANCE,
  FIELD_WEEKLY_EXP_BONUS
} from '../../config/uiStrings';
import { getMostRecentMonday } from '../../utils/dateParser';

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

function formatClaimDate(d: Date): string {
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export const data = new SlashCommandBuilder()
  .setName('cobrar_sueldo')
  .setDescription('Cobra tu sueldo semanal (lunes más reciente, Caracas).');

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

      const mostRecentMonday = getMostRecentMonday(new Date());
      const result = await salaryService.claimWeeklySalary(interaction.user.id, mostRecentMonday);

      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('💰 Cobro de Sueldo Semanal')
        .setDescription(`**${result.characterName}** ha cobrado su sueldo semanal.`)
        .addFields(
          { name: FIELD_WEEK_OF, value: formatClaimDate(result.claimDate), inline: false },
          { name: FIELD_BASE_SALARY, value: `${result.baseSalary} Ryou`, inline: true },
          { name: FIELD_ORIGIN_BONUS, value: `${result.bonusRyou} Ryou`, inline: true },
          {
            name: FIELD_BALANCE_MULTIPLIER,
            value: `${result.multiplierGanancia.toFixed(2)}x`,
            inline: true
          },
          { name: FIELD_FINAL_BALANCE, value: `**${result.finalRyou} Ryou**`, inline: true },
          { name: FIELD_WEEKLY_EXP_BONUS, value: `+${result.weeklyExpBonus} EXP`, inline: true }
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
