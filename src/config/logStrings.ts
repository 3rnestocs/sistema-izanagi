/**
 * Console/log strings for index.ts and runtime output.
 * Dev-facing; low priority for i18n.
 */

export const LOG = {
  APPROVAL_PROCESSED: (messageId: string) =>
    `✅ Aprobación procesada desde reacción en mensaje ${messageId}`,
  ERROR_REACTION_APPROVAL: '❌ Error procesando aprobación por reacción:',
  ERROR_REACTION_REMOVE: '❌ Error procesando remoción de aprobación por reacción:',
  ERROR_DELETE_NON_OWNER: '❌ Error eliminando mensaje de no-dueño en thread:',
  BOT_READY: (tag: string) => `✅ Sistema IZANAGI en línea. Bot: ${tag}`,
  COMMANDS_LOADED: (count: number) => `📦 Loaded ${count} commands`,
  ERROR_AUTOCOMPLETE: (commandName: string) => `❌ Error handling autocomplete for ${commandName}:`,
  WARN_NO_COMMAND: (commandName: string) => `⚠️  No command found for: ${commandName}`,
  ERROR_EXECUTE_COMMAND: (commandName: string) => `❌ Error executing command ${commandName}:`,
  SHUTDOWN_START: (signal: string) => `\n🛑 ${signal} received. Shutting down gracefully...`,
  SHUTDOWN_TIMEOUT: '❌ Graceful shutdown timeout. Force exiting...',
  DISCONNECTING_DISCORD: '📡 Disconnecting from Discord...',
  DISCORD_DISCONNECTED: '✅ Discord bot disconnected',
  DISCONNECTING_DB: '💾 Disconnecting from database...',
  DB_DISCONNECTED: '✅ Database disconnected',
  SHUTDOWN_COMPLETE: '✅ Graceful shutdown completed',
  ERROR_SHUTDOWN: '❌ Error during graceful shutdown:',
  FAILED_SEND_ERROR: 'Failed to send error response:'
} as const;
