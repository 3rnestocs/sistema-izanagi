import { PrismaClient } from '@prisma/client';
import { Message } from 'discord.js';

interface ParsedBuildFromMessage {
  keko: string | null;
  plazas: string[];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseKekoFromLines(lines: string[]): string | null {
  for (const line of lines) {
    const match = line.match(/nombre\s+del\s+keko\s*:\s*(.+)$/i);
    if (match && match[1]) {
      const candidate = sanitizeKekoText(match[1]);
      if (candidate.length > 0) {
        return candidate;
      }
    }
  }
  return null;
}

function sanitizeKekoText(raw: string): string {
  return raw
    .trim()
    .replace(/^['"`*_~\[\]()<>\s]+/, '')
    .replace(/['"`*_~\[\]()<>\s]+$/, '')
    .replace(/^[:\-\s]+/, '')
    .trim();
}

export class BuildApprovalService {
  constructor(private prisma: PrismaClient) {}

  private extractApprovedPlazasFromContent(content: string, knownPlazaNames: string[]): string[] {
    const normalizedContent = normalizeText(content);
    const sorted = [...knownPlazaNames].sort((a, b) => b.length - a.length);

    const found = sorted.filter((plazaName) => {
      const normalizedPlaza = normalizeText(plazaName);
      return normalizedContent.includes(normalizedPlaza);
    });

    return Array.from(new Set(found)).sort((a, b) => a.localeCompare(b, 'es'));
  }

  private parseBuildMessage(content: string, knownPlazaNames: string[]): ParsedBuildFromMessage {
    const lines = content
      .split('\n')
      .map((line) => line.replace(/^\s*[\-•*]\s*/, '').trim())
      .filter((line) => line.length > 0);

    const keko = parseKekoFromLines(lines);

    const plazasLine = lines.find((line) => /habilidades\s+iniciales\s+solicitadas/i.test(line));
    const plazaSourceText = plazasLine ?? content;
    const plazas = this.extractApprovedPlazasFromContent(plazaSourceText, knownPlazaNames);

    return { keko, plazas };
  }

  async upsertApprovalFromMessage(message: Message, staffUserId: string): Promise<void> {
    const guildId = message.guildId;
    const channelId = message.channelId;

    if (!guildId) {
      throw new Error('El mensaje de aprobación no pertenece a un servidor.');
    }

    const knownPlazas = await this.prisma.plaza.findMany({
      select: { name: true }
    });

    const parsed = this.parseBuildMessage(
      message.content,
      knownPlazas.map((plaza) => plaza.name)
    );

    if (!parsed.keko) {
      throw new Error('No se pudo extraer "Nombre del Keko" del mensaje aprobado.');
    }

    const existing = await this.prisma.characterBuildApproval.findUnique({
      where: { sourceMessageId: message.id }
    });

    const nextApprovers = Array.from(
      new Set([...(existing?.approvedByIds ?? []), staffUserId])
    );

    await this.prisma.characterBuildApproval.upsert({
      where: { sourceMessageId: message.id },
      update: {
        discordId: message.author.id,
        keko: parsed.keko,
        sourceChannelId: channelId,
        sourceGuildId: guildId,
        sourceMessageUrl: message.url,
        approvedPlazas: { set: parsed.plazas },
        approvedByIds: { set: nextApprovers },
        isActive: true,
        revokedAt: null
      },
      create: {
        discordId: message.author.id,
        keko: parsed.keko,
        sourceMessageId: message.id,
        sourceChannelId: channelId,
        sourceGuildId: guildId,
        sourceMessageUrl: message.url,
        approvedPlazas: parsed.plazas,
        approvedByIds: [staffUserId],
        isActive: true
      }
    });
  }

  async setApprovalActiveStateByMessageId(messageId: string, isActive: boolean): Promise<void> {
    const existing = await this.prisma.characterBuildApproval.findUnique({
      where: { sourceMessageId: messageId },
      select: { id: true }
    });

    if (!existing) {
      return;
    }

    await this.prisma.characterBuildApproval.update({
      where: { id: existing.id },
      data: {
        isActive,
        revokedAt: isActive ? null : new Date()
      }
    });
  }

  async getActiveApprovalForUser(discordId: string, guildId?: string) {
    return this.prisma.characterBuildApproval.findFirst({
      where: {
        discordId,
        isActive: true,
        ...(guildId ? { sourceGuildId: guildId } : {})
      },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
