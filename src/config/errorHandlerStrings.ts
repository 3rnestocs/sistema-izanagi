/**
 * Strings for errorHandler.ts (AppCommandError, Prisma mapping, etc.)
 */

export const ERROR_HANDLER = {
  DEFAULT_RECOVERY_TIP:
    '↩️ Tip: Presiona Ctrl+Z en la caja de chat para recuperar tu mensaje. También puedes seleccionar el comando resaltado encima de la respuesta del bot y copiar el texto desde ahí.',
  PANEL_TITLE: '## :x: Operacion cancelada',
  MAIN_PREFIX: ':no_entry:',
  PRISMA_P2002: 'Ya existe un registro con esos datos únicos.',
  PRISMA_P2025: 'No se encontró el registro solicitado.',
  PRISMA_GENERIC: 'Ocurrió un error al procesar la base de datos. Intenta nuevamente.',
  SYSTEM_FALLBACK: 'Error del sistema. Intenta nuevamente.',
  COOLDOWN_DETAIL: (seconds: number) => `Intenta de nuevo en ${seconds}s.`,
  FAILED_SEND_ERROR: 'Failed to send error response:'
} as const;
