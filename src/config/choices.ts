/**
 * Centralized choice arrays for slash command options.
 * Derived from config where possible to avoid drift.
 */

import { CURACION_PR_BY_SEVERITY } from './activityRewards';
import { BASE_SALARIES } from './salaryConfig';

/** Severidad choices for curación. Value must match CURACION_PR_BY_SEVERITY keys. */
export const SEVERIDAD_CHOICES = Object.entries(CURACION_PR_BY_SEVERITY).map(([key]) => ({
  name: key === 'Herido Critico' ? 'Herido Crítico' : key,
  value: key
}));

/** Cargo choices for ascender. Derived from BASE_SALARIES, excludes Genin. Lider de Clan added (not in salary config). */
const SALARY_RANKS = Object.keys(BASE_SALARIES) as string[];
const RANKS_FOR_ASCENDER = SALARY_RANKS.filter((r) => r !== 'Genin');
export const CARGO_CHOICES: Array<{ name: string; value: string }> = [
  ...RANKS_FOR_ASCENDER.map((r) => ({ name: r, value: r })),
  { name: 'Líder de Clan', value: 'Lider de Clan' }
];

/** Activity result choices for mission/combat/narration in registrar_suceso. Values match canonicalizeActivityResult input. */
export const ACTIVITY_RESULT_CHOICES = {
  mision: [
    { name: '✅ Exitosa', value: 'Exitosa' },
    { name: '❌ Fallida', value: 'Fallida' }
  ] as Array<{ name: string; value: string }>,
  combate: [
    { name: '✅ Victoria', value: 'Exitosa' },
    { name: '❌ Derrota', value: 'Fallida' },
    { name: '🤝 Empate', value: 'Empate' }
  ] as Array<{ name: string; value: string }>,
  narracion: [
    { name: '⭐ Destacado', value: 'Destacado' },
    { name: '📝 Participación', value: 'Participación' }
  ] as Array<{ name: string; value: string }>
} as const;

/** Store currency filter choices. */
export const STORE_CURRENCY_CHOICES: Array<{ name: string; value: string }> = [
  { name: 'Ryou', value: 'RYOU' },
  { name: 'EXP', value: 'EXP' },
  { name: 'PR', value: 'PR' }
];
