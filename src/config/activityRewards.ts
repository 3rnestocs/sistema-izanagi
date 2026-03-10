/**
 * Centralized activity reward configuration.
 * Defines deterministic rewards, tier classification, weekly caps, and reference catalogs.
 */

import { ActivityType } from '../domain/activityDomain';

export interface RewardBreakdown {
  exp: number;
  pr: number;
  ryou: number;
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
  [ActivityType.LOGRO_GENERAL]: 'MANUAL',
  [ActivityType.LOGRO_SAGA]: 'MANUAL',
  [ActivityType.LOGRO_REPUTACION]: 'MANUAL',
  [ActivityType.TIMESKIP]: 'MANUAL'
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

// Logro General reference catalog (for staff lookup)
export const LOGRO_REFERENCE_CATALOG: Record<string, RewardBreakdown> = {
  'Bienvenido al Shinobi Sekai': { exp: 3, pr: 0, ryou: 0 },
  'Forma un grupo': { exp: 0, pr: 0, ryou: 0 }, // 1 EXP per non-NPC member (variable)
  'Explorador': { exp: 3, pr: 0, ryou: 0 },
  'Ninja peligroso': { exp: 10, pr: 0, ryou: 0 },
  'Ninja especializado': { exp: 10, pr: 0, ryou: 0 },
  'Un paso por delante': { exp: 10, pr: 0, ryou: 0 },
  'Gana tu primer combate': { exp: 1, pr: 0, ryou: 0 }, // additional to combat reward
  'Primera asistencia medica': { exp: 1, pr: 0, ryou: 0 }, // additional to curacion reward
  'Satsujin Ninja': { exp: 5, pr: 0, ryou: 0 },
  'Invicto': { exp: 15, pr: 0, ryou: 0 },
  'Precision absoluta': { exp: 15, pr: 0, ryou: 0 },
  'Maestro especialista': { exp: 0, pr: 0, ryou: 0 }, // Level-dependent: D=3, C=4, B=5, A=6, S=10
  'Humildad': { exp: 10, pr: 0, ryou: 0 },
  'Cientifico de elite': { exp: 5, pr: 0, ryou: 0 },
  'Que facil es esto': { exp: 20, pr: 0, ryou: 0 },
  'Traiganme la verdadera pelea': { exp: 10, pr: 0, ryou: 0 },
  'Luchador formidable I': { exp: 5, pr: 0, ryou: 0 },
  'Luchador formidable II': { exp: 8, pr: 0, ryou: 0 },
  'Luchador formidable III': { exp: 10, pr: 0, ryou: 0 },
  'Luchador formidable IV': { exp: 15, pr: 0, ryou: 0 },
  'Luchador formidable V': { exp: 20, pr: 0, ryou: 0 },
  'Medico experimentado I': { exp: 5, pr: 0, ryou: 0 },
  'Medico experimentado II': { exp: 8, pr: 0, ryou: 0 },
  'Medico experimentado III': { exp: 10, pr: 0, ryou: 0 },
  'Medico experimentado IV': { exp: 15, pr: 0, ryou: 0 },
  'Medico experimentado V': { exp: 20, pr: 0, ryou: 0 },
  'Nemesis del azar': { exp: 3, pr: 0, ryou: 0 },
  'Amo del dado': { exp: 8, pr: 0, ryou: 0 },
  'Lo justo': { exp: 3, pr: 0, ryou: 0 }, // repeatable x2
  'Aniquilacion inmediata': { exp: 8, pr: 0, ryou: 0 }
};

// Logro de Reputacion reference catalog (PR-only milestones)
export const LOGRO_REPUTACION_CATALOG: Record<string, number> = {
  'Alcanza 200000 Ryou': 50,
  'Kage aldea grande': 100,
  'Kage aldea pequeña': 50,
  'Lider de clan': 50,
  'Requisito Nivel S': 60,
  'Acumula 400 EXP': 40,
  'Deseo Nivel A': 20,
  'Deseo Nivel S': 50
};
