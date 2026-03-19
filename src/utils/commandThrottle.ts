import { ERROR_COOLDOWN } from '../config/uiStrings';

const cooldownStore = new Map<string, number>();

const DEFAULT_COOLDOWNS_SECONDS = {
  registrar_suceso: 45,
  comprar: 8,
  vender: 8,
  transferir: 15,
  cobrar_sueldo: 45
} as const;

export type ThrottledCommandName = keyof typeof DEFAULT_COOLDOWNS_SECONDS;

interface CooldownParams {
  commandName: ThrottledCommandName;
  actorId: string;
  scopeKey?: string;
  customWindowSeconds?: number;
}

function nowMs(): number {
  return Date.now();
}

function buildStoreKey(commandName: string, actorId: string, scopeKey?: string): string {
  return scopeKey ? `${commandName}:${actorId}:${scopeKey}` : `${commandName}:${actorId}`;
}

function getWindowSeconds(commandName: ThrottledCommandName, customWindowSeconds?: number): number {
  if (customWindowSeconds && customWindowSeconds > 0) {
    return customWindowSeconds;
  }

  return DEFAULT_COOLDOWNS_SECONDS[commandName];
}

export function consumeCommandCooldown(params: CooldownParams): void {
  const key = buildStoreKey(params.commandName, params.actorId, params.scopeKey);
  const currentTime = nowMs();
  const expiresAt = cooldownStore.get(key);

  if (expiresAt && expiresAt > currentTime) {
    const retrySeconds = Math.ceil((expiresAt - currentTime) / 1000);
    throw new Error(ERROR_COOLDOWN(retrySeconds));
  }

  const windowSeconds = getWindowSeconds(params.commandName, params.customWindowSeconds);
  cooldownStore.set(key, currentTime + windowSeconds * 1000);
}

// Best-effort cleanup to avoid unbounded growth in long-running sessions.
export function cleanupExpiredCooldowns(): void {
  const currentTime = nowMs();
  for (const [key, expiresAt] of cooldownStore.entries()) {
    if (expiresAt <= currentTime) {
      cooldownStore.delete(key);
    }
  }
}
