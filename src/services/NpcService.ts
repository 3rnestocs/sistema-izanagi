import { PrismaClient } from '@prisma/client';
import { AUDIT_LOG_CATEGORY } from '../config/auditLogCategories';
import { EVIDENCE } from '../config/evidenceStrings';
import {
  ERROR_NPC_ALREADY_EXISTS,
  ERROR_NPC_ALREADY_RETIRED,
  ERROR_NPC_NAME_REQUIRED,
  ERROR_NPC_NOT_FOUND,
  ERROR_NPC_RETIRE_REASON_REQUIRED,
  ERROR_NPC_RETIRE_REFERENCE_REQUIRED
} from '../config/serviceErrors';
import { StatValidatorService } from './StatValidatorService';

interface CreateNpcInput {
  name: string;
  fullName?: string;
  level?: string;
  rank?: string;
  age?: number;
  moral?: string;
  title?: string;
  notes?: string;
  actorDiscordTag: string;
}

interface ListNpcsInput {
  page?: number;
  pageSize?: number;
  includeRetired?: boolean;
  search?: string;
}

interface RetireNpcInput {
  npcReference: string;
  reason: string;
  actorDiscordTag: string;
}

const DEFAULT_PAGE_SIZE = 10;

export class NpcService {
  constructor(private prisma: PrismaClient) {}

  async createNpc(input: CreateNpcInput) {
    const normalizedName = input.name.trim();
    if (normalizedName.length === 0) {
      throw new Error(ERROR_NPC_NAME_REQUIRED);
    }

    const normalizedLevel = (input.level ?? 'D1').trim().toUpperCase();
    const initialSp = StatValidatorService.getInitialSpForLevel(normalizedLevel);

    return this.prisma.$transaction(async (tx) => {
      const existingCharacter = await tx.character.findFirst({
        where: { name: normalizedName }
      });

      if (existingCharacter) {
        throw new Error(ERROR_NPC_ALREADY_EXISTS(normalizedName));
      }

      const npc = await tx.character.create({
        data: {
          discordId: null,
          name: normalizedName,
          fullName: input.fullName?.trim() || normalizedName,
          level: normalizedLevel,
          rank: input.rank?.trim() || 'Genin',
          age: input.age ?? null,
          moral: input.moral?.trim() || null,
          title: input.title?.trim() || null,
          isNpc: true,
          isRetired: false,
          retiredAt: null,
          rc: 0,
          cupos: 0,
          sp: initialSp,
          ryou: 0,
          exp: 0,
          pr: 0,
          bts: 0,
          bes: 0,
          specialWishUsed: false
        },
        select: {
          id: true,
          name: true,
          level: true,
          rank: true,
          isRetired: true,
          createdAt: true
        }
      });

      const detailSuffix = input.notes?.trim() ? ` Notas: ${input.notes.trim()}` : '';
      await tx.auditLog.create({
        data: {
          characterId: npc.id,
          category: AUDIT_LOG_CATEGORY.NPC_LIFECYCLE,
          detail: `NPC creado por ${input.actorDiscordTag}.${detailSuffix}`,
          evidence: EVIDENCE.COMANDO_NPC_CREAR
        }
      });

      return npc;
    });
  }

  async listNpcs(input: ListNpcsInput = {}) {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.max(1, Math.min(25, input.pageSize ?? DEFAULT_PAGE_SIZE));

    const whereClause = {
      isNpc: true,
      ...(input.includeRetired ? {} : { isRetired: false }),
      ...(input.search
        ? {
            name: {
              contains: input.search.trim(),
              mode: 'insensitive' as const
            }
          }
        : {})
    };

    const [total, npcs] = await this.prisma.$transaction([
      this.prisma.character.count({ where: whereClause }),
      this.prisma.character.findMany({
        where: whereClause,
        orderBy: [{ isRetired: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          fullName: true,
          level: true,
          rank: true,
          title: true,
          isRetired: true,
          retiredAt: true,
          createdAt: true
        }
      })
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      npcs
    };
  }

  async retireNpc(input: RetireNpcInput) {
    const reference = input.npcReference.trim();
    if (reference.length === 0) {
      throw new Error(ERROR_NPC_RETIRE_REFERENCE_REQUIRED);
    }

    const reason = input.reason.trim();
    if (reason.length === 0) {
      throw new Error(ERROR_NPC_RETIRE_REASON_REQUIRED);
    }

    return this.prisma.$transaction(async (tx) => {
      const npc = await tx.character.findFirst({
        where: {
          isNpc: true,
          OR: [{ id: reference }, { name: reference }]
        },
        select: {
          id: true,
          name: true,
          isRetired: true,
          retiredAt: true
        }
      });

      if (!npc) {
        throw new Error(ERROR_NPC_NOT_FOUND(reference));
      }

      if (npc.isRetired) {
        throw new Error(ERROR_NPC_ALREADY_RETIRED(npc.name));
      }

      const retiredAt = new Date();
      await tx.character.update({
        where: { id: npc.id },
        data: {
          isRetired: true,
          retiredAt
        }
      });

      await tx.auditLog.create({
        data: {
          characterId: npc.id,
          category: AUDIT_LOG_CATEGORY.NPC_LIFECYCLE,
          detail: `NPC retirado por ${input.actorDiscordTag}. Motivo: ${reason}`,
          evidence: EVIDENCE.COMANDO_NPC_RETIRAR
        }
      });

      return {
        id: npc.id,
        name: npc.name,
        retiredAt
      };
    });
  }
}
