import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { SalaryService } from '../../services/SalaryService';
import { executeWithErrorHandling, validationError } from '../../utils/errorHandler';
import { assertStaffAccess } from '../../utils/staffGuards';
import { COMMAND_NAMES } from '../../config/commandNames';
import {
  DATE_OPTION_VARIANTS,
  ERROR_DATE_FORMAT_PROVIDE,
  FIELD_WEEK_OF,
  FIELD_BASE_SALARY,
  FIELD_ORIGIN_BONUS,
  FIELD_BALANCE_MULTIPLIER,
  FIELD_NET_RYOU,
  FIELD_EXP_GRANTED,
  FIELD_FINAL_BALANCE
} from '../../config/uiStrings';
import {
  getFechaFromOption,
  isMondayInTimezone,
  toDateOnlyUTC
} from '../../utils/dateParser';

const salaryService = new SalaryService(prisma);

function formatClaimDate(d: Date): string {
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export const data = new SlashCommandBuilder()
  .setName('forzar_sueldo')
  .setDescription('Staff: aplica el cobro semanal a un jugador (retroactivo, requiere fecha lunes).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario objetivo al que se le aplicará el sueldo')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('fecha')
      .setDescription(DATE_OPTION_VARIANTS.lunes)
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await executeWithErrorHandling(
    interaction,
    COMMAND_NAMES.forzar_sueldo,
    async (interaction) => {
      await assertStaffAccess(interaction);

      const targetUser = interaction.options.getUser('usuario', true);
      const fechaValue = interaction.options.getString('fecha', true);

      const fechaResult = getFechaFromOption(fechaValue);
      if (fechaResult && 'error' in fechaResult) {
        throw validationError(fechaResult.error);
      }
      if (!fechaResult || !('date' in fechaResult)) {
        throw validationError(ERROR_DATE_FORMAT_PROVIDE);
      }

      const parsedDate = fechaResult.date;
      if (!isMondayInTimezone(parsedDate)) {
        throw validationError('La fecha ingresada DEBE ser un día Lunes.');
      }

      const claimDateNorm = toDateOnlyUTC(parsedDate);
      const result = await salaryService.claimWeeklySalary(targetUser.id, claimDateNorm);

      const embed = new EmbedBuilder()
        .setColor(0x27ae60)
        .setTitle('💰 Sueldo Forzado por Staff')
        .setDescription(
          `Se aplicó el cobro semanal retroactivo a **${result.characterName}** (<@${targetUser.id}>).`
        )
        .addFields(
          {
            name: FIELD_WEEK_OF,
            value: formatClaimDate(result.claimDate),
            inline: false
          },
          { name: FIELD_BASE_SALARY, value: `${result.baseSalary} Ryou`, inline: true },
          { name: FIELD_ORIGIN_BONUS, value: `${result.bonusRyou} Ryou`, inline: true },
          {
            name: FIELD_BALANCE_MULTIPLIER,
            value: `${result.multiplierGanancia.toFixed(2)}x`,
            inline: true
          },
          {
            name: FIELD_NET_RYOU,
            value: `${result.netDeltaRyou >= 0 ? '+' : ''}${result.netDeltaRyou} Ryou`,
            inline: true
          },
          { name: FIELD_EXP_GRANTED, value: `+${result.weeklyExpBonus} EXP`, inline: true },
          { name: FIELD_FINAL_BALANCE, value: `**${result.finalRyou} Ryou**`, inline: true }
        )
        .setFooter({
          text: `Staff: ${interaction.user.tag} | ⚠️ Si la cantidad es incorrecta por multiplicadores (ej. Ambicioso), usa /ajustar_recursos retirar para corregir.`
        })
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
