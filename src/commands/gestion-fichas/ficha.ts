import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { prisma } from '../../lib/prisma';
import { assertForumPostContext } from '../../utils/channelGuards';
import { StatValidatorService } from '../../services/StatValidatorService';
import { handleCommandError } from '../../utils/errorHandler';

const statValidatorService = new StatValidatorService();
const ZERO_WIDTH_SPACE = '\u200B';
const TRACKED_STATS = ['fuerza', 'resistencia', 'velocidad', 'percepcion', 'chakra', 'armas', 'inteligencia'] as const;
type TrackedStat = typeof TRACKED_STATS[number];
const PLAZA_CATEGORY_ORDER = [
  'Clanes',
  'Habilidades Secundarias',
  'Bijuu',
  'Elementos',
  'Especiales',
  'Potenciadores'
] as const;

function normalizeStatName(rawStatName: string): TrackedStat | null {
  const normalized = rawStatName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const aliases: Record<string, TrackedStat> = {
    fuerza: 'fuerza',
    resistencia: 'resistencia',
    velocidad: 'velocidad',
    percepcion: 'percepcion',
    chakra: 'chakra',
    armas: 'armas',
    inteligencia: 'inteligencia',
    ninjutsu: 'chakra'
  };

  return aliases[normalized] ?? null;
}

function buildEmptyBonusMap(): Record<TrackedStat, number> {
  return {
    fuerza: 0,
    resistencia: 0,
    velocidad: 0,
    percepcion: 0,
    chakra: 0,
    armas: 0,
    inteligencia: 0
  };
}

function formatInventoryThreeColumns(items: Array<{ name: string; quantity: number }>): string {
  if (items.length === 0) return 'Vacio';

  const cells = items.map((item) => `${item.name} x${item.quantity}`);
  const rows: string[] = [];

  for (let i = 0; i < cells.length; i += 3) {
    const row = [cells[i], cells[i + 1] ?? '-', cells[i + 2] ?? '-'];
    rows.push(row.join(' | '));
  }

  return rows.join('\n');
}

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
  try {
    assertForumPostContext(interaction, { allowStaffBypass: true, enforceThreadOwnership: true });

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

    const traitBonuses = buildEmptyBonusMap();
    const traitGradationBonuses = buildEmptyBonusMap();
    for (const characterTrait of character.traits) {
      const mechanics = characterTrait.trait.mechanics;
      if (!mechanics || typeof mechanics !== 'object' || Array.isArray(mechanics)) {
        continue;
      }

      const mechanicRecord = mechanics as Record<string, unknown>;
      const bonusGradations = mechanicRecord.bonusGradations;
      if (bonusGradations && typeof bonusGradations === 'object' && !Array.isArray(bonusGradations)) {
        for (const [rawKey, rawValue] of Object.entries(bonusGradations as Record<string, unknown>)) {
          if (typeof rawValue !== 'number') {
            continue;
          }
          const mappedStat = normalizeStatName(rawKey);
          if (mappedStat && mappedStat !== 'chakra') {
            traitGradationBonuses[mappedStat] += rawValue;
          }
        }
      }

      const chakraBonus = mechanicRecord.bonusChakra;
      if (typeof chakraBonus === 'number') {
        traitBonuses.chakra += chakraBonus;
      }
    }

    const plazaBonuses = buildEmptyBonusMap();
    let chakraExternalBonus = 0;
    for (const characterPlaza of character.plazas) {
      const rawStatName = characterPlaza.plaza.bonusStatName;
      if (!rawStatName || characterPlaza.plaza.bonusStatValue === 0) {
        continue;
      }

      const mappedStat = normalizeStatName(rawStatName);
      if (!mappedStat) {
        continue;
      }

      if (mappedStat === 'chakra') {
        chakraExternalBonus += characterPlaza.plaza.bonusStatValue;
        continue;
      }

      plazaBonuses[mappedStat] += characterPlaza.plaza.bonusStatValue;
    }

    const displayedStats = {
      fuerza: statValidatorService.getEffectiveDisplayValueForStat(character.level, 'fuerza', character.fuerza, {
        traitBonus: traitBonuses.fuerza,
        traitGradationBonus: traitGradationBonuses.fuerza,
        plazaBonus: plazaBonuses.fuerza
      }).formatted,
      resistencia: statValidatorService.getEffectiveDisplayValueForStat(character.level, 'resistencia', character.resistencia, {
        traitBonus: traitBonuses.resistencia,
        traitGradationBonus: traitGradationBonuses.resistencia,
        plazaBonus: plazaBonuses.resistencia
      }).formatted,
      velocidad: statValidatorService.getEffectiveDisplayValueForStat(character.level, 'velocidad', character.velocidad, {
        traitBonus: traitBonuses.velocidad,
        traitGradationBonus: traitGradationBonuses.velocidad,
        plazaBonus: plazaBonuses.velocidad
      }).formatted,
      percepcion: statValidatorService.getEffectiveDisplayValueForStat(character.level, 'percepcion', character.percepcion, {
        traitBonus: traitBonuses.percepcion,
        traitGradationBonus: traitGradationBonuses.percepcion,
        plazaBonus: plazaBonuses.percepcion
      }).formatted,
      chakra: statValidatorService.getEffectiveDisplayValueForStat(character.level, 'chakra', character.chakra, {
        traitBonus: traitBonuses.chakra,
        externalBonus: chakraExternalBonus
      }).formatted,
      armas: statValidatorService.getEffectiveDisplayValueForStat(character.level, 'armas', character.armas, {
        traitBonus: traitBonuses.armas,
        traitGradationBonus: traitGradationBonuses.armas,
        plazaBonus: plazaBonuses.armas
      }).formatted,
      inteligencia: statValidatorService.getEffectiveDisplayValueForStat(character.level, 'inteligencia', character.inteligencia, {
        traitBonus: traitBonuses.inteligencia,
        traitGradationBonus: traitGradationBonuses.inteligencia,
        plazaBonus: plazaBonuses.inteligencia
      }).formatted
    };

    const ageText = character.age ? `${character.age} años` : 'Edad desconocida';
    const traitList = character.traits.map((ct) => ct.trait.name).join(', ') || 'Ninguno';
    const plazasByCategory = new Map<string, string[]>();
    for (const cp of character.plazas) {
      const current = plazasByCategory.get(cp.plaza.category) ?? [];
      current.push(cp.plaza.name);
      plazasByCategory.set(cp.plaza.category, current);
    }

    const orderedPlazaCategories = Array.from(plazasByCategory.keys()).sort((a, b) => {
      const ai = PLAZA_CATEGORY_ORDER.indexOf(a as (typeof PLAZA_CATEGORY_ORDER)[number]);
      const bi = PLAZA_CATEGORY_ORDER.indexOf(b as (typeof PLAZA_CATEGORY_ORDER)[number]);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'es');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    const plazasList = orderedPlazaCategories.length > 0
      ? orderedPlazaCategories
          .map((category) => `${category}: ${plazasByCategory.get(category)!.join(', ')}`)
          .join('\n')
      : 'Ninguna';
    const inventoryTable = formatInventoryThreeColumns(
      character.inventory
        .map((item) => ({ name: item.item.name, quantity: item.quantity }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    );

    const statsColumnA = [
      `Fuerza: ${displayedStats.fuerza}`,
      `Resistencia: ${displayedStats.resistencia}`,
      `Velocidad: ${displayedStats.velocidad}`,
      `Percepcion: ${displayedStats.percepcion}`
    ].join('\n');

    const statsColumnB = [
      `Chakra: ${displayedStats.chakra}`,
      `Armas: ${displayedStats.armas}`,
      `Inteligencia: ${displayedStats.inteligencia}`
    ].join('\n');

    const resourcesColumnA = [
      `Ryou: **${character.ryou}**`,
      `EXP: **${character.exp}**`,
      `PR: **${character.pr}**`,
      `SP: **${character.sp}**`
    ].join('\n');

    const resourcesColumnB = [
      `Cupos: **${character.cupos}**`,
      `RC: **${character.rc}**`,
      `BTS: **${character.bts}**`,
      `BES: **${character.bes}**`
    ].join('\n');

    const statsEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`📋 Ficha de ${character.name}`)
      .setDescription(`${character.fullName ?? 'Nombre completo no especificado'} (${ageText})`);
    if (character.imageUrl) {
      statsEmbed.setThumbnail(character.imageUrl);
    }
    statsEmbed
      .addFields(
        {
          name: '🎖️ Rango y Cargo',
          value: `Cargo: **${character.rank}**${character.title ? ` (${character.title})` : ''}\nRango: **${character.level}**${character.isSpecialRank ? ' [Rango Especial]' : ''}`,
          inline: false
        },
        {
          name: '💰 Recursos',
          value: resourcesColumnA,
          inline: true
        },
        {
          name: ZERO_WIDTH_SPACE,
          value: resourcesColumnB,
          inline: true
        },
        {
          name: ZERO_WIDTH_SPACE,
          value: ZERO_WIDTH_SPACE,
          inline: true
        },
        {
          name: '💪 STATS',
          value: statsColumnA,
          inline: true
        },
        {
          name: ZERO_WIDTH_SPACE,
          value: statsColumnB,
          inline: true
        },
        {
          name: ZERO_WIDTH_SPACE,
          value: ZERO_WIDTH_SPACE,
          inline: true
        },
        {
          name: '🧬 Rasgos',
          value: traitList,
          inline: false
        },
        {
          name: '🏰 Plazas',
          value: plazasList,
          inline: false
        },
        {
          name: '🎒 Inventario',
          value: character.inventory.length > 0 ? `\`\`\`\n${inventoryTable}\n\`\`\`` : 'Vacio',
          inline: false
        }
      )
      .setFooter({
        text: `Creado: ${character.createdAt.toLocaleDateString('es-ES')} • ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}\nEsta ficha es una foto del momento. Usa /ficha nuevamente para actualizarla.`
      })
      .setTimestamp();

    const isOwner = targetUser.id === interaction.user.id;
    const buttons: ButtonBuilder[] = [
      new ButtonBuilder()
        .setCustomId(`ficha_delete:${interaction.user.id}`)
        .setLabel('Eliminar mensaje')
        .setStyle(ButtonStyle.Secondary)
    ];
    if (isOwner) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ficha_change_image:${character.id}`)
          .setLabel('Cambiar imagen')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    return interaction.reply({ embeds: [statsEmbed], components: [row], ephemeral: false });
  } catch (error: unknown) {
    await handleCommandError(error, interaction, {
      commandName: 'ficha',
      fallbackMessage: 'Error desconocido al obtener ficha.',
      ephemeral: true
    });
    return;
  }
}
