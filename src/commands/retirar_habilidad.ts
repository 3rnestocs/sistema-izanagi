import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { PlazaService } from '../services/PlazaService';
import { handleCommandError } from '../utils/errorHandler';

const plazaService = new PlazaService(prisma);

export const data = new SlashCommandBuilder()
  .setName('retirar_habilidad')
  .setDescription('Remueve una habilidad/plaza de un personaje (Staff)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario al que se le removerá la habilidad')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('habilidad')
      .setDescription('Nombre de la habilidad a remover')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Este comando es exclusivo de Staff.');
    }

    const targetUser = interaction.options.getUser('usuario', true);
    const habilidadName = interaction.options.getString('habilidad', true);

    const character = await prisma.character.findUnique({
      where: { discordId: targetUser.id },
      select: { id: true, name: true }
    });

    if (!character) {
      throw new Error(`⛔ ${targetUser.username} no tiene un personaje registrado.`);
    }

    await plazaService.removePlaza(character.id, habilidadName);

    return interaction.editReply(
      `✅ Habilidad '${habilidadName}' removida de **${character.name}**.\n` +
        `Cupos reembolsados. Rasgos heredados revertidos.`
    );
  } catch (error: unknown) {
    await handleCommandError(error, interaction, {
      commandName: 'retirar_habilidad',
      fallbackMessage: 'Error desconocido al remover habilidad.',
      ephemeral: true
    });
    return;
  }
}
