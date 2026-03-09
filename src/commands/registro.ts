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
            select: { name: true, category: true }
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

        if (plazaNames.length > 0) {
            const selectedPlazas = await prisma.plaza.findMany({
                where: { name: { in: plazaNames } },
                select: { id: true, name: true, category: true }
            });

            if (selectedPlazas.length !== plazaNames.length) {
                const found = new Set(selectedPlazas.map((plaza) => plaza.name));
                const missing = plazaNames.filter((name) => !found.has(name));
                throw new Error(`⛔ Plazas no encontradas: ${missing.join(', ')}`);
            }

            const autoGrantedTraitNames = new Set<string>();
            const autoGrantedPlazaNames = new Set<string>();
            const visitedPlazaIds = new Set<string>();
            const queue = selectedPlazas.map((plaza) => plaza.id);

            while (queue.length > 0) {
                const plazaId = queue.shift();
                if (!plazaId || visitedPlazaIds.has(plazaId)) continue;
                visitedPlazaIds.add(plazaId);

                const plaza = await prisma.plaza.findUnique({
                    where: { id: plazaId },
                    include: {
                        inheritedTraits: { include: { trait: { select: { name: true } } } },
                        inheritedPlazas: { include: { child: { select: { id: true, name: true } } } }
                    }
                });

                if (!plaza) continue;

                for (const inheritedTrait of plaza.inheritedTraits) {
                    autoGrantedTraitNames.add(inheritedTrait.trait.name);
                }

                for (const inheritedPlaza of plaza.inheritedPlazas) {
                    autoGrantedPlazaNames.add(inheritedPlaza.child.name);
                    if (!visitedPlazaIds.has(inheritedPlaza.child.id)) {
                        queue.push(inheritedPlaza.child.id);
                    }
                }
            }

            const redundantTraits = uniqueTraitNames.filter((name) => autoGrantedTraitNames.has(name));
            if (redundantTraits.length > 0) {
                throw new Error(
                    `⛔ No incluyas estos rasgos en /registro porque se otorgan automaticamente por tus plazas: ${redundantTraits.join(', ')}`
                );
            }

            const redundantPlazas = plazaNames.filter((name) => autoGrantedPlazaNames.has(name));
            if (redundantPlazas.length > 0) {
                throw new Error(
                    `⛔ No incluyas estas plazas en /registro porque se heredan automaticamente: ${redundantPlazas.join(', ')}`
                );
            }
        }

        const nuevoPJ = await characterService.createCharacter({
            discordId: interaction.user.id,
            name: keko,
            fullName: nombre,
            ...(moralidad ? { moral: moralidad } : {}),
            traitNames: uniqueTraitNames
        });

        const guiasExitosas: string[] = [];

        for (const plazaName of plazaNames) {
            try {
                await plazaService.assignPlaza({
                    characterId: nuevoPJ.id,
                    plazaName,
                    grantType: 'INICIAL'
                });
                guiasExitosas.push(plazaName);
            } catch (plazaError: unknown) {
                const plazaMessage = plazaError instanceof Error ? plazaError.message : 'Error desconocido';
                await interaction.followUp({
                    content: `⚠️ **Aviso sobre Guias:** No se pudo asignar '${plazaName}'. Razon: ${plazaMessage}`,
                    ephemeral: true
                });
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

        if (bonusRcTotal > 0) {
            await prisma.character.update({
                where: { id: nuevoPJ.id },
                data: { rc: { increment: bonusRcTotal } }
            });

            await prisma.auditLog.create({
                data: {
                    characterId: nuevoPJ.id,
                    category: 'Bono RC por Clan',
                    detail: bonusDetails.join(' | '),
                    evidence: 'Regla de registro por clanes',
                    deltaRc: bonusRcTotal
                }
            });
        }

        const fichaFinal = await prisma.character.findUnique({ where: { id: nuevoPJ.id } });

        const mensajeExito = `✅ **¡Ficha de ${fichaFinal?.fullName} creada con exito!**\n`
            + `**Keko:** ${fichaFinal?.name}\n`
            + `**Rasgos:** ${uniqueTraitNames.join(', ')}\n`
            + `**Guias:** ${guiasExitosas.length > 0 ? guiasExitosas.join(', ') : 'Ninguna'}\n\n`
            + `💰 **Economia inicial:** ${fichaFinal?.ryou} Ryou | ${fichaFinal?.rc} RC | ${fichaFinal?.cupos} cupos restantes.\n`
            + `📊 **Siguiente paso:** Tienes **${fichaFinal?.sp} SP** disponibles. Usa \`/invertir_sp\` para asignarlos.`;

        return interaction.editReply(mensajeExito);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error desconocido en registro.';
        console.error('Error en /registro:', error);
        return interaction.editReply(`❌ **Operacion cancelada:**\n${message}`);
    }
}