/**
 * Centralized AuditLog evidence strings.
 * Use these when creating audit log entries.
 */

export const EVIDENCE = {
  SISTEMA_AUTOMATIZADO: 'Sistema Automatizado',
  SISTEMA_TRANSACCIONES: 'Sistema de Transacciones',
  COMANDO_ASCENDER: 'Comando /ascender',
  COMANDO_FORZAR_ASCENSO: 'Comando /forzar_ascenso',
  COMANDO_REGISTRO: 'Comando /registro',
  COMANDO_OTORGAR_RASGO: 'Comando /otorgar_rasgo',
  COMANDO_RETIRAR_HABILIDAD: 'Comando /retirar_habilidad',
  COMANDO_NPC_CREAR: 'Comando /npc crear',
  COMANDO_NPC_RETIRAR: 'Comando /npc retirar'
} as const;
