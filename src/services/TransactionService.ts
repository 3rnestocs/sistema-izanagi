import { PrismaClient, Prisma } from '@prisma/client';
import { AUDIT_LOG_CATEGORY } from '../config/auditLogCategories';
import { EVIDENCE } from '../config/evidenceStrings';
import {
  ERROR_CHARACTER_NOT_FOUND,
  ERROR_FUNDS_INSUFFICIENT,
  ERROR_INSUFFICIENT_QUANTITY_SELL,
  ERROR_INSUFFICIENT_QUANTITY_TRANSFER,
  ERROR_ITEM_NOT_FOUND,
  ERROR_ITEM_NOT_IN_CATALOG,
  ERROR_ITEM_NOT_SELLABLE,
  ERROR_ITEMS_NOT_IN_CATALOG,
  ERROR_SENDER_NOT_FOUND,
  ERROR_TRAIT_BLOCKS_TRANSFER,
  ERROR_TRAIT_MIN_BALANCE,
  ERROR_INSUFFICIENT_RYOU_TRANSFER
} from '../config/serviceErrors';

export interface BuyDTO {
  characterId: string;
  itemNames: string[]; // Ej: ["Kunai", "Shuriken", "Kunai"] (Se apilarán)
  createdAt?: Date; // Optional backdate for migration
}

export interface SellDTO {
  characterId: string;
  itemNames: string[]; // Lo que desea vender
  createdAt?: Date; // Optional backdate for migration
}

export interface SellResult {
  success: boolean;
  itemsSold: Array<{ itemName: string; quantity: number; basePrice: number; sellPrice: number }>;
  totalRyouGained: number;
}

export interface TransferDTO {
  senderId: string;
  receiverId: string;
  itemNames: string[];
  ryouAmount?: number | undefined; // 🚀 Agregamos '| undefined' para satisfacer al compilador
  createdAt?: Date; // Optional backdate for migration
}

export class TransactionService {
  constructor(private prisma: PrismaClient) {}

  // Constante del sistema: La venta devuelve el 50% del valor base
  private readonly SELL_PERCENTAGE = 0.5;

  // ==========================================
  // 🛒 COMPRA ATÓMICA
  // ==========================================
  async buyItems(data: BuyDTO) {
    return await this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: data.characterId },
        include: { traits: { include: { trait: true } } }
      });
      if (!character) throw new Error(ERROR_CHARACTER_NOT_FOUND);

      // 1. Extraer multiplicadores y reglas de Rasgos (Tacaño, Derrochador, etc.)
      let multiplierGasto = 1.0;
      let minBalanceRule = 0;

      for (const ct of character.traits) {
        multiplierGasto *= ct.trait.multiplierGasto; // Ej: Derrochador = 1.2
        if (ct.trait.minBalanceRule > minBalanceRule) {
          minBalanceRule = ct.trait.minBalanceRule; // Ej: Tacaño = 10000 Ryou intocables
        }
      }

      // 2. Buscar items en el catálogo global
      const itemsToBuy = await tx.item.findMany({
        where: { name: { in: data.itemNames } }
      });

      if (itemsToBuy.length === 0) throw new Error(ERROR_ITEMS_NOT_IN_CATALOG);

      // 3. Agrupar costos por moneda (RYOU, EXP, PR)
      const costs = { RYOU: 0, EXP: 0, PR: 0 };
      const itemsToAdd: Record<string, number> = {}; // { itemId: quantity }

      for (const name of data.itemNames) {
        const item = itemsToBuy.find(i => i.name.toUpperCase() === name.toUpperCase());
        if (!item) throw new Error(ERROR_ITEM_NOT_FOUND(name));
        
        const finalPrice = item.currency === 'RYOU'
          ? Math.ceil(item.price * multiplierGasto)
          : item.price;
        costs[item.currency as keyof typeof costs] += finalPrice;

        itemsToAdd[item.id] = (itemsToAdd[item.id] || 0) + 1;
      }

      // 4. Validar Fondos y Regla del Tacaño
      if (character.ryou < costs.RYOU) throw new Error(ERROR_FUNDS_INSUFFICIENT('Ryou', costs.RYOU, character.ryou));
      if (character.exp < costs.EXP) throw new Error(ERROR_FUNDS_INSUFFICIENT('EXP', costs.EXP, character.exp));
      if (character.pr < costs.PR) throw new Error(ERROR_FUNDS_INSUFFICIENT('PR', costs.PR, character.pr));

      if (costs.RYOU > 0 && (character.ryou - costs.RYOU) < minBalanceRule) {
        throw new Error(ERROR_TRAIT_MIN_BALANCE(minBalanceRule));
      }

      // 5. Cobrar Recursos
      await tx.character.update({
        where: { id: character.id },
        data: {
          ryou: { decrement: costs.RYOU },
          exp: { decrement: costs.EXP },
          pr: { decrement: costs.PR }
        }
      });

      // 6. Añadir al Inventario (Upsert para apilar cantidades)
      for (const [itemId, qty] of Object.entries(itemsToAdd)) {
        await tx.inventoryItem.upsert({
          where: { characterId_itemId: { characterId: character.id, itemId: itemId } },
          update: { quantity: { increment: qty } },
          create: { characterId: character.id, itemId: itemId, quantity: qty }
        });
      }

      // 7. Auditoría
      await tx.auditLog.create({
        data: {
          characterId: character.id,
          category: AUDIT_LOG_CATEGORY.COMPRA_MERCADO,
          detail: `Compró: ${data.itemNames.join(", ")}`,
          evidence: EVIDENCE.SISTEMA_TRANSACCIONES,
          deltaRyou: -costs.RYOU,
          deltaExp: -costs.EXP,
          deltaPr: -costs.PR,
          ...(data.createdAt && { createdAt: data.createdAt })
        }
      });

      return { success: true, costs };
    });
  }

  // ==========================================
  // 💸 VENTA ATÓMICA
  // ==========================================
  async sellItems(data: SellDTO) {
    return await this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: data.characterId },
        include: { inventory: { include: { item: true } } }
      });
      if (!character) throw new Error(ERROR_CHARACTER_NOT_FOUND);

      // 1. Buscar items en el catálogo global
      const catalog = await tx.item.findMany({
        where: { name: { in: data.itemNames } }
      });

      if (catalog.length === 0) throw new Error(ERROR_ITEMS_NOT_IN_CATALOG);

      // 2. Agrupar items a vender y calcular ingresos
      const itemsToSell: Record<string, { quantity: number; basePrice: number; item: any }> = {};
      let totalRyouGained = 0;
      const soldDetails: Array<{ itemName: string; quantity: number; basePrice: number; sellPrice: number }> = [];

      for (const name of data.itemNames) {
        const catalogItem = catalog.find(i => i.name.toUpperCase() === name.toUpperCase());
        if (!catalogItem) throw new Error(ERROR_ITEM_NOT_FOUND(name));

        // Solo procesamos items con precio en RYOU (venta solo en moneda)
        if (catalogItem.currency !== 'RYOU') {
          throw new Error(ERROR_ITEM_NOT_SELLABLE(name));
        }

        if (!itemsToSell[catalogItem.id]) {
          itemsToSell[catalogItem.id] = { quantity: 0, basePrice: catalogItem.price, item: catalogItem };
        }
        itemsToSell[catalogItem.id]!.quantity += 1;
      }

      // 3. Validar inventario y calcular ingresos
      for (const [itemId, sellData] of Object.entries(itemsToSell)) {
        const invItem = character.inventory.find(inv => inv.itemId === itemId);
        if (!invItem || invItem.quantity < sellData.quantity) {
          throw new Error(ERROR_INSUFFICIENT_QUANTITY_SELL(sellData.item.name));
        }

        const sellPrice = Math.floor(sellData.basePrice * this.SELL_PERCENTAGE);
        const totalSalePrice = sellPrice * sellData.quantity;
        totalRyouGained += totalSalePrice;

        soldDetails.push({
          itemName: sellData.item.name,
          quantity: sellData.quantity,
          basePrice: sellData.basePrice,
          sellPrice: totalSalePrice
        });
      }

      // 4. Remover items del inventario
      for (const [itemId, sellData] of Object.entries(itemsToSell)) {
        const invItem = character.inventory.find(inv => inv.itemId === itemId);
        if (!invItem) continue;
        
        if (invItem.quantity === sellData.quantity) {
          await tx.inventoryItem.delete({ where: { id: invItem.id } });
        } else {
          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { decrement: sellData.quantity } }
          });
        }
      }

      // 5. Acreditar Ryou al personaje
      await tx.character.update({
        where: { id: character.id },
        data: { ryou: { increment: totalRyouGained } }
      });

      // 6. Auditoría
      const itemNames = soldDetails.map(d => d.itemName).join(', ');
      await tx.auditLog.create({
        data: {
          characterId: character.id,
          category: AUDIT_LOG_CATEGORY.VENTA_MERCADO,
          detail: `Vendió: ${itemNames}. Ganancia: ${totalRyouGained} Ryou.`,
          evidence: EVIDENCE.SISTEMA_TRANSACCIONES,
          deltaRyou: totalRyouGained,
          ...(data.createdAt && { createdAt: data.createdAt })
        }
      });

      return { success: true, itemsSold: soldDetails, totalRyouGained };
    });
  }
  async transferItems(data: TransferDTO) {
    return await this.prisma.$transaction(async (tx) => {
      const sender = await tx.character.findUnique({
        where: { id: data.senderId },
        include: { traits: { include: { trait: true } } }
      });
      if (!sender) throw new Error(ERROR_SENDER_NOT_FOUND);

      // 1. Validar bloqueo de transferencia (Tacaño)
      const transferAmount = data.ryouAmount || 0;
      if (transferAmount > 0) {
        const blocksTransfer = sender.traits.some(ct => ct.trait.blocksTransfer);
        if (blocksTransfer) {
          throw new Error(ERROR_TRAIT_BLOCKS_TRANSFER);
        }
        if (sender.ryou < transferAmount) {
          throw new Error(ERROR_INSUFFICIENT_RYOU_TRANSFER);
        }
      }

      // 2. Procesar transferencia de ítems
      const itemsToMove: Record<string, number> = {};
      if (data.itemNames && data.itemNames.length > 0) {
        const catalog = await tx.item.findMany({ where: { name: { in: data.itemNames } } });
        
        for (const name of data.itemNames) {
          const item = catalog.find(i => i.name.toUpperCase() === name.toUpperCase());
          if (!item) throw new Error(ERROR_ITEM_NOT_IN_CATALOG(name));
          itemsToMove[item.id] = (itemsToMove[item.id] || 0) + 1;
        }

        // Verificar que el remitente tiene los ítems y restarlos
        for (const [itemId, qty] of Object.entries(itemsToMove)) {
          const invItem = await tx.inventoryItem.findUnique({
            where: { characterId_itemId: { characterId: sender.id, itemId: itemId } }
          });
          
          if (!invItem || invItem.quantity < qty) {
            throw new Error(ERROR_INSUFFICIENT_QUANTITY_TRANSFER);
          }

          if (invItem.quantity === qty) {
            await tx.inventoryItem.delete({ where: { id: invItem.id } }); // Se queda sin ninguno
          } else {
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data: { quantity: { decrement: qty } }
            });
          }
        }

        // Añadirlos al destinatario
        for (const [itemId, qty] of Object.entries(itemsToMove)) {
          await tx.inventoryItem.upsert({
            where: { characterId_itemId: { characterId: data.receiverId, itemId: itemId } },
            update: { quantity: { increment: qty } },
            create: { characterId: data.receiverId, itemId: itemId, quantity: qty }
          });
        }
      }

      // 3. Procesar transferencia de Ryou
      if (transferAmount > 0) {
        await tx.character.update({ where: { id: sender.id }, data: { ryou: { decrement: transferAmount } } });
        await tx.character.update({ where: { id: data.receiverId }, data: { ryou: { increment: transferAmount } } });
      }

      // 4. Logs Cruzados
      const itemsLog = (data.itemNames && data.itemNames.length > 0) ? data.itemNames.join(", ") : "Ningún objeto";
      const moneyLog = transferAmount > 0 ? ` y ${transferAmount} Ryou` : "";
      const auditBase = data.createdAt ? { createdAt: data.createdAt } : {};

      await tx.auditLog.create({
        data: {
          characterId: sender.id,
          category: AUDIT_LOG_CATEGORY.INTERCAMBIO,
          detail: `Transfirió a [${data.receiverId}]: ${itemsLog}${moneyLog}`,
          evidence: EVIDENCE.SISTEMA_TRANSACCIONES,
          deltaRyou: -transferAmount,
          ...auditBase
        }
      });

      await tx.auditLog.create({
        data: {
          characterId: data.receiverId,
          category: AUDIT_LOG_CATEGORY.INTERCAMBIO,
          detail: `Recibió de [${sender.id}]: ${itemsLog}${moneyLog}`,
          evidence: EVIDENCE.SISTEMA_TRANSACCIONES,
          deltaRyou: transferAmount,
          ...auditBase
        }
      });

      return true;
    });
  }
}