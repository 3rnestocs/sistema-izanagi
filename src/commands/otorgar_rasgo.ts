import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { CharacterService } from '../services/CharacterService';
import { handleCommandError } from '../utils/errorHandler';

const characterService = new CharacterService(prisma);

export const data = new SlashCommandBuilder()
  .setName('otorgar_rasgo')
  .setDescription('Asigna o remueve rasgos post-creación (Staff)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario al que se le asignará/removerá el rasgo')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('operacion')
      .setDescription('Asignar o remover rasgo')
      .setRequired(true)
      .addChoices(
        { name: 'Asignar', value: 'ASIGNAR' },
        { name: 'Remover', value: 'RETIRAR' }
      )
  )
  .addStringOption((option) =>
    option
      .setName('rasgo')
      .setDescription('Nombre del rasgo (debe existir en el sistema)')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Este comando es exclusivo de Staff.');
    }

    const targetUser = interaction.options.getUser('usuario', true);
    const operation = interaction.options.getString('operacion', true) as 'ASIGNAR' | 'RETIRAR';
    const traitName = interaction.options.getString('rasgo', true);

    const character = await prisma.character.findUnique({
      where: { discordId: targetUser.id },
      select: { id: true, name: true }
    });

    if (!character) {
      throw new Error(`⛔ ${targetUser.username} no tiene un personaje registrado.`);
    }

    let result;
    if (operation === 'ASIGNAR') {
      result = await characterService.addTrait(character.id, traitName);
      return interaction.editReply(
        `✅ Rasgo '${traitName}' asignado a **${character.name}**.\n` +
          `RC disponibles: **${result.rc}** | Stats actualizados.`
      );
    } else {
      result = await characterService.removeTrait(character.id, traitName);
      return interaction.editReply(
        `✅ Rasgo '${traitName}' removido de **${character.name}**.\n` +
          `RC reembolsado: **${result.rc}** | Stats restaurados.`
      );
    }
  } catch (error: unknown) {
    await handleCommandError(error, interaction, {
      commandName: 'otorgar_rasgo',
      fallbackMessage: 'Error desconocido al gestionar rasgo.',
      ephemeral: true
    });
    return;
  }
}
