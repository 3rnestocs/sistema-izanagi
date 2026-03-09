import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../lib/prisma';

export const data = new SlashCommandBuilder()
  .setName('rechazar_registro')
  .setDescription('Rechaza una actividad registrada (Staff)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName('actividad_id')
      .setDescription('ID de la actividad a rechazar')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('razon')
      .setDescription('Razón del rechazo')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Este comando es exclusivo de Staff.');
    }

    const activityId = interaction.options.getString('actividad_id', true);
    const reason = interaction.options.getString('razon') || 'Sin especificar';

    const activity = await prisma.activityRecord.findUnique({
      where: { id: activityId },
      include: { character: true }
    });

    if (!activity) {
      throw new Error(`⛔ No se encontró una actividad con ID '${activityId}'.`);
    }

    if (activity.status !== 'PENDING') {
      throw new Error(`⛔ La actividad ya ha sido procesada (Estado: ${activity.status}).`);
    }

    // Update activity status to REJECTED
    const updatedActivity = await prisma.activityRecord.update({
      where: { id: activityId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        characterId: activity.characterId,
        category: 'Actividad Rechazada',
        detail: `Actividad ${activity.activityType} rechazada. Razón: ${reason}`,
        evidence: `Comando /rechazar_registro por ${interaction.user.username}`
      }
    });

    return interaction.editReply(
      `✅ Actividad **${updatedActivity.id}** de **${activity.character.name}** rechazada.\n` +
        `Tipo: ${updatedActivity.activityType}\n` +
        `Razón: ${reason}`
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al rechazar actividad.';
    return interaction.editReply(`❌ ${message}`);
  }
}
