import { Prisma, PrismaClient } from '@prisma/client';

export const ADJUSTABLE_RESOURCES = [
  'ryou',
  'exp',
  'pr',
  'sp',
  'cupos',
  'rc',
  'bts',
  'bes'
] as const;

export type AdjustableResource = (typeof ADJUSTABLE_RESOURCES)[number];

export interface RemoveResourceDTO {
  targetDiscordId: string;
  resource: AdjustableResource;
  requestedAmount: number;
  reason: string;
  actorDiscordTag: string;
  evidence?: string;
}

export interface RemoveResourceResult {
  characterId: string;
  characterName: string;
  resource: AdjustableResource;
  previousValue: number;
  requestedAmount: number;
  appliedAmount: number;
  finalValue: number;
}

export interface AddResourceDTO {
  targetDiscordId: string;
  resource: AdjustableResource;
  amount: number;
  reason: string;
  actorDiscordTag: string;
  evidence?: string;
}

export interface AddResourceResult {
  characterId: string;
  characterName: string;
  resource: AdjustableResource;
  previousValue: number;
  appliedAmount: number;
  finalValue: number;
}

const RESOURCE_DELTA_FIELD_MAP = {
  ryou: 'deltaRyou',
  exp: 'deltaExp',
  pr: 'deltaPr',
  sp: 'deltaSp',
  cupos: 'deltaCupos',
  rc: 'deltaRc',
  bts: 'deltaBts',
  bes: 'deltaBes'
} as const;

export const RESOURCE_LABEL_MAP = {
  ryou: 'Ryou',
  exp: 'EXP',
  pr: 'PR',
  sp: 'SP',
  cupos: 'Cupos',
  rc: 'RC',
  bts: 'BTS',
  bes: 'BES'
} as const;

type DeltaFieldName = (typeof RESOURCE_DELTA_FIELD_MAP)[AdjustableResource];

export class ResourceAdjustmentService {
  constructor(private prisma: PrismaClient) {}

  public getResourceLabel(resource: AdjustableResource): string {
    return RESOURCE_LABEL_MAP[resource];
  }

  public async removeResource(data: RemoveResourceDTO): Promise<RemoveResourceResult> {
    if (data.requestedAmount <= 0) {
      throw new Error('⛔ La cantidad debe ser mayor a cero.');
    }

    const reason = data.reason.trim();
    if (!reason) {
      throw new Error('⛔ Debes proporcionar un motivo para el ajuste.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const character = await tx.character.findUnique({
          where: { discordId: data.targetDiscordId },
          select: {
            id: true,
            name: true,
            ryou: true,
            exp: true,
            pr: true,
            sp: true,
            cupos: true,
            rc: true,
            bts: true,
            bes: true
          }
        });

        if (!character) {
          throw new Error('⛔ El usuario objetivo no tiene un personaje registrado.');
        }

        const previousValue = character[data.resource];
        const appliedAmount = Math.min(data.requestedAmount, previousValue);
        const finalValue = previousValue - appliedAmount;
        const resourceLabel = this.getResourceLabel(data.resource);
        const deltaField = RESOURCE_DELTA_FIELD_MAP[data.resource];

        const characterUpdateData: Pick<Prisma.CharacterUncheckedUpdateInput, AdjustableResource> = {
          [data.resource]: finalValue
        } as Pick<Prisma.CharacterUncheckedUpdateInput, AdjustableResource>;

        await tx.character.update({
          where: { id: character.id },
          data: characterUpdateData
        });

        const deltaData: Pick<Prisma.AuditLogUncheckedCreateInput, DeltaFieldName> = {
          [deltaField]: -appliedAmount
        } as Pick<Prisma.AuditLogUncheckedCreateInput, DeltaFieldName>;

        await tx.auditLog.create({
          data: {
            characterId: character.id,
            category: 'Ajuste Staff de Recursos',
            detail: [
              `Staff: ${data.actorDiscordTag}`,
              `Recurso: ${resourceLabel}`,
              `Solicitado: ${data.requestedAmount}`,
              `Aplicado: ${appliedAmount}`,
              `Saldo previo: ${previousValue}`,
              `Saldo final: ${finalValue}`,
              `Motivo: ${reason}`
            ].join(' | '),
            evidence: data.evidence?.trim() || 'Sin evidencia adjunta',
            ...deltaData
          }
        });

        return {
          characterId: character.id,
          characterName: character.name,
          resource: data.resource,
          previousValue,
          requestedAmount: data.requestedAmount,
          appliedAmount,
          finalValue
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  }

  public async addResource(data: AddResourceDTO): Promise<AddResourceResult> {
    if (data.amount <= 0) {
      throw new Error('⛔ La cantidad debe ser mayor a cero.');
    }

    const reason = data.reason.trim();
    if (!reason) {
      throw new Error('⛔ Debes proporcionar un motivo para el ajuste.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const character = await tx.character.findUnique({
          where: { discordId: data.targetDiscordId },
          select: {
            id: true,
            name: true,
            ryou: true,
            exp: true,
            pr: true,
            sp: true,
            cupos: true,
            rc: true,
            bts: true,
            bes: true
          }
        });

        if (!character) {
          throw new Error('⛔ El usuario objetivo no tiene un personaje registrado.');
        }

        const previousValue = character[data.resource];
        const finalValue = previousValue + data.amount;
        const resourceLabel = this.getResourceLabel(data.resource);
        const deltaField = RESOURCE_DELTA_FIELD_MAP[data.resource];

        const characterUpdateData: Pick<Prisma.CharacterUncheckedUpdateInput, AdjustableResource> = {
          [data.resource]: finalValue
        } as Pick<Prisma.CharacterUncheckedUpdateInput, AdjustableResource>;

        await tx.character.update({
          where: { id: character.id },
          data: characterUpdateData
        });

        const deltaData: Pick<Prisma.AuditLogUncheckedCreateInput, DeltaFieldName> = {
          [deltaField]: data.amount
        } as Pick<Prisma.AuditLogUncheckedCreateInput, DeltaFieldName>;

        await tx.auditLog.create({
          data: {
            characterId: character.id,
            category: 'Ajuste Staff de Recursos',
            detail: [
              `Staff: ${data.actorDiscordTag}`,
              `Recurso: ${resourceLabel}`,
              `Otorgado: ${data.amount}`,
              `Saldo previo: ${previousValue}`,
              `Saldo final: ${finalValue}`,
              `Motivo: ${reason}`
            ].join(' | '),
            evidence: data.evidence?.trim() || 'Sin evidencia adjunta',
            ...deltaData
          }
        });

        return {
          characterId: character.id,
          characterName: character.name,
          resource: data.resource,
          previousValue,
          appliedAmount: data.amount,
          finalValue
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  }
}
