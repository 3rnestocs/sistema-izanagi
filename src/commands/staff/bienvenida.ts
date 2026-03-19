import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { assertStaffAccess } from '../../utils/staffGuards';
import { handleCommandError } from '../../utils/errorHandler';
import { ERROR_OWNER_ONLY } from '../../config/uiStrings';

const GESTION_FORUM_ID = process.env.GESTION_FORUM_ID ?? '';
const REGISTRO_SUCESOS_FORUM_ID = process.env.REGISTRO_SUCESOS_FORUM_ID ?? '';
const TIENDA_FORUM_ID = process.env.TIENDA_FORUM_ID ?? '';
const BUILD_APPROVAL_FORUM_ID = process.env.BUILD_APPROVAL_FORUM_ID ?? '';

export const data = new SlashCommandBuilder()
  .setName('bienvenida')
  .setDescription('Envía el mensaje de bienvenida con embeds al canal actual.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const allowedId = process.env.BIENVENIDA_ALLOWED_USER_ID?.trim();
    if (!allowedId || interaction.user.id !== allowedId) {
      await interaction.reply({
        content: ERROR_OWNER_ONLY,
        ephemeral: true
      });
      return;
    }

    const leebirdEmoji = interaction.guild?.emojis.cache.find((e) => e.name === 'nrt_leebird')?.toString() ?? ':nrt_leebird:';

    const introEmbed = new EmbedBuilder()
      .setColor(0xFF4500)
      .setTitle('🔥 TE DAMOS LA BIENVENIDA A NSC')
      .setDescription(
        'Este es un rol por turnos donde el éxito de tus acciones está atado a una dificultad que debes igualar o superar con los dados. ' +
        'Encontrarás todo el contexto sobre cómo rolear en nuestro [Sistema de Combate](https://nscroleplay.forumcommunity.net/?t=63365044).\n\n' +
        '### 🏗️ ¿Cómo empezar?\n' +
        `Ve a ${BUILD_APPROVAL_FORUM_ID ? `<#${BUILD_APPROVAL_FORUM_ID}>` : '**#🛠️-registro-builds**'} y propón tu build (las guías que quieres ocupar). ` +
        'Una vez el Staff apruebe tu mensaje con ✅, pasarás a la fase de **REGISTRO**.'
      );

    const izanagiEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🤖 EL SISTEMA AUTOMATIZADO: IZANAGI')
      .setDescription(
        'Olvídate de hojas de cálculo, formularios y esperas. **IZANAGI** es un bot de Discord que procesa todo al instante usando comandos slash (`/comando`).\n\n' +
        '> 💬 Escribes un comando → ⚡ Izanagi responde al instante.\n\n' +
        'Aplica multiplicadores, valida requisitos, calcula recompensas y actualiza tu ficha automáticamente. Sin intervención manual.'
      )
      .addFields({
        name: '🏯 Reglas de Oro',
        value:
          '• **Un hilo por Personaje** — En los canales de foro, crea un único post con el nombre exacto de tu Keko. Todos tus comandos van ahí.\n' +
          '• **Usa comandos slash** — Escribe `/registro`, `/ficha`, etc. El bot no lee mensajes de texto.',
        inline: false
      });

    const gestionRef = GESTION_FORUM_ID ? `<#${GESTION_FORUM_ID}>` : '#gestion-de-fichas';
    const buildApprovalRef = BUILD_APPROVAL_FORUM_ID ? `<#${BUILD_APPROVAL_FORUM_ID}>` : '#🛠️-registro-builds';
    const registroRef = REGISTRO_SUCESOS_FORUM_ID ? `<#${REGISTRO_SUCESOS_FORUM_ID}>` : '#registro-de-sucesos';
    const tiendaRef = TIENDA_FORUM_ID ? `<#${TIENDA_FORUM_ID}>` : '#tienda';

    const routeEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🗺️ TU RUTA NINJA')
      .setDescription('Solo hay **3 canales de foro**. El 90% del tiempo usarás solo uno.')
      .addFields(
        {
          name: `🟢 UNA SOLA VEZ — ${gestionRef}`,
          value:
            '`/registro` — Crea tu ficha en la base de datos de Izanagi. Rellenas nombre, edad, moral, rasgos y habilidades iniciales en un solo comando.\n' +
            `• Antes de usar el comando, recuerda enviar tu build por ${buildApprovalRef} y esperar a que el staff reaccione con ✅ en el mensaje, indicando que tu build fue aprobada.\n` +
            '• Si una de las guías de tu build te da otra habilidad o rasgo, no hace falta que lo escribas. Izanagi lo agregará por ti 💪\n'
            ,
            inline: false
          },
          {
            name: `🔵 FRECUENTEMENTE — ${registroRef}`,
            value:
            '`/registrar_suceso` — Registra misiones, combates, narraciones o cualquier actividad.\n' +
            '• Tú pones el tipo, rango y enlace de evidencia. Izanagi **calcula las recompensas** según tu nivel, rango y rasgos.\n' +
            '• Si el suceso queda como PENDIENTE, el staff debe  revisar y aprobar con ✅ para que obtengas tus recompensas.\n' +
            `• Si te sumas recompensas falsas y se comprueba que no fue por un error, la sanción hará que te plantees desinstalar Hobba ${leebirdEmoji}\n`
            ,
            inline: false
          },
          {
            name: `🟡 OCASIONALMENTE — ${gestionRef}`,
            value:
            '`/ficha` — Consulta tu ficha completa en cualquier momento.\n' +
            '`/historial` — Consulta el historial de actividades y recompensas de tu personaje.\n' +
            '`/invertir_sp` — Reparte tus puntos de stat. El bot valida topes, escalas y bloqueos.\n' +
            '`/ascender` — Solicita un ascenso de rango cuando cumplas los requisitos.\n' +
            '`/otorgar_habilidad` — Solicita una nueva habilidad cuando tengas un deseo aprobado. Staff aprueba con ✅.\n' +
            '`/otorgar_rasgo` — Solicita agregar o remover un rasgo. Staff aprueba con ✅.\n' +
            '`/catalogo` — Consulta rasgos, habilidades o ítems disponibles.',
          inline: false
        },
        {
          name: `🟠 ECONOMÍA — ${tiendaRef}`,
          value:
            '`/tienda` — Consulta el inventario disponible.\n' +
            '`/comprar` · `/vender` · `/transferir` — Izanagi aplica descuentos y recargos según tus rasgos.\n' +
            '`/cobrar_sueldo` — Cobra tu sueldo semanal (se registra el lunes más reciente). El monto depende de tu cargo y rasgos.',
          inline: false
        }
      );

    const helpEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('🛡️ ¿NECESITAS AYUDA?')
      .setDescription(
        'Si tienes dudas sobre qué comando usar o cómo funciona algo, pregunta en el canal de dudas **antes** de registrar nada. ¡El Staff está para ayudarte!'
      )
      .setFooter({ text: 'Sistema IZANAGI • NSC' })
      .setTimestamp();

    const channel = interaction.channel;
    if (!channel || !('send' in channel)) {
      throw new Error('⛔ Este comando debe usarse en un canal de texto.');
    }

    await interaction.reply({ content: '✅ Mensaje de bienvenida enviado.', ephemeral: true });

    await channel.send({
      embeds: [introEmbed, izanagiEmbed, routeEmbed, helpEmbed]
    });
  } catch (error: unknown) {
    await handleCommandError(error, interaction, {
      commandName: 'bienvenida',
      fallbackMessage: 'Error al enviar el mensaje de bienvenida.',
      ephemeral: true
    });
  }
}
