import type { AuthUser } from "../../fourni/auth/index";
import { toOrderDto } from "../orders/order.dto";
import type { OrderRecord } from "../orders/order.types";

// Un client connecté : qui il est, et comment lui écrire
export type SseClient = {
  user: AuthUser;
  write: (chunk: string) => void;
};

export class SseHub {
  private readonly clients = new Set<SseClient>();

  // Ajoute un client et renvoie la fonction qui le retire (appelée à la déconnexion)
  add(client: SseClient): () => void {
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  // seulement pour la cuisine et l'admin
  orderCreated(order: OrderRecord): void {
    this.send("order.created", order, (user) => user.role !== "CUSTOMER");
  }

  // pour son client, la cuisine et l'admin
  orderUpdated(order: OrderRecord): void {
    this.send("order.updated", order, (user) => user.role !== "CUSTOMER" || user.id === order.userId);
  }

  // une ligne « event: », une ligne « data: » en JSON, puis une ligne vide
  private send(event: string, order: OrderRecord, isRecipient: (user: AuthUser) => boolean): void {
    const frame = `event: ${event}\ndata: ${JSON.stringify(toOrderDto(order))}\n\n`;
    for (const client of this.clients) {
      if (isRecipient(client.user)) client.write(frame);
    }
  }
}