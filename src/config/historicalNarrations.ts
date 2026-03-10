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
 * Normalize a narration name for catalog lookup.
 * Removes extra whitespace, converts to lowercase, etc.
 */
export function normalizeNarrationKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // collapse multiple spaces to single space
}

/**
 * Historical catalog of Cronicas and Eventos with their actual rewards.
 * Keys are normalized (lowercase, trimmed).
 * Current catalog size: 11 entries (add new entries only with validated reward data).
 */
export const HISTORICAL_NARRATIONS: Record<string, NarrationRewards> = {
  // El sueño del sabio - Capitulo I
  'el sueño del sabio - capitulo i. clase de indra': {
    participant: { exp: 10, pr: 20, ryou: 0 },
    destacado: { exp: 5, pr: 5, ryou: 0 }
  },
  'el sueño del sabio - capitulo i. expedición de asura': {
    participant: { exp: 10, pr: 20, ryou: 0 },
    destacado: { exp: 5, pr: 5, ryou: 0 }
  },
  'el sueño del sabio - capitulo i. recuento': {
    participant: { exp: 25, pr: 50, ryou: 0 },
    destacado: { exp: 0, pr: 0, ryou: 0 } // participant only
  },

  // El sueño del sabio - Capitulo II
  'el sueño del sabio ii - primer juego': {
    participant: { exp: 30, pr: 50, ryou: 0 },
    destacado: { exp: 10, pr: 25, ryou: 0 }
  },
  'el sueño del sabio ii - segundo juego': {
    participant: { exp: 10, pr: 20, ryou: 0 },
    destacado: { exp: 15, pr: 50, ryou: 0 }
  },

  // El sueño del sabio - Capitulo I (Tercer juego - note: listed as I but chronologically later)
  'el sueño del sabio i - tercer juego': {
    participant: { exp: 10, pr: 20, ryou: 0 },
    destacado: { exp: 5, pr: 5, ryou: 0 }
  },

  // El sueño del sabio - Capitulo III
  'el sueño del sabio iii': {
    participant: { exp: 30, pr: 50, ryou: 0 },
    destacado: { exp: 15, pr: 25, ryou: 0 }
  },

  // El sueño del sabio - Capitulo IV
  'el sueño del sabio iv': {
    participant: { exp: 30, pr: 50, ryou: 0 },
    destacado: { exp: 15, pr: 25, ryou: 0 }
  },

  // Special balance rewards
  'el sueño del sabio iv balance general': {
    participant: { exp: 50, pr: 100, ryou: 0 },
    destacado: { exp: 0, pr: 0, ryou: 0 } // participant only
  },

  // Saga milestones
  'participar en 4 capítulos de saga general': {
    participant: { exp: 50, pr: 100, ryou: 0 },
    destacado: { exp: 0, pr: 0, ryou: 0 } // participant only
  },
  'participar en 3 capítulos de saga general': {
    participant: { exp: 30, pr: 50, ryou: 0 },
    destacado: { exp: 0, pr: 0, ryou: 0 } // participant only
  }
};

/**
 * Lookup a narration in the historical catalog.
 * Returns the rewards if found, undefined otherwise.
 */
export function getHistoricalNarrationRewards(
  narrationName: string | null | undefined
): NarrationRewards | undefined {
  if (!narrationName) return undefined;
  const key = normalizeNarrationKey(narrationName);
  return HISTORICAL_NARRATIONS[key];
}
