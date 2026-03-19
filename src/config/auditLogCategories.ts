/**
 * Centralized AuditLog category strings.
 * Use these when reading or writing audit log entries to avoid typos.
 */

export const AUDIT_LOG_CATEGORY = {
  /** Promotion (level or rank). Used by LevelUpService, PromotionService. */
  ASCENSO: 'Ascenso',

  /** Activity registration/approval. Substrings: "Actividad", "Aprobación de Actividad", etc. */
  ACTIVIDAD: 'Actividad',

  /** Trait assignment/removal. Substrings: "Rasgo", "Rasgo Asignado", "Rasgo Removido". */
  RASGO: 'Rasgo',

  /** Stats distribution. */
  STATS: 'Stats',

  /** Resource adjustment. */
  RECURSOS: 'Recursos',

  /** Salary. Substrings: "Sueldo", "Sueldo Semanal". */
  SUELDO: 'Sueldo',

  /** Ability/plaza management. Substrings: "Habilidad", "Gestor Habilidades". */
  HABILIDAD: 'Habilidad',

  /** Ability/plaza manager. */
  GESTOR: 'Gestor',

  /** Character creation. */
  CREACION_FICHA: 'Creación de Ficha'
} as const;
