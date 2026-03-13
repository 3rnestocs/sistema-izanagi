import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { PlazaService, PlazaGrantType } from '../../services/PlazaService';
import { assertForumPostContext } from '../../utils/channelGuards';
import { executeWithErrorHandling, validationError } from '../../utils/errorHandler';

const plazaService = new PlazaService(prisma);

const GRANT_TYPE_CHOICES: Array<{ name: string; value: PlazaGrantType }> = [
  { name: 'Desarrollo', value: 'DESARROLLO' },
  { name: 'Deseo Normal', value: 'DESEO_NORMAL' },
  { name: 'Deseo Especial', value: 'DESEO_ESPECIAL' }
];

const TIPO_LABELS: Record<PlazaGrantType, string> = {
  INICIAL: 'Inicial',
  DESARROLLO: 'Desarrollo',
  DESEO_NORMAL: 'Deseo Normal',
  DESEO_ESPECIAL: 'Deseo Especial'
};

export const data = new SlashCommandBuilder()
  .setName('otorgar_habilidad')
  .setDescription('Solicita una habilidad/plaza para tu personaje. Staff aprobará con ✅.')
  .addStringOption((option) =>
    option
      .setName('plaza')
      .setDescription('Nombre exacto de la plaza/habilidad')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('tipo_otorgamiento')
      .setDescription('Tipo de adquisición según sistema de deseos/habilidades')
      .setRequired(true)
      .addChoices(...GRANT_TYPE_CHOICES)
  )
  .addStringOption((option) =>
    option
      .setName('evidencia')
      .setDescription('URL o referencia del post de deseo / aprobación de staff')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('costo_bts')
      .setDescription('Costo opcional en BTS')
      .setMinValue(1)
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName('costo_bes')
      .setDescription('Costo opcional en BES')
      .setMinValue(1)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    'otorgar_habilidad',
    async (interaction) => {
      assertForumPostContext(interaction, { enforceThreadOwnership: true });

      const plazaName = interaction.options.getString('plaza', true).trim();
      const grantType = interaction.options.getString('tipo_otorgamiento', true) as PlazaGrantType;
      const evidence = interaction.options.getString('evidencia', true).trim();
      const costoBts = interaction.options.getInteger('costo_bts') ?? 0;
      const costoBes = interaction.options.getInteger('costo_bes') ?? 0;

      if (costoBts > 0 && costoBes > 0) {
        throw validationError('Debes elegir solo una ruta de costo: BTS o BES.');
      }

      const character = await prisma.character.findUnique({
        where: { discordId: interaction.user.id },
        select: { id: true, name: true }
      });

      if (!character) {
        throw validationError('No tienes ficha registrada. Usa `/registro` primero.');
      }

      const plaza = await prisma.plaza.findUnique({
        where: { name: plazaName },
        select: { id: true }
      });

      if (!plaza) {
        throw validationError(`La plaza '${plazaName}' no existe. Revisa el nombre en /catalogo.`);
      }

      const embed = new EmbedBuilder()
        .setTitle('Solicitud de Habilidad')
        .setColor(0xfee75c)
        .addFields(
          { name: 'Solicitante', value: `<@${interaction.user.id}> (${character.name})`, inline: false },
          { name: 'Plaza', value: plazaName, inline: true },
          { name: 'Tipo de otorgamiento', value: TIPO_LABELS[grantType], inline: true },
          { name: 'Evidencia', value: evidence, inline: false }
        );

      if (costoBts > 0) {
        embed.addFields({ name: 'Costo BTS', value: String(costoBts), inline: true });
      }
      if (costoBes > 0) {
        embed.addFields({ name: 'Costo BES', value: String(costoBes), inline: true });
      }

      const footerParts = [
        `UserID: ${interaction.user.id}`,
        `PlazaID: ${plaza.id}`,
        `Tipo: ${grantType}`,
        `BTS: ${costoBts}`,
        `BES: ${costoBes}`
      ];
      embed.setFooter({ text: footerParts.join(' | ') });

      return interaction.reply({
        embeds: [embed],
        ephemeral: false
      });
    },
    {
      defer: false,
      fallbackMessage: 'Error al crear solicitud de habilidad.',
      errorEphemeral: true
    }
  );
}
