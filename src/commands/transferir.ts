import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { TransactionService } from '../services/TransactionService';
import { assertForumPostContext } from '../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../utils/commandThrottle';
import { businessRuleError, executeWithErrorHandling, validationError } from '../utils/errorHandler';

const transactionService = new TransactionService(prisma);

async function publishPublicTransferEmbed(
    interaction: ChatInputCommandInteraction,
    embed: EmbedBuilder
): Promise<void> {
    await interaction.followUp({
        embeds: [embed],
        ephemeral: false
    });
}

export const data = new SlashCommandBuilder()
    .setName('transferir')
    .setDescription('Transfiere Ryou y/o objetos a otro personaje.')
    .addUserOption(opt => 
        opt.setName('destinatario')
           .setDescription('El usuario de Discord al que le enviarás las cosas')
           .setRequired(true)
    )
    .addIntegerOption(opt => 
        opt.setName('ryou')
           .setDescription('Cantidad de Ryou a enviar (Opcional)')
           .setMinValue(1)
           .setRequired(false)
    )
    .addStringOption(opt => 
        opt.setName('items')
           .setDescription('Objetos a enviar, separados por comas (Opcional)')
           .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await executeWithErrorHandling(
        interaction,
        'transferir',
        async (interaction) => {
        assertForumPostContext(interaction, { enforceThreadOwnership: true });

        const targetUser = interaction.options.getUser('destinatario', true);
        const ryouAmount = interaction.options.getInteger('ryou') || undefined;
        const rawItems = interaction.options.getString('items');

        if (!ryouAmount && !rawItems) {
            throw validationError('Debes especificar Ryou o al menos un objeto para transferir.');
        }

        if (targetUser.id === interaction.user.id) {
            throw businessRuleError('No puedes transferirte cosas a ti mismo.');
        }

        // 1. Buscar a los actores en la DB
        const sender = await prisma.character.findUnique({ where: { discordId: interaction.user.id } });
        const receiver = await prisma.character.findUnique({ where: { discordId: targetUser.id } });

        if (!sender) throw validationError('No tienes una ficha registrada.');
        if (!receiver) throw validationError(`El usuario ${targetUser.username} no tiene una ficha registrada.`);

        // 2. Preparar los ítems
        const itemNames = rawItems ? rawItems.split(',').map(item => item.trim()).filter(Boolean) : [];

        cleanupExpiredCooldowns();
        consumeCommandCooldown({
            commandName: 'transferir',
            actorId: interaction.user.id,
            scopeKey: targetUser.id
        });

        // 3. Ejecutar la transferencia atómica
        await transactionService.transferItems({
            senderId: sender.id,
            receiverId: receiver.id,
            itemNames: itemNames,
            ryouAmount: ryouAmount
        });

        // 4. Reporte de éxito
        const transferSummary = [
            `Emisor: <@${interaction.user.id}>`,
            `Destinatario: <@${targetUser.id}>`,
            ...(ryouAmount ? [`Ryou: ${ryouAmount}`] : []),
            ...(itemNames.length > 0 ? [`Objetos: ${itemNames.join(', ')}`] : [])
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤝 Transferencia Realizada')
            .setDescription(transferSummary)
            .addFields(
                {
                    name: 'Detalle de Recursos',
                    value: [
                        ...(ryouAmount ? [`🪙 Ryou: ${ryouAmount}`] : []),
                        ...(itemNames.length > 0 ? [`📦 Objetos: ${itemNames.join(', ')}`] : [])
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp();

        await publishPublicTransferEmbed(interaction, embed);
        return;

        },
        {
            defer: { ephemeral: true },
            fallbackMessage: 'Transferencia fallida por error del sistema.',
            errorEphemeral: true
        }
    );
}