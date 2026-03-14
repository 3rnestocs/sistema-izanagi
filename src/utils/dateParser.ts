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

const CARACAS_TIMEZONE = 'America/Caracas';

/**
 * Returns the weekday (0=Sunday, 1=Monday, ..., 6=Saturday) in the given timezone for the given date.
 */
export function getDayOfWeekInTimezone(date: Date, timeZone: string = CARACAS_TIMEZONE): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short'
  });
  const weekday = formatter.format(date); // "Mon", "Tue", ...
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

/**
 * Returns true if the given date (or current time if omitted) is a Monday in the specified timezone.
 * Uses Intl.DateTimeFormat for reliable timezone conversion.
 */
export function isMondayInTimezone(date: Date = new Date(), timeZone: string = CARACAS_TIMEZONE): boolean {
  const weekday = new Intl.DateTimeFormat('en-CA', { timeZone, weekday: 'long' }).format(date);
  return weekday === 'Monday';
}

/**
 * Returns the most recent Monday in America/Caracas (UTC-4).
 * If fromDate is a Monday, returns that date at 00:00:00. Otherwise returns the preceding Monday.
 */
export function getMostRecentMonday(fromDate: Date = new Date()): Date {
  const dayOfWeek = getDayOfWeekInTimezone(fromDate, CARACAS_TIMEZONE); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CARACAS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(fromDate);

  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);

  const caracasMonday = new Date(Date.UTC(year, month, day - daysBack, 4, 0, 0, 0)); // midnight Caracas = 04:00 UTC
  return new Date(Date.UTC(
    caracasMonday.getUTCFullYear(),
    caracasMonday.getUTCMonth(),
    caracasMonday.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * Normalizes a Date to midnight UTC (date-only) for exact date matching.
 */
export function toDateOnlyUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
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
