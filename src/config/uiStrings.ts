/**
 * Centralized UI strings for commands.
 * Use these instead of hardcoded strings for consistency and easier localization.
 */

/** Date format hint for slash command options. */
export const DATE_OPTION_DESCRIPTION = 'Fecha (en formato DD/MM/YYYY o escribe "hoy").';

/** Date option descriptions by context. */
export const DATE_OPTION_VARIANTS = {
  actividad: 'Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").',
  ascenso: 'Fecha del ascenso (en formato DD/MM/YYYY o escribe "hoy").',
  ascensoShort: 'Fecha del ascenso (DD/MM/YYYY o "hoy")',
  compra: 'Fecha de la compra (en formato DD/MM/YYYY o escribe "hoy").',
  creacion: 'Fecha de creación de la ficha (en formato DD/MM/YYYY o escribe "hoy").',
  inversion: 'Fecha de la inversión (en formato DD/MM/YYYY o escribe "hoy").',
  lunes: 'Fecha del lunes (formato DD/MM/YYYY o "hoy")',
  transferencia: 'Fecha de la transferencia (en formato DD/MM/YYYY o escribe "hoy").',
  venta: 'Fecha de la venta (en formato DD/MM/YYYY o escribe "hoy").'
} as const;

/** Error: invalid date format */
export const ERROR_INVALID_DATE = '⛔ Fecha inválida.';

/** Error: date format hint for validation */
export const ERROR_DATE_FORMAT_HINT = 'Debes indicar una fecha válida (DD/MM/YYYY o "hoy").';

/** Error: must provide date in format */
export const ERROR_DATE_FORMAT_PROVIDE = 'Debes proporcionar una fecha en formato DD/MM/YYYY o "hoy".';

/** Error: staff-only command */
export const ERROR_STAFF_ONLY = '⛔ Este comando es exclusivo de Staff.';

/** Error: staff-only historial */
export const ERROR_STAFF_ONLY_HISTORIAL = '⛔ Solo staff puede ver el historial de otros personajes.';

/** Error: owner-only command */
export const ERROR_OWNER_ONLY = '⛔ Solo el propietario configurado puede usar este comando.';

/** Error: user has no character (for historial) */
export function ERROR_NO_CHARACTER(username: string): string {
  return `⛔ ${username} no tiene un personaje registrado.`;
}

/** Error: user has no character (for forzar_ascenso) */
export function ERROR_NO_CHARACTER_FICHA(username: string): string {
  return `⛔ El usuario ${username} no tiene ficha registrada.`;
}

/** Embed field: week of (salary) */
export const FIELD_WEEK_OF = 'Correspondiente a la semana del';

/** Embed field: base salary */
export const FIELD_BASE_SALARY = 'Sueldo Base';

/** Embed field: origin bonus */
export const FIELD_ORIGIN_BONUS = 'Bonos de Origen';

/** Embed field: balance multiplier */
export const FIELD_BALANCE_MULTIPLIER = 'Multiplicador de Balance';

/** Embed field: final balance */
export const FIELD_FINAL_BALANCE = 'Balance Final';

/** Embed field: net Ryou */
export const FIELD_NET_RYOU = 'Ryou Neto';

/** Embed field: weekly EXP bonus */
export const FIELD_WEEKLY_EXP_BONUS = 'Bono EXP Semanal';

/** Embed field: EXP granted */
export const FIELD_EXP_GRANTED = 'EXP Otorgado';

/** Embed field: SP granted */
export const FIELD_SP_GRANTED = 'SP Acumulados';

/** Embed field: base compensation for level */
export const FIELD_BASE_COMPENSATION = 'Compensación de Base (Para alcanzar el mínimo del nivel)';

/** Historial: empty state */
export const HISTORIAL_EMPTY = 'Sin eventos registrados en el historial.';

/** Historial: continuation embed title */
export const HISTORIAL_CONTINUATION = '...continuación del historial...';

/** Button: delete message */
export const BUTTON_DELETE_MESSAGE = 'Eliminar mensaje';

/** Error: historial fetch failed */
export const ERROR_HISTORIAL_FETCH = 'Error al obtener historial.';

/** Placeholder: no evidence attached */
export const PLACEHOLDER_NO_EVIDENCE = 'Sin evidencia adjunta';

// --- index.ts: button/modal/interaction ---

/** Error: only historial author or staff can delete */
export const ERROR_HISTORIAL_DELETE_AUTH = '⛔ Solo el autor del historial o staff puede eliminar este mensaje.';

/** Error: failed to delete message */
export const ERROR_DELETE_MESSAGE_FAILED = '❌ No se pudo eliminar el mensaje.';

/** Error: only ficha author, thread owner or staff can delete */
export const ERROR_FICHA_DELETE_AUTH = '⛔ Solo el autor de la ficha, el dueño del post o staff puede eliminar este mensaje.';

/** Error: failed to delete ficha message */
export const ERROR_FICHA_DELETE_FAILED = '❌ No se pudo eliminar el mensaje de ficha.';

/** Error: only own character image can be changed */
export const ERROR_FICHA_IMAGE_OWNER_ONLY = '⛔ Solo puedes cambiar la imagen de tu propio personaje.';

/** Modal: change character image title */
export const MODAL_FICHA_IMAGE_TITLE = 'Cambiar imagen del personaje';

/** Modal: image URL input label */
export const MODAL_FICHA_IMAGE_LABEL = 'URL de la imagen';

/** Modal: image URL placeholder */
export const MODAL_FICHA_IMAGE_PLACEHOLDER = 'https://ejemplo.com/imagen.png';

/** Error: internal error */
export const ERROR_INTERNAL = '⛔ Error interno.';

/** Error: URL must start with https or http */
export const ERROR_URL_MUST_START_HTTPS = '⛔ La URL debe comenzar con https:// o http://';

/** Error: URL must be image or known host */
export const ERROR_URL_MUST_BE_IMAGE =
  '⛔ La URL debe ser de una imagen (jpg, png, gif, webp) o de un host conocido (imgur, Discord CDN).';

/** Success: ficha image updated */
export const SUCCESS_FICHA_IMAGE_UPDATED = '✅ Imagen del personaje actualizada. Usa `/ficha` para ver el cambio.';

/** Error: command execution failed */
export const ERROR_COMMAND_EXECUTION = '❌ Error al ejecutar el comando';

// --- utils: guards, forum, date ---

/** Error: command must be used in guild */
export const ERROR_GUILD_ONLY = '⛔ Este comando solo puede usarse dentro de un servidor.';

/** Error: no staff permission */
export const ERROR_STAFF_PERMISSION = '⛔ No tienes permisos de staff para usar este comando.';

/** Error: NPC validation requires Prisma client */
export const ERROR_NPC_VALIDATION_NO_PRISMA =
  '⛔ Configuración inválida: falta cliente de base de datos para validación de NPC.';

/** Error: character needs canCreateNPC permission */
export const ERROR_NPC_CAN_CREATE_REQUIRED =
  '⛔ Tu ficha no tiene habilitado el permiso canCreateNPC para gestionar NPCs.';

/** Error: use command in forum thread */
export const ERROR_FORUM_THREAD_REQUIRED =
  '⛔ Usa este comando dentro de un post de foro (thread), no en un canal de texto normal.';

/** Error: command only in forum channel threads */
export const ERROR_FORUM_CHANNEL_REQUIRED =
  '⛔ Este comando solo está permitido en threads que pertenezcan a canales tipo foro.';

/** Error: no allowed role for forum */
export const ERROR_FORUM_ROLE_REQUIRED =
  '⛔ No tienes el rol permitido para usar este comando en el flujo de pruebas.';

/** Error: forum not enabled for ficha commands */
export const ERROR_FORUM_NOT_ENABLED =
  '⛔ Este foro no está habilitado para comandos de ficha. Usa el foro configurado por Staff para creación/gestión de personaje.';

/** Error: must use own forum post */
export const ERROR_FORUM_OWN_POST_REQUIRED =
  '⛔ Debes usar tu propio post del foro para ejecutar comandos de ficha.';

/** Error: date format invalid (dateParser) */
export const ERROR_DATE_FORMAT_INVALID = 'Formato de fecha inválido. Usa DD/MM/YYYY (ej: 15/01/2025) o "hoy".';

/** Error: month invalid */
export const ERROR_DATE_MONTH_INVALID = 'Mes inválido. Debe estar entre 01 y 12.';

/** Error: date invalid (e.g. 31/02) */
export const ERROR_DATE_INVALID = 'Fecha inválida (ej: 31/02 no existe).';

/** Error: date cannot be future */
export const ERROR_DATE_FUTURE = 'La fecha no puede ser futura.';

/** Error: date too old (template) */
export const ERROR_DATE_TOO_OLD = (days: number, years: number) =>
  `La fecha no puede ser hace más de ${days} días (${years} años).`;

/** Error: command cooldown (template) */
export const ERROR_COOLDOWN = (seconds: number) =>
  `⏳ Comando en enfriamiento. Intenta nuevamente en ${seconds}s.`;
