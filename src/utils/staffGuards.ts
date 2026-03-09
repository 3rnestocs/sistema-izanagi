import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { PrismaClient } from '@prisma/client';

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
    throw new Error('⛔ Este comando solo puede usarse dentro de un servidor.');
  }

  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
  const hasStaffRole = hasConfiguredStaffRole(interaction);

  if (!isAdmin && !hasStaffRole) {
    throw new Error('⛔ No tienes permisos de staff para usar este comando.');
  }

  if (!options.requireNpcCreationFlag || !shouldRequireNpcFlag()) {
    return;
  }

  if (isAdmin && options.allowAdminBypassNpcFlag !== false) {
    return;
  }

  if (!options.prisma) {
    throw new Error('⛔ Configuración inválida: falta cliente de base de datos para validación de NPC.');
  }

  const actorCharacter = await options.prisma.character.findUnique({
    where: { discordId: interaction.user.id },
    select: { canCreateNPC: true }
  });

  if (!actorCharacter?.canCreateNPC) {
    throw new Error('⛔ Tu ficha no tiene habilitado el permiso canCreateNPC para gestionar NPCs.');
  }
}
