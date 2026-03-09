import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { RewardCalculatorService } from '../services/RewardCalculatorService';

const rewardCalculatorService = new RewardCalculatorService();

const PENDING_STATUS = 'PENDIENTE';
const APPROVED_STATUS = 'APROBADO';

export const data = new SlashCommandBuilder()
  .setName('aprobar_registro')
  .setDescription('Aprueba un registro de actividad y aplica recompensas (solo Staff).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName('registro_id')
      .setDescription('ID del ActivityRecord a aprobar')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Este comando es exclusivo de Staff.');
    }

    const recordId = interaction.options.getString('registro_id', true);

    const activityRecord = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      include: { character: true }
    });

    if (!activityRecord) {
      throw new Error('⛔ No existe un ActivityRecord con ese ID.');
    }

    if (activityRecord.status !== PENDING_STATUS) {
      throw new Error(`⛔ El registro ya fue procesado con estado '${activityRecord.status}'.`);
    }

    const rewards = rewardCalculatorService.calculateRewards(activityRecord.character, activityRecord);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.character.update({
        where: { id: activityRecord.characterId },
        data: {
          exp: { increment: rewards.exp },
          pr: { increment: rewards.pr },
          ryou: { increment: rewards.ryou }
        }
      });

      await tx.activityRecord.update({
        where: { id: activityRecord.id },
        data: { status: APPROVED_STATUS }
      });

      await tx.auditLog.create({
        data: {
          characterId: activityRecord.characterId,
          category: 'Aprobación de Actividad',
          detail: `Registro ${activityRecord.id} aprobado por ${interaction.user.tag}. Recompensas => EXP:${rewards.exp}, PR:${rewards.pr}, RYOU:${rewards.ryou}`,
          evidence: activityRecord.evidenceUrl,
          deltaExp: rewards.exp,
          deltaPr: rewards.pr,
          deltaRyou: rewards.ryou
        }
      });
    });

    const response = [
      '✅ Registro aprobado correctamente.',
      `🆔 ID: ${activityRecord.id}`,
      `👤 Personaje: ${activityRecord.character.name}`,
      `✨ EXP: +${rewards.exp}`,
      `🏆 PR: +${rewards.pr}`,
      `🪙 Ryou: +${rewards.ryou}`
    ].join('\n');

    return interaction.editReply(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al aprobar el registro.';
    return interaction.editReply(`❌ ${message}`);
  }
}
