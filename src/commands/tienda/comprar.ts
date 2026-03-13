import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../../lib/prisma';
import { TransactionService } from '../../services/TransactionService';
import { assertForumPostContext } from '../../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../../utils/commandThrottle';
import { executeWithErrorHandling, validationError } from '../../utils/errorHandler';
import { COMMAND_NAMES } from '../../config/commandNames';
import { getFechaFromOption } from '../../utils/dateParser';

const transactionService = new TransactionService(prisma);

export const data = new SlashCommandBuilder()
    .setName('comprar')
    .setDescription('Compra objetos del mercado de IZANAGI.')
    .addStringOption(opt =>
        opt.setName('fecha')
           .setDescription('Fecha de la compra (en formato DD/MM/YYYY o escribe "hoy").')
           .setRequired(true)
    )
    .addStringOption(opt => 
        opt.setName('items')
           .setDescription('Nombres de los objetos separados por comas (Ej: Kunai, Shuriken, Píldora)')
           .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await executeWithErrorHandling(
        interaction,
        COMMAND_NAMES.comprar,
        async (interaction) => {
        assertForumPostContext(interaction, { enforceThreadOwnership: true });

        // 1. Identificar al comprador
        const character = await prisma.character.findUnique({
            where: { discordId: interaction.user.id }
        });

        if (!character) {
            throw validationError('No tienes ninguna ficha registrada.');
        }

        // 2. Sanitizar el input del usuario (Capa 8)
        const rawItems = interaction.options.getString('items', true);
        const itemNames = rawItems.split(',').map(item => item.trim()).filter(Boolean);

        if (itemNames.length === 0) {
            throw validationError('Debes escribir al menos un objeto válido.');
        }

        const fechaResult = getFechaFromOption(interaction.options.getString('fecha'));
        if (fechaResult && 'error' in fechaResult) {
            throw validationError(fechaResult.error);
        }

        cleanupExpiredCooldowns();
        consumeCommandCooldown({
            commandName: COMMAND_NAMES.comprar,
            actorId: interaction.user.id
        });

        // 3. Ejecutar la transacción atómica
        const resultado = await transactionService.buyItems({
            characterId: character.id,
            itemNames: itemNames,
            ...(fechaResult && 'date' in fechaResult ? { createdAt: fechaResult.date } : {})
        });

        // 4. Reporte de éxito
        const appliedCosts = [
            ...(resultado.costs.RYOU > 0 ? [`🪙 ${resultado.costs.RYOU} Ryou`] : []),
            ...(resultado.costs.EXP > 0 ? [`✨ ${resultado.costs.EXP} EXP`] : []),
            ...(resultado.costs.PR > 0 ? [`🏆 ${resultado.costs.PR} PR`] : [])
        ].join('\n') || 'Sin costo aplicado';

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('✅ Compra Exitosa')
            .setDescription(`Has adquirido: **${itemNames.join(', ')}**`)
            .addFields(
                { name: '📦 Ítems Comprados', value: itemNames.join(', '), inline: false },
                { name: '💰 Costos Aplicados', value: appliedCosts, inline: false }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
        },
        {
            defer: { ephemeral: true },
            fallbackMessage: 'Error desconocido al procesar la compra.',
            errorEphemeral: true
        }
    );
}