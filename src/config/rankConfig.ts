/**
 * Rank display names and Sannin discount targets.
 * Shared by LevelUpService and PromotionService.
 */

/** Maps internal rank IDs (uppercase, underscore) to display names for DB/UI. */
export const RANK_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  CHUUNIN: 'Chuunin',
  TOKUBETSU_JOUNIN: 'Tokubetsu Jounin',
  JOUNIN: 'Jounin',
  ANBU: 'ANBU',
  BUNTAICHOO: 'Buntaichoo',
  JOUNIN_HANCHOU: 'Jounin Hanchou',
  GO_IKENBAN: 'Go-Ikenban',
  LIDER_DE_CLAN: 'Lider de Clan',
  KAGE: 'Kage'
};

/** Rank IDs that receive 50% EXP/PR discount when character has Sannin title. */
export const SANNIN_DISCOUNT_TARGETS = new Set<string>([
  'JOUNIN',
  'JOUNIN_HANCHOU',
  'GO_IKENBAN',
  'LIDER_DE_CLAN'
]);
