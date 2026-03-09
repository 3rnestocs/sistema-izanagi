// src/commands/registro.ts

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../index'; // Asegúrate de que esta ruta apunte a tu cliente Prisma
import { CharacterService } from '../services/CharacterService';
import { PlazaService } from '../services/PlazaService';

// Instanciamos los Pilares (Idealmente esto se inyecta o se importa de un index de servicios)
const characterService = new CharacterService(prisma);
const plazaService = new PlazaService(prisma);

export const data = new SlashCommandBuilder()
    .setName('registro')
    .setDescription('Crea tu ficha inicial en el Sistema IZANAGI')
    .addStringOption(option => 
        option.setName('keko').setDescription('Tu alias de usuario (ej: Bill)').setRequired(true))
    .addStringOption(option => 
        option.setName('nombre').setDescription('Nombre de tu personaje (ej: Ao Hagoromo)').setRequired(true))
    // Pedimos los Rasgos (SSOT)
    .addStringOption(option => 
        option.setName('rasgo_origen').setDescription('Nombre exacto de tu Rasgo de Origen').setRequired(true))
    .addStringOption(option => 
        option.setName('rasgo_nacimiento').setDescription('Nombre exacto de tu Rasgo de Nacimiento').setRequired(true))
    .addStringOption(option => 
        option.setName('rasgo_extra').setDescription('Rasgo Extra (Opcional)').setRequired(false))
    // Pedimos las Guías/Plazas
    .addStringOption(option => 
        option.setName('guia_1').setDescription('Guía Inicial 1 (Ej: Clan Uchiha) (Opcional)').setRequired(false))
    .addStringOption(option => 
        option.setName('guia_2').setDescription('Guía Inicial 2 (Ej: Katon) (Opcional)').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    // Retrasamos la respuesta porque las transacciones a la DB pueden tomar un par de segundos
    await interaction.deferReply({ ephemeral: true });

    try {
        // 1. RECOLECCIÓN Y SANITIZACIÓN DE DATOS (Capa 8)
        const keko = interaction.options.getString('keko', true);
        const nombre = interaction.options.getString('nombre', true);
        
        const rasgoOrigen = interaction.options.getString('rasgo_origen', true);
        const rasgoNacimiento = interaction.options.getString('rasgo_nacimiento', true);
        const rasgoExtra = interaction.options.getString('rasgo_extra');
        
        const guia1 = interaction.options.getString('guia_1');
        const guia2 = interaction.options.getString('guia_2');

        // Filtramos los nulos y creamos arrays limpios
        const traitNames = [rasgoOrigen, rasgoNacimiento, rasgoExtra].filter(Boolean) as string[];
        const plazaNames = [guia1, guia2].filter(Boolean) as string[];

        // 🛡️ Fail-Fast Previo: Verificar si el keko ya existe para no hacer consultas pesadas en vano
        const existe = await prisma.character.findUnique({ where: { name: keko } });
        if (existe) {
            return interaction.editReply(`❌ **ERROR:** El keko **${keko}** ya está registrado en la base de datos.`);
        }

        // ==========================================
        // 🧬 PILAR 1: CREACIÓN DE FICHA Y RASGOS
        // ==========================================
        // CharacterService validará las incompatibilidades y sumará los Ryou iniciales
        const nuevoPJ = await characterService.createCharacter({
            discordId: interaction.user.id,
            name: keko,
            fullName: nombre,
            traitNames: traitNames
        });

        // ==========================================
        // 📜 PILAR 2: ASIGNACIÓN DE GUÍAS INICIALES
        // ==========================================
        // PlazaService validará los Cupos, la Categoría Inicial y la Simbiosis
        let guiasExitosas: string[] = [];
        
        for (const plazaName of plazaNames) {
            try {
                await plazaService.assignPlaza({
                    characterId: nuevoPJ.id,
                    plazaName: plazaName,
                    grantType: 'INICIAL'
                });
                guiasExitosas.push(plazaName);
            } catch (plazaError: any) {
                // Si una guía falla (ej. no existe o cuesta muchos cupos), informamos pero no borramos la ficha
                await interaction.followUp({ 
                    content: `⚠️ **Aviso sobre Guías:** No se pudo asignar '${plazaName}'. Razón: ${plazaError.message}`, 
                    ephemeral: true 
                });
            }
        }

        // ==========================================
        // 📊 PILAR 3: PREPARACIÓN DE STATS (Siguiente Paso)
        // ==========================================
        // Leemos cómo quedó la ficha tras inyectar Rasgos y Guías (que podrían haberle dado +Ninjutsu o Cupos)
        const fichaFinal = await prisma.character.findUnique({ where: { id: nuevoPJ.id } });

        const mensajeExito = `✅ **¡Ficha de ${fichaFinal?.fullName} Creada con Éxito!**\n` +
                             `**Keko:** ${fichaFinal?.name}\n` +
                             `**Rasgos:** ${traitNames.join(', ')}\n` +
                             `**Guías:** ${guiasExitosas.length > 0 ? guiasExitosas.join(', ') : 'Ninguna'}\n\n` +
                             `💰 **Economía Inicial:** ${fichaFinal?.ryou} Ryou | ${fichaFinal?.rc} RC | ${fichaFinal?.cupos} Cupos restantes.\n` +
                             `📊 **Siguiente Paso:** Tienes **${fichaFinal?.sp} SP** disponibles. Usa el comando \`/invertir_sp\` para asignarlos.`;

        return interaction.editReply(mensajeExito);

    } catch (error: any) {
        // Atrapa los Errores de Capa 8 lanzados por los "throw new Error" del CharacterService
        console.error("Error en /registro:", error);
        return interaction.editReply(`❌ **Operación Cancelada:**\n${error.message}`);
    }
}