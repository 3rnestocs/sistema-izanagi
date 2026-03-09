import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../lib/prisma';
import { CharacterService } from '../services/CharacterService';
import { PlazaService } from '../services/PlazaService';
import { assertForumPostContext } from '../utils/channelGuards';

const characterService = new CharacterService(prisma);
const plazaService = new PlazaService(prisma);

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

function sanitizeErrorMessage(message: string): string {
    return message.replace(/^⛔\s*/, '').trim();
}

function formatRegistroErrorMessage(message: string, includeInputNameNote: boolean): string {
    const cleanMessage = sanitizeErrorMessage(message);
    const contentLines = cleanMessage.split('\n').filter((line) => line.trim().length > 0);
    const mainLine = contentLines.length > 0 ? contentLines[0] : cleanMessage;
    const extraLines = contentLines.slice(1);

    const helperLines = [
        ...(includeInputNameNote
            ? ['> :bulb: **NOTA:** Cada nombre de rasgo o habilidad debe coincidir exactamente. Usa `/catalogo` para verificar nombres antes de enviar.']
            : []),
        '> :leftwards_arrow_with_hook: **TIP:** Para recuperar tu mensaje mas reciente, presiona Ctrl+Z en la caja de chat.'
    ];

    return [
        '## :x: Operacion cancelada',
        `:no_entry: ${mainLine}`,
        ...extraLines,
        '',
        ...helperLines
    ].join('\n');
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
        return `> **${entry.label}:** ${entry.items.join(', ')} | Subtotal: ${formatSignedRc(entry.subtotal)} RC`;
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

function normalizeCategory(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
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
    .addStringOption((option) =>
        option.setName('rasgo_origen').setDescription('Nombre exacto del Rasgo de Origen').setRequired(true)
    )
    .addStringOption((option) =>
        option.setName('rasgo_nacimiento').setDescription('Nombre exacto del Rasgo de Nacimiento').setRequired(true)
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
        option.setName('moralidad').setDescription('Rasgo de moralidad (opcional)').setRequired(false)
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

        const rasgoOrigen = interaction.options.getString('rasgo_origen', true);
        const rasgoNacimiento = interaction.options.getString('rasgo_nacimiento', true);
        const rasgosFisicos = parseCsv(interaction.options.getString('rasgos_fisicos'));
        const rasgosSociales = parseCsv(interaction.options.getString('rasgos_sociales'));
        const rasgosPsicologicos = parseCsv(interaction.options.getString('rasgos_psicologicos'));
        const moralidad = interaction.options.getString('moralidad');
        const plazaNames = Array.from(new Set(parseCsv(interaction.options.getString('habilidades'))));

        const traitNames = [
            rasgoOrigen,
            rasgoNacimiento,
            ...rasgosFisicos,
            ...rasgosSociales,
            ...rasgosPsicologicos,
            ...(moralidad ? [moralidad] : [])
        ];
        const uniqueTraitNames = Array.from(new Set(traitNames));

        const existe = await prisma.character.findUnique({ where: { name: keko } });
        if (existe) {
            return interaction.editReply(`❌ **ERROR:** El keko **${keko}** ya esta registrado en la base de datos.`);
        }

        const traitRecords = await prisma.trait.findMany({
            where: { name: { in: uniqueTraitNames } },
            select: { name: true, category: true, costRC: true }
        });

        if (traitRecords.length !== uniqueTraitNames.length) {
            const existingNames = new Set(traitRecords.map((trait) => trait.name));
            const missing = uniqueTraitNames.filter((name) => !existingNames.has(name));
            throw new Error(`⛔ Rasgos no encontrados: ${missing.join(', ')}`);
        }

        const categoryMap = new Map(
            traitRecords.map((trait) => [trait.name, normalizeCategory(trait.category)])
        );

        const validateCategory = (name: string, expected: string, label: string) => {
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
        if (moralidad) {
            validateCategory(moralidad, 'moral', 'Moralidad');
        }

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

        if (selectedPlazas.length > 0) {
            const autoGrantedTraitNames = new Set<string>();
            const autoGrantedPlazaNames = new Set<string>();
            const visitedPlazaIds = new Set<string>();
            const autoGrantedTraitSource = new Map<string, string>();
            const queue = selectedPlazas.map((plaza) => ({ id: plaza.id, sourcePlazaName: plaza.name }));

            while (queue.length > 0) {
                const current = queue.shift();
                if (!current || visitedPlazaIds.has(current.id)) continue;
                visitedPlazaIds.add(current.id);

                const plaza = await prisma.plaza.findUnique({
                    where: { id: current.id },
                    include: {
                        inheritedTraits: { include: { trait: { select: { name: true } } } },
                        inheritedPlazas: { include: { child: { select: { id: true, name: true } } } }
                    }
                });

                if (!plaza) continue;

                for (const inheritedTrait of plaza.inheritedTraits) {
                    autoGrantedTraitNames.add(inheritedTrait.trait.name);
                    if (!autoGrantedTraitSource.has(inheritedTrait.trait.name)) {
                        autoGrantedTraitSource.set(inheritedTrait.trait.name, current.sourcePlazaName);
                    }
                }

                for (const inheritedPlaza of plaza.inheritedPlazas) {
                    autoGrantedPlazaNames.add(inheritedPlaza.child.name);
                    if (!visitedPlazaIds.has(inheritedPlaza.child.id)) {
                        queue.push({ id: inheritedPlaza.child.id, sourcePlazaName: current.sourcePlazaName });
                    }
                }
            }

            const redundantTraits = uniqueTraitNames.filter((name) => autoGrantedTraitNames.has(name));
            if (redundantTraits.length > 0) {
                const redundantTrait = redundantTraits[0]!;
                const sourcePlaza = autoGrantedTraitSource.get(redundantTrait) ?? selectedPlazas[0]?.name ?? 'tu habilidad elegida';
                throw new Error(`⛔ El rasgo ${redundantTrait} te lo da la habilidad ${sourcePlaza}. No lo pongas.`);
            }

            const redundantPlazas = plazaNames.filter((name) => autoGrantedPlazaNames.has(name));
            if (redundantPlazas.length > 0) {
                throw new Error(`⛔ La habilidad ${redundantPlazas[0]} se hereda automaticamente. No la pongas.`);
            }
        }

        let bonusRcTotal = 0;
        const bonusDetails: string[] = [];
        for (const rule of CLAN_TRAIT_RC_BONUSES) {
            if (plazaNames.includes(rule.plazaName) && uniqueTraitNames.includes(rule.traitName)) {
                bonusRcTotal += rule.bonusRc;
                bonusDetails.push(`${rule.plazaName} + ${rule.traitName}: +${rule.bonusRc} RC`);
            }
        }

        const traitBreakdown = buildTraitRcBreakdown(traitRecords);
        const projectedRc = BASE_INITIAL_RC + traitBreakdown.total + bonusRcTotal;

        if (projectedRc !== 0) {
            const rcLines = [
                ...traitBreakdown.lines,
                `> **Base inicial:** ${BASE_INITIAL_RC} RC`,
                `> **Bono por clan/plaza:** ${formatSignedRc(bonusRcTotal)} RC`,
                `> **RC final proyectado:** ${formatSignedRc(projectedRc)} RC`,
                '> **Regla de registro:** Debes cerrar en 0 RC. Ajusta tus rasgos antes de continuar.'
            ];
            throw new Error(`⛔ Balance de RC invalido: Tu selección no cierra en 0 RC.\n${rcLines.join('\n')}`);
        }

        const characterId = await prisma.$transaction(async (tx) => {
            const nuevoPJ = await characterService.createCharacter({
                discordId: interaction.user.id,
                name: keko,
                fullName: nombre,
                ...(moralidad ? { moral: moralidad } : {}),
                traitNames: uniqueTraitNames
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
        const selectedTraitSet = new Set(uniqueTraitNames);
        const inheritedTraitNames = persistedTraitNames
            .filter((name) => !selectedTraitSet.has(name))
            .sort((a, b) => a.localeCompare(b, 'es'));
        const traitNamesForDisplay = [...uniqueTraitNames, ...inheritedTraitNames];

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
        const message = error instanceof Error ? error.message : 'Error desconocido en registro.';
        const shouldShowNote =
            message.includes('⛔')
            || message.includes('no encontrado')
            || message.includes('no encontradas')
            || message.includes('Categoria real');
        const finalMessage = formatRegistroErrorMessage(message, shouldShowNote);
        console.error('Error en /registro:', error);
        return interaction.editReply(finalMessage);
    }
}