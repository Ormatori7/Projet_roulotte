// DAO des commandes : l'interface (le contrat) et son implémentation Prisma.
import type { PrismaClient } from "../../generated/prisma/client";
import type { NewOrder, OrderFilter, OrderRecord, OrderStatus } from "./order.types";
import { AppError } from "../../shared/errors";

export interface OrderRepository {
  create(data: NewOrder): Promise<OrderRecord>;
  findById(id: number): Promise<OrderRecord | null>;
  list(filter: OrderFilter): Promise<{ items: OrderRecord[]; total: number }>;
  updateStatus(id: number, from: OrderStatus, to: OrderStatus): Promise<OrderRecord | null>;
  // Passe la commande à PAID. renvoie null si elle était déjà payée ou annulée
  markPaid(id: number): Promise<OrderRecord | null>;
}

// Ce qu'on charge avec chaque commande : son client et ses lignes (avec le nom du plat)
const withDetails = {
  user: { select: { id: true, name: true } },
  items: { include: { dish: { select: { name: true } } } },
} as const;

export class PrismaOrderRepository implements OrderRepository {
  constructor(  private readonly prisma: PrismaClient) {}

  // La commande et ses lignes sont créées
create(data: NewOrder): Promise<OrderRecord> {
    return this.prisma.$transaction(async (tx) => {
      const shortages: { dishId: number; available: number }[] = [];

      for (const item of data.items) {
        // Décrément conditionnel : la ligne n'est modifiée que si le stock suffit
        // (stock null = illimité). Jamais « lire puis écrire ».
        const result = await tx.dish.updateMany({
          where: {
            id: item.dishId,
            OR: [{ stock: null }, { stock: { gte: item.quantity } }],
          },
          data: { stock: { decrement: item.quantity } },
        });

        // count === 0 : aucune ligne modifiée, donc pas assez de stock pour ce plat
        if (result.count === 0) {
          const dish = await tx.dish.findUnique({ where: { id: item.dishId }, select: { stock: true } });
          shortages.push({ dishId: item.dishId, available: dish?.stock ?? 0 });
        }
      }

      // Lever une erreur annule toute la transaction : aucun stock n'est consommé
      if (shortages.length > 0) {
        throw new AppError(409, "OUT_OF_STOCK", "Stock insuffisant", shortages);
      }

      return tx.order.create({
        data: {
          userId: data.userId,
          note: data.note,
          totalCents: data.totalCents,
          items: { create: data.items },
        },
        include: withDetails,
      });
    });
  }

  findById(id: number): Promise<OrderRecord | null> {
    return this.prisma.order.findUnique({ where: { id }, include: withDetails });
  }

  async list(filter: OrderFilter): Promise<{ items: OrderRecord[]; total: number }> {
    const where = {
      ...(filter.userId === undefined ? {} : { userId: filter.userId }),
      ...(filter.statuses === undefined ? {} : { status: { in: filter.statuses } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: withDetails,
        orderBy: { createdAt: filter.sort === "createdAt" ? "asc" : "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  updateStatus(id: number, from: OrderStatus, to: OrderStatus): Promise<OrderRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      // Mise à jour conditionnelle : seulement si la commande a encore le statut attendu
      // Deux annulations simultanées ne peuvent donc pas rendre le stock deux fois.
      const result = await tx.order.updateMany({
        where: { id, status: from },
        data: { status: to }
      })
      if (result.count === 0) return null;

      // Annulation d'une commande (remet le nombre de plat commandé dans le stock)
      if (to === "CANCELLED") {
        const items = await tx.orderItem.findMany({ where : { orderId: id }});
        for (const item of items) {
          // Un stock null (illimité) reste null (ex: null + 2 = null)
          await tx.dish.update({
            where: { id: item.dishId },
            data: { stock: { increment: item.quantity } }
          })
        }
      }

      return tx.order.findUnique({ where: { id }, include: withDetails });
    })
  }

    // Mise à jour conditionnelle : seulement si la commande est encore impayée et pas annulée
  async markPaid(id: number): Promise<OrderRecord | null> {
    const result = await this.prisma.order.updateMany({
      where: { id, paymentStatus: "UNPAID", status: { not: "CANCELLED" } },
      data: { paymentStatus: "PAID" },
    });
    if (result.count === 0) return null;

    return this.findById(id);
  }
}
