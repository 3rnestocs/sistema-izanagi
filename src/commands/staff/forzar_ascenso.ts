import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { PromotionService } from '../../services/PromotionService';
import { executeWithErrorHandling, validationError } from '../../utils/errorHandler';
import { getFechaFromOption } from '../../utils/dateParser';
import { COMMAND_NAMES } from '../../config/commandNames';
import {
  DATE_OPTION_VARIANTS,
  ERROR_INVALID_DATE,
  ERROR_STAFF_ONLY,
  ERROR_NO_CHARACTER_FICHA,
  FIELD_SP_GRANTED,
  FIELD_BASE_COMPENSATION
} from '../../config/uiStrings';

const promotionService = new PromotionService(prisma);

const LEVEL_CHOICES = PromotionService.LEVEL_ORDER.slice(1).map((l) => ({ name: `Nivel ${l}`, value: l }));

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.forzar_ascenso)
  .setDescription('Staff: Aplica un salto de nivel administrativo (Otorga stats y SP acumulativos).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((o) =>
    o.setName('usuario').setDescription('Usuario al que se le aplicará el ascenso').setRequired(true)
  )
  .addStringOption((o) =>
    o.setName('nivel').setDescription('Nivel de destino').setRequired(true).addChoices(...LEVEL_CHOICES)
  )
  .addStringOption((o) =>
    o.setName('fecha').setDescription(DATE_OPTION_VARIANTS.ascensoShort).setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    COMMAND_NAMES.forzar_ascenso,
    async (interaction) => {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        throw new Error(ERROR_STAFF_ONLY);
      }

      const targetUser = interaction.options.getUser('usuario', true);
      const targetLevel = interaction.options.getString('nivel', true);

      const fechaResult = getFechaFromOption(interaction.options.getString('fecha'));
      if (fechaResult && 'error' in fechaResult) throw validationError(fechaResult.error);
      if (!fechaResult || !('date' in fechaResult)) throw validationError(ERROR_INVALID_DATE);
      const promotedAt = fechaResult.date;

      const character = await prisma.character.findUnique({
        where: { discordId: targetUser.id }
      });

      if (!character) {
        throw new Error(ERROR_NO_CHARACTER_FICHA(targetUser.username));
      }

      const result = await promotionService.forceLevelPromotion(
        character.id,
        targetLevel,
        interaction.user.tag,
        promotedAt
      );

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('⚠️ ASCENSO ADMINISTRATIVO APLICADO')
        .setDescription(`Se ha forzado el ascenso de **${character.name}** saltando requisitos automáticos.`)
        .addFields(
          { name: 'Nivel', value: `${result.previousLevel} ➔ **${result.newLevel}**`, inline: true },
          { name: FIELD_SP_GRANTED, value: `+${result.spGranted}`, inline: true },
          { name: 'Fecha Oficial', value: promotedAt.toLocaleDateString('es-ES'), inline: true }
        );

      if (result.expGranted > 0 || result.prGranted > 0) {
        embed.addFields({
          name: FIELD_BASE_COMPENSATION,
          value: `✨ EXP: +${result.expGranted} | 🏆 PR: +${result.prGranted}`,
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });
    },
    { defer: { ephemeral: false }, errorEphemeral: true }
  );
}
