import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../lib/prisma';
import { TransactionService } from '../services/TransactionService';

const transactionService = new TransactionService(prisma);

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
    await interaction.deferReply({ ephemeral: false }); // Público para que el otro jugador lo vea

    try {
        const targetUser = interaction.options.getUser('destinatario', true);
        const ryouAmount = interaction.options.getInteger('ryou') || undefined;
        const rawItems = interaction.options.getString('items');

        if (!ryouAmount && !rawItems) {
            return interaction.editReply("⚠️ Debes especificar Ryou o al menos un objeto para transferir.");
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.editReply("🤡 ERROR DE CAPA 8: No puedes transferirte cosas a ti mismo.");
        }

        // 1. Buscar a los actores en la DB
        const sender = await prisma.character.findUnique({ where: { discordId: interaction.user.id } });
        const receiver = await prisma.character.findUnique({ where: { discordId: targetUser.id } });

        if (!sender) return interaction.editReply("❌ No tienes una ficha registrada.");
        if (!receiver) return interaction.editReply(`❌ El usuario ${targetUser.username} no tiene una ficha registrada.`);

        // 2. Preparar los ítems
        const itemNames = rawItems ? rawItems.split(',').map(item => item.trim()).filter(Boolean) : [];

        // 3. Ejecutar la transferencia atómica
        await transactionService.transferItems({
            senderId: sender.id,
            receiverId: receiver.id,
            itemNames: itemNames,
            ryouAmount: ryouAmount
        });

        // 4. Reporte de éxito
        let mensajeExito = `🤝 <@${interaction.user.id}> ha realizado una transferencia a <@${targetUser.id}>:\n`;
        if (ryouAmount) mensajeExito += `🪙 **Ryou:** \`${ryouAmount}\`\n`;
        if (itemNames.length > 0) mensajeExito += `📦 **Objetos:** \`${itemNames.join(', ')}\`\n`;

        return interaction.editReply(mensajeExito);

    } catch (error: any) {
        return interaction.editReply(`❌ **Transferencia Fallida:**\n${error.message}`);
    }
}