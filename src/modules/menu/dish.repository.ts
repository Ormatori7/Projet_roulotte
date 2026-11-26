import type { PrismaClient } from "../../generated/prisma/client";

// Ce que les commandes ont besoin de savoir sur un plat
export type DishForOrder = {
    id: number;
    name: string;
    priceCents: number;
    available: boolean;
}

export interface DishRepository {
    findByIds(ids: number[]): Promise<DishForOrder[]>;
}

export class PrismaDishRepository implements DishRepository {
    constructor(private readonly prisma: PrismaClient) {}

    findByIds(ids: number[]): Promise<DishForOrder[]> {
        return this.prisma.dish.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, priceCents: true, available: true }
        })
    }
}


