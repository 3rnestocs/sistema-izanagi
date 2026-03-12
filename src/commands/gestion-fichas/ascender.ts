import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { PromotionService } from '../../services/PromotionService';
import { executeWithErrorHandling } from '../../utils/errorHandler';
import { getFechaFromOption } from '../../utils/dateParser';

const promotionService = new PromotionService(prisma);

function isInternalLevel(objective: string): boolean {
  return /^[DCBAS][123]$/.test(objective) || objective === 'S2';
}

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
  .setName('ascender')
  .setDescription('Aplica un ascenso de nivel o cargo cuando los requisitos automáticos se cumplen.')
  .addStringOption((option) =>
    option
      .setName('fecha')
      .setDescription('Fecha del ascenso (DD/MM/YYYY).')
      .setRequired(true)
  )
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario al que se le aplicará el ascenso')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('objetivo')
      .setDescription('Nivel o cargo de destino')
      .setRequired(true)
      .addChoices(...TARGET_CHOICES)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(
    interaction,
    'ascender',
    async (interaction) => {
    const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const targetUser = interaction.options.getUser('usuario', true);
    const objective = interaction.options.getString('objetivo', true);

    if (!isStaff && targetUser.id !== interaction.user.id) {
      throw new Error('⛔ Solo puedes ascendarte a ti mismo. El staff puede ascender a otros.');
    }

    const character = await prisma.character.findUnique({
      where: { discordId: targetUser.id },
      select: { id: true, name: true, level: true, rank: true }
    });

    if (!character) {
      throw new Error(`⛔ ${targetUser.username} no tiene ficha registrada.`);
    }

    const targetType = isInternalLevel(objective) ? 'level' : 'rank';

    if (targetType === 'level') {
      const check = await promotionService.checkLevelRequirements(character.id, objective);
      if (!check.passed) {
        throw new Error(`⛔ No cumples los requisitos: ${check.reason ?? 'Revisa con /validar_ascenso.'}`);
      }
    } else {
      const check = await promotionService.checkRankRequirements(character.id, objective);
      if (!check.passed) {
        throw new Error(`⛔ No cumples los requisitos para este cargo: ${check.reason ?? 'Revisa con /validar_ascenso.'}`);
      }
    }

    const fechaResult = getFechaFromOption(interaction.options.getString('fecha'));
    if (fechaResult && 'error' in fechaResult) {
      throw new Error(`⛔ ${fechaResult.error}`);
    }
    const promotedAt = fechaResult && 'date' in fechaResult ? fechaResult.date : undefined;

    const result = await promotionService.applyPromotion(character.id, targetType, objective, promotedAt);

    const responseLines = [
      '✅ Ascenso aplicado correctamente.',
      `👤 Personaje: **${character.name}**`,
      `🎯 Objetivo: **${objective}**`,
      `📈 Nivel Anterior: **${character.level}**`,
      `🏷️ Cargo Anterior: **${character.rank}**`
    ];
    if (result.spGranted !== undefined) {
      responseLines.push(`✨ SP otorgados: **+${result.spGranted}**`);
    }

    return interaction.editReply(responseLines.join('\n'));
    },
    {
      defer: { ephemeral: true },
      fallbackMessage: 'Error desconocido al aplicar ascenso.',
      errorEphemeral: true
    }
  );
}
