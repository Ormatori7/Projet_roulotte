// Le service et le controller ne dépendent que de ces types

export const ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "PICKED_UP", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Une commande telle que le repository la renvoie (avec son client et ses lignes)
export type OrderRecord = {
    id: number;
    status: OrderStatus;
    note: string | null;
    totalCents: number;
    createdAt: Date;
    updatedAt: Date;
    userId: number;
    user: { id: number; name: string; };
    items: {
        dishId: number;
        quantity: number;
        unitPriceCents: number;
        dish: { name: string };
    }[];
}

// Ce que le service donne au repository pour créer une commande
export type NewOrder = {
    userId: number;
    note: string | null;
    totalCents: number;
    items: { dishId: number; quantity: number; unitPriceCents: number }[];
}

// Les critères de la liste des commandes
export type OrderFilter = {
    userId?: number;
    statuses?: OrderStatus[];
    sort: "createdAt" | "-createdAt";
    page: number;
    pageSize: number;
}
