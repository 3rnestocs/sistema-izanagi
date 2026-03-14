/**
 * Centralized salary configuration.
 * Used by SalaryService and related commands.
 */

export const BASE_SALARIES: Readonly<Record<string, number>> = {
  Genin: 0,
  Chuunin: 800,
  'Tokubetsu Jounin': 1200,
  Jounin: 1800,
  ANBU: 2400,
  Buntaichoo: 3000,
  'Jounin Hanchou': 3000,
  'Go-Ikenban': 3500,
  Kage: 5000
};

export const WEEKLY_EXP_BONUS = 2;

export const SALARY_COOLDOWN_DAYS = 7;
