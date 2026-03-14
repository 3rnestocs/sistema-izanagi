import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { SalaryService } from '../../services/SalaryService';
import { executeWithErrorHandling } from '../../utils/errorHandler';
import { assertStaffAccess } from '../../utils/staffGuards';
import { COMMAND_NAMES } from '../../config/commandNames';

const salaryService = new SalaryService(prisma);

export const data = new SlashCommandBuilder()
  .setName('forzar_sueldo')
  .setDescription('Staff: aplica el cobro semanal a un jugador de forma forzada (ignora lunes y cooldown).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario objetivo al que se le aplicará el sueldo')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await executeWithErrorHandling(
    interaction,
    COMMAND_NAMES.forzar_sueldo,
    async (interaction) => {
      await assertStaffAccess(interaction);

      const targetUser = interaction.options.getUser('usuario', true);
      const result = await salaryService.claimWeeklySalary(targetUser.id, true);

      const embed = new EmbedBuilder()
        .setColor(0x27ae60)
        .setTitle('💰 Sueldo Forzado por Staff')
        .setDescription(
          `Se aplicó el cobro semanal a **${result.characterName}** (<@${targetUser.id}>).`
        )
        .addFields(
          { name: 'Sueldo Base', value: `${result.baseSalary} Ryou`, inline: true },
          { name: 'Bonos de Origen', value: `${result.bonusRyou} Ryou`, inline: true },
          {
            name: 'Multiplicador de Balance',
            value: `${result.multiplierGanancia.toFixed(2)}x`,
            inline: true
          },
          { name: 'Ryou Neto', value: `${result.netDeltaRyou >= 0 ? '+' : ''}${result.netDeltaRyou} Ryou`, inline: true },
          { name: 'EXP Otorgado', value: `+${result.weeklyExpBonus} EXP`, inline: true },
          { name: 'Balance Final', value: `**${result.finalRyou} Ryou**`, inline: true }
        )
        .setFooter({ text: `Staff executor: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'No se pudo completar el cobro forzado de sueldo.',
      errorEphemeral: true
    }
  );
}
