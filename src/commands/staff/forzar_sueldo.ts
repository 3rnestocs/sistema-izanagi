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
      .setDescription('Fecha del lunes (formato DD/MM/YYYY o "hoy")')
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
        throw validationError('Debes proporcionar una fecha en formato DD/MM/YYYY o "hoy".');
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
            name: 'Correspondiente a la semana del',
            value: formatClaimDate(result.claimDate),
            inline: false
          },
          { name: 'Sueldo Base', value: `${result.baseSalary} Ryou`, inline: true },
          { name: 'Bonos de Origen', value: `${result.bonusRyou} Ryou`, inline: true },
          {
            name: 'Multiplicador de Balance',
            value: `${result.multiplierGanancia.toFixed(2)}x`,
            inline: true
          },
          {
            name: 'Ryou Neto',
            value: `${result.netDeltaRyou >= 0 ? '+' : ''}${result.netDeltaRyou} Ryou`,
            inline: true
          },
          { name: 'EXP Otorgado', value: `+${result.weeklyExpBonus} EXP`, inline: true },
          { name: 'Balance Final', value: `**${result.finalRyou} Ryou**`, inline: true }
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
