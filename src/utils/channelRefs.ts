export function extractChannelId(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const mentionMatch = trimmed.match(/^<#(\d+)>$/);
  if (mentionMatch?.[1]) {
    return mentionMatch[1];
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function formatChannelReference(value: string | undefined, fallback: string): string {
  const channelId = extractChannelId(value);
  if (channelId) {
    return `<#${channelId}>`;
  }

  const trimmed = value?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  return fallback;
}
