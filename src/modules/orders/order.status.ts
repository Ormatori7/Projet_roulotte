// La machine d'états des commandes : les transitiosn autorisées sont décrites ici
import type { OrderStatus } from "./order.types";

export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
    RECEIVED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["PICKED_UP", "CANCELLED"],
    PICKED_UP: [],
    CANCELLED: []
};

// La transiton from -> to existe-t-elle ?
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return TRANSITIONS[from].includes(to);
}

// Un client ne peut qu'annlyer, et seulement tant que la commande n'est pas en préparation
export function customerCanCancel(from: OrderStatus): boolean {
    return from === "RECEIVED"
}
