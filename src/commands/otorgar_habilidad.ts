import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../index';
import { PlazaService, PlazaGrantType } from '../services/PlazaService';

const plazaService = new PlazaService(prisma);

const GRANT_TYPE_CHOICES: Array<{ name: string; value: PlazaGrantType }> = [
  { name: 'Desarrollo', value: 'DESARROLLO' },
  { name: 'Deseo Normal', value: 'DESEO_NORMAL' },
  { name: 'Deseo Especial', value: 'DESEO_ESPECIAL' }
];

export const data = new SlashCommandBuilder()
  .setName('otorgar_habilidad')
  .setDescription('Otorga una habilidad/plaza a un personaje (solo Staff).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setDescription('Usuario que recibirá la habilidad')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('plaza')
      .setDescription('Nombre exacto de la plaza/habilidad')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('tipo_otorgamiento')
      .setDescription('Tipo de adquisición según sistema de deseos/habilidades')
      .setRequired(true)
      .addChoices(...GRANT_TYPE_CHOICES)
  )
  .addStringOption((option) =>
    option
      .setName('evidencia')
      .setDescription('URL o referencia del post de deseo / aprobación de staff')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('costo_bts')
      .setDescription('Costo opcional en BTS')
      .setMinValue(1)
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName('costo_bes')
      .setDescription('Costo opcional en BES')
      .setMinValue(1)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('⛔ Este comando es exclusivo de Staff.');
    }

    const targetUser = interaction.options.getUser('usuario', true);
    const plazaName = interaction.options.getString('plaza', true).trim();
    const grantType = interaction.options.getString('tipo_otorgamiento', true) as PlazaGrantType;
    const evidence = interaction.options.getString('evidencia', true).trim();
    const costoBts = interaction.options.getInteger('costo_bts') ?? undefined;
    const costoBes = interaction.options.getInteger('costo_bes') ?? undefined;

    if (costoBts && costoBes) {
      throw new Error('⛔ Debes elegir solo una ruta de costo: BTS o BES.');
    }

    const character = await prisma.character.findUnique({
      where: { discordId: targetUser.id },
      select: {
        id: true,
        name: true,
        cupos: true,
        bts: true,
        bes: true,
        specialWishUsed: true
      }
    });

    if (!character) {
      throw new Error(`⛔ ${targetUser.username} no tiene ficha registrada.`);
    }

    const assignPayload = {
      characterId: character.id,
      plazaName,
      grantType,
      evidence: `${evidence} | Staff: ${interaction.user.tag}`,
      ...(costoBts ? { costoBts } : {}),
      ...(costoBes ? { costoBes } : {})
    };

    await plazaService.assignPlaza(assignPayload);

    const updatedCharacter = await prisma.character.findUnique({
      where: { id: character.id },
      select: {
        cupos: true,
        bts: true,
        bes: true,
        specialWishUsed: true
      }
    });

    const responseLines = [
      '✅ Habilidad otorgada correctamente.',
      `👤 Personaje: **${character.name}** (<@${targetUser.id}>)`,
      `📚 Plaza: **${plazaName}**`,
      `🧾 Tipo: **${grantType}**`,
      `🔗 Evidencia: ${evidence}`,
      '',
      '**Estado actual de recursos:**',
      `- Cupos: ${updatedCharacter?.cupos ?? character.cupos}`,
      `- BTS: ${updatedCharacter?.bts ?? character.bts}`,
      `- BES: ${updatedCharacter?.bes ?? character.bes}`,
      `- Deseo especial usado: ${(updatedCharacter?.specialWishUsed ?? character.specialWishUsed) ? 'Sí' : 'No'}`
    ];

    return interaction.editReply(responseLines.join('\n'));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al otorgar habilidad.';
    return interaction.editReply(`❌ ${message}`);
  }
}
