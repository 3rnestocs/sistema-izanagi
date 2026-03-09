import { Prisma } from '@prisma/client';
import { ChatInputCommandInteraction } from 'discord.js';

export enum CommandErrorType {
  Validation = 'validation',
  Authorization = 'authorization',
  NotFound = 'not_found',
  Conflict = 'conflict',
  Cooldown = 'cooldown',
  BusinessRule = 'business_rule',
  Database = 'database',
  External = 'external',
  System = 'system'
}

export enum CommandErrorSeverity {
  Regular = 'regular',
  Detailed = 'detailed',
  Critical = 'critical'
}

interface AppCommandErrorInput {
  type: CommandErrorType;
  userMessage: string;
  severity?: CommandErrorSeverity;
  details?: string[];
  hints?: string[];
  internalCode?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export class AppCommandError extends Error {
  public readonly type: CommandErrorType;
  public readonly severity: CommandErrorSeverity;
  public readonly userMessage: string;
  public readonly details: string[];
  public readonly hints: string[];
  public readonly internalCode: string;
  public readonly context: Record<string, unknown> | undefined;
  public override readonly cause?: unknown;

  constructor(input: AppCommandErrorInput) {
    super(input.userMessage);
    this.name = 'AppCommandError';
    this.type = input.type;
    this.severity = input.severity ?? CommandErrorSeverity.Regular;
    this.userMessage = sanitizeUserMessage(input.userMessage);
    this.details = input.details ?? [];
    this.hints = input.hints ?? [];
    this.internalCode = input.internalCode ?? 'SYS_UNSPECIFIED';
    this.context = input.context;
    this.cause = input.cause;
  }
}

interface HandleCommandErrorOptions {
  commandName: string;
  fallbackMessage?: string;
  ephemeral?: boolean;
  customFormatter?: (error: AppCommandError) => string;
}

function sanitizeUserMessage(message: string): string {
  return message.replace(/^[⛔❌🚫\s]+/, '').trim();
}

function inferTypeFromMessage(message: string): CommandErrorType {
  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('enfriamiento') || normalized.includes('intenta nuevamente en')) {
    return CommandErrorType.Cooldown;
  }
  if (normalized.includes('permiso') || normalized.includes('staff') || normalized.includes('administrador')) {
    return CommandErrorType.Authorization;
  }
  if (normalized.includes('no encontrado') || normalized.includes('no existe') || normalized.includes('no se encontro')) {
    return CommandErrorType.NotFound;
  }
  if (normalized.includes('ya existe') || normalized.includes('duplic') || normalized.includes('conflicto')) {
    return CommandErrorType.Conflict;
  }
  if (normalized.includes('regla') || normalized.includes('invalido') || normalized.includes('insuficiente')) {
    return CommandErrorType.BusinessRule;
  }
  if (normalized.includes('prisma') || normalized.includes('database') || normalized.includes('db')) {
    return CommandErrorType.Database;
  }

  return CommandErrorType.Validation;
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): AppCommandError {
  switch (error.code) {
    case 'P2002':
      return new AppCommandError({
        type: CommandErrorType.Conflict,
        userMessage: 'Ya existe un registro con esos datos únicos.',
        internalCode: 'DB_P2002_DUPLICATE',
        cause: error
      });
    case 'P2025':
      return new AppCommandError({
        type: CommandErrorType.NotFound,
        userMessage: 'No se encontró el registro solicitado.',
        internalCode: 'DB_P2025_NOT_FOUND',
        cause: error
      });
    default:
      return new AppCommandError({
        type: CommandErrorType.Database,
        userMessage: 'Ocurrió un error al procesar la base de datos. Intenta nuevamente.',
        internalCode: `DB_${error.code}`,
        cause: error
      });
  }
}

function coerceUnknownToAppError(error: unknown, fallbackMessage: string): AppCommandError {
  if (error instanceof AppCommandError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(error);
  }

  if (error instanceof Error) {
    return new AppCommandError({
      type: inferTypeFromMessage(error.message),
      userMessage: error.message || fallbackMessage,
      internalCode: 'LEGACY_ERROR_MESSAGE',
      cause: error
    });
  }

  return new AppCommandError({
    type: CommandErrorType.System,
    userMessage: fallbackMessage,
    severity: CommandErrorSeverity.Critical,
    internalCode: 'UNKNOWN_NON_ERROR_THROW',
    cause: error
  });
}

export function formatCommandError(error: AppCommandError): string {
  const lines: string[] = [`❌ ${error.userMessage}`];

  if (error.severity === CommandErrorSeverity.Detailed && error.details.length > 0) {
    lines.push('', ...error.details);
  }

  if (error.hints.length > 0) {
    lines.push('', ...error.hints.map((hint) => `> ${hint}`));
  }

  return lines.join('\n');
}

async function sendErrorResponse(
  interaction: ChatInputCommandInteraction,
  message: string,
  ephemeral: boolean
): Promise<void> {
  if (interaction.deferred) {
    await interaction.editReply({ content: message });
    return;
  }

  if (interaction.replied) {
    await interaction.followUp({ content: message, ephemeral });
    return;
  }

  await interaction.reply({ content: message, ephemeral });
}

export async function handleCommandError(
  error: unknown,
  interaction: ChatInputCommandInteraction,
  options: HandleCommandErrorOptions
): Promise<void> {
  const appError = coerceUnknownToAppError(error, options.fallbackMessage ?? 'Error del sistema. Intenta nuevamente.');
  const finalMessage = options.customFormatter ? options.customFormatter(appError) : formatCommandError(appError);

  console.error(
    `[${new Date().toISOString()}] CommandError`,
    {
      commandName: options.commandName,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      type: appError.type,
      severity: appError.severity,
      internalCode: appError.internalCode,
      context: appError.context,
      cause: appError.cause instanceof Error ? appError.cause.stack : appError.cause
    }
  );

  try {
    await sendErrorResponse(interaction, finalMessage, options.ephemeral ?? true);
  } catch (replyError) {
    console.error('Failed to send error response:', replyError);
  }
}

export function validationError(message: string, details?: string[], hints?: string[]): AppCommandError {
  return new AppCommandError({
    type: CommandErrorType.Validation,
    userMessage: message,
    severity: details && details.length > 0 ? CommandErrorSeverity.Detailed : CommandErrorSeverity.Regular,
    ...(details ? { details } : {}),
    ...(hints ? { hints } : {}),
    internalCode: 'VAL_GENERIC'
  });
}

export function businessRuleError(message: string, details?: string[], hints?: string[]): AppCommandError {
  return new AppCommandError({
    type: CommandErrorType.BusinessRule,
    userMessage: message,
    severity: details && details.length > 0 ? CommandErrorSeverity.Detailed : CommandErrorSeverity.Regular,
    ...(details ? { details } : {}),
    ...(hints ? { hints } : {}),
    internalCode: 'BIZ_RULE'
  });
}

export function authorizationError(message: string): AppCommandError {
  return new AppCommandError({
    type: CommandErrorType.Authorization,
    userMessage: message,
    internalCode: 'AUTH_FORBIDDEN'
  });
}

export function conflictError(message: string): AppCommandError {
  return new AppCommandError({
    type: CommandErrorType.Conflict,
    userMessage: message,
    internalCode: 'CONFLICT_GENERIC'
  });
}

export function cooldownError(message: string, seconds?: number): AppCommandError {
  const detail = seconds ? [`Intenta de nuevo en ${seconds}s.`] : undefined;
  return new AppCommandError({
    type: CommandErrorType.Cooldown,
    userMessage: message,
    ...(detail ? { details: detail } : {}),
    internalCode: 'COOLDOWN_ACTIVE'
  });
}

export async function executeWithErrorHandling(
  interaction: ChatInputCommandInteraction,
  commandName: string,
  executor: (interaction: ChatInputCommandInteraction) => Promise<void>,
  options?: {
    defer?: { ephemeral: boolean } | false;
    fallbackMessage?: string;
    errorEphemeral?: boolean;
    customFormatter?: (error: AppCommandError) => string;
  }
): Promise<void> {
  try {
    if (options?.defer !== false && !interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: options?.defer?.ephemeral ?? true });
    }

    await executor(interaction);
  } catch (error) {
    await handleCommandError(error, interaction, {
      commandName,
      ...(options?.fallbackMessage ? { fallbackMessage: options.fallbackMessage } : {}),
      ...(typeof options?.errorEphemeral === 'boolean' ? { ephemeral: options.errorEphemeral } : {}),
      ...(options?.customFormatter ? { customFormatter: options.customFormatter } : {})
    });
  }
}
