import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { TraitOperation } from '@prisma/client';
import { executeWithErrorHandling } from '../../utils/errorHandler';

const EMBED_TITLE = 'Solicitud de Rasgo';
const EMBED_COLOR_PENDING = 0xfee75c;

function formatRcImpact(costRC: number, operation: TraitOperation): string {
  if (operation === 'ASIGNAR') {
    if (costRC < 0) return `Costo: ${Math.abs(costRC)} RC`;
    if (costRC > 0) return `Bonificación: +${costRC} RC`;
    return 'Sin costo RC';
  }
  // RETIRAR
  if (costRC < 0) return `Reembolso: ${Math.abs(costRC)} RC`;
  if (costRC > 0) return `Pérdida: ${costRC} RC`;
  return 'Sin impacto RC';
}

export const data = new SlashCommandBuilder()
  .setName('otorgar_rasgo')
  .setDescription('Solicita asignar o remover un rasgo de tu personaje (requiere aprobación Staff)')
  .addStringOption((option) =>
    option
      .setName('operacion')
      .setDescription('Asignar o remover rasgo')
      .setRequired(true)
      .addChoices(
        { name: 'Asignar', value: 'ASIGNAR' },
        { name: 'Remover', value: 'RETIRAR' }
      )
  )
  .addStringOption((option) =>
    option
      .setName('rasgo')
      .setDescription('Nombre del rasgo (debe existir en el sistema)')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    'otorgar_rasgo',
    async (interaction) => {
      const discordId = interaction.user.id;
      const operation = interaction.options.getString('operacion', true) as 'ASIGNAR' | 'RETIRAR';
      const traitName = interaction.options.getString('rasgo', true);

      const character = await prisma.character.findUnique({
        where: { discordId },
        select: { id: true, name: true }
      });
      if (!character) {
        throw new Error('⛔ No tienes un personaje registrado.');
      }

      const trait = await prisma.trait.findUnique({
        where: { name: traitName }
      });
      if (!trait) {
        throw new Error(`⛔ El rasgo '${traitName}' no existe en el sistema.`);
      }

      const pending = await prisma.pendingTraitRequest.create({
        data: {
          characterId: character.id,
          discordId,
          traitName,
          operation: operation as TraitOperation,
          channelId: interaction.channelId
        }
      });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR_PENDING)
        .setTitle(EMBED_TITLE)
        .addFields(
          { name: 'Personaje', value: character.name, inline: true },
          { name: 'Operación', value: operation === 'ASIGNAR' ? 'Asignar' : 'Remover', inline: true },
          { name: 'Rasgo', value: traitName, inline: true },
          {
            name: 'Costo/Reembolso RC',
            value: formatRcImpact(trait.costRC, operation as TraitOperation),
            inline: false
          }
        )
        .setFooter({
          text: `Reacciona con ✅ para aprobar | ID: ${pending.id}`
        })
        .setTimestamp();

      const reply = await interaction.editReply({
        embeds: [embed]
      });

      await prisma.pendingTraitRequest.update({
        where: { id: pending.id },
        data: { approvalMessageId: reply.id }
      });
    },
    {
      defer: { ephemeral: false },
      fallbackMessage: 'Error desconocido al solicitar rasgo.',
      errorEphemeral: true
    }
  );
}
