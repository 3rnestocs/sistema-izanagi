import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { executeWithErrorHandling } from '../../utils/errorHandler';
import { assertStaffAccess } from '../../utils/staffGuards';
import {
  ADJUSTABLE_RESOURCES,
  AdjustableResource,
  ResourceAdjustmentService
} from '../../services/ResourceAdjustmentService';
import { RESOURCE_LABEL_MAP } from '../../config/resourceLabels';
import { PLACEHOLDER_NO_EVIDENCE } from '../../config/uiStrings';

const resourceAdjustmentService = new ResourceAdjustmentService(prisma);

export const data = new SlashCommandBuilder()
  .setName('ajustar_recursos')
  .setDescription('Ajustes de recursos para moderación staff.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) => {
    subcommand
      .setName('retirar')
      .setDescription('Retira recursos de un personaje con auditoría.')
      .addUserOption((option) =>
        option
          .setName('usuario')
          .setDescription('Usuario objetivo del ajuste')
          .setRequired(true)
      )
      .addStringOption((option) => {
        option
          .setName('recurso')
          .setDescription('Recurso a retirar')
          .setRequired(true);

        for (const resource of ADJUSTABLE_RESOURCES) {
          option.addChoices({
            name: RESOURCE_LABEL_MAP[resource],
            value: resource
          });
        }

        return option;
      })
      .addIntegerOption((option) =>
        option
          .setName('cantidad')
          .setDescription('Cantidad a retirar (se aplica clamp a 0)')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo disciplinario o administrativo del ajuste')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('evidencia')
          .setDescription('URL o referencia opcional para auditoría')
          .setRequired(false)
      );

    return subcommand;
  })
  .addSubcommand((subcommand) => {
    subcommand
      .setName('otorgar')
      .setDescription('Otorga recursos a un personaje con auditoría (ej. aprobación manual de actividad).')
      .addUserOption((option) =>
        option
          .setName('usuario')
          .setDescription('Usuario objetivo del otorgamiento')
          .setRequired(true)
      )
      .addStringOption((option) => {
        option
          .setName('recurso')
          .setDescription('Recurso a otorgar')
          .setRequired(true);

        for (const resource of ADJUSTABLE_RESOURCES) {
          option.addChoices({
            name: RESOURCE_LABEL_MAP[resource],
            value: resource
          });
        }

        return option;
      })
      .addIntegerOption((option) =>
        option
          .setName('cantidad')
          .setDescription('Cantidad a otorgar')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo del otorgamiento (ej. aprobación de registro de actividad)')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('evidencia')
          .setDescription('URL o referencia opcional para auditoría')
          .setRequired(false)
      );

    return subcommand;
  });

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await executeWithErrorHandling(
    interaction,
    'ajustar_recursos',
    async (interaction) => {
      await assertStaffAccess(interaction);

      const subcommand = interaction.options.getSubcommand(true);
      const targetUser = interaction.options.getUser('usuario', true);
      const resource = interaction.options.getString('recurso', true) as AdjustableResource;
      const amount = interaction.options.getInteger('cantidad', true);
      const reason = interaction.options.getString('motivo', true);
      const evidence = interaction.options.getString('evidencia') ?? undefined;

      if (subcommand === 'retirar') {
        const result = await resourceAdjustmentService.removeResource({
          targetDiscordId: targetUser.id,
          resource,
          requestedAmount: amount,
          reason,
          actorDiscordTag: interaction.user.tag,
          ...(evidence ? { evidence } : {})
        });

        const resourceLabel = resourceAdjustmentService.getResourceLabel(result.resource);
        const clampNote = result.appliedAmount < result.requestedAmount
          ? 'Sí (saldo insuficiente, aplicado hasta 0)'
          : 'No';

        const embed = new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle('🛡️ Ajuste Staff de Recursos')
          .setDescription(`Se registró un ajuste sobre **${result.characterName}** (<@${targetUser.id}>).`)
          .addFields(
            {
              name: 'Acción',
              value: 'Retirar',
              inline: true
            },
            {
              name: 'Recurso',
              value: resourceLabel,
              inline: true
            },
            {
              name: 'Solicitado',
              value: `${result.requestedAmount}`,
              inline: true
            },
            {
              name: 'Aplicado',
              value: `${result.appliedAmount}`,
              inline: true
            },
            {
              name: 'Saldo Previo',
              value: `${result.previousValue}`,
              inline: true
            },
            {
              name: 'Saldo Final',
              value: `${result.finalValue}`,
              inline: true
            },
            {
              name: 'Clamp a Cero',
              value: clampNote,
              inline: true
            },
            {
              name: 'Motivo',
              value: reason,
              inline: false
            },
            {
              name: 'Evidencia',
              value: evidence ?? PLACEHOLDER_NO_EVIDENCE,
              inline: false
            }
          )
          .setFooter({ text: `Staff executor: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'otorgar') {
        const result = await resourceAdjustmentService.addResource({
          targetDiscordId: targetUser.id,
          resource,
          amount,
          reason,
          actorDiscordTag: interaction.user.tag,
          ...(evidence ? { evidence } : {})
        });

        const resourceLabel = resourceAdjustmentService.getResourceLabel(result.resource);

        const embed = new EmbedBuilder()
          .setColor(0x27ae60)
          .setTitle('🛡️ Ajuste Staff de Recursos')
          .setDescription(`Se otorgaron recursos a **${result.characterName}** (<@${targetUser.id}>).`)
          .addFields(
            {
              name: 'Acción',
              value: 'Otorgar',
              inline: true
            },
            {
              name: 'Recurso',
              value: resourceLabel,
              inline: true
            },
            {
              name: 'Cantidad',
              value: `${result.appliedAmount}`,
              inline: true
            },
            {
              name: 'Saldo Previo',
              value: `${result.previousValue}`,
              inline: true
            },
            {
              name: 'Saldo Final',
              value: `${result.finalValue}`,
              inline: true
            },
            {
              name: 'Motivo',
              value: reason,
              inline: false
            },
            {
              name: 'Evidencia',
              value: evidence ?? PLACEHOLDER_NO_EVIDENCE,
              inline: false
            }
          )
          .setFooter({ text: `Staff executor: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        throw new Error('⛔ Subcomando no soportado.');
      }
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'No se pudo completar el ajuste de recursos.',
      errorEphemeral: true
    }
  );
}
