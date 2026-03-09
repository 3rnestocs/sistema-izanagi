import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../lib/prisma';

export const data = new SlashCommandBuilder()
  .setName('ficha')
  .setDescription('Visualiza la ficha de un personaje (completa)')
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario cuya ficha deseas ver (opcional, por defecto la tuya)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  try {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;

    // If user is viewing someone else's profile and is not staff, deny
    if (targetUser.id !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Solo staff puede ver fichas de otros personajes.');
    }

    const character = await prisma.character.findUnique({
      where: { discordId: targetUser.id },
      include: {
        traits: { include: { trait: true } },
        plazas: { include: { plaza: true } },
        inventory: { include: { item: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 5 }
      }
    });

    if (!character) {
      throw new Error(`⛔ ${targetUser.username} no tiene un personaje registrado.`);
    }

    // Main Stats Embed
    const statsEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`📋 Ficha de ${character.name}`)
      .setDescription(
        character.fullName
          ? `${character.fullName} (${character.age ? `${character.age} años` : 'Edad desconocida'})`
          : 'Nombre completo no especificado'
      )
      .addFields(
        // Rank and Level
        {
          name: '🎖️ Rango y Nivel',
          value: `Cargo: **${character.rank}**${character.title ? ` (${character.title})` : ''}\nNivel: **${character.level}**${character.isSpecialRank ? ' [Rango Especial]' : ''}`,
          inline: false
        },
        // Resources
        {
          name: '💰 Recursos',
          value: `💵 Ryou: **${character.ryou}**\n📚 EXP: **${character.exp}**\n🌟 PR: **${character.pr}**\n⚡ SP: **${character.sp}**`,
          inline: true
        },
        {
          name: '📦 Recursos Especiales',
          value: `🎁 Cupos: **${character.cupos}**\n🔮 RC: **${character.rc}**\n🏆 BTS: **${character.bts}**\n🧪 BES: **${character.bes}**`,
          inline: true
        },
        // Stats
        {
          name: '💪 Estadísticas Base',
          value: `Fuerza: **${character.fuerza}**\nResistencia: **${character.resistencia}**\nVelocidad: **${character.velocidad}**\nPercepción: **${character.percepcion}**`,
          inline: true
        },
        {
          name: '🧠 Estadísticas Avanzadas',
          value: `Chakra: **${character.chakra}**\nArmas: **${character.armas}**\nInteligencia: **${character.inteligencia}**`,
          inline: true
        }
      );

    // Traits section
    if (character.traits && character.traits.length > 0) {
      const traitsText = character.traits
        .map((ct) => `• **${ct.trait.name}** (${ct.trait.category})`)
        .join('\n');
      statsEmbed.addFields({ name: '🧬 Rasgos', value: traitsText || 'Ninguno', inline: false });
    } else {
      statsEmbed.addFields({ name: '🧬 Rasgos', value: 'Ninguno', inline: false });
    }

    // Plazas section
    if (character.plazas && character.plazas.length > 0) {
      const plazasText = character.plazas
        .map((cp) => `• **${cp.plaza.name}** (${cp.plaza.category}) [Rango ${cp.currentRank}]`)
        .join('\n');
      statsEmbed.addFields({ name: '🏰 Habilidades Asignadas', value: plazasText, inline: false });
    } else {
      statsEmbed.addFields({ name: '🏰 Habilidades Asignadas', value: 'Ninguna', inline: false });
    }

    // Inventory section
    if (character.inventory && character.inventory.length > 0) {
      const inventoryText = character.inventory
        .map((invItem) => `• ${invItem.item.name} ×${invItem.quantity}`)
        .slice(0, 10)
        .join('\n');
      const remaining = character.inventory.length > 10 ? `\n... y ${character.inventory.length - 10} más` : '';
      statsEmbed.addFields({
        name: '🎒 Inventario',
        value: inventoryText + remaining,
        inline: false
      });
    } else {
      statsEmbed.addFields({ name: '🎒 Inventario', value: 'Vacío', inline: false });
    }

    // Recent Activity
    if (character.activities && character.activities.length > 0) {
      const activityText = character.activities
        .map((a) => `• ${a.activityType}: +${a.baseReward} (${a.status})`)
        .join('\n');
      statsEmbed.addFields({ name: '📋 Actividad Reciente', value: activityText, inline: false });
    }

    statsEmbed.setFooter({ text: `Creado: ${character.createdAt.toLocaleDateString('es-ES')}` });
    statsEmbed.setTimestamp();

    return interaction.editReply({ embeds: [statsEmbed] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al obtener ficha.';
    return interaction.editReply(`❌ ${message}`);
  }
}
