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
