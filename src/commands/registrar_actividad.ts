import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../lib/prisma';
import { assertForumPostContext } from '../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../utils/commandThrottle';
import { handleCommandError } from '../utils/errorHandler';

export const data = new SlashCommandBuilder()
    .setName('registrar_actividad')
    .setDescription('Registra una actividad on-rol (Misiones, Combates, Tramas) para tu historial.')
    .addStringOption(opt => 
        opt.setName('tipo')
           .setDescription('El tipo de actividad que realizaste')
           .setRequired(true)
           .addChoices(
               { name: '⚔️ Misión', value: 'Misión' },
               { name: '🩸 Combate', value: 'Combate' },
               { name: '📖 Crónica', value: 'Crónica' },
               { name: '🎭 Evento', value: 'Evento' },
               { name: '🎬 Escena', value: 'Escena' },
               { name: '🧪 Experimento', value: 'Experimento' },
               { name: '🩹 Curación', value: 'Curación' },
               { name: '🏆 Logro General', value: 'Logro General' },
               { name: '👑 Logro de Saga', value: 'Logro de Saga' },
               { name: '✍️ Desarrollo Personal', value: 'Desarrollo Personal' },
               { name: '⏳ Timeskip', value: 'Timeskip' },
               { name: '🎂 Mesiversario', value: 'Mesiversario' }
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
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false }); // Público para presumir el rol

    try {
        assertForumPostContext(interaction, { enforceThreadOwnership: true });

        // 1. Identificar al personaje del usuario
        const character = await prisma.character.findUnique({
            where: { discordId: interaction.user.id }
        });

        if (!character) {
            return interaction.editReply("❌ No tienes ninguna ficha registrada. Usa `/registro` primero.");
        }

        // 2. Extraer los datos del formulario
        const tipo = interaction.options.getString('tipo', true);
        const evidencia = interaction.options.getString('evidencia', true);
        const rango = interaction.options.getString('rango'); // Opcional
        const resultado = interaction.options.getString('resultado'); // Opcional

        // 3. Validación de Capa 8 (Evitar incoherencias)
        if ((tipo === 'Misión' || tipo === 'Combate' || tipo === 'Experimento') && (!rango || !resultado)) {
            return interaction.editReply("⚠️ **Atención:** Las Misiones, Combates y Experimentos requieren obligatoriamente que selecciones un `rango` y un `resultado`.");
        }

        cleanupExpiredCooldowns();
        consumeCommandCooldown({
            commandName: 'registrar_actividad',
            actorId: interaction.user.id
        });

        // 4. Guardar en la Base de Datos
        const nuevaActividad = await prisma.activityRecord.create({
            data: {
                characterId: character.id,
                type: tipo,
                rank: rango,
                result: resultado,
                evidenceUrl: evidencia
            }
        });

        // 5. Reporte visual bonito
        let mensajeExito = `📜 **Registro de Actividad Guardado**\n` +
                           `**Ninja:** <@${interaction.user.id}> (${character.name})\n` +
                           `**Actividad:** ${tipo}\n`;
        
        if (rango) mensajeExito += `**Rango/Nivel:** ${rango}\n`;
        if (resultado) mensajeExito += `**Resultado:** ${resultado}\n`;
        
        mensajeExito += `**Evidencia:** [Ver Prueba](${evidencia})`;

        return interaction.editReply(mensajeExito);

    } catch (error: unknown) {
        await handleCommandError(error, interaction, {
            commandName: 'registrar_actividad',
            fallbackMessage: 'No se pudo guardar el registro.',
            ephemeral: false
        });
        return;
    }
}