/**
 * Historical Cronica/Evento rewards catalog.
 * Maps canonical activity names to their actual participant and destacado rewards.
 * Used during migration when players register past activities.
 */

import { RewardBreakdown } from './activityRewards';

export interface NarrationRewards {
  participant: RewardBreakdown;
  destacado: RewardBreakdown; // additive to participant
}

/**
 * Prefix for each activity type in the historical narrations catalog.
 * Used to filter autocomplete options by tipo.
 */
export const NARRATION_PREFIX_BY_TYPE = {
  'Crónica': 'Cronica vieja:',
  'Evento': 'Evento viejo:',
  'Balance General': 'Balance General:'
} as const;

/**
 * Historical catalog of Cronicas, Eventos and Balance General with their actual rewards.
 * Keys are normalized (lowercase, trimmed).
 * Current catalog size: 11 entries (add new entries only with validated reward data).
 */
export const HISTORICAL_NARRATIONS: Record<string, NarrationRewards> = {
  // El sueño del sabio - Capitulo I
  'Cronica vieja: El sueño del sabio I - Recuento': {
    participant: { exp: 25, pr: 50, ryou: 0 },
    destacado: { exp: 0, pr: 0, ryou: 0 } // participant only
  },
  'Evento viejo: El sueño del sabio I - Clase de Indra': {
    participant: { exp: 10, pr: 20, ryou: 0 },
    destacado: { exp: 5, pr: 5, ryou: 0 }
  },
  'Evento viejo: El sueño del sabio I - Expedición de Asura': {
    participant: { exp: 10, pr: 20, ryou: 0 },
    destacado: { exp: 5, pr: 5, ryou: 0 }
  },

  // El sueño del sabio - Capitulo II
  'Cronica vieja: El sueño del sabio II - Primer juego': {
    participant: { exp: 30, pr: 50, ryou: 0 },
    destacado: { exp: 10, pr: 25, ryou: 0 }
  },
  'Evento viejo: El sueño del sabio II - Segundo juego': {
    participant: { exp: 10, pr: 20, ryou: 0 },
    destacado: { exp: 15, pr: 50, ryou: 0 }
  },

  // El sueño del sabio - Capitulo I (Tercer juego - note: listed as I but chronologically later)
  'Evento viejo: El sueño del sabio I - Tercer juego': {
    participant: { exp: 10, pr: 20, ryou: 0 },
    destacado: { exp: 5, pr: 5, ryou: 0 }
  },

  // El sueño del sabio - Capitulo III
  'Cronica vieja: El sueño del sabio III': {
    participant: { exp: 30, pr: 50, ryou: 0 },
    destacado: { exp: 15, pr: 25, ryou: 0 }
  },

  // El sueño del sabio - Capitulo IV
  'Cronica vieja: El sueño del sabio IV': {
    participant: { exp: 30, pr: 50, ryou: 0 },
    destacado: { exp: 15, pr: 25, ryou: 0 }
  },

  // Special balance rewards
  'Balance General: Todos los personajes con ficha': {
    participant: { exp: 50, pr: 100, ryou: 0 },
    destacado: { exp: 0, pr: 0, ryou: 0 } // participant only
  },

  // Saga milestones
  'Balance General: Recompensa por 4 participaciones': {
    participant: { exp: 50, pr: 100, ryou: 0 },
    destacado: { exp: 0, pr: 0, ryou: 0 } // participant only
  },
  'Balance General: Recompensa por 3 participaciones': {
    participant: { exp: 30, pr: 50, ryou: 0 },
    destacado: { exp: 0, pr: 0, ryou: 0 } // participant only
  }
};

/**
 * Lookup a narration in the historical catalog.
 * Returns the rewards if found, undefined otherwise.
 * Uses direct key match (autocomplete sends exact keys from catalog).
 */
export function getHistoricalNarrationRewards(
  narrationName: string | null | undefined
): NarrationRewards | undefined {
  if (!narrationName) return undefined;
  return HISTORICAL_NARRATIONS[narrationName];
}
