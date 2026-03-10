import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { executeWithErrorHandling } from '../utils/errorHandler';
import { assertStaffAccess } from '../utils/staffGuards';
import {
  ADJUSTABLE_RESOURCES,
  AdjustableResource,
  ResourceAdjustmentService
} from '../services/ResourceAdjustmentService';

const resourceAdjustmentService = new ResourceAdjustmentService(prisma);

const RESOURCE_CHOICE_LABELS: Record<AdjustableResource, string> = {
  ryou: 'Ryou',
  exp: 'EXP',
  pr: 'PR',
  sp: 'SP',
  cupos: 'Cupos',
  rc: 'RC',
  bts: 'BTS',
  bes: 'BES'
};

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
            name: RESOURCE_CHOICE_LABELS[resource],
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
  });

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await executeWithErrorHandling(
    interaction,
    'ajustar_recursos',
    async (interaction) => {
      await assertStaffAccess(interaction);

      const subcommand = interaction.options.getSubcommand(true);
      if (subcommand !== 'retirar') {
        throw new Error('⛔ Subcomando no soportado.');
      }

      const targetUser = interaction.options.getUser('usuario', true);
      const resource = interaction.options.getString('recurso', true) as AdjustableResource;
      const amount = interaction.options.getInteger('cantidad', true);
      const reason = interaction.options.getString('motivo', true);
      const evidence = interaction.options.getString('evidencia') ?? undefined;

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
            value: evidence ?? 'Sin evidencia adjunta',
            inline: false
          }
        )
        .setFooter({ text: `Staff executor: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'No se pudo completar el ajuste de recursos.',
      errorEphemeral: true
    }
  );
}
