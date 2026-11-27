// Bus d'événements (pattern Observer) : celui qui publie ne connaît pas ceux qui écoutent.
import type { OrderRecord } from "../modules/orders/order.types";

// La liste des évenements de l'application et ce que chacun transporte
export type AppEvents = {
    "order.created": OrderRecord;
    "order.updated": OrderRecord;
}

type Listener<T> = (payload: T) => void;

export class EventBus {
    private readonly listeners = new Map<string, Listener<never>[]>();

    // S'abonner : préviens moi quand cet évent se produit
    on<K extends keyof AppEvents>(event: K, listener: Listener<AppEvents[K]>): void {
        const list = this.listeners.get(event) ?? [];
        list.push(listener as Listener<never>);
        this.listeners.set(event, list);
    }

    // Publier : appelle tous les abonnés de cet événement
    emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
        for (const listener of this.listeners.get(event) ?? []) {
            (listener as Listener<AppEvents[K]>)(payload);
        }
    }
}
