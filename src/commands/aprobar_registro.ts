import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { RewardCalculatorService } from '../services/RewardCalculatorService';
import { executeWithErrorHandling } from '../utils/errorHandler';
import { ActivityStatus, canonicalizeActivityStatus } from '../domain/activityDomain';

const rewardCalculatorService = new RewardCalculatorService();

const PENDING_STATUS = ActivityStatus.PENDIENTE;
const APPROVED_STATUS = ActivityStatus.APROBADO;

export const data = new SlashCommandBuilder()
  .setName('aprobar_registro')
  .setDescription('Aprueba un registro de actividad y aplica recompensas (solo Staff).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName('registro_id')
      .setDescription('ID del ActivityRecord a aprobar')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('exp')
      .setDescription('EXP a otorgar (deja en blanco para automático)')
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName('pr')
      .setDescription('PR a otorgar (deja en blanco para automático)')
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName('ryou')
      .setDescription('Ryou a otorgar (deja en blanco para automático)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    'aprobar_registro',
    async (interaction) => {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Este comando es exclusivo de Staff.');
    }

    const recordId = interaction.options.getString('registro_id', true);
    const expOverride = interaction.options.getInteger('exp');
    const prOverride = interaction.options.getInteger('pr');
    const ryouOverride = interaction.options.getInteger('ryou');

    const activityRecord = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      include: { character: true }
    });

    if (!activityRecord) {
      throw new Error('⛔ No existe un ActivityRecord con ese ID.');
    }

    // Check if already processed (AUTO_APROBADO or APROBADO)
    const normalizedStatus = canonicalizeActivityStatus(activityRecord.status);

    if (normalizedStatus === ActivityStatus.AUTO_APROBADO) {
      throw new Error('⛔ Este registro ya fue auto-aprobado automáticamente. No puede ser procesado nuevamente.');
    }

    if (normalizedStatus !== PENDING_STATUS) {
      throw new Error(`⛔ El registro ya fue procesado con estado '${activityRecord.status}'.`);
    }

    // Determine rewards: use overrides if provided, otherwise calculate
    let rewards;
    if (expOverride !== null || prOverride !== null || ryouOverride !== null) {
      // Staff provided overrides
      rewards = {
        exp: expOverride !== null ? expOverride : 0,
        pr: prOverride !== null ? prOverride : 0,
        ryou: ryouOverride !== null ? ryouOverride : 0
      };
    } else {
      // Calculate using the service
      rewards = rewardCalculatorService.calculateRewards(activityRecord.character, activityRecord as any);
      
      // Warn if result is all zeros (likely a MANUAL type with no overrides)
      if (rewards.exp === 0 && rewards.pr === 0 && rewards.ryou === 0) {
        throw new Error(
          `⛔ No se especificaron recompensas y la actividad '${activityRecord.type}' no tiene tabla automática. ` +
          `Usa los parámetros \`exp\`, \`pr\`, \`ryou\` para establecer recompensas manuales.`
        );
      }
    }

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
          detail: `Registro ${activityRecord.id} (${activityRecord.type}) aprobado por ${interaction.user.tag}. Recompensas => EXP:${rewards.exp}, PR:${rewards.pr}, RYOU:${rewards.ryou}`,
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
      `🎯 Tipo: ${activityRecord.type}`,
      `✨ EXP: +${rewards.exp}`,
      `🏆 PR: +${rewards.pr}`,
      `🪙 Ryou: +${rewards.ryou}`
    ].join('\n');

    return interaction.editReply(response);
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'Error desconocido al aprobar el registro.',
      errorEphemeral: true
    }
  );
}
