import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { NpcService } from '../services/NpcService';
import { assertStaffAccess } from '../utils/staffGuards';
import { handleCommandError } from '../utils/errorHandler';

const npcService = new NpcService(prisma);

const LEVEL_CHOICES = [
  'D1',
  'D2',
  'D3',
  'C1',
  'C2',
  'C3',
  'B1',
  'B2',
  'B3',
  'A1',
  'A2',
  'A3',
  'S1',
  'S2'
] as const;

const RANK_CHOICES = [
  'Genin',
  'Chuunin',
  'Tokubetsu Jounin',
  'Jounin',
  'ANBU',
  'Buntaichoo',
  'Jounin Hanchou',
  'Go-Ikenban',
  'Kage'
] as const;

export const data = new SlashCommandBuilder()
  .setName('npc')
  .setDescription('Gestiona NPCs (crear, listar, retirar)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('crear')
      .setDescription('Crea un NPC en el sistema')
      .addStringOption((option) =>
        option
          .setName('nombre')
          .setDescription('Nombre identificador único del NPC')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('nombre_completo')
          .setDescription('Nombre completo/descriptivo del NPC')
          .setRequired(false)
      )
      .addStringOption((option) => {
        option
          .setName('nivel')
          .setDescription('Nivel inicial del NPC')
          .setRequired(false);

        for (const level of LEVEL_CHOICES) {
          option.addChoices({ name: level, value: level });
        }

        return option;
      })
      .addStringOption((option) => {
        option
          .setName('rango')
          .setDescription('Rango base del NPC')
          .setRequired(false);

        for (const rank of RANK_CHOICES) {
          option.addChoices({ name: rank, value: rank });
        }

        return option;
      })
      .addIntegerOption((option) =>
        option
          .setName('edad')
          .setDescription('Edad del NPC (opcional)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(120)
      )
      .addStringOption((option) =>
        option
          .setName('moral')
          .setDescription('Alineación moral/etiqueta del NPC')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('titulo')
          .setDescription('Título opcional (ej: líder, capitán, etc.)')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('notas')
          .setDescription('Notas de staff para auditoría')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('listar')
      .setDescription('Lista NPCs activos o retirados')
      .addIntegerOption((option) =>
        option
          .setName('pagina')
          .setDescription('Página de resultados (por defecto 1)')
          .setRequired(false)
          .setMinValue(1)
      )
      .addBooleanOption((option) =>
        option
          .setName('incluir_retirados')
          .setDescription('Incluye NPCs retirados en el listado')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('buscar')
          .setDescription('Filtra por nombre de NPC')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('retirar')
      .setDescription('Retira (soft-retire) un NPC existente')
      .addStringOption((option) =>
        option
          .setName('npc')
          .setDescription('ID o nombre exacto del NPC a retirar')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo del retiro para auditoría')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand === 'listar') {
      await assertStaffAccess(interaction);

      const page = interaction.options.getInteger('pagina') ?? 1;
      const includeRetired = interaction.options.getBoolean('incluir_retirados') ?? false;
      const search = interaction.options.getString('buscar');

      const result = await npcService.listNpcs({
        page,
        includeRetired,
        ...(search ? { search } : {})
      });

      if (result.npcs.length === 0) {
        return interaction.editReply('ℹ️ No se encontraron NPCs con los filtros proporcionados.');
      }

      const lines = result.npcs.map((npc) => {
        const status = npc.isRetired
          ? `Retirado (${npc.retiredAt ? npc.retiredAt.toISOString().slice(0, 10) : 'sin fecha'})`
          : 'Activo';
        const titleLabel = npc.title ? ` | Título: ${npc.title}` : '';
        return `- ${npc.name} [${npc.id}] | ${npc.rank} ${npc.level}${titleLabel} | ${status}`;
      });

      return interaction.editReply([
        `📋 NPCs (página ${result.page}/${result.totalPages}, total ${result.total})`,
        ...lines
      ].join('\n'));
    }

    await assertStaffAccess(interaction, {
      requireNpcCreationFlag: true,
      prisma
    });

    if (subcommand === 'crear') {
      const name = interaction.options.getString('nombre', true);
      const fullName = interaction.options.getString('nombre_completo');
      const level = interaction.options.getString('nivel');
      const rank = interaction.options.getString('rango');
      const age = interaction.options.getInteger('edad');
      const moral = interaction.options.getString('moral');
      const title = interaction.options.getString('titulo');
      const notes = interaction.options.getString('notas');

      const npc = await npcService.createNpc({
        name,
        ...(fullName ? { fullName } : {}),
        ...(level ? { level } : {}),
        ...(rank ? { rank } : {}),
        ...(age !== null ? { age } : {}),
        ...(moral ? { moral } : {}),
        ...(title ? { title } : {}),
        ...(notes ? { notes } : {}),
        actorDiscordTag: interaction.user.tag
      });

      return interaction.editReply([
        '✅ NPC creado correctamente.',
        `- ID: ${npc.id}`,
        `- Nombre: ${npc.name}`,
        `- Nivel/Rango: ${npc.level} / ${npc.rank}`
      ].join('\n'));
    }

    if (subcommand === 'retirar') {
      const npcReference = interaction.options.getString('npc', true);
      const reason = interaction.options.getString('motivo', true);

      const retired = await npcService.retireNpc({
        npcReference,
        reason,
        actorDiscordTag: interaction.user.tag
      });

      return interaction.editReply([
        '✅ NPC retirado correctamente.',
        `- ID: ${retired.id}`,
        `- Nombre: ${retired.name}`,
        `- Fecha retiro: ${retired.retiredAt.toISOString()}`
      ].join('\n'));
    }

    return interaction.editReply('❌ Subcomando no reconocido.');
  } catch (error: unknown) {
    await handleCommandError(error, interaction, {
      commandName: 'npc',
      fallbackMessage: 'Error desconocido en gestión de NPCs.',
      ephemeral: true
    });
    return;
  }
}
