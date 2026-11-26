// Tests unitaires du service des commandes : de faux repositories, aucune base de données.
import { describe, expect, it, vi } from "vitest";
import type { DishForOrder } from "../src/modules/menu/dish.repository.js";
import { OrderService } from "../src/modules/orders/order.service.js";
import type { OrderRecord } from "../src/modules/orders/order.types.js";

const client = { id: 7, role: "CUSTOMER" as const };

const plat = (id: number, priceCents: number, available = true): DishForOrder => ({
  id,
  name: `Plat ${id}`,
  priceCents,
  available,
});

// Une commande minimale appartenant à l'utilisateur userId
const commande = (id: number, userId: number): OrderRecord => ({
  id,
  status: "RECEIVED",
  note: null,
  totalCents: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
  userId,
  user: { id: userId, name: "Quelqu'un" },
  items: [],
});

// Faux repository de commandes : chaque test remplace ce dont il a besoin
function fauxOrders(overrides = {}) {
  return {
    create: vi.fn(async (data) => ({ ...commande(1, data.userId), ...data })),
    findById: vi.fn(async () => null),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    updateStatus: vi.fn(async () => null), 
    ...overrides,
  };
}

describe("OrderService.place", () => {
  it("prend les prix dans la base, pas chez le client", async () => {
    const dishes = { findByIds: async () => [plat(1, 1000), plat(2, 250)] };
    const orders = fauxOrders();
    const service = new OrderService(orders, dishes);

    await service.place(client, { items: [{ dishId: 1, quantity: 2 }] });

    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        totalCents: 2000,
        items: [{ dishId: 1, quantity: 2, unitPriceCents: 1000 }],
      }),
    );
  });

  it("refuse la commande en listant TOUS les plats inexistants ou indisponibles", async () => {
    // Le plat 1 existe, le 2 est indisponible, le 99 n'existe pas
    const dishes = { findByIds: async () => [plat(1, 1000), plat(2, 500, false)] };
    const orders = fauxOrders();
    const service = new OrderService(orders, dishes);

    const tentative = service.place(client, {
      items: [
        { dishId: 1, quantity: 1 },
        { dishId: 2, quantity: 1 },
        { dishId: 99, quantity: 1 },
      ],
    });

    await expect(tentative).rejects.toMatchObject({
      status: 422,
      code: "DISH_UNAVAILABLE",
      details: [
        { dishId: 2, reason: "UNAVAILABLE" },
        { dishId: 99, reason: "NOT_FOUND" },
      ],
    });
    expect(orders.create).not.toHaveBeenCalled();
  });
});

describe("OrderService.getFor", () => {
  const dishes = { findByIds: async () => [] };

  it("répond 404 pour la commande d'un autre client", async () => {
    const orders = fauxOrders({ findById: async () => commande(5, 999) });
    const service = new OrderService(orders, dishes);

    await expect(service.getFor(client, 5)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("laisse la cuisine voir la commande de n'importe quel client", async () => {
    const orders = fauxOrders({ findById: async () => commande(5, 999) });
    const service = new OrderService(orders, dishes);

    const order = await service.getFor({ id: 2, role: "STAFF" }, 5);

    expect(order.id).toBe(5);
  });
});

describe("OrderService.listFor", () => {
  it("ne demande que ses commandes pour un client", async () => {
    const orders = fauxOrders();
    const service = new OrderService(orders, { findByIds: async () => [] });

    await service.listFor(client, { sort: "-createdAt", page: 1, pageSize: 20 });

    expect(orders.list).toHaveBeenCalledWith(expect.objectContaining({ userId: 7 }));
  });
});
