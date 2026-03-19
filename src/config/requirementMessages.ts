/**
 * Requirement messages for LevelUpService promotion validation.
 * Used in checkRankRequirements and checkLevelRequirements.
 */

/** Generic: EXP insufficient. */
export const ERROR_EXP_INSUFFICIENT = (current: number, required: number) =>
  `- EXP insuficiente (${current}/${required}).`;

/** Generic: PR insufficient. */
export const ERROR_PR_INSUFFICIENT = (current: number, required: number) =>
  `- PR insuficiente (${current}/${required}).`;

/** buildFailure: when only manual requirements remain. */
export const REASON_MANUAL_REQUIREMENTS = 'Cumple validaciones automáticas, pero faltan requisitos manuales.';

// --- Rank-specific (checkRankRequirements) ---

export const REQ_MISSION_B_1 = '- Falta al menos 1 misión Rango B (fallida o exitosa).';
export const REQ_MISSION_A_SUCCESS_1 = '- Falta cumplir exitosamente al menos 1 misión Rango A.';
export const REQ_MISSION_A_S_SUCCESS_2 = (current: number) =>
  `- Falta cumplir exitosamente al menos 2 misión Rango A/S (${current}/2).`;
export const REQ_JOUNIN_CONSENT = 'Requiere consentimiento de otro Jounin (o duelo de mérito válido).';
export const REQ_LEVEL_A_OR_HIGHER = (level: string) =>
  `- Se requiere potencial Rango A o superior (actual: ${level}).`;
export const REQ_RANK_ANBU = (rank: string) => `- Se requiere ser ANBU actualmente (actual: ${rank}).`;
export const REQ_MISSION_S_SUCCESS_1 = '- Falta cumplir exitosamente al menos 1 misión Rango S.';
export const REQ_RANK_JOUNIN = (rank: string) => `- Se requiere ser Jounin actualmente (actual: ${rank}).`;
export const REQ_S_TRACEABLE =
  '- Falta al menos 1 requisito trazable de Rango S (misión S o combate ganado vs A/S).';
export const REQ_TWO_JUMPS_VALIDATION = '- Requiere validación de "dos saltos temporales" por Staff.';
export const REQ_LEVEL_S = (level: string) => `- Se requiere potencial Rango S (actual: ${level}).`;
export const REQ_KAGE_CONSENTS =
  '- Requiere consentimientos: Jounin Hanchou/Jounin, Buntaichoo/ANBU, Go-Ikenban (mayoría) y líder de clan.';
export const REQ_LEVEL_B_OR_HIGHER = (level: string) =>
  `- Se requiere potencial mínimo Rango B (actual: ${level}).`;
export const REQ_CLAN_CONSENT = '- Requiere consentimiento de todos los miembros del clan en rangos B/A/S.';
export const REQ_CLAN_VALIDATE_3 = '- Si es potencial B, validar externamente "3 requisitos cumplidos".';

// --- Level-specific: manual review ---

export const REQ_NO_GRADATION_HISTORY = 'No hay historial de gradación. Requiere revisión manual.';
export const REQ_NO_GRADATION_HISTORY_DAYS =
  'No hay historial de gradación para verificar días. Requiere revisión manual.';

// --- Level-specific: time gates ---

export const REQ_DAYS_D_FOR_C1 = (days: number) =>
  `Faltan días como Rango D para C1 (requiere 5, actualmente ${days}).`;
export const REQ_DAYS_PREV_GRADATION = (level: string, required: number, days: number) =>
  `Faltan días en la gradación previa para ${level} (requiere ${required}, actualmente ${days}).`;
export const REQ_DAYS_C_FOR_B1 = (days: number) =>
  `Faltan días como Rango C para B1 (requiere 8, actualmente ${days}).`;
export const REQ_DAYS_B_FOR_A1 = (days: number) =>
  `Faltan días como Rango B para A1 (requiere 14, actualmente ${days}).`;
export const REQ_DAYS_A_FOR_S1 = (days: number) =>
  `Faltan días como Rango A para S1 (requiere 20, actualmente ${days}).`;
export const REQ_DAYS_S_FOR_S2 = (days: number) =>
  `Faltan días como Rango S para S2 (requiere 10, actualmente ${days}).`;

// --- Level-specific: PR ---

export const REQ_PR_B1 = (current: number) => `PR insuficiente para B1 (${current}/500).`;
export const REQ_PR_A1 = (current: number) => `PR insuficiente para A1 (${current}/1000).`;
export const REQ_PR_S1 = (current: number) => `PR insuficiente para S1 (${current}/3500).`;

// --- Level-specific: S1 ---

export const REQ_COMBAT_WINS_A_S_S1 = (current: number) =>
  `Faltan victorias vs A/S para S1 (${current}/7).`;
export const REQ_S1_MISSIONS =
  'Para S1 se requiere 5 misiones A exitosas o participar en 3 misiones S.';
export const REQ_NARRATIONS_S1 = (current: number) =>
  `Narraciones insuficientes para S1 (${current}/10).`;
export const REQ_HIGHLIGHTS_S1 = (current: number) =>
  `Destacados insuficientes para S1 (${current}/5).`;

// --- Level-specific: A2/A3 manual ---

export const REQ_MANUAL_PR_300_GRADACION =
  'Manual parcial: "obtener 300 PR durante la gradación anterior" no es trazable sin ledger temporal.';

// --- Optional requirement group messages ---

export const REQ_OPTIONAL_C1 =
  'Falta al menos 2 requisitos adicionales para C1 (narración, combate, 2 misiones D o 2 logros).';
export const REQ_OPTIONAL_C2C3 =
  'Falta al menos 2 requisitos adicionales para C2/C3 (narración, destacado, logro, combate, misión C o curar a 2 personajes).';
export const REQ_OPTIONAL_B1 =
  'Falta al menos 3 requisitos adicionales para B1 (narraciones, destacados, misiones equivalentes C, combates vs C+ o curar a 5 personajes).';
export const REQ_OPTIONAL_B2B3 =
  'Falta al menos 2 requisitos adicionales para B2/B3 (narración, destacado, logro, 2 combates B+, misión B/A o curar a 2 personajes).';
export const REQ_OPTIONAL_A1 =
  'Falta al menos 3 requisitos adicionales para A1 (narraciones, destacados, misiones B/A, victorias vs B+, logros o curar a 10 personajes).';
export const REQ_OPTIONAL_A2A3 =
  'Falta al menos 2 requisitos adicionales para A2/A3 (narración, destacado, 2 logros, combate A+, misiones B/A o curar a 2 personajes).';
export const REQ_OPTIONAL_S2 =
  'Falta al menos 2 requisitos adicionales para S2 (2 narraciones, 1 destacado, 1 misión S, 500 PR o curar a 5 personajes).';
