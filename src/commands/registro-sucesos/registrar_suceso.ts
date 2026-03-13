import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    Message
} from 'discord.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { assertForumPostContext } from '../../utils/channelGuards';
import { cleanupExpiredCooldowns, consumeCommandCooldown } from '../../utils/commandThrottle';
import { executeWithErrorHandling, validationError } from '../../utils/errorHandler';
import { RewardCalculatorService } from '../../services/RewardCalculatorService';
import { ActivityCapService } from '../../services/ActivityCapService';
import { formatChannelReference } from '../../utils/channelRefs';
import { ActivityStatus, ActivityType } from '../../domain/activityDomain';
import { getHistoricalNarrationRewards, HISTORICAL_NARRATIONS, NARRATION_PREFIX_BY_TYPE } from '../../config/historicalNarrations';
import { COMMAND_NAMES } from '../../config/commandNames';
import { getFechaFromOption } from '../../utils/dateParser';
import {
    ACTIVITY_TIER,
    LOGRO_GENERAL_CATALOG,
    LOGRO_REPUTACION_CATALOG,
    getLogroGeneralEntry,
    getLogroReputacionEntry
} from '../../config/activityRewards';

const rewardCalculatorService = new RewardCalculatorService();
const activityCapService = new ActivityCapService(prisma);
const REGISTRO_SUCESOS_FORUM_ID = formatChannelReference(process.env.REGISTRO_SUCESOS_FORUM_ID, '#canal-correcto');

const TIPO_BY_SUBCOMMAND: Record<string, string> = {
    mision: ActivityType.MISION,
    combate: ActivityType.COMBATE,
    cronica: ActivityType.CRONICA,
    evento: ActivityType.EVENTO,
    escena: ActivityType.ESCENA,
    logro_general: ActivityType.LOGRO_GENERAL,
    logro_saga: ActivityType.LOGRO_SAGA,
    logro_reputacion: ActivityType.LOGRO_REPUTACION,
    balance_general: ActivityType.BALANCE_GENERAL,
    experimento: ActivityType.EXPERIMENTO,
    curacion: ActivityType.CURACION,
    desarrollo_personal: ActivityType.DESARROLLO_PERSONAL,
    timeskip: ActivityType.TIMESKIP
};

const RANGO_CHOICES = [
    { name: 'Rango D', value: 'D' },
    { name: 'Rango C', value: 'C' },
    { name: 'Rango B', value: 'B' },
    { name: 'Rango A', value: 'A' },
    { name: 'Rango S', value: 'S' }
];

const RESULTADO_MISION_CHOICES = [
    { name: '✅ Exitosa', value: 'Exitosa' },
    { name: '❌ Fallida', value: 'Fallida' }
];

const RESULTADO_COMBATE_CHOICES = [
    { name: '✅ Victoria', value: 'Exitosa' },
    { name: '❌ Derrota', value: 'Fallida' },
    { name: '🤝 Empate', value: 'Empate' }
];

const RESULTADO_CRONICA_EVENTO_CHOICES = [
    { name: '⭐ Destacado', value: 'Destacado' },
    { name: '📝 Participación', value: 'Participación' }
];

const SEVERIDAD_CHOICES = [
    { name: 'Herido Leve', value: 'Herido Leve' },
    { name: 'Herido Grave', value: 'Herido Grave' },
    { name: 'Herido Crítico', value: 'Herido Critico' },
    { name: 'Coma', value: 'Coma' },
    { name: 'Herida Letal', value: 'Herida Letal' }
];

function normalizeForMatch(value: string): string {
    return value
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

async function publishActivityEmbed(
    interaction: ChatInputCommandInteraction,
    embed: EmbedBuilder
): Promise<Message> {
    return (await interaction.editReply({ embeds: [embed] })) as Message;
}

const evidenciaDesc = 'Link al foro, pantallazo o mensaje de Discord que prueba la actividad';

export const data = new SlashCommandBuilder()
    .setName(COMMAND_NAMES.registrar_suceso)
    .setDescription('Registra una actividad on-rol (Misiones, Combates, Tramas) para tu historial.')
    .addSubcommand((sc) =>
        sc
            .setName('mision')
            .setDescription('Registrar una misión')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('rango')
                    .setDescription('Nivel de la misión')
                    .setRequired(true)
                    .addChoices(...RANGO_CHOICES)
            )
            .addStringOption((o) =>
                o
                    .setName('resultado')
                    .setDescription('Exitosa o Fallida')
                    .setRequired(true)
                    .addChoices(...RESULTADO_MISION_CHOICES)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('combate')
            .setDescription('Registrar un combate')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('rango')
                    .setDescription('Nivel del combate')
                    .setRequired(true)
                    .addChoices(...RANGO_CHOICES)
            )
            .addStringOption((o) =>
                o
                    .setName('resultado')
                    .setDescription('Victoria, Derrota o Empate')
                    .setRequired(true)
                    .addChoices(...RESULTADO_COMBATE_CHOICES)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('cronica')
            .setDescription('Registrar una crónica')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('resultado')
                    .setDescription('Destacado o Participación')
                    .setRequired(true)
                    .addChoices(...RESULTADO_CRONICA_EVENTO_CHOICES)
            )
            .addStringOption((o) =>
                o
                    .setName('nombre_actividad')
                    .setDescription('Crónica del catálogo histórico (opcional)')
                    .setAutocomplete(true)
                    .setRequired(false)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('evento')
            .setDescription('Registrar un evento')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('resultado')
                    .setDescription('Destacado o Participación')
                    .setRequired(true)
                    .addChoices(...RESULTADO_CRONICA_EVENTO_CHOICES)
            )
            .addStringOption((o) =>
                o
                    .setName('nombre_actividad')
                    .setDescription('Evento del catálogo histórico (opcional)')
                    .setAutocomplete(true)
                    .setRequired(false)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('escena')
            .setDescription('Registrar una escena')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addIntegerOption((o) =>
                o
                    .setName('exp')
                    .setDescription('EXP reclamada')
                    .setRequired(true)
                    .setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('pr').setDescription('PR reclamado (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('ryou').setDescription('Ryou reclamado (opcional)').setRequired(false).setMinValue(0)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('logro_general')
            .setDescription('Registrar un logro general')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('nombre_logro')
                    .setDescription('Nombre del logro del catálogo')
                    .setAutocomplete(true)
                    .setRequired(true)
            )
            .addIntegerOption((o) =>
                o.setName('exp').setDescription('EXP (solo para logros de excepción manual)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('pr').setDescription('PR (solo para logros de excepción manual)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('ryou').setDescription('Ryou (solo para logros de excepción manual)').setRequired(false).setMinValue(0)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('logro_saga')
            .setDescription('Registrar un logro de saga')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addIntegerOption((o) =>
                o.setName('exp').setDescription('EXP reclamada').setRequired(true).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('pr').setDescription('PR (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('ryou').setDescription('Ryou (opcional)').setRequired(false).setMinValue(0)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('logro_reputacion')
            .setDescription('Registrar un logro de reputación')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('nombre_logro')
                    .setDescription('Nombre del logro del catálogo')
                    .setAutocomplete(true)
                    .setRequired(true)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('balance_general')
            .setDescription('Registrar un balance general')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('nombre_actividad')
                    .setDescription('Balance General del catálogo (opcional)')
                    .setAutocomplete(true)
                    .setRequired(false)
            )
            .addIntegerOption((o) =>
                o.setName('exp').setDescription('EXP (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('pr').setDescription('PR (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('ryou').setDescription('Ryou (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('rc').setDescription('RC (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('cupos').setDescription('Cupos de habilidad (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('bts').setDescription('Bonos de Técnica Superior (opcional)').setRequired(false).setMinValue(0)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('experimento')
            .setDescription('Registrar un experimento')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('rango')
                    .setDescription('Nivel del experimento')
                    .setRequired(true)
                    .addChoices(...RANGO_CHOICES)
            )
            .addStringOption((o) =>
                o
                    .setName('resultado')
                    .setDescription('Exitosa o Fallida')
                    .setRequired(true)
                    .addChoices(...RESULTADO_MISION_CHOICES)
            )
            .addIntegerOption((o) =>
                o.setName('exp').setDescription('EXP reclamada').setRequired(true).setMinValue(0)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('curacion')
            .setDescription('Registrar una curación')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addStringOption((o) =>
                o
                    .setName('severidad')
                    .setDescription('Severidad de la herida')
                    .setRequired(true)
                    .addChoices(...SEVERIDAD_CHOICES)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('desarrollo_personal')
            .setDescription('Registrar desarrollo personal')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
    )
    .addSubcommand((sc) =>
        sc
            .setName('timeskip')
            .setDescription('Registrar un timeskip')
            .addStringOption((o) =>
                o.setName('fecha').setDescription('Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").').setRequired(true)
            )
            .addStringOption((o) =>
                o.setName('evidencia').setDescription(evidenciaDesc).setRequired(true)
            )
            .addIntegerOption((o) =>
                o.setName('exp').setDescription('EXP reclamada').setRequired(true).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('pr').setDescription('PR (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('ryou').setDescription('Ryou (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('rc').setDescription('RC (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('cupos').setDescription('Cupos de habilidad (opcional)').setRequired(false).setMinValue(0)
            )
            .addIntegerOption((o) =>
                o.setName('bts').setDescription('Bonos de Técnica Superior (opcional)').setRequired(false).setMinValue(0)
            )
    );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    const sub = interaction.options.getSubcommand(false);
    const query = normalizeForMatch(focused.value);

    if (!sub) {
        await interaction.respond([]);
        return;
    }

    if (focused.name === 'nombre_actividad') {
        const tipoParaNombre =
            sub === 'cronica'
                ? ActivityType.CRONICA
                : sub === 'evento'
                  ? ActivityType.EVENTO
                  : sub === 'balance_general'
                    ? ActivityType.BALANCE_GENERAL
                    : null;

        if (!tipoParaNombre) {
            await interaction.respond([]);
            return;
        }

        const prefix = NARRATION_PREFIX_BY_TYPE[tipoParaNombre as keyof typeof NARRATION_PREFIX_BY_TYPE];
        const sourceEntries = Object.keys(HISTORICAL_NARRATIONS).filter((key) => key.startsWith(prefix));
        const suggestions = sourceEntries
            .filter((name) => normalizeForMatch(name).includes(query))
            .slice(0, 25)
            .map((name) => ({ name, value: name }));
        await interaction.respond(suggestions);
        return;
    }

    if (focused.name === 'nombre_logro') {
        const tipoLogro =
            sub === 'logro_general'
                ? ActivityType.LOGRO_GENERAL
                : sub === 'logro_reputacion'
                  ? ActivityType.LOGRO_REPUTACION
                  : null;

        if (!tipoLogro) {
            await interaction.respond([]);
            return;
        }

        const sourceEntries =
            tipoLogro === ActivityType.LOGRO_GENERAL
                ? LOGRO_GENERAL_CATALOG.map((entry) => entry.key)
                : LOGRO_REPUTACION_CATALOG.map((entry) => entry.key);

        const suggestions = sourceEntries
            .filter((name) => normalizeForMatch(name).includes(query))
            .slice(0, 25)
            .map((name) => ({ name, value: name }));

        await interaction.respond(suggestions);
        return;
    }

    await interaction.respond([]);
}

export async function execute(interaction: ChatInputCommandInteraction) {
    await executeWithErrorHandling(
        interaction,
        COMMAND_NAMES.registrar_suceso,
        async (interaction) => {
            assertForumPostContext(interaction, {
                enforceThreadOwnership: true,
                invalidForumMessage:
                    `⛔ No puedes usar ese comando en este canal. Ve a ${REGISTRO_SUCESOS_FORUM_ID} y lee las instrucciones del post fijado para mas informacion.`,
                invalidThreadOwnershipMessage:
                    '⛔ Debes usar tu propio post para registrar actividades.'
            });

            const character = await prisma.character.findUnique({
                where: { discordId: interaction.user.id },
                include: {
                    traits: {
                        include: {
                            trait: true
                        }
                    }
                }
            });

            if (!character) {
                throw validationError('No tienes ninguna ficha registrada. Usa `/registro` primero.');
            }

            const sub = interaction.options.getSubcommand(true);
            const tipo = TIPO_BY_SUBCOMMAND[sub];
            if (!tipo) {
                throw validationError('Tipo de actividad no reconocido. Por favor, usa el comando de nuevo.');
            }

            const evidencia = interaction.options.getString('evidencia', true);
            const rango = interaction.options.getString('rango');
            const severidad = interaction.options.getString('severidad');
            const resultado = interaction.options.getString('resultado');
            const nombreActividad = interaction.options.getString('nombre_actividad');
            const nombreLogro = interaction.options.getString('nombre_logro');
            const claimedExp = interaction.options.getInteger('exp');
            const claimedPr = interaction.options.getInteger('pr');
            const claimedRyou = interaction.options.getInteger('ryou');
            const claimedRc = interaction.options.getInteger('rc');
            const claimedCupos = interaction.options.getInteger('cupos');
            const claimedBts = interaction.options.getInteger('bts');
            const fechaResult = getFechaFromOption(interaction.options.getString('fecha'));
            if (fechaResult && 'error' in fechaResult) {
                throw validationError(fechaResult.error);
            }
            const createdAtOverride = fechaResult && 'date' in fechaResult ? fechaResult.date : undefined;

            const valorRangoPersistido = tipo === ActivityType.CURACION ? severidad : rango;
            const isNarration =
                tipo === ActivityType.CRONICA ||
                tipo === ActivityType.EVENTO ||
                tipo === ActivityType.BALANCE_GENERAL;
            const isLogroGeneral = tipo === ActivityType.LOGRO_GENERAL;
            const isLogroReputacion = tipo === ActivityType.LOGRO_REPUTACION;
            const isLogroCatalogType = isLogroGeneral || isLogroReputacion;

            const generalLogroEntry = isLogroGeneral ? getLogroGeneralEntry(nombreLogro ?? null) : undefined;
            const reputacionLogroEntry = isLogroReputacion
                ? getLogroReputacionEntry(nombreLogro ?? null)
                : undefined;
            const selectedLogroEntry = generalLogroEntry ?? reputacionLogroEntry;
            const selectedCatalogKey = isNarration
                ? nombreActividad
                : isLogroCatalogType
                  ? selectedLogroEntry?.key
                  : null;

            const isManualLogroException = isLogroGeneral && Boolean(generalLogroEntry?.isManualException);
            const isManualType = ACTIVITY_TIER[tipo] === 'MANUAL' || isManualLogroException;
            const isBalanceManualOverride =
                tipo === ActivityType.BALANCE_GENERAL &&
                (claimedExp != null ||
                    claimedPr != null ||
                    claimedRyou != null ||
                    claimedRc != null ||
                    claimedCupos != null ||
                    claimedBts != null);

            // Validation: Balance General can use catalog name for special rewards, or be manual
            if (tipo === ActivityType.BALANCE_GENERAL) {
                if (nombreActividad && !getHistoricalNarrationRewards(nombreActividad)) {
                    throw validationError(
                        'El nombre de actividad no coincide con el catálogo de Balance General. Usa el autocompletado o deja vacío para registro normal.'
                    );
                }
            }

            if (isLogroGeneral && !generalLogroEntry) {
                throw validationError('El `nombre_logro` no coincide con el catálogo de Logros Generales.');
            }

            if (isLogroReputacion && !reputacionLogroEntry) {
                throw validationError(
                    'El `nombre_logro` no coincide con el catálogo de Logros de Reputación.'
                );
            }

            if (isNarration && nombreActividad && !getHistoricalNarrationRewards(nombreActividad)) {
                throw validationError(
                    'El nombre de actividad no coincide con el catálogo histórico. Usa el autocompletado o deja el campo vacío para la tabla estándar.'
                );
            }

            if (isManualType && (claimedExp === null || claimedExp === undefined)) {
                throw validationError(
                    'Las actividades manuales (Escena, Experimento, Logro Saga, Timeskip, Logros con excepción) requieren que indiques la cantidad de EXP reclamada.'
                );
            }

            if (isLogroCatalogType && selectedCatalogKey && selectedLogroEntry) {
                const approvedClaimCount = await prisma.activityRecord.count({
                    where: {
                        characterId: character.id,
                        type: tipo,
                        narrationKey: selectedCatalogKey,
                        status: { in: [ActivityStatus.APROBADO, ActivityStatus.AUTO_APROBADO] }
                    }
                });

                if (approvedClaimCount >= selectedLogroEntry.repeatLimit) {
                    const vecesText = selectedLogroEntry.repeatLimit === 1 ? 'vez' : 'veces';
                    throw validationError(
                        `El logro \`${selectedCatalogKey}\` solo puede hacerse ${selectedLogroEntry.repeatLimit} ${vecesText}.`
                    );
                }
            }

            const capOptions =
                tipo === ActivityType.MISION && rango
                    ? {
                          character: { rank: character.rank, isExiled: character.isExiled },
                          missionRank: rango,
                          ...(createdAtOverride !== undefined ? { createdAtOverride } : {})
                      }
                    : undefined;
            const capResult = await activityCapService.enforceWeeklyCaps(
                character.id,
                tipo,
                capOptions
            );

            cleanupExpiredCooldowns();
            consumeCommandCooldown({
                commandName: COMMAND_NAMES.registrar_suceso,
                actorId: interaction.user.id
            });

            const isHistoricalNarration =
                isNarration && Boolean(getHistoricalNarrationRewards(nombreActividad ?? undefined));
            const shouldPersistClaimed =
                (isManualType &&
                    (claimedExp != null || claimedPr != null || claimedRyou != null || claimedRc != null || claimedCupos != null || claimedBts != null)) ||
                isBalanceManualOverride;
            const activityCreateData: Prisma.ActivityRecordCreateInput = {
                character: { connect: { id: character.id } },
                type: tipo,
                rank: valorRangoPersistido,
                result: resultado,
                evidenceUrl: evidencia,
                ...(createdAtOverride ? { createdAt: createdAtOverride } : {}),
                ...(selectedCatalogKey ? { narrationKey: selectedCatalogKey } : {}),
                ...(shouldPersistClaimed
                    ? {
                          ...(claimedExp != null ? { claimedExp } : {}),
                          ...(claimedPr != null ? { claimedPr } : {}),
                          ...(claimedRyou != null ? { claimedRyou } : {}),
                          ...(claimedRc != null ? { claimedRc } : {}),
                          ...(claimedCupos != null ? { claimedCupos } : {}),
                          ...(claimedBts != null ? { claimedBts } : {})
                      }
                    : {})
            };

            const nuevaActividad = await prisma.activityRecord.create({
                data: activityCreateData
            });

            const isAutoApprovable =
                rewardCalculatorService.isAutoApprovable(tipo) &&
                !isManualLogroException &&
                !isHistoricalNarration &&
                !isBalanceManualOverride;

            if (isAutoApprovable) {
                const rewards = rewardCalculatorService.calculateRewards(
                    character as any,
                    { ...nuevaActividad, narrationKey: selectedCatalogKey } as any
                );

                await prisma.$transaction(async (tx: any) => {
                    const updateData: Record<string, { increment: number }> = {
                        exp: { increment: rewards.exp },
                        pr: { increment: rewards.pr },
                        ryou: { increment: rewards.ryou }
                    };
                    if (rewards.rc && rewards.rc > 0) updateData.rc = { increment: rewards.rc };
                    if (rewards.cupos && rewards.cupos > 0) updateData.cupos = { increment: rewards.cupos };

                    await tx.character.update({
                        where: { id: character.id },
                        data: updateData
                    });

                    await tx.activityRecord.update({
                        where: { id: nuevaActividad.id },
                        data: { status: ActivityStatus.AUTO_APROBADO }
                    });

                    const auditData: Record<string, number> = {
                        deltaExp: rewards.exp,
                        deltaPr: rewards.pr,
                        deltaRyou: rewards.ryou
                    };
                    if (rewards.rc && rewards.rc > 0) auditData.deltaRc = rewards.rc;
                    if (rewards.cupos && rewards.cupos > 0) auditData.deltaCupos = rewards.cupos;

                    await tx.auditLog.create({
                        data: {
                            characterId: character.id,
                            category: 'Registro Automático de Actividad',
                            detail: `Actividad ${tipo} auto-aprobada. Recompensas: EXP=${rewards.exp}, PR=${rewards.pr}, Ryou=${rewards.ryou}` +
                                (rewards.rc ? `, RC=${rewards.rc}` : '') +
                                (rewards.cupos ? `, Cupos=${rewards.cupos}` : ''),
                            evidence: evidencia,
                            ...auditData
                        }
                    });
                });

                const rewardLines = [
                    `✨ EXP: +${rewards.exp}`,
                    `🏆 PR: +${rewards.pr}`,
                    `🪙 Ryou: +${rewards.ryou}`,
                    ...(rewards.rc && rewards.rc > 0 ? [`📜 RC: +${rewards.rc}`] : []),
                    ...(rewards.cupos && rewards.cupos > 0 ? [`📋 Cupos: +${rewards.cupos}`] : [])
                ].join('\n');

                const activitySummary = [
                    `**Usuario:** <@${interaction.user.id}> (${character.name})`,
                    `**Actividad:** ${tipo}`,
                    ...(isLogroCatalogType && selectedCatalogKey ? [`**Logro:** ${selectedCatalogKey}`] : []),
                    ...(isNarration && selectedCatalogKey ? [`**Nombre:** ${selectedCatalogKey}`] : []),
                    ...(valorRangoPersistido
                        ? [
                              tipo === ActivityType.CURACION
                                  ? `**Severidad:** ${valorRangoPersistido}`
                                  : `**Rango/Nivel:** ${valorRangoPersistido}`
                          ]
                        : []),
                    ...(resultado ? [`**Resultado:** ${resultado}`] : []),
                    `**Fecha:** ${interaction.options.getString('fecha', true)}`,
                    `**Evidencia:** [Ver Prueba](${evidencia})`
                ].join('\n');

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00aa00)
                    .setTitle('✅ REGISTRO APROBADO')
                    .setDescription(activitySummary)
                    .addFields(
                        {
                            name: '💰 RECOMPENSAS',
                            value: rewardLines,
                            inline: false
                        },
                        {
                            name: 'CONCLUSIÓN',
                            value: 'Los recursos han sido acreditados a tu ficha de manera inmediata.' +
                                (capResult?.slotsRemaining !== undefined
                                    ? `\n📋 Cupos de misión restantes esta semana: ${capResult.slotsRemaining}`
                                    : ''),
                            inline: false
                        }
                    )
                    .setFooter({
                        text: `ID: ${nuevaActividad.id}`
                    })
                    .setTimestamp();

                await publishActivityEmbed(interaction, successEmbed);
                return;
            }

            const projectedRewards = rewardCalculatorService.calculateRewards(
                character as any,
                { ...nuevaActividad, narrationKey: selectedCatalogKey } as any
            );

            const projectedRewardLines = [
                `✨ EXP: +${projectedRewards.exp}`,
                `🏆 PR: +${projectedRewards.pr}`,
                `🪙 Ryou: +${projectedRewards.ryou}`,
                ...(projectedRewards.rc && projectedRewards.rc > 0 ? [`📜 RC: +${projectedRewards.rc}`] : []),
                ...(projectedRewards.cupos && projectedRewards.cupos > 0 ? [`📋 Cupos: +${projectedRewards.cupos}`] : [])
            ].join('\n');

            const pendingSummary = [
                `**ID de Registro:** ${nuevaActividad.id}`,
                `**Estado:** PENDIENTE (requiere revisión de Staff)`,
                `**Ninja:** <@${interaction.user.id}> (${character.name})`,
                `**Actividad:** ${tipo}`,
                ...(isLogroCatalogType && selectedCatalogKey ? [`**Logro:** ${selectedCatalogKey}`] : []),
                ...(isNarration && selectedCatalogKey ? [`**Nombre:** ${selectedCatalogKey}`] : []),
                ...(valorRangoPersistido
                    ? [
                          tipo === ActivityType.CURACION
                              ? `**Severidad:** ${valorRangoPersistido}`
                              : `**Rango/Nivel:** ${valorRangoPersistido}`
                      ]
                    : []),
                ...(resultado ? [`**Resultado:** ${resultado}`] : []),
                `**Fecha:** ${interaction.options.getString('fecha', true)}`,
                `**Evidencia:** [Ver Prueba](${evidencia})`
            ].join('\n');

            const hasClaimedRewards = (isManualType && claimedExp != null) || isBalanceManualOverride;
            const claimedLines: string[] = [];
            if ((claimedExp ?? 0) > 0) claimedLines.push(`✨ EXP: +${claimedExp}`);
            if ((claimedPr ?? 0) > 0) claimedLines.push(`🏆 PR: +${claimedPr}`);
            if ((claimedRyou ?? 0) > 0) claimedLines.push(`🪙 Ryou: +${claimedRyou}`);
            if ((claimedRc ?? 0) > 0) claimedLines.push(`📜 RC: +${claimedRc}`);
            if ((claimedCupos ?? 0) > 0) claimedLines.push(`📋 Cupos: +${claimedCupos}`);
            if ((claimedBts ?? 0) > 0) claimedLines.push(`🔧 BTS: +${claimedBts}`);
            const rewardDisplayLines = hasClaimedRewards
                ? (claimedLines.length > 0 ? claimedLines.join('\n') : '—')
                : projectedRewardLines;

            const manualNotes = [
                'Staff puede aprobar este registro reaccionando con ✅ en este mensaje.',
                ...(isManualLogroException
                    ? ['Este logro está marcado como excepción manual y requiere validación de Staff.']
                    : []),
                ...(isHistoricalNarration
                    ? [
                          tipo === ActivityType.BALANCE_GENERAL
                              ? 'Este Balance General requiere revisión de Staff.'
                              : 'Esta Crónica/Evento tiene recompensas históricas especiales que requieren revisión.'
                      ]
                    : []),
                ...(!hasClaimedRewards &&
                projectedRewards.exp === 0 &&
                projectedRewards.pr === 0 &&
                projectedRewards.ryou === 0
                    ? [
                          'Este tipo de actividad requiere revisión manual por parte del staff. Usa `/ajustar_recursos otorgar` si el mensaje fue borrado.'
                      ]
                    : [])
            ].join('\n');

            const rewardFieldName = hasClaimedRewards
                ? '💰 Recompensa Reclamada (Pendiente de Aprobación)'
                : '💰 Recompensa Proyectada (Pendiente de Aprobación)';

            const pendingEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('📜 Registro de Actividad Guardado')
                .setDescription(pendingSummary)
                .addFields(
                    {
                        name: rewardFieldName,
                        value: rewardDisplayLines,
                        inline: false
                    },
                    {
                        name: 'Estado de Acreditación',
                        value: manualNotes,
                        inline: false
                    }
                )
                .setFooter({
                    text: `ID: ${nuevaActividad.id}`
                })
                .setTimestamp();

            const publishedMessage = await publishActivityEmbed(interaction, pendingEmbed);
            await prisma.activityRecord.update({
                where: { id: nuevaActividad.id },
                data: { approvalMessageId: publishedMessage.id } as Prisma.ActivityRecordUpdateInput
            });
        },
        {
            defer: { ephemeral: false },
            fallbackMessage: 'No se pudo guardar el registro.',
            errorEphemeral: true
        }
    );
}
