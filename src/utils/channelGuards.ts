import { ChannelType, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import {
  ERROR_FORUM_CHANNEL_REQUIRED,
  ERROR_FORUM_NOT_ENABLED,
  ERROR_FORUM_OWN_POST_REQUIRED,
  ERROR_FORUM_ROLE_REQUIRED,
  ERROR_FORUM_THREAD_REQUIRED,
  ERROR_GUILD_ONLY
} from '../config/uiStrings';

interface ForumGuardOptions {
  allowStaffBypass?: boolean;
  enforceThreadOwnership?: boolean;
  invalidForumMessage?: string;
  invalidThreadOwnershipMessage?: string;
}

function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];

  const normalized = raw.trim().replace(/^['\"]|['\"]$/g, '');

  return normalized
    .split(',')
    .map((id) => id.trim().replace(/^['\"]|['\"]$/g, ''))
    .filter((id) => id.length > 0);
}

function getAllowedForumChannelIds(): string[] {
  return parseIdList(process.env.PLAYER_FORUM_CHANNEL_IDS);
}

function getAllowedRoleIds(): string[] {
  return parseIdList(process.env.PLAYER_ALLOWED_ROLE_IDS);
}

export function getCommandForumMap(): Map<string, string[]> {
  const raw = process.env.PLAYER_COMMAND_FORUM_MAP;
  if (!raw) return new Map<string, string[]>();

  const map = new Map<string, string[]>();
  const normalized = raw.trim().replace(/^['\"]|['\"]$/g, '');

  for (const entry of normalized.split(';')) {
    const [commandRaw, forumIdsRaw] = entry.split(':');
    const command = commandRaw?.trim();
    const forumIds = forumIdsRaw
      ?.split('|')
      .map((id) => id.trim().replace(/^['\"]|['\"]$/g, ''))
      .filter((id) => id.length > 0);

    if (command && forumIds && forumIds.length > 0) {
      map.set(command, forumIds);
    }
  }

  return map;
}

const REGISTRAR_SUCESO_COMMAND = 'registrar_suceso';

export function getRegistrarSucesoForumIds(): string[] {
  return getCommandForumMap().get(REGISTRAR_SUCESO_COMMAND) ?? [];
}

/**
 * Returns forum channel IDs where the bot restricts thread writes (only owner + staff).
 * Excludes BUILD_APPROVAL_FORUM_ID: that is a text channel (not a forum) where all users
 * upload builds; the bot never restricts or overwrites permissions there.
 */
export function getAllBotForumIds(): string[] {
  const ids = new Set<string>();
  const add = (id: string | undefined) => id && ids.add(id.trim());
  add(process.env.GESTION_FORUM_ID);
  add(process.env.REGISTRO_SUCESOS_FORUM_ID);
  add(process.env.TIENDA_FORUM_ID);
  getAllowedForumChannelIds().forEach((id) => ids.add(id));
  for (const forumIds of getCommandForumMap().values()) {
    forumIds.forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

function getMemberRoleIds(interaction: ChatInputCommandInteraction): string[] {
  const member = interaction.member;
  if (!member || !("roles" in member)) return [];

  const rolesField = member.roles;
  if (Array.isArray(rolesField)) {
    return rolesField;
  }

  if ('cache' in rolesField) {
    return Array.from(rolesField.cache.keys());
  }

  return [];
}

export function assertForumPostContext(
  interaction: ChatInputCommandInteraction,
  options: ForumGuardOptions = {}
): void {
  const {
    allowStaffBypass = false,
    enforceThreadOwnership = false,
    invalidForumMessage,
    invalidThreadOwnershipMessage
  } = options;

  if (allowStaffBypass && interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return;
  }

  if (!interaction.inGuild()) {
    throw new Error(ERROR_GUILD_ONLY);
  }

  const channel = interaction.channel;
  if (!channel || !channel.isThread()) {
    throw new Error(ERROR_FORUM_THREAD_REQUIRED);
  }

  const parent = channel.parent;
  if (!parent || parent.type !== ChannelType.GuildForum) {
    throw new Error(ERROR_FORUM_CHANNEL_REQUIRED);
  }

  const allowedRoleIds = getAllowedRoleIds();
  if (allowedRoleIds.length > 0) {
    const memberRoleIds = getMemberRoleIds(interaction);
    const hasAllowedRole = memberRoleIds.some((roleId) => allowedRoleIds.includes(roleId));
    if (!hasAllowedRole) {
      throw new Error(ERROR_FORUM_ROLE_REQUIRED);
    }
  }

  const commandForumMap = getCommandForumMap();
  const allowedForumIds = commandForumMap.get(interaction.commandName) ?? getAllowedForumChannelIds();
  if (allowedForumIds.length > 0 && !allowedForumIds.includes(parent.id)) {
    throw new Error(invalidForumMessage ?? ERROR_FORUM_NOT_ENABLED);
  }

  if (enforceThreadOwnership) {
    if (channel.ownerId && channel.ownerId !== interaction.user.id) {
      throw new Error(invalidThreadOwnershipMessage ?? ERROR_FORUM_OWN_POST_REQUIRED);
    }
  }
}
