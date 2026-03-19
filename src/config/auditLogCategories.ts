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

  /** Trait assigned. */
  RASGO_ASIGNADO: 'Rasgo Asignado',

  /** Trait removed. */
  RASGO_REMOVIDO: 'Rasgo Removido',

  /** Stats distribution. */
  STATS: 'Stats',

  /** Resource adjustment (staff). */
  RECURSOS: 'Recursos',

  /** Staff resource adjustment. */
  AJUSTE_RECURSOS: 'Ajuste Staff de Recursos',

  /** Salary. Substrings: "Sueldo", "Sueldo Semanal". */
  SUELDO: 'Sueldo',

  /** Weekly salary. */
  SUELDO_SEMANAL: 'Sueldo Semanal',

  /** Ability/plaza management. Substrings: "Habilidad", "Gestor Habilidades". */
  HABILIDAD: 'Habilidad',

  /** Ability/plaza manager. */
  GESTOR: 'Gestor',

  /** Character creation. */
  CREACION_FICHA: 'Creación de Ficha',

  /** Market purchase. */
  COMPRA_MERCADO: 'Compra (Mercado)',

  /** Market sale. */
  VENTA_MERCADO: 'Venta (Mercado)',

  /** Item/Ryou transfer. */
  INTERCAMBIO: 'Intercambio',

  /** Activity approval. */
  APROBACION_ACTIVIDAD: 'Aprobación de Actividad',

  /** NPC create/retire. */
  NPC_LIFECYCLE: 'NPC Lifecycle'
} as const;
