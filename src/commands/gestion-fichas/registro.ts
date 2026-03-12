import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CharacterService } from '../../services/CharacterService';
import { PlazaService } from '../../services/PlazaService';
import { resolvePlazaInheritance } from '../../services/PlazaInheritanceResolver';
import {
    RESTRICTED_TRAIT_CATEGORIES,
    getCategoryLabel,
    normalizeCategory,
    normalizeRestrictedCategory,
    type RestrictedTraitCategory
} from '../../services/TraitRuleService';
import { assertForumPostContext } from '../../utils/channelGuards';
import { formatChannelReference } from '../../utils/channelRefs';
import { BuildApprovalService } from '../../services/BuildApprovalService';
import { AppCommandError, CommandErrorStyle, CommandErrorType, handleCommandError } from '../../utils/errorHandler';

const characterService = new CharacterService(prisma);
const plazaService = new PlazaService(prisma);
const buildApprovalService = new BuildApprovalService(prisma);
const APPROVAL_CHANNEL_REFERENCE = formatChannelReference(process.env.BUILD_APPROVAL_FORUM_ID, '#🛠️-registro-builds');

const CLAN_TRAIT_RC_BONUSES: Array<{ plazaName: string; traitName: string; bonusRc: number }> = [
    { plazaName: 'Akimichi Ichizoku', traitName: 'Lento', bonusRc: 2 },
    { plazaName: 'Vendedores del clima', traitName: 'Nómada', bonusRc: 2 },
    { plazaName: 'Iburi Ichizoku', traitName: 'Discriminado', bonusRc: 3 },
    { plazaName: 'Samurai del Hierro', traitName: 'Honorable', bonusRc: 3 }
];

const BASE_INITIAL_RC = 6;

interface TraitRecordInput {
    name: string;
    category: string;
    costRC: number;
}

const INPUT_NAME_NOTE = '💡 Nota: Cada nombre de rasgo o habilidad debe coincidir exactamente. Usa /catalogo para verificar nombres antes de enviar.';
const RECOVERY_NOTE = '↩️ Tip: Si estabas escribiendo en Discord, presiona Ctrl+Z en la caja de chat para recuperar tu ultimo mensaje.';
const AUTO_TRAIT_TOKEN = 'auto';

interface CategoryTraitEntry {
    name: string;
    category: RestrictedTraitCategory;
    source: 'manual' | 'herencia';
    sourcePlaza?: string;
}

function formatSignedRc(costRC: number): string {
    return costRC > 0 ? `+${costRC}` : `${costRC}`;
}

function buildTraitRcBreakdown(traits: TraitRecordInput[]): { lines: string[]; total: number } {
    const categoryOrder = ['origen', 'nacimiento', 'fisico', 'social', 'psicologico', 'moral'];
    const labels: Record<string, string> = {
        origen: 'Origen',
        nacimiento: 'Nacimiento',
        fisico: 'Fisico',
        social: 'Social',
        psicologico: 'Psicologico',
        moral: 'Moral'
    };

    const grouped = new Map<string, { label: string; items: string[]; subtotal: number }>();

    for (const trait of traits) {
        const key = normalizeCategory(trait.category);
        const label = labels[key] ?? trait.category;
        const current = grouped.get(key) ?? { label, items: [], subtotal: 0 };
        current.items.push(`${trait.name} (${formatSignedRc(trait.costRC)} RC)`);
        current.subtotal += trait.costRC;
        grouped.set(key, current);
    }

    const orderedKeys = Array.from(grouped.keys()).sort((a, b) => {
        const ai = categoryOrder.indexOf(a);
        const bi = categoryOrder.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b, 'es');
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    const lines = orderedKeys.map((key) => {
        const entry = grouped.get(key)!;
        return `> **${entry.label}:** ${entry.items.join(', ')}`;
    });

    const total = traits.reduce((acc, trait) => acc + trait.costRC, 0);
    return { lines, total };
}

function formatRegistroSuccessMessage(params: {
    titleEmoji: string;
    fullName: string;
    keko: string;
    traitNames: string[];
    plazas: string[];
    ryou: number;
    rc: number;
    cupos: number;
    sp: number;
}): string {
    return [
        `# ${params.titleEmoji} ¡Ficha de ${params.fullName} creada con exito!`,
        `> **Keko:** ${params.keko}`,
        `> **Rasgos:** ${params.traitNames.join(', ')}`,
        `> **Plazas:** ${params.plazas.length > 0 ? params.plazas.join(', ') : 'Ninguna'}`,
        `## :moneybag: Economia inicial`,
        `> ${params.ryou} Ryou | ${params.rc} RC restantes | ${params.cupos} cupos restantes.`,
        `## :bar_chart: Siguiente paso`,
        `> Tienes ${params.sp} SP disponibles. Usa \`/invertir_sp\` para asignarlos.`
    ].join('\n');
}

function parseCsv(input: string | null): string[] {
    if (!input) return [];
    return input
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function sanitizeInlineDisplayText(value: string): string {
    return value
        .trim()
        .replace(/^['"`*_~\[\]()<>\s]+/, '')
        .replace(/['"`*_~\[\]()<>\s]+$/, '')
        .trim();
}

function normalizeKekoForComparison(keko: string): string {
    return normalizeText(
        sanitizeInlineDisplayText(keko)
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/^@+/, '')
    );
}

function isAutoTraitToken(value: string): boolean {
    return normalizeText(value) === AUTO_TRAIT_TOKEN;
}

function shouldShowInputNameNote(message: string): boolean {
    const normalized = normalizeText(message);

    const inputRelatedSignals = [
        'rasgos no encontrados',
        'plazas no encontradas',
        'rasgo no encontrado en catalogo',
        'no pertenece a',
        'categoria real',
        'seleccion de plazas no coincide con la build aprobada'
    ];

    return inputRelatedSignals.some((signal) => normalized.includes(signal));
}

export const data = new SlashCommandBuilder()
    .setName('registro')
    .setDescription('Crea tu ficha inicial en el Sistema IZANAGI')
    .addStringOption((option) =>
        option.setName('keko').setDescription('Tu usuario de Hobba (sin @).').setRequired(true)
    )
    .addStringOption((option) =>
        option.setName('nombre').setDescription('Nombre de tu personaje (ej: Uzumaki Naruto)').setRequired(true)
    )
    .addIntegerOption((option) =>
        option
            .setName('edad')
            .setDescription('Edad de tu personaje')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(120)
    )
    .addStringOption((option) =>
        option
            .setName('rasgo_origen')
            .setDescription("Nombre exacto del Rasgo de Origen (o 'auto' si lo heredas)")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName('rasgo_nacimiento')
            .setDescription("Nombre exacto del Rasgo de Nacimiento (o 'auto' si lo heredas)")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName('moralidad')
            .setDescription("Rasgo de moralidad (o 'auto' si lo heredas)")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName('rasgos_fisicos')
            .setDescription('Rasgos fisicos separados por comas (opcional)')
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('rasgos_sociales')
            .setDescription('Rasgos sociales separados por comas (opcional)')
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('rasgos_psicologicos')
            .setDescription('Rasgos psicologicos separados por comas (opcional)')
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('habilidades')
            .setDescription('Solo habilidades iniciales: Elementos, Clanes, Especiales o Bijuu (opcional)')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        assertForumPostContext(interaction, { enforceThreadOwnership: true });

        const keko = interaction.options.getString('keko', true);
        const nombre = interaction.options.getString('nombre', true);
        const edad = interaction.options.getInteger('edad', true);

        const rasgoOrigen = interaction.options.getString('rasgo_origen', true);
        const rasgoNacimiento = interaction.options.getString('rasgo_nacimiento', true);
        const moralidad = interaction.options.getString('moralidad', true);
        const rasgosFisicos = parseCsv(interaction.options.getString('rasgos_fisicos'));
        const rasgosSociales = parseCsv(interaction.options.getString('rasgos_sociales'));
        const rasgosPsicologicos = parseCsv(interaction.options.getString('rasgos_psicologicos'));
        const plazaNames = Array.from(new Set(parseCsv(interaction.options.getString('habilidades'))));

        const restrictedInputs: Array<{ category: RestrictedTraitCategory; label: string; value: string }> = [
            { category: 'origen', label: 'Rasgo de Origen', value: rasgoOrigen },
            { category: 'nacimiento', label: 'Rasgo de Nacimiento', value: rasgoNacimiento },
            { category: 'moral', label: 'Moralidad', value: moralidad }
        ];

        const manualRestrictedTraits = restrictedInputs
            .filter((entry) => !isAutoTraitToken(entry.value))
            .map((entry) => entry.value);

        const manualTraitNames = [
            ...manualRestrictedTraits,
            ...rasgosFisicos,
            ...rasgosSociales,
            ...rasgosPsicologicos
        ];
        const uniqueManualTraitNames = Array.from(new Set(manualTraitNames));

        const existingByDiscord = await prisma.character.findUnique({
            where: { discordId: interaction.user.id },
            select: { name: true }
        });

        if (existingByDiscord) {
            throw new Error(`⛔ Ya tienes una ficha registrada con el keko ${existingByDiscord.name}. Solo se permite una ficha por usuario de Discord.`);
        }

        const activeApproval = await buildApprovalService.getActiveApprovalForUser(
            interaction.user.id,
            interaction.guildId ?? undefined
        );

        if (!activeApproval) {
            throw new Error(`⛔ No tienes una build aprobada por staff. Publica tu solicitud en ${APPROVAL_CHANNEL_REFERENCE} y espera la reacción ✅ de un administrador.`);
        }

        if (normalizeKekoForComparison(activeApproval.keko) !== normalizeKekoForComparison(keko)) {
            const approvedKekoText = sanitizeInlineDisplayText(activeApproval.keko);
            const submittedKekoText = sanitizeInlineDisplayText(keko);
            throw new Error(`⛔ El keko ingresado no coincide con tu build aprobada. Aprobado: ${approvedKekoText}. Enviado: ${submittedKekoText}.`);
        }

        const approvedPlazas = activeApproval.approvedPlazas;
        const normalizedSelected = new Set(plazaNames.map((name) => normalizeText(name)));
        const normalizedApproved = new Set(approvedPlazas.map((name: string) => normalizeText(name)));
        const missingApproved = approvedPlazas.filter((name: string) => !normalizedSelected.has(normalizeText(name)));
        const unapprovedSelected = plazaNames.filter((name) => !normalizedApproved.has(normalizeText(name)));

        if (missingApproved.length > 0 || unapprovedSelected.length > 0) {
            const mismatchLines = [
                `> **Build aprobada:** ${approvedPlazas.length > 0 ? approvedPlazas.join(', ') : 'Sin plazas iniciales'}`,
                `> **Build enviada:** ${plazaNames.length > 0 ? plazaNames.join(', ') : 'Sin plazas iniciales'}`,
                ...(missingApproved.length > 0 ? [`> **Faltan plazas aprobadas:** ${missingApproved.join(', ')}`] : []),
                ...(unapprovedSelected.length > 0 ? [`> **Plazas no aprobadas incluidas:** ${unapprovedSelected.join(', ')}`] : [])
            ];

            throw new Error(`⛔ Tu selección de plazas no coincide con la build aprobada por staff.\n${mismatchLines.join('\n')}`);
        }

        const existe = await prisma.character.findUnique({ where: { name: keko } });
        if (existe) {
            throw new Error(`⛔ El keko ${keko} ya esta registrado en la base de datos.`);
        }

        const traitRecords = await prisma.trait.findMany({
            where: { name: { in: uniqueManualTraitNames } },
            select: { name: true, category: true, costRC: true }
        });

        if (traitRecords.length !== uniqueManualTraitNames.length) {
            const existingNames = new Set(traitRecords.map((trait) => trait.name));
            const missing = uniqueManualTraitNames.filter((name) => !existingNames.has(name));
            throw new Error(`⛔ Rasgos no encontrados: ${missing.join(', ')}`);
        }

        const categoryMap = new Map(
            traitRecords.map((trait) => [trait.name, normalizeCategory(trait.category)])
        );

        const validateCategory = (name: string, expected: string, label: string) => {
            if (isAutoTraitToken(name)) {
                return;
            }

            const category = categoryMap.get(name);
            if (!category) {
                throw new Error(`⛔ Rasgo no encontrado en catalogo: ${name}`);
            }
            if (category !== expected) {
                throw new Error(`⛔ '${name}' no pertenece a '${label}'. Categoria real: ${category}.`);
            }
        };

        validateCategory(rasgoOrigen, 'origen', 'Rasgo de Origen');
        validateCategory(rasgoNacimiento, 'nacimiento', 'Rasgo de Nacimiento');
        rasgosFisicos.forEach((name) => validateCategory(name, 'fisico', 'Rasgos fisicos'));
        rasgosSociales.forEach((name) => validateCategory(name, 'social', 'Rasgos sociales'));
        rasgosPsicologicos.forEach((name) => validateCategory(name, 'psicologico', 'Rasgos psicologicos'));
        validateCategory(moralidad, 'moral', 'Moralidad');

        const selectedPlazas = plazaNames.length > 0
            ? await prisma.plaza.findMany({
                where: { name: { in: plazaNames } },
                select: { id: true, name: true, category: true }
            })
            : [];

        if (selectedPlazas.length !== plazaNames.length) {
            const found = new Set(selectedPlazas.map((plaza) => plaza.name));
            const missing = plazaNames.filter((name) => !found.has(name));
            throw new Error(`⛔ Plazas no encontradas: ${missing.join(', ')}`);
        }

        const inheritanceResolution = await resolvePlazaInheritance(
            prisma,
            selectedPlazas.map((plaza) => ({ id: plaza.id, name: plaza.name }))
        );
        const autoGrantedTraitNames = inheritanceResolution.autoGrantedTraitNames;
        const autoGrantedPlazaNames = inheritanceResolution.autoGrantedPlazaNames;
        const autoGrantedTraitSource = inheritanceResolution.autoGrantedTraitSource;
        const inheritedRestrictedTraits: CategoryTraitEntry[] = inheritanceResolution.inheritedRestrictedTraits;

        const redundantTraits = uniqueManualTraitNames.filter((name) => autoGrantedTraitNames.has(name));
        if (redundantTraits.length > 0) {
            const redundantTrait = redundantTraits[0]!;
            const sourcePlaza = autoGrantedTraitSource.get(redundantTrait) ?? selectedPlazas[0]?.name ?? 'tu habilidad elegida';
            throw new Error(`⛔ El rasgo ${redundantTrait} te lo da la habilidad ${sourcePlaza}. No lo pongas.`);
        }

        const redundantPlazas = plazaNames.filter((name) => autoGrantedPlazaNames.has(name));
        if (redundantPlazas.length > 0) {
            throw new Error(`⛔ La habilidad ${redundantPlazas[0]} se hereda automaticamente. No la pongas.`);
        }

        const manualRestrictedEntries: CategoryTraitEntry[] = [];
        for (const trait of traitRecords) {
            const category = normalizeRestrictedCategory(trait.category);
            if (!category) continue;
            manualRestrictedEntries.push({
                name: trait.name,
                category,
                source: 'manual'
            });
        }

        const effectiveRestrictedTraits: CategoryTraitEntry[] = [
            ...manualRestrictedEntries,
            ...inheritedRestrictedTraits
        ];

        const groupedRestricted = new Map<RestrictedTraitCategory, CategoryTraitEntry[]>();
        for (const category of RESTRICTED_TRAIT_CATEGORIES) {
            groupedRestricted.set(category, []);
        }
        for (const entry of effectiveRestrictedTraits) {
            const current = groupedRestricted.get(entry.category) ?? [];
            current.push(entry);
            groupedRestricted.set(entry.category, current);
        }

        for (const input of restrictedInputs) {
            if (!isAutoTraitToken(input.value)) continue;

            const inheritedForCategory = inheritedRestrictedTraits.filter((entry) => entry.category === input.category);
            if (inheritedForCategory.length === 0) {
                throw new Error(
                    `⛔ Marcaste '${AUTO_TRAIT_TOKEN}' en ${input.label}, pero ninguna de tus habilidades hereda un rasgo de ${getCategoryLabel(input.category)}. Si tu build deberia heredarlo, pide al staff revisar la sincronizacion seed/DB con 'npm run db:audit:plaza-traits'.`
                );
            }
        }

        for (const category of RESTRICTED_TRAIT_CATEGORIES) {
            const entries = groupedRestricted.get(category) ?? [];
            const categoryLabel = getCategoryLabel(category);

            if (entries.length === 0) {
                throw new Error(`⛔ Debes tener exactamente un rasgo de ${categoryLabel}. Selecciona uno manualmente o usa '${AUTO_TRAIT_TOKEN}' si lo heredas.`);
            }

            if (entries.length > 1) {
                const manualEntry = entries.find((entry) => entry.source === 'manual');
                const inheritedEntry = entries.find((entry) => entry.source === 'herencia');

                if (manualEntry && inheritedEntry) {
                    throw new Error(
                        `⛔ CONFLICTO DE CATEGORIA: Solo puedes tener un rasgo de ${category}, y la plaza ${inheritedEntry.sourcePlaza ?? 'seleccionada'} ya te da el rasgo ${inheritedEntry.name}. Debes eliminar el rasgo ${manualEntry.name} que pusiste manualmente en /registro.`
                    );
                }

                const summary = entries
                    .map((entry) => entry.source === 'herencia'
                        ? `${entry.name} (heredado por ${entry.sourcePlaza ?? 'una habilidad'})`
                        : `${entry.name} (manual)`)
                    .join(', ');
                throw new Error(`⛔ CONFLICTO DE CATEGORIA: Tienes mas de un rasgo en ${categoryLabel}. Detectados: ${summary}. Deja solo uno.`);
            }
        }

        const resolvedMoralTrait = (groupedRestricted.get('moral') ?? [])[0]?.name;
        if (!resolvedMoralTrait) {
            throw new Error(`⛔ Debes tener exactamente un rasgo de Moral. Selecciona uno manualmente o usa '${AUTO_TRAIT_TOKEN}' si lo heredas.`);
        }

        let bonusRcTotal = 0;
        const bonusDetails: string[] = [];
        for (const rule of CLAN_TRAIT_RC_BONUSES) {
            if (plazaNames.includes(rule.plazaName) && uniqueManualTraitNames.includes(rule.traitName)) {
                bonusRcTotal += rule.bonusRc;
                bonusDetails.push(`${rule.plazaName} + ${rule.traitName}: +${rule.bonusRc} RC`);
            }
        }

        const traitBreakdown = buildTraitRcBreakdown(traitRecords);
        const projectedRc = BASE_INITIAL_RC + traitBreakdown.total + bonusRcTotal;

        const rcSummaryLines = [
            ...traitBreakdown.lines,
            `> **Bono por clan/plaza:** ${formatSignedRc(bonusRcTotal)} RC`
        ];

        if (projectedRc < 0) {
            const rcLines = [
                ...rcSummaryLines,
                `> **Conclusion:** Quedas con ${formatSignedRc(projectedRc)} RC, debes ajustar tus rasgos para quedar en 0 o un total positivo.`
            ];
            throw new Error(`⛔ Balance de RC invalido: Tu seleccion no cumple con el minimo requerido.\n${rcLines.join('\n')}`);
        }

        const positiveRcWarning = projectedRc > 0
            ? `Quedas con ${formatSignedRc(projectedRc)} RC. ¿Estas seguro que quieres crear tu ficha con ese excedente?`
            : undefined;

        if (positiveRcWarning) {
            const confirmCustomId = `registro_confirm_rc:${interaction.id}`;
            const cancelCustomId = `registro_cancel_rc:${interaction.id}`;

            const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(confirmCustomId)
                    .setLabel('Confirmar y crear ficha')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(cancelCustomId)
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({
                content: [
                    '## :warning: Confirmacion requerida',
                    ...rcSummaryLines,
                    `> **Conclusion:** ${positiveRcWarning}`,
                    '> Si deseas continuar, confirma con el boton verde.',
                    '',
                    `> ${RECOVERY_NOTE}`
                ].join('\n'),
                components: [confirmRow]
            });

            const replyMessage = await interaction.fetchReply();

            try {
                const buttonInteraction = await replyMessage.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    time: 60000,
                    filter: (button) =>
                        button.user.id === interaction.user.id
                        && (button.customId === confirmCustomId || button.customId === cancelCustomId)
                });

                if (buttonInteraction.customId === cancelCustomId) {
                    await buttonInteraction.update({
                        content: [
                            '❌ Registro cancelado. Puedes ajustar tus rasgos y volver a intentarlo.',
                            '',
                            `> ${RECOVERY_NOTE}`
                        ].join('\n'),
                        components: []
                    });
                    return;
                }

                await buttonInteraction.update({
                    content: '✅ Confirmado. Creando ficha... ',
                    components: []
                });
            } catch {
                await interaction.editReply({
                    content: [
                        '⏱️ Confirmacion expirada. Ejecuta /registro nuevamente si deseas continuar con RC positivo.',
                        '',
                        `> ${RECOVERY_NOTE}`
                    ].join('\n'),
                    components: []
                });
                return;
            }
        }

        const characterId = await prisma.$transaction(async (tx) => {
            const nuevoPJ = await characterService.createCharacter({
                discordId: interaction.user.id,
                name: keko,
                fullName: nombre,
                age: edad,
                moral: resolvedMoralTrait,
                traitNames: uniqueManualTraitNames
            }, tx as any);

            for (const plazaName of plazaNames) {
                await plazaService.assignPlaza({
                    characterId: nuevoPJ.id,
                    plazaName,
                    grantType: 'INICIAL'
                }, tx as any);
            }

            if (bonusRcTotal > 0) {
                await tx.character.update({
                    where: { id: nuevoPJ.id },
                    data: { rc: { increment: bonusRcTotal } }
                });

                await tx.auditLog.create({
                    data: {
                        characterId: nuevoPJ.id,
                        category: 'Bono RC por Clan',
                        detail: bonusDetails.join(' | '),
                        evidence: 'Regla de registro por clanes',
                        deltaRc: bonusRcTotal
                    }
                });
            }

            await tx.character.update({
                where: { id: nuevoPJ.id },
                data: { approvalId: activeApproval.id }
            });

            await tx.characterBuildApproval.update({
                where: { id: activeApproval.id },
                data: { isActive: false }
            });

            return nuevoPJ.id;
        }, {
            maxWait: 10000,
            timeout: 20000
        });

        const fichaFinal = await prisma.character.findUnique({
            where: { id: characterId },
            include: {
                traits: {
                    include: {
                        trait: {
                            select: { name: true }
                        }
                    }
                },
                plazas: {
                    include: {
                        plaza: {
                            select: { name: true }
                        }
                    }
                }
            }
        });

        if (!fichaFinal) {
            throw new Error('⛔ No se pudo recuperar la ficha luego del registro.');
        }

        const plazasFinales = fichaFinal.plazas
            .map((entry) => entry.plaza.name)
            .sort((a, b) => a.localeCompare(b, 'es'));

        const persistedTraitNames = fichaFinal.traits.map((entry) => entry.trait.name);
        const selectedTraitSet = new Set(uniqueManualTraitNames);
        const inheritedTraitNames = persistedTraitNames
            .filter((name) => !selectedTraitSet.has(name))
            .sort((a, b) => a.localeCompare(b, 'es'));
        const traitNamesForDisplay = [...uniqueManualTraitNames, ...inheritedTraitNames];

        const mensajeExito = formatRegistroSuccessMessage({
            titleEmoji: interaction.guild?.emojis.cache.find((emoji) => emoji.name === 'naruto_vsign')?.toString() ?? ':naruto_vsign:',
            fullName: fichaFinal.fullName ?? nombre,
            keko: fichaFinal.name,
            traitNames: traitNamesForDisplay,
            plazas: plazasFinales,
            ryou: fichaFinal.ryou,
            rc: fichaFinal.rc,
            cupos: fichaFinal.cupos,
            sp: fichaFinal.sp
        });

        return interaction.editReply(mensajeExito);
    } catch (error: unknown) {
        const wrappedError =
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
                ? new AppCommandError({
                    type: CommandErrorType.Conflict,
                    userMessage: 'Ya existe una ficha para este usuario de Discord o para ese keko.',
                    context: { includeInputNameNote: false },
                    internalCode: 'REG_DUPLICATE_ID'
                })
                : new AppCommandError({
                    type: CommandErrorType.BusinessRule,
                    userMessage: error instanceof Error ? error.message : 'Error desconocido en registro.',
                    context: {
                        includeInputNameNote: shouldShowInputNameNote(error instanceof Error ? error.message : 'Error desconocido en registro.')
                    },
                    internalCode: 'REG_GENERAL_FLOW',
                    cause: error
                });

        await handleCommandError(wrappedError, interaction, {
            commandName: 'registro',
            fallbackMessage: 'Error desconocido en registro.',
            ephemeral: true,
            errorStyle: CommandErrorStyle.MarkdownPanel,
            styleOptions: {
                includeInputNameTipFromContext: true,
                inputNameTip: INPUT_NAME_NOTE,
                recoveryTip: RECOVERY_NOTE
            }
        });
        return;
    }
}