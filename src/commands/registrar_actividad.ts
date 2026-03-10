import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../lib/prisma';
import { assertForumPostContext } from '../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../utils/commandThrottle';
import { executeWithErrorHandling, validationError } from '../utils/errorHandler';
import { RewardCalculatorService } from '../services/RewardCalculatorService';
import { ActivityCapService } from '../services/ActivityCapService';
import { formatChannelReference } from '../utils/channelRefs';
import { ActivityStatus, ActivityType, shouldForceManualReview } from '../domain/activityDomain';

const rewardCalculatorService = new RewardCalculatorService();
const activityCapService = new ActivityCapService(prisma);
const ACTIVITY_FORUM_MENTION = formatChannelReference(process.env.ACTIVITY_FORUM_MENTION, '#canal-correcto');

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
        const nuevaActividad = await prisma.activityRecord.create({
            data: {
                characterId: character.id,
                type: tipo,
                rank: valorRangoPersistido,
                result: resultado,
                evidenceUrl: evidencia,
                narrationKey: (tipo === ActivityType.CRONICA || tipo === ActivityType.EVENTO) ? nombreActividad : undefined
            } as any
        });

        // 6. Check if auto-approvable and process rewards
        const isAutoApprovable = rewardCalculatorService.isAutoApprovable(tipo)
            && !shouldForceManualReview(tipo, resultado);

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

            // Reply with FINAL rewards (applied)
            let mensajeExito = `✅ **Actividad Aprobada Automáticamente**\n` +
                               `**ID de Registro:** ${nuevaActividad.id}\n` +
                               `**Estado:** APROBADO AUTOMÁTICAMENTE\n` +
                               `**Ninja:** <@${interaction.user.id}> (${character.name})\n` +
                               `**Actividad:** ${tipo}\n`;
            
            if (valorRangoPersistido) {
                if (tipo === ActivityType.CURACION) {
                    mensajeExito += `**Severidad:** ${valorRangoPersistido}\n`;
                } else {
                    mensajeExito += `**Rango/Nivel:** ${valorRangoPersistido}\n`;
                }
            }
            if (resultado) mensajeExito += `**Resultado:** ${resultado}\n`;
            
            mensajeExito += `**Evidencia:** [Ver Prueba](${evidencia})\n\n` +
                            `## :moneybag: Recompensas Acreditadas\n` +
                            `✨ EXP: +${rewards.exp}\n` +
                            `🏆 PR: +${rewards.pr}\n` +
                            `🪙 Ryou: +${rewards.ryou}\n\n` +
                            `> Los recursos han sido acreditados a tu ficha de manera inmediata.`;

            return interaction.editReply(mensajeExito);
        } else {
            // MANUAL tier: calculate projected rewards for display, leave status as PENDIENTE
            const projectedRewards = rewardCalculatorService.calculateRewards(
                character as any,
                { ...nuevaActividad, narrationKey: nombreActividad } as any
            );

            // Reply with projected rewards (not applied)
            let mensajePendiente = `📜 **Registro de Actividad Guardado**\n` +
                                   `**ID de Registro:** ${nuevaActividad.id}\n` +
                                   `**Estado:** PENDIENTE (requiere revisión de Staff)\n` +
                                   `**Ninja:** <@${interaction.user.id}> (${character.name})\n` +
                                   `**Actividad:** ${tipo}\n`;
            
            if (valorRangoPersistido) {
                if (tipo === ActivityType.CURACION) {
                    mensajePendiente += `**Severidad:** ${valorRangoPersistido}\n`;
                } else {
                    mensajePendiente += `**Rango/Nivel:** ${valorRangoPersistido}\n`;
                }
            }
            if (resultado) mensajePendiente += `**Resultado:** ${resultado}\n`;
            
            mensajePendiente += `**Evidencia:** [Ver Prueba](${evidencia})\n\n` +
                                `## :moneybag: Recompensa Proyectada (Pendiente de Aprobación)\n` +
                                `✨ EXP: +${projectedRewards.exp}\n` +
                                `🏆 PR: +${projectedRewards.pr}\n` +
                                `🪙 Ryou: +${projectedRewards.ryou}\n\n` +
                                `> Los recursos se acreditan solo cuando Staff aprueba este registro con \`/aprobar_registro\`.`;

            if (projectedRewards.exp === 0 && projectedRewards.pr === 0 && projectedRewards.ryou === 0) {
                mensajePendiente += `\n> Este tipo de actividad requiere revisión manual por parte del staff.`;
            }

            return interaction.editReply(mensajePendiente);
        }
        },
        {
            defer: { ephemeral: false },
            fallbackMessage: 'No se pudo guardar el registro.',
            errorEphemeral: false
        }
    );
}