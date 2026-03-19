import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import {
  ERROR_GUILD_ONLY,
  ERROR_NPC_CAN_CREATE_REQUIRED,
  ERROR_NPC_VALIDATION_NO_PRISMA,
  ERROR_STAFF_PERMISSION
} from '../config/uiStrings';

interface StaffGuardOptions {
  requireNpcCreationFlag?: boolean;
  allowAdminBypassNpcFlag?: boolean;
  prisma?: PrismaClient;
}

function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function getMemberRoleIds(interaction: ChatInputCommandInteraction): string[] {
  const member = interaction.member;
  if (!member || !("roles" in member)) return [];

  const rolesField = member.roles;
  if (Array.isArray(rolesField)) {
    return rolesField;
  }

  if ("cache" in rolesField) {
    return Array.from(rolesField.cache.keys());
  }

  return [];
}

function hasConfiguredStaffRole(interaction: ChatInputCommandInteraction): boolean {
  const allowedRoleIds = parseIdList(process.env.STAFF_ALLOWED_ROLE_IDS);
  if (allowedRoleIds.length === 0) {
    return false;
  }

  const roleIds = getMemberRoleIds(interaction);
  return roleIds.some((roleId) => allowedRoleIds.includes(roleId));
}

function shouldRequireNpcFlag(): boolean {
  return (process.env.NPC_REQUIRE_CAN_CREATE ?? 'false').toLowerCase() === 'true';
}

export async function assertStaffAccess(
  interaction: ChatInputCommandInteraction,
  options: StaffGuardOptions = {}
): Promise<void> {
  if (!interaction.inGuild()) {
    throw new Error(ERROR_GUILD_ONLY);
  }

  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
  const hasStaffRole = hasConfiguredStaffRole(interaction);

  if (!isAdmin && !hasStaffRole) {
    throw new Error(ERROR_STAFF_PERMISSION);
  }

  if (!options.requireNpcCreationFlag || !shouldRequireNpcFlag()) {
    return;
  }

  if (isAdmin && options.allowAdminBypassNpcFlag !== false) {
    return;
  }

  if (!options.prisma) {
    throw new Error(ERROR_NPC_VALIDATION_NO_PRISMA);
  }

  const actorCharacter = await options.prisma.character.findUnique({
    where: { discordId: interaction.user.id },
    select: { canCreateNPC: true }
  });

  if (!actorCharacter?.canCreateNPC) {
    throw new Error(ERROR_NPC_CAN_CREATE_REQUIRED);
  }
}
