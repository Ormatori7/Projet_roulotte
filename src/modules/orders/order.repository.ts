// DAO des commandes : l'interface (le contrat) et son implémentation Prisma.
import type { PrismaClient } from "../../generated/prisma/client";
import type { NewOrder, OrderFilter, OrderRecord } from "./order.types";

export interface OrderRepository {
  create(data: NewOrder): Promise<OrderRecord>;
  findById(id: number): Promise<OrderRecord | null>;
  list(filter: OrderFilter): Promise<{ items: OrderRecord[]; total: number }>;
}

// Ce qu'on charge avec chaque commande : son client et ses lignes (avec le nom du plat)
const withDetails = {
  user: { select: { id: true, name: true } },
  items: { include: { dish: { select: { name: true } } } },
} as const;

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // La commande et ses lignes sont créées
  create(data: NewOrder): Promise<OrderRecord> {
    return this.prisma.order.create({
      data: {
        userId: data.userId,
        note: data.note,
        totalCents: data.totalCents,
        items: { create: data.items },
      },
      include: withDetails,
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
}
