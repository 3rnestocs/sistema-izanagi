import { PrismaClient, Prisma } from '@prisma/client';

export interface BuyDTO {
  characterId: string;
  itemNames: string[]; // Ej: ["Kunai", "Shuriken", "Kunai"] (Se apilarán)
}

export interface SellDTO {
  characterId: string;
  itemNames: string[]; // Lo que desea vender
}

export interface TransferDTO {
  senderId: string;
  receiverId: string;
  itemNames: string[];
  ryouAmount?: number | undefined; // 🚀 Agregamos '| undefined' para satisfacer al compilador
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
      if (!character) throw new Error("Personaje no encontrado.");

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

      if (itemsToBuy.length === 0) throw new Error("Ninguno de los ítems existe en el Mercado.");

      // 3. Agrupar costos por moneda (RYOU, EXP, PR)
      const costs = { RYOU: 0, EXP: 0, PR: 0 };
      const itemsToAdd: Record<string, number> = {}; // { itemId: quantity }

      for (const name of data.itemNames) {
        const item = itemsToBuy.find(i => i.name.toUpperCase() === name.toUpperCase());
        if (!item) throw new Error(`El ítem '${name}' no existe en el catálogo.`);
        
        const finalPrice = item.currency === 'RYOU'
          ? Math.ceil(item.price * multiplierGasto)
          : item.price;
        costs[item.currency as keyof typeof costs] += finalPrice;

        itemsToAdd[item.id] = (itemsToAdd[item.id] || 0) + 1;
      }

      // 4. Validar Fondos y Regla del Tacaño
      if (character.ryou < costs.RYOU) throw new Error(`⛔ FONDOS: Necesitas ${costs.RYOU} Ryou, tienes ${character.ryou}.`);
      if (character.exp < costs.EXP) throw new Error(`⛔ FONDOS: Necesitas ${costs.EXP} EXP, tienes ${character.exp}.`);
      if (character.pr < costs.PR) throw new Error(`⛔ FONDOS: Necesitas ${costs.PR} PR, tienes ${character.pr}.`);

      if (costs.RYOU > 0 && (character.ryou - costs.RYOU) < minBalanceRule) {
        throw new Error(`⛔ RESTRICCIÓN DE RASGO: Debes mantener al menos ${minBalanceRule} Ryou intactos en tu ficha.`);
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
          category: "Compra (Mercado)",
          detail: `Compró: ${data.itemNames.join(", ")}`,
          evidence: "Sistema de Transacciones",
          deltaRyou: -costs.RYOU,
          deltaExp: -costs.EXP,
          deltaPr: -costs.PR
        }
      });

      return { success: true, costs };
    });
  }

  // ==========================================
  // 🤝 TRANSFERENCIA ATÓMICA
  // ==========================================
  async transferItems(data: TransferDTO) {
    return await this.prisma.$transaction(async (tx) => {
      const sender = await tx.character.findUnique({
        where: { id: data.senderId },
        include: { traits: { include: { trait: true } } }
      });
      if (!sender) throw new Error("Remitente no encontrado.");

      // 1. Validar bloqueo de transferencia (Tacaño)
      const transferAmount = data.ryouAmount || 0;
      if (transferAmount > 0) {
        const blocksTransfer = sender.traits.some(ct => ct.trait.blocksTransfer);
        if (blocksTransfer) {
          throw new Error("⛔ RESTRICCIÓN DE RASGO: Tienes prohibido ceder dinero voluntariamente a otros personajes.");
        }
        if (sender.ryou < transferAmount) {
          throw new Error("⛔ No tienes suficientes Ryou para transferir.");
        }
      }

      // 2. Procesar transferencia de ítems
      const itemsToMove: Record<string, number> = {};
      if (data.itemNames && data.itemNames.length > 0) {
        const catalog = await tx.item.findMany({ where: { name: { in: data.itemNames } } });
        
        for (const name of data.itemNames) {
          const item = catalog.find(i => i.name.toUpperCase() === name.toUpperCase());
          if (!item) throw new Error(`Ítem '${name}' no existe en el catálogo.`);
          itemsToMove[item.id] = (itemsToMove[item.id] || 0) + 1;
        }

        // Verificar que el remitente tiene los ítems y restarlos
        for (const [itemId, qty] of Object.entries(itemsToMove)) {
          const invItem = await tx.inventoryItem.findUnique({
            where: { characterId_itemId: { characterId: sender.id, itemId: itemId } }
          });
          
          if (!invItem || invItem.quantity < qty) {
            throw new Error(`⛔ No tienes suficiente cantidad del ítem para transferir.`);
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
      const itemsLog = data.itemNames.length > 0 ? data.itemNames.join(", ") : "Ningún objeto";
      const moneyLog = transferAmount > 0 ? ` y ${transferAmount} Ryou` : "";

      await tx.auditLog.create({
        data: {
          characterId: sender.id,
          category: "Intercambio",
          detail: `Transfirió a [${data.receiverId}]: ${itemsLog}${moneyLog}`,
          evidence: "Sistema de Transacciones",
          deltaRyou: -transferAmount
        }
      });

      await tx.auditLog.create({
        data: {
          characterId: data.receiverId,
          category: "Intercambio",
          detail: `Recibió de [${sender.id}]: ${itemsLog}${moneyLog}`,
          evidence: "Sistema de Transacciones",
          deltaRyou: transferAmount
        }
      });

      return true;
    });
  }
}