/**
 * Centralized activity reward configuration.
 * Defines deterministic rewards, tier classification, weekly caps, and reference catalogs.
 */

import { ActivityType } from '../domain/activityDomain';

export interface RewardBreakdown {
  exp: number;
  pr: number;
  ryou: number;
  rc?: number;
  cupos?: number;
}

// Activity tier classification: AUTO = deterministic rewards, MANUAL = staff-set rewards
export const ACTIVITY_TIER: Record<string, 'AUTO' | 'MANUAL'> = {
  [ActivityType.MISION]: 'AUTO',
  [ActivityType.COMBATE]: 'AUTO',
  [ActivityType.CURACION]: 'AUTO',
  [ActivityType.DESARROLLO_PERSONAL]: 'AUTO',
  [ActivityType.CRONICA]: 'AUTO',
  [ActivityType.EVENTO]: 'AUTO',
  [ActivityType.ESCENA]: 'MANUAL',
  [ActivityType.EXPERIMENTO]: 'MANUAL',
  [ActivityType.LOGRO_GENERAL]: 'AUTO',
  [ActivityType.LOGRO_SAGA]: 'MANUAL',
  [ActivityType.LOGRO_REPUTACION]: 'AUTO',
  [ActivityType.TIMESKIP]: 'MANUAL',
  [ActivityType.BALANCE_GENERAL]: 'AUTO'
};

// Mission rewards by rank. Failed missions give EXP only.
export const MISSION_REWARDS: Record<string, RewardBreakdown> = {
  D: { exp: 7, pr: 20, ryou: 700 },
  C: { exp: 7, pr: 20, ryou: 700 },
  B: { exp: 15, pr: 45, ryou: 1500 },
  A: { exp: 30, pr: 100, ryou: 7000 },
  S: { exp: 60, pr: 200, ryou: 0 } // S-rank Ryou is distributed manually by staff
};

// Combat PR rewards by opponent rank
export const COMBAT_PR_REWARD: Record<string, number> = {
  C: 5,
  B: 10,
  A: 20,
  S: 30
};

// Curacion PR rewards by wound severity
export const CURACION_PR_BY_SEVERITY: Record<string, number> = {
  'Herido Leve': 5,
  'Herido Grave': 10,
  'Herido Critico': 15,
  'Coma': 25,
  'Herida Letal': 40
};

// Desarrollo Personal EXP by character level
export const DESARROLLO_PERSONAL_EXP: Record<string, number> = {
  D: 4,
  C: 6,
  B: 8,
  A: 10,
  S: 12
};

// Standard Cronica/Evento rewards for activities not in historical catalog
export const STANDARD_NARRATION_REWARDS = {
  Cronica: {
    participant: { exp: 15, pr: 20, ryou: 0 },
    destacado: { exp: 5, pr: 5, ryou: 0 } // additive to participant
  },
  Evento: {
    participant: { exp: 15, pr: 15, ryou: 0 },
    destacado: { exp: 5, pr: 5, ryou: 0 } // additive to participant
  }
};

// Weekly activity caps
export const WEEKLY_CAPS = {
  [ActivityType.COMBATE]: 5,
  [ActivityType.CURACION]: 10
};

// Combat and Curacion are mutually exclusive per week
export const COMBAT_CURACION_EXCLUSIVE = true;

// Mission caps (Feature 0)
export const MISSION_WEEKLY_SLOTS = 5;
export const MISSION_DAILY_LIMIT = 1;
export const MISSION_SLOT_COST: Record<string, number> = {
  D: 1, C: 1, B: 2, A: 3, S: 5
};
export const MISSION_MAX_RANK_BY_CARGO: Record<string, string> = {
  Genin: 'D',
  Chuunin: 'C',
  'Tokubetsu Jounin': 'B',
  Jounin: 'B',
  ANBU: 'B',
  Buntaichoo: 'A',
  'Jounin Hanchou': 'A',
  'Go-Ikenban': 'A',
  Kage: 'S'
};

export interface LogroGeneralEntry {
  key: string;
  category: 'Iniciales' | 'Libres' | 'Maestria' | 'Dados';
  rewards: RewardBreakdown;
  repeatLimit: number;
  isManualException?: boolean;
  levelRule?: string;
  notes?: string;
}

export interface LogroReputacionEntry {
  key: string;
  rewards: RewardBreakdown;
  repeatLimit: number;
  notes?: string;
}

export const LOGRO_GENERAL_CATALOG: LogroGeneralEntry[] = [
  { key: 'Bienvenido al Shinobi Sekai', category: 'Iniciales', rewards: { exp: 3, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'D' },
  { key: 'Forma un grupo', category: 'Iniciales', rewards: { exp: 0, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'D', isManualException: true, notes: 'Recompensa variable (+1 EXP por miembro no-NPC).' },
  { key: 'Explorador', category: 'Iniciales', rewards: { exp: 3, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'D-C' },
  { key: 'Ninja peligroso', category: 'Libres', rewards: { exp: 10, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Ninja especializado', category: 'Libres', rewards: { exp: 10, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'A-S' },
  { key: 'Un paso por delante', category: 'Libres', rewards: { exp: 10, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'A-S' },
  { key: 'Gana tu primer combate', category: 'Maestria', rewards: { exp: 1, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'D-C' },
  { key: 'Primera asistencia medica', category: 'Maestria', rewards: { exp: 1, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'D-C' },
  { key: 'Satsujin Ninja', category: 'Maestria', rewards: { exp: 5, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'A-S' },
  { key: 'Invicto', category: 'Maestria', rewards: { exp: 15, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'S' },
  { key: 'Precision absoluta', category: 'Maestria', rewards: { exp: 15, pr: 0, ryou: 0 }, repeatLimit: 5, levelRule: 'B-S', notes: 'Una vez por nivel.' },
  { key: 'Maestro especialista', category: 'Maestria', rewards: { exp: 0, pr: 0, ryou: 0 }, repeatLimit: 5, isManualException: true, notes: 'Recompensa variable por nivel (D/C/B/A/S).' },
  { key: 'Humildad', category: 'Maestria', rewards: { exp: 10, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'B-S' },
  { key: 'Cientifico de elite', category: 'Maestria', rewards: { exp: 5, pr: 0, ryou: 0 }, repeatLimit: 1, isManualException: true, notes: 'Valida primera victoria de paciente por experimento.' },
  { key: 'Que facil es esto', category: 'Maestria', rewards: { exp: 20, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'A' },
  { key: 'Traiganme la verdadera pelea', category: 'Maestria', rewards: { exp: 10, pr: 0, ryou: 0 }, repeatLimit: 1, levelRule: 'A' },
  { key: 'Luchador formidable I', category: 'Maestria', rewards: { exp: 5, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Luchador formidable II', category: 'Maestria', rewards: { exp: 8, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Luchador formidable III', category: 'Maestria', rewards: { exp: 10, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Luchador formidable IV', category: 'Maestria', rewards: { exp: 15, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Luchador formidable V', category: 'Maestria', rewards: { exp: 20, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Medico experimentado I', category: 'Maestria', rewards: { exp: 5, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Medico experimentado II', category: 'Maestria', rewards: { exp: 8, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Medico experimentado III', category: 'Maestria', rewards: { exp: 10, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Medico experimentado IV', category: 'Maestria', rewards: { exp: 15, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Medico experimentado V', category: 'Maestria', rewards: { exp: 20, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Nemesis del azar', category: 'Dados', rewards: { exp: 3, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Amo del dado', category: 'Dados', rewards: { exp: 8, pr: 0, ryou: 0 }, repeatLimit: 1 },
  { key: 'Lo justo', category: 'Dados', rewards: { exp: 3, pr: 0, ryou: 0 }, repeatLimit: 2 },
  { key: 'Aniquilacion inmediata', category: 'Dados', rewards: { exp: 8, pr: 0, ryou: 0 }, repeatLimit: 1 }
];

export const LOGRO_REPUTACION_CATALOG: LogroReputacionEntry[] = [
  { key: 'Alcanza 200000 Ryou', rewards: { exp: 0, pr: 50, ryou: 0 }, repeatLimit: 1 },
  { key: 'Kage aldea grande', rewards: { exp: 0, pr: 100, ryou: 0 }, repeatLimit: 1 },
  { key: 'Kage aldea pequeña', rewards: { exp: 0, pr: 50, ryou: 0 }, repeatLimit: 1 },
  { key: 'Lider de clan', rewards: { exp: 0, pr: 50, ryou: 0 }, repeatLimit: 1 },
  { key: 'Requisito Nivel S', rewards: { exp: 0, pr: 60, ryou: 0 }, repeatLimit: 1 },
  { key: 'Acumula 400 EXP', rewards: { exp: 0, pr: 40, ryou: 0 }, repeatLimit: 1 },
  { key: 'Deseo Nivel A', rewards: { exp: 0, pr: 20, ryou: 0 }, repeatLimit: 1 },
  { key: 'Deseo Nivel S', rewards: { exp: 0, pr: 50, ryou: 0 }, repeatLimit: 1 }
];

function normalizeGoalKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function getLogroGeneralEntry(goalName: string | null | undefined): LogroGeneralEntry | undefined {
  if (!goalName) return undefined;
  const normalized = normalizeGoalKey(goalName);
  return LOGRO_GENERAL_CATALOG.find((entry) => normalizeGoalKey(entry.key) === normalized);
}

export function getLogroReputacionEntry(goalName: string | null | undefined): LogroReputacionEntry | undefined {
  if (!goalName) return undefined;
  const normalized = normalizeGoalKey(goalName);
  return LOGRO_REPUTACION_CATALOG.find((entry) => normalizeGoalKey(entry.key) === normalized);
}

export function isManualLogroGeneralException(goalName: string | null | undefined): boolean {
  return getLogroGeneralEntry(goalName)?.isManualException === true;
}

// Backward-compatible maps for existing references.
export const LOGRO_REFERENCE_CATALOG: Record<string, RewardBreakdown> = LOGRO_GENERAL_CATALOG.reduce<Record<string, RewardBreakdown>>(
  (acc, entry) => {
    acc[entry.key] = entry.rewards;
    return acc;
  },
  {}
);

export const LOGRO_REPUTACION_PR_CATALOG: Record<string, number> = LOGRO_REPUTACION_CATALOG.reduce<Record<string, number>>(
  (acc, entry) => {
    acc[entry.key] = entry.rewards.pr;
    return acc;
  },
  {}
);
