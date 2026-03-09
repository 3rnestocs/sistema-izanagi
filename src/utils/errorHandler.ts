import { ChatInputCommandInteraction } from 'discord.js';

export type ErrorType = 'validation' | 'database' | 'authorization' | 'not_found' | 'conflict' | 'system';

export interface ErrorContext {
  commandName: string;
  userId: string;
  guildId: string;
  timestamp: Date;
}

export class CommandError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

/**
 * Classify an error and determine its type.
 */
function classifyError(error: unknown): ErrorType {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('VALIDACIÓN') || errorMessage.includes('Validación')) {
    return 'validation';
  }
  if (errorMessage.includes('permiso') || errorMessage.includes('Permiso') || errorMessage.includes('Admin')) {
    return 'authorization';
  }
  if (errorMessage.includes('no encontr') || errorMessage.includes('No existe') || errorMessage.includes('no existe')) {
    return 'not_found';
  }
  if (errorMessage.includes('existe') || errorMessage.includes('Existe') || errorMessage.includes('duplicad')) {
    return 'conflict';
  }
  if (errorMessage.includes('DATABASE') || errorMessage.includes('Prisma') || errorMessage.includes('DB')) {
    return 'database';
  }

  return 'system';
}

/**
 * Format error message for Discord embed.
 */
function formatErrorMessage(error: unknown, type: ErrorType): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Remove emoji prefixes if present
  const cleanMessage = errorMessage.replace(/^[⛔❌🚫]+\s*/, '');

  switch (type) {
    case 'validation':
      return `**Validation Error:** ${cleanMessage}`;
    case 'authorization':
      return `**Permission Denied:** ${cleanMessage}\n\nYou don't have permission to use this command.`;
    case 'not_found':
      return `**Not Found:** ${cleanMessage}`;
    case 'conflict':
      return `**Conflict:** ${cleanMessage}`;
    case 'database':
      return `**Database Error:** Something went wrong with the database. Please try again later.`;
    case 'system':
      return `**Error:** ${cleanMessage}`;
    default:
      return `**Unexpected Error:** ${cleanMessage}`;
  }
}

/**
 * Handle command execution errors with logging and Discord feedback.
 */
export async function handleCommandError(
  error: unknown,
  interaction: ChatInputCommandInteraction,
  commandName: string
): Promise<void> {
  const type = classifyError(error);
  const message = formatErrorMessage(error, type);
  const timestamp = new Date().toISOString();

  // Log error with context
  const context = {
    commandName,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    timestamp,
    errorType: type,
    error: error instanceof Error ? error.stack : String(error)
  };

  console.error(
    `[${timestamp}] Command Error in ${commandName}:`,
    error instanceof Error ? error.stack : error
  );

  // Send user feedback
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: message,
        ephemeral: true
      });
    } else if (interaction.deferred) {
      await interaction.editReply({
        content: message
      });
    }
  } catch (replyError) {
    console.error('Failed to send error reply:', replyError);
  }
}

/**
 * Wrapper to execute a command with automatic error handling.
 */
export async function executeWithErrorHandler(
  interaction: ChatInputCommandInteraction,
  executor: (interaction: ChatInputCommandInteraction) => Promise<void>,
  commandName: string
): Promise<void> {
  try {
    // Defer reply if not already deferred
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await executor(interaction);
  } catch (error) {
    await handleCommandError(error, interaction, commandName);
  }
}
