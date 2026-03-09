import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../lib/prisma';
import { TransactionService } from '../services/TransactionService';
import { assertForumPostContext } from '../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../utils/commandThrottle';
import { executeWithErrorHandling, validationError } from '../utils/errorHandler';

const transactionService = new TransactionService(prisma);

export const data = new SlashCommandBuilder()
    .setName('comprar')
    .setDescription('Compra objetos del mercado de IZANAGI.')
    .addStringOption(opt => 
        opt.setName('items')
           .setDescription('Nombres de los objetos separados por comas (Ej: Kunai, Shuriken, Píldora)')
           .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await executeWithErrorHandling(
        interaction,
        'comprar',
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

        cleanupExpiredCooldowns();
        consumeCommandCooldown({
            commandName: 'comprar',
            actorId: interaction.user.id
        });

        // 3. Ejecutar la transacción atómica
        const resultado = await transactionService.buyItems({
            characterId: character.id,
            itemNames: itemNames
        });

        // 4. Reporte de éxito
        let mensajeExito = `✅ **¡Compra Exitosa!** Has adquirido:\n📦 \`${itemNames.join(', ')}\`\n\n**Costos Aplicados:**\n`;
        if (resultado.costs.RYOU > 0) mensajeExito += `🪙 \`${resultado.costs.RYOU} Ryou\`\n`;
        if (resultado.costs.EXP > 0) mensajeExito += `✨ \`${resultado.costs.EXP} EXP\`\n`;
        if (resultado.costs.PR > 0) mensajeExito += `🏆 \`${resultado.costs.PR} PR\`\n`;

        return interaction.editReply(mensajeExito);
        },
        {
            defer: { ephemeral: true },
            fallbackMessage: 'Error desconocido al procesar la compra.',
            errorEphemeral: true
        }
    );
}