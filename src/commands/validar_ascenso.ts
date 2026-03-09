import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { PromotionService } from '../services/PromotionService';
import { handleCommandError } from '../utils/errorHandler';

const promotionService = new PromotionService(prisma);

const TARGET_CHOICES: Array<{ name: string; value: string }> = [
  { name: 'Nivel D2', value: 'D2' },
  { name: 'Nivel D3', value: 'D3' },
  { name: 'Nivel C1', value: 'C1' },
  { name: 'Nivel C2', value: 'C2' },
  { name: 'Nivel C3', value: 'C3' },
  { name: 'Nivel B1', value: 'B1' },
  { name: 'Nivel B2', value: 'B2' },
  { name: 'Nivel B3', value: 'B3' },
  { name: 'Nivel A1', value: 'A1' },
  { name: 'Nivel A2', value: 'A2' },
  { name: 'Nivel A3', value: 'A3' },
  { name: 'Nivel S1', value: 'S1' },
  { name: 'Nivel S2', value: 'S2' },
  { name: 'Cargo Chuunin', value: 'Chuunin' },
  { name: 'Cargo Tokubetsu Jounin', value: 'Tokubetsu Jounin' },
  { name: 'Cargo Jounin', value: 'Jounin' },
  { name: 'Cargo ANBU', value: 'ANBU' },
  { name: 'Cargo Buntaichoo', value: 'Buntaichoo' },
  { name: 'Cargo Jounin Hanchou', value: 'Jounin Hanchou' },
  { name: 'Cargo Go-Ikenban', value: 'Go-Ikenban' },
  { name: 'Cargo Líder de Clan', value: 'Lider de Clan' },
  { name: 'Cargo Kage', value: 'Kage' }
];

export const data = new SlashCommandBuilder()
  .setName('validar_ascenso')
  .setDescription('Valida si un personaje cumple requisitos de ascenso (nivel o cargo).')
  .addStringOption((option) =>
    option
      .setName('objetivo')
      .setDescription('Nivel o cargo al que se quiere ascender')
      .setRequired(true)
      .addChoices(...TARGET_CHOICES)
  )
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario a validar (solo Staff puede validar a terceros)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const targetUser = interaction.options.getUser('usuario') ?? interaction.user;
    const isSelfCheck = targetUser.id === interaction.user.id;

    if (!isSelfCheck && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Solo el Staff puede validar ascensos de otros usuarios.');
    }

    const objective = interaction.options.getString('objetivo', true);

    const character = await prisma.character.findUnique({
      where: { discordId: targetUser.id },
      select: { id: true, name: true, level: true, rank: true }
    });

    if (!character) {
      throw new Error(`⛔ ${targetUser.username} no tiene ficha registrada.`);
    }

    const result = await promotionService.checkRankRequirements(character.id, objective);

    const lines: string[] = [
      '📋 **Validación de Ascenso**',
      `👤 Personaje: **${character.name}** (<@${targetUser.id}>)`,
      `🎯 Objetivo: **${objective}**`,
      `📌 Estado actual: **${character.level}** | **${character.rank}**`,
      result.passed ? '✅ **Resultado:** Apto para ascenso automático.' : `❌ **Resultado:** ${result.reason ?? 'No apto.'}`,
      '',
      '📊 **Métricas detectadas (aprobadas):**',
      `- EXP: ${result.snapshot.exp}`,
      `- PR: ${result.snapshot.pr}`,
      `- Misiones D/C/B/A/S: ${result.snapshot.missionD}/${result.snapshot.missionC}/${result.snapshot.missionB}/${result.snapshot.missionA}/${result.snapshot.missionS}`,
      `- Misiones A exitosas: ${result.snapshot.missionASuccess}`,
      `- Misiones S exitosas: ${result.snapshot.missionSSuccess}`,
      `- Narraciones: ${result.snapshot.narrations} (Destacadas: ${result.snapshot.highlightedNarrations})`,
      `- Combates: ${result.snapshot.combats} (vs C+: ${result.snapshot.combatsVsCOrHigher}, vs B+: ${result.snapshot.combatsVsBOrHigher}, vs A+: ${result.snapshot.combatsVsAOrHigher})`,
      `- Victorias vs A+: ${result.snapshot.combatWinsVsAOrHigher}`,
      `- Logros: ${result.snapshot.achievements}`
    ];

    if (result.missingRequirements && result.missingRequirements.length > 0) {
      lines.push('', '⛔ **Faltantes automáticos:**');
      for (const item of result.missingRequirements) {
        lines.push(`- ${item}`);
      }
    }

    if (result.manualRequirements && result.manualRequirements.length > 0) {
      lines.push('', '📝 **Revisión manual requerida:**');
      for (const item of result.manualRequirements) {
        lines.push(`- ${item}`);
      }
    }

    return interaction.editReply(lines.join('\n'));
  } catch (error: unknown) {
    await handleCommandError(error, interaction, {
      commandName: 'validar_ascenso',
      fallbackMessage: 'Error desconocido al validar ascenso.',
      ephemeral: true
    });
    return;
  }
}
