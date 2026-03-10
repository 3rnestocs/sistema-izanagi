import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { assertForumPostContext } from '../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../utils/commandThrottle';
import { executeWithErrorHandling, validationError } from '../utils/errorHandler';
import { RewardCalculatorService } from '../services/RewardCalculatorService';
import { ActivityCapService } from '../services/ActivityCapService';
import { formatChannelReference } from '../utils/channelRefs';
import { ActivityStatus, ActivityType } from '../domain/activityDomain';
import { getHistoricalNarrationRewards } from '../config/historicalNarrations';

const rewardCalculatorService = new RewardCalculatorService();
const activityCapService = new ActivityCapService(prisma);
const ACTIVITY_FORUM_MENTION = formatChannelReference(process.env.ACTIVITY_FORUM_MENTION, '#canal-correcto');

async function publishActivityEmbed(
    interaction: ChatInputCommandInteraction,
    embed: EmbedBuilder
): Promise<void> {
    const deleteButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`ficha_delete:${interaction.user.id}`)
            .setLabel('Eliminar mensaje')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.followUp({
        embeds: [embed],
        components: [deleteButton],
        ephemeral: false
    });

    // Remove the private deferred placeholder to avoid an extra private message.
    await interaction.deleteReply();
}

export const data = new SlashCommandBuilder()
    .setName('registrar_actividad')
    .setDescription('Registra una actividad on-rol (Misiones, Combates, Tramas) para tu historial.')
    .addStringOption(opt => 
        opt.setName('tipo')
           .setDescription('El tipo de actividad que realizaste')
           .setRequired(true)
           .addChoices(
               { name: '⚔️ Misión', value: ActivityType.MISION },
               { name: '🩸 Combate', value: ActivityType.COMBATE },
               { name: '📖 Crónica', value: ActivityType.CRONICA },
               { name: '🎭 Evento', value: ActivityType.EVENTO },
               { name: '🎬 Escena', value: ActivityType.ESCENA },
               { name: '🧪 Experimento', value: ActivityType.EXPERIMENTO },
               { name: '🩹 Curación', value: ActivityType.CURACION },
               { name: '🏆 Logro General', value: ActivityType.LOGRO_GENERAL },
               { name: '👑 Logro de Saga', value: ActivityType.LOGRO_SAGA },
               { name: '🎖️ Logro de Reputación', value: ActivityType.LOGRO_REPUTACION },
               { name: '✍️ Desarrollo Personal', value: ActivityType.DESARROLLO_PERSONAL },
               { name: '⏳ Timeskip', value: ActivityType.TIMESKIP }
           )
    )
    .addStringOption(opt => 
        opt.setName('evidencia')
           .setDescription('Link al foro, pantallazo o mensaje de Discord que prueba la actividad')
           .setRequired(true)
    )
    .addStringOption(opt => 
        opt.setName('rango')
           .setDescription('Nivel de la amenaza o misión (Si aplica)')
           .setRequired(false)
           .addChoices(
               { name: 'Rango D', value: 'D' },
               { name: 'Rango C', value: 'C' },
               { name: 'Rango B', value: 'B' },
               { name: 'Rango A', value: 'A' },
               { name: 'Rango S', value: 'S' }
           )
    )
    .addStringOption(opt =>
        opt.setName('severidad')
           .setDescription('Severidad de herida (solo para Curación)')
           .setRequired(false)
           .addChoices(
               { name: 'Herido Leve', value: 'Herido Leve' },
               { name: 'Herido Grave', value: 'Herido Grave' },
               { name: 'Herido Crítico', value: 'Herido Critico' },
               { name: 'Coma', value: 'Coma' },
               { name: 'Herida Letal', value: 'Herida Letal' }
           )
    )
    .addStringOption(opt => 
        opt.setName('resultado')
           .setDescription('¿Cómo terminó la actividad? (Si aplica)')
           .setRequired(false)
           .addChoices(
               { name: '✅ Victoria / Exitosa', value: 'Exitosa' },
               { name: '❌ Derrota / Fallida', value: 'Fallida' },
               { name: '🤝 Empate', value: 'Empate' },
               { name: '⭐ Destacado (Crónicas/Eventos)', value: 'Destacado' },
               { name: '📝 Participación Normal', value: 'Participación' }
           )
    )
    .addStringOption(opt => 
        opt.setName('nombre_actividad')
           .setDescription('Nombre de la Crónica/Evento para aplicar recompensas históricas (opcional)')
           .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await executeWithErrorHandling(
        interaction,
        'registrar_actividad',
        async (interaction) => {
        assertForumPostContext(interaction, {
            enforceThreadOwnership: true,
            invalidForumMessage:
                `⛔ No puedes usar ese comando en este canal. Ve a ${ACTIVITY_FORUM_MENTION} y lee las instrucciones del post fijado para mas informacion.`,
            invalidThreadOwnershipMessage:
                '⛔ Debes usar tu propio post para registrar actividades.'
        });

        // 1. Identificar al personaje del usuario
        const character = await prisma.character.findUnique({
            where: { discordId: interaction.user.id },
            include: {
                traits: {
                    include: {
                        trait: true
                    }
                }
            }
        });

        if (!character) {
            throw validationError('No tienes ninguna ficha registrada. Usa `/registro` primero.');
        }

        // 2. Extraer los datos del formulario
        const tipo = interaction.options.getString('tipo', true);
        const evidencia = interaction.options.getString('evidencia', true);
        const rango = interaction.options.getString('rango'); // Opcional
        const severidad = interaction.options.getString('severidad'); // Opcional (solo Curación)
        const resultado = interaction.options.getString('resultado'); // Opcional
        const nombreActividad = interaction.options.getString('nombre_actividad'); // Opcional (para Cronica/Evento)

        const valorRangoPersistido = tipo === ActivityType.CURACION ? severidad : rango;
        const isNarration = tipo === ActivityType.CRONICA || tipo === ActivityType.EVENTO;
        const narrationMissWarning = isNarration && nombreActividad && !getHistoricalNarrationRewards(nombreActividad)
            ? `El nombre de actividad proporcionado no coincide con el catálogo histórico. Se aplicó la tabla estándar de ${tipo}.`
            : null;

        // 3. Validación de coherencia
        // Misión, Combate: requieren rango y resultado
        if ((tipo === ActivityType.MISION || tipo === ActivityType.COMBATE) && (!rango || !resultado)) {
            throw validationError('Las Misiones y Combates requieren obligatoriamente que selecciones un `rango` y un `resultado`.');
        }

        // Curación: requiere severidad; no debe usar el campo rango
        if (tipo === ActivityType.CURACION && !severidad) {
            throw validationError('Las Curaciones requieren obligatoriamente que selecciones la `severidad` de la herida.');
        }

        if (tipo === ActivityType.CURACION && rango) {
            throw validationError('Para Curación debes usar el campo `severidad`, no `rango`.');
        }

        if (tipo !== ActivityType.CURACION && severidad) {
            throw validationError('El campo `severidad` solo aplica para actividades de tipo Curación.');
        }

        // Experimento: requiere rango y resultado
        if (tipo === ActivityType.EXPERIMENTO && (!rango || !resultado)) {
            throw validationError('Los Experimentos requieren obligatoriamente que selecciones un `rango` y un `resultado`.');
        }

        // 4. Enforce weekly caps (before creating the record)
        await activityCapService.enforceWeeklyCaps(character.id, tipo);

        cleanupExpiredCooldowns();
        consumeCommandCooldown({
            commandName: 'registrar_actividad',
            actorId: interaction.user.id
        });

        // 5. Guardar en la Base de Datos
        const activityCreateData: Prisma.ActivityRecordCreateInput = {
            character: { connect: { id: character.id } },
            type: tipo,
            rank: valorRangoPersistido,
            result: resultado,
            evidenceUrl: evidencia,
            ...(isNarration && nombreActividad ? { narrationKey: nombreActividad } : {})
        };

        const nuevaActividad = await prisma.activityRecord.create({
            data: activityCreateData
        });

        // 6. Check if auto-approvable and process rewards
        const isAutoApprovable = rewardCalculatorService.isAutoApprovable(tipo);

        if (isAutoApprovable) {
            // Calculate rewards
            const rewards = rewardCalculatorService.calculateRewards(
                character as any,
                { ...nuevaActividad, narrationKey: nombreActividad } as any
            );

            // Apply rewards in a transaction
            await prisma.$transaction(async (tx: any) => {
                await tx.character.update({
                    where: { id: character.id },
                    data: {
                        exp: { increment: rewards.exp },
                        pr: { increment: rewards.pr },
                        ryou: { increment: rewards.ryou }
                    }
                });

                await tx.activityRecord.update({
                    where: { id: nuevaActividad.id },
                    data: { status: ActivityStatus.AUTO_APROBADO }
                });

                await tx.auditLog.create({
                    data: {
                        characterId: character.id,
                        category: 'Registro Automático de Actividad',
                        detail: `Actividad ${tipo} auto-aprobada. Recompensas: EXP=${rewards.exp}, PR=${rewards.pr}, Ryou=${rewards.ryou}`,
                        evidence: evidencia,
                        deltaExp: rewards.exp,
                        deltaPr: rewards.pr,
                        deltaRyou: rewards.ryou
                    }
                });
            });

            const rewardLines = [
                `✨ EXP: +${rewards.exp}`,
                `🏆 PR: +${rewards.pr}`,
                `🪙 Ryou: +${rewards.ryou}`
            ].join('\n');

            const activitySummary = [
                `**ID de Registro:** ${nuevaActividad.id}`,
                `**Estado:** APROBADO AUTOMÁTICAMENTE`,
                `**Ninja:** <@${interaction.user.id}> (${character.name})`,
                `**Actividad:** ${tipo}`,
                ...(valorRangoPersistido
                    ? [tipo === ActivityType.CURACION
                        ? `**Severidad:** ${valorRangoPersistido}`
                        : `**Rango/Nivel:** ${valorRangoPersistido}`]
                    : []),
                ...(resultado ? [`**Resultado:** ${resultado}`] : []),
                `**Evidencia:** [Ver Prueba](${evidencia})`
            ].join('\n');

            const successEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('✅ Actividad Aprobada Automáticamente')
                .setDescription(activitySummary)
                .addFields(
                    {
                        name: '💰 Recompensas Acreditadas',
                        value: rewardLines,
                        inline: false
                    },
                    {
                        name: 'Estado de Acreditación',
                        value: 'Los recursos han sido acreditados a tu ficha de manera inmediata.',
                        inline: false
                    },
                    ...(narrationMissWarning
                        ? [{
                            name: '⚠️ Aviso',
                            value: narrationMissWarning,
                            inline: false
                        }]
                        : [])
                )
                .setTimestamp();

            await publishActivityEmbed(interaction, successEmbed);
            return;
        } else {
            // MANUAL tier: calculate projected rewards for display, leave status as PENDIENTE
            const projectedRewards = rewardCalculatorService.calculateRewards(
                character as any,
                { ...nuevaActividad, narrationKey: nombreActividad } as any
            );

            const projectedRewardLines = [
                `✨ EXP: +${projectedRewards.exp}`,
                `🏆 PR: +${projectedRewards.pr}`,
                `🪙 Ryou: +${projectedRewards.ryou}`
            ].join('\n');

            const pendingSummary = [
                `**ID de Registro:** ${nuevaActividad.id}`,
                `**Estado:** PENDIENTE (requiere revisión de Staff)`,
                `**Ninja:** <@${interaction.user.id}> (${character.name})`,
                `**Actividad:** ${tipo}`,
                ...(valorRangoPersistido
                    ? [tipo === ActivityType.CURACION
                        ? `**Severidad:** ${valorRangoPersistido}`
                        : `**Rango/Nivel:** ${valorRangoPersistido}`]
                    : []),
                ...(resultado ? [`**Resultado:** ${resultado}`] : []),
                `**Evidencia:** [Ver Prueba](${evidencia})`
            ].join('\n');

            const manualNotes = [
                'Los recursos se acreditan solo cuando Staff aprueba este registro con `/aprobar_registro`.',
                ...(projectedRewards.exp === 0 && projectedRewards.pr === 0 && projectedRewards.ryou === 0
                    ? ['Este tipo de actividad requiere revisión manual por parte del staff.']
                    : [])
            ].join('\n');

            const pendingEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📜 Registro de Actividad Guardado')
                .setDescription(pendingSummary)
                .addFields(
                    {
                        name: '💰 Recompensa Proyectada (Pendiente de Aprobación)',
                        value: projectedRewardLines,
                        inline: false
                    },
                    {
                        name: 'Estado de Acreditación',
                        value: manualNotes,
                        inline: false
                    },
                    ...(narrationMissWarning
                        ? [{
                            name: '⚠️ Aviso',
                            value: narrationMissWarning,
                            inline: false
                        }]
                        : [])
                )
                .setTimestamp();

            await publishActivityEmbed(interaction, pendingEmbed);
            return;
        }
        },
        {
            defer: { ephemeral: true },
            fallbackMessage: 'No se pudo guardar el registro.',
            errorEphemeral: true
        }
    );
}