/**
 * Centralized choice arrays for slash command options.
 * Derived from config where possible to avoid drift.
 */

import { CURACION_PR_BY_SEVERITY } from './activityRewards';

/** Severidad choices for curación. Value must match CURACION_PR_BY_SEVERITY keys. */
export const SEVERIDAD_CHOICES = Object.entries(CURACION_PR_BY_SEVERITY).map(([key]) => ({
  name: key === 'Herido Critico' ? 'Herido Crítico' : key,
  value: key
}));

/** Cargo choices for ascender. Excludes Genin (starting rank). */
export const CARGO_CHOICES: Array<{ name: string; value: string }> = [
  { name: 'Chuunin', value: 'Chuunin' },
  { name: 'Tokubetsu Jounin', value: 'Tokubetsu Jounin' },
  { name: 'Jounin', value: 'Jounin' },
  { name: 'ANBU', value: 'ANBU' },
  { name: 'Buntaichoo', value: 'Buntaichoo' },
  { name: 'Jounin Hanchou', value: 'Jounin Hanchou' },
  { name: 'Go-Ikenban', value: 'Go-Ikenban' },
  { name: 'Líder de Clan', value: 'Lider de Clan' },
  { name: 'Kage', value: 'Kage' }
];

/** Store currency filter choices. */
export const STORE_CURRENCY_CHOICES: Array<{ name: string; value: string }> = [
  { name: 'Ryou', value: 'RYOU' },
  { name: 'EXP', value: 'EXP' },
  { name: 'PR', value: 'PR' }
];
