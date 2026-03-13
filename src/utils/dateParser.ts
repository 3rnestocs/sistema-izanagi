/**
 * Shared date parsing and validation for backdating commands.
 * Format: DD/MM/YYYY. Max 730 days (2 years) back for migration support.
 */

const MAX_DAYS_BACK = 730;
const DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export interface ParseFechaResult {
  success: true;
  date: Date | null; // null when no input (no override)
}

export interface ParseFechaError {
  success: false;
  message: string;
}

export type ParseFechaOutcome = ParseFechaResult | ParseFechaError;

/**
 * Parse and validate a fecha string (DD/MM/YYYY).
 * Returns { success: true, date } or { success: false, message }.
 * Use null/undefined input when no backdating is requested (caller will NOT override createdAt).
 */
export function parseAndValidateFecha(value: string | null | undefined): ParseFechaOutcome {
  if (!value || value.trim().length === 0) {
    return { success: true, date: null };
  }

  const trimmed = value.trim();

  if (trimmed.toLowerCase() === 'hoy') {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
    return { success: true, date: today };
  }

  const match = trimmed.match(DATE_REGEX);
  if (!match) {
    return {
      success: false,
      message: `Formato de fecha inválido. Usa DD/MM/YYYY (ej: 15/01/2025) o "hoy".`
    };
  }

  const day = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10) - 1; // JS months are 0-indexed
  const year = parseInt(match[3]!, 10);

  if (month < 0 || month > 11) {
    return {
      success: false,
      message: `Mes inválido. Debe estar entre 01 y 12.`
    };
  }

  const date = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return {
      success: false,
      message: `Fecha inválida (ej: 31/02 no existe).`
    };
  }

  const now = new Date();
  now.setUTCHours(23, 59, 59, 999);
  if (date > now) {
    return {
      success: false,
      message: `La fecha no puede ser futura.`
    };
  }

  const minDate = new Date(now);
  minDate.setUTCDate(minDate.getUTCDate() - MAX_DAYS_BACK);
  minDate.setUTCHours(0, 0, 0, 0);
  if (date < minDate) {
    return {
      success: false,
      message: `La fecha no puede ser hace más de ${MAX_DAYS_BACK} días (${Math.floor(MAX_DAYS_BACK / 365)} años).`
    };
  }

  return { success: true, date };
}

/**
 * Helper to get optional fecha from interaction and return a Date for createdAt override.
 * Returns null when no fecha was provided (caller uses default now).
 */
export function getFechaFromOption(
  value: string | null | undefined
): { date: Date } | { error: string } | null {
  const result = parseAndValidateFecha(value);
  if (!result.success) {
    return { error: result.message };
  }
  if (result.date === null) {
    return null; // No override
  }
  return { date: result.date };
}
