import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import { StatValidatorService, StatInvestmentDTO } from '../services/StatValidatorService';

// Instanciamos el Pilar Matemático
const statValidator = new StatValidatorService();

export const data = new SlashCommandBuilder()
    .setName('invertir_sp')
    .setDescription('Distribuye tus Skill Points (SP) en tus estadísticas.')
    // Definimos los 7 stats. Todos son opcionales y con un mínimo de 1 para evitar trolleos numéricos.
    .addIntegerOption(opt => opt.setName('fuerza').setDescription('SP a invertir en Fuerza').setMinValue(1))
    .addIntegerOption(opt => opt.setName('resistencia').setDescription('SP a invertir en Resistencia').setMinValue(1))
    .addIntegerOption(opt => opt.setName('velocidad').setDescription('SP a invertir en Velocidad').setMinValue(1))
    .addIntegerOption(opt => opt.setName('percepcion').setDescription('SP a invertir en Percepción').setMinValue(1))
    .addIntegerOption(opt => opt.setName('inteligencia').setDescription('SP a invertir en Inteligencia').setMinValue(1))
    .addIntegerOption(opt => opt.setName('armas').setDescription('SP a invertir en Armas').setMinValue(1))
    .addIntegerOption(opt => opt.setName('chakra').setDescription('SP a invertir en Chakra (1 SP = +2 Puntos)').setMinValue(1));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        // 1. OBTENER AL PERSONAJE DEL USUARIO QUE EJECUTA EL COMANDO
        // Usamos discordId para que el usuario no tenga que escribir su Keko cada vez
        const character = await prisma.character.findUnique({
            where: { discordId: interaction.user.id },
            include: { 
                traits: { include: { trait: true } } // Necesario para leer los bloqueos (Ej: Torpeza)
            }
        });

        if (!character) {
            return interaction.editReply("❌ No tienes ninguna ficha registrada. Usa `/registro` primero.");
        }

        // 2. RECOLECTAR LA INVERSIÓN (DTO)
        const investment: StatInvestmentDTO = {
            fuerza: interaction.options.getInteger('fuerza') || undefined,
            resistencia: interaction.options.getInteger('resistencia') || undefined,
            velocidad: interaction.options.getInteger('velocidad') || undefined,
            percepcion: interaction.options.getInteger('percepcion') || undefined,
            chakra: interaction.options.getInteger('chakra') || undefined,
            inteligencia: interaction.options.getInteger('inteligencia') || undefined,
            armas: interaction.options.getInteger('armas') || undefined
        };

        // Pre-validación rápida: ¿Escribió al menos un número?
        const hasInvestment = Object.values(investment).some(val => val !== undefined);
        if (!hasInvestment) {
            return interaction.editReply("⚠️ Debes indicar al menos un stat para invertir tus SP.");
        }

        // 3. 🧠 EL MOTOR MATEMÁTICO (Fail-Fast)
        // Extraemos los objetos 'Trait' puros de la tabla intermedia para pasarlos al servicio
        const userTraits = character.traits.map((ct: any) => ct.trait);
        
        // Si hay una violación de reglas (Rango B, Torpeza, Sin SP), esto lanzará un throw new Error
        const validationResult = statValidator.calculateNewStats(character, userTraits, investment);

        // 4. 🛡️ TRANSACCIÓN ACID: GUARDAR LOS CAMBIOS
        // Si llegamos aquí, la matemática es 100% legal. Abrimos transacción para actualizar stats y crear el log.
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => { 
            // A. Actualizamos el personaje con los nuevos SP Invertidos
            await tx.character.update({
                where: { id: character.id },
                data: {
                    sp: validationResult.remainingSp,
                    fuerza: validationResult.newInvestedSP.fuerza,
                    resistencia: validationResult.newInvestedSP.resistencia,
                    velocidad: validationResult.newInvestedSP.velocidad,
                    percepcion: validationResult.newInvestedSP.percepcion,
                    inteligencia: validationResult.newInvestedSP.inteligencia,
                    armas: validationResult.newInvestedSP.armas,
                    chakra: validationResult.newInvestedSP.chakra
                }
            });

            // B. Creamos el registro de auditoría
            // Formateamos un texto bonito con lo que invirtió: "Fuerza: +2, Chakra: +1"
            const detallesInversion = Object.entries(investment)
                .filter(([_, val]) => val !== undefined)
                .map(([stat, val]) => `${stat.toUpperCase()}: +${val} SP`)
                .join(", ");

            await tx.auditLog.create({
                data: {
                    characterId: character.id,
                    category: "Distribución de Stats",
                    detail: `Inversión: ${detallesInversion}`,
                    evidence: "Comando /invertir_sp",
                    deltaSp: -validationResult.spSpent
                }
            });
        });

        // 5. RESPUESTA AL USUARIO (UX)
        const mensajeExito = `✅ **¡Entrenamiento Completado!** Has invertido **${validationResult.spSpent} SP**.\n\n` +
                             `📊 **Tus SP Invertidos Actuales:**\n` +
                             `💪 Fuerza: \`${validationResult.newInvestedSP.fuerza}\`\n` +
                             `🛡️ Resistencia: \`${validationResult.newInvestedSP.resistencia}\`\n` +
                             `⚡ Velocidad: \`${validationResult.newInvestedSP.velocidad}\`\n` +
                             `👁️ Percepción: \`${validationResult.newInvestedSP.percepcion}\`\n` +
                             `🧠 Inteligencia: \`${validationResult.newInvestedSP.inteligencia}\`\n` +
                             `🗡️ Armas: \`${validationResult.newInvestedSP.armas}\`\n` +
                             `🌀 Chakra: \`${validationResult.newInvestedSP.chakra}\`\n\n` +
                             `✨ **SP Restantes:** \`${validationResult.remainingSp}\``;

        return interaction.editReply(mensajeExito);

    } catch (error: any) {
        // Aquí atrapamos los errores de Capa 8: "⛔ REGLA RANGO B: Solo un stat..." o "⛔ FONDOS INSUFICIENTES"
        console.error("Error en /invertir_sp:", error);
        return interaction.editReply(`❌ **Inversión Rechazada:**\n${error.message}`);
    }
}