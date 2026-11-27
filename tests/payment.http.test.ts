// Le paiement de bout en bout (route, controller, service) avec un FAUX prestataire :
// aucun appel réseau, donc les tests sont rapides et ne dépendent pas du simulateur.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/test-app.js";

// Une application neuve, un client connecté et sa commande de 2 « Le Classique » (2000 centimes)
async function commandeAPayer() {
  const { app, tokenFor, gateway } = createTestApp();
  const token = await tokenFor("alice@test.fr");
  const created = await request(app)
    .post("/orders")
    .set("Authorization", `Bearer ${token}`)
    .send({ items: [{ dishId: 1, quantity: 2 }] });
  const orderId = created.body.id as number;

  const pay = (as: string, body: unknown = { token: "tok_visa" }) =>
    request(app).post(`/orders/${orderId}/payment`).set("Authorization", `Bearer ${as}`).send(body as object);

  return { app, tokenFor, gateway, token, orderId, created, pay };
}

describe("POST /orders/:id/payment", () => {
  it("une nouvelle commande est UNPAID", async () => {
    const { created } = await commandeAPayer();

    expect(created.body.paymentStatus).toBe("UNPAID");
  });

  it("paiement accepté → 200, PAID, le bon montant est envoyé au prestataire", async () => {
    const { pay, token, gateway, orderId } = await commandeAPayer();

    const res = await pay(token);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("PAID");
    expect(gateway.charges).toEqual([{ orderId, amountCents: 2000, token: "tok_visa" }]);
  });

  it("déjà payée → 409 CONFLICT, sans rappeler le prestataire", async () => {
    const { pay, token, gateway } = await commandeAPayer();
    await pay(token);

    const res = await pay(token);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(gateway.charges).toHaveLength(1);
  });

  it("paiement refusé → 402 PAYMENT_DECLINED, la commande reste UNPAID", async () => {
    const { app, pay, token, orderId } = await commandeAPayer();

    const res = await pay(token, { token: "tok_declined" });

    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe("PAYMENT_DECLINED");
    const order = await request(app).get(`/orders/${orderId}`).set("Authorization", `Bearer ${token}`);
    expect(order.body.paymentStatus).toBe("UNPAID");
  });

  it("un autre client → 404, la cuisine → 403, et le prestataire n'est jamais appelé", async () => {
    const { pay, tokenFor, gateway } = await commandeAPayer();

    const autreClient = await pay(await tokenFor("bob@test.fr"));
    const cuisine = await pay(await tokenFor("cuisine@test.fr", "STAFF"));

    expect(autreClient.status).toBe(404);
    expect(cuisine.status).toBe(403);
    expect(gateway.charges).toHaveLength(0);
  });

  it("commande annulée → 409 CONFLICT, sans appeler le prestataire", async () => {
    const { app, pay, token, gateway, orderId } = await commandeAPayer();
    await request(app)
      .patch(`/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "CANCELLED" });

    const res = await pay(token);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(gateway.charges).toHaveLength(0);
  });

  it("corps sans token, ou avec un champ en trop → 400 VALIDATION_ERROR", async () => {
    const { pay, token } = await commandeAPayer();

    const vide = await pay(token, {});
    const enTrop = await pay(token, { token: "tok_visa", amountCents: 1 });

    expect(vide.status).toBe(400);
    expect(enTrop.status).toBe(400);
    expect(enTrop.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("sans jeton de connexion → 401", async () => {
    const { app, orderId } = await commandeAPayer();

    const res = await request(app).post(`/orders/${orderId}/payment`).send({ token: "tok_visa" });

    expect(res.status).toBe(401);
  });
});
