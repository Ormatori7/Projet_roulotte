import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { SseHub } from "../src/modules/events/sse-hub.js";
import type { OrderRecord } from "../src/modules/orders/order.types.js";
import { createTestApp } from "./helpers/test-app.js";

// Une commande qui appartient au client 7
const commande: OrderRecord = {
  id: 12,
  status: "RECEIVED",
  note: null,
  totalCents: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: 7,
  user: { id: 7, name: "Alice" },
  items: [{ dishId: 1, quantity: 1, unitPriceCents: 1000, dish: { name: "Le Classique" } }],
};

// Un hub avec trois clients connectés : Alice (propriétaire), Bob (autre client), la cuisine
function hubAvecTroisClients() {
  const hub = new SseHub();
  const alice = vi.fn();
  const bob = vi.fn();
  const cuisine = vi.fn();
  hub.add({ user: { id: 7, role: "CUSTOMER" }, write: alice });
  hub.add({ user: { id: 8, role: "CUSTOMER" }, write: bob });
  hub.add({ user: { id: 2, role: "STAFF" }, write: cuisine });
  return { hub, alice, bob, cuisine };
}

describe("SseHub", () => {
  it("order.created part vers la cuisine, pas vers les clients", () => {
    const { hub, alice, bob, cuisine } = hubAvecTroisClients();

    hub.orderCreated(commande);

    expect(cuisine).toHaveBeenCalledTimes(1);
    expect(alice).not.toHaveBeenCalled();
    expect(bob).not.toHaveBeenCalled();
  });

  it("order.updated part vers le client de la commande et la cuisine, pas vers un autre client", () => {
    const { hub, alice, bob, cuisine } = hubAvecTroisClients();

    hub.orderUpdated({ ...commande, status: "PREPARING" });

    expect(alice).toHaveBeenCalledTimes(1);
    expect(cuisine).toHaveBeenCalledTimes(1);
    expect(bob).not.toHaveBeenCalled();
  });

  it("le message respecte le format SSE et contient la commande au format du contrat", () => {
    const { hub, cuisine } = hubAvecTroisClients();

    hub.orderCreated(commande);

    const frame = cuisine.mock.calls[0][0] as string;
    expect(frame.startsWith("event: order.created\ndata: ")).toBe(true);
    expect(frame.endsWith("\n\n")).toBe(true);
    const data = JSON.parse(frame.split("\n")[1].slice("data: ".length));
    expect(data).toMatchObject({ id: 12, status: "RECEIVED", customer: { id: 7, name: "Alice" } });
  });

  it("un client retiré ne reçoit plus rien", () => {
    const hub = new SseHub();
    const cuisine = vi.fn();
    const remove = hub.add({ user: { id: 2, role: "STAFF" }, write: cuisine });

    remove();
    hub.orderCreated(commande);

    expect(cuisine).not.toHaveBeenCalled();
  });
});

describe("GET /events", () => {
  it("sans jeton → 401 UNAUTHORIZED", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/events");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});