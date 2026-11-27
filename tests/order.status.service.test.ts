// Les règles de changement de statut dans le service, avec un faux repository.
import { describe, expect, it, vi } from "vitest";
import { OrderService } from "../src/modules/orders/order.service.js";
import type { OrderRecord, OrderStatus } from "../src/modules/orders/order.types.js";

const client = { id: 7, role: "CUSTOMER" as const };
const cuisine = { id: 2, role: "STAFF" as const };
const dishes = { findByIds: async () => [] };

const commande = (status: OrderStatus, userId = 7): OrderRecord => ({
  id: 5,
  status,
  note: null,
  totalCents: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
  userId,
  user: { id: userId, name: "Quelqu'un" },
  items: [],
});

// Faux repository : la commande 5 existe avec le statut donné
function serviceAvec(existante: OrderRecord) {
  const orders = {
    create: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(async () => existante),
    updateStatus: vi.fn(async (_id: number, _from: OrderStatus, to: OrderStatus) => ({ ...existante, status: to })),
  };
  return { service: new OrderService(orders, dishes), orders };
}

describe("OrderService.changeStatus", () => {
  it("la cuisine fait avancer une commande reçue vers « en préparation »", async () => {
    const { service, orders } = serviceAvec(commande("RECEIVED"));

    const updated = await service.changeStatus(cuisine, 5, "PREPARING");

    expect(updated.status).toBe("PREPARING");
    expect(orders.updateStatus).toHaveBeenCalledWith(5, "RECEIVED", "PREPARING");
  });

  it("transition interdite → 409 INVALID_TRANSITION, rien n'est écrit", async () => {
    const { service, orders } = serviceAvec(commande("RECEIVED"));

    await expect(service.changeStatus(cuisine, 5, "PICKED_UP")).rejects.toMatchObject({
      status: 409,
      code: "INVALID_TRANSITION",
    });
    expect(orders.updateStatus).not.toHaveBeenCalled();
  });

  it("un client annule sa commande reçue", async () => {
    const { service } = serviceAvec(commande("RECEIVED"));

    const updated = await service.changeStatus(client, 5, "CANCELLED");

    expect(updated.status).toBe("CANCELLED");
  });

  it("un client qui demande autre chose que l'annulation → 403 FORBIDDEN", async () => {
    const { service } = serviceAvec(commande("RECEIVED"));

    await expect(service.changeStatus(client, 5, "PREPARING")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("un client ne peut plus annuler une commande en préparation → 409", async () => {
    const { service } = serviceAvec(commande("PREPARING"));

    await expect(service.changeStatus(client, 5, "CANCELLED")).rejects.toMatchObject({
      status: 409,
      code: "INVALID_TRANSITION",
    });
  });

  it("la commande d'un autre client → 404, même pour l'annuler", async () => {
    const { service } = serviceAvec(commande("RECEIVED", 999));

    await expect(service.changeStatus(client, 5, "CANCELLED")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});