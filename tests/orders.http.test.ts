import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/test-app.js";

describe("Commandes : controle d'acces", () => {
  it("POST /orders sans jeton → 401 UNAUTHORIZED", async () => {
    const { app } = createTestApp();

    const res = await request(app).post("/orders").send({ items: [{ dishId: 1, quantity: 1 }] });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /orders avec un jeton falsifie → 401", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/orders").set("Authorization", "Bearer faux.jeton.invente");

    expect(res.status).toBe(401);
  });

  it("la commande d'un autre client → 404, mais la cuisine la voit", async () => {
    const { app, tokenFor } = createTestApp();
    const alice = await tokenFor("alice@test.fr");
    const bob = await tokenFor("bob@test.fr");
    const cuisine = await tokenFor("cuisine@test.fr", "STAFF");

    const created = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${alice}`)
      .send({ items: [{ dishId: 1, quantity: 1 }] });
    const url = `/orders/${created.body.id}`;

    const parBob = await request(app).get(url).set("Authorization", `Bearer ${bob}`);
    const parLaCuisine = await request(app).get(url).set("Authorization", `Bearer ${cuisine}`);

    expect(parBob.status).toBe(404);
    expect(parBob.body.error.code).toBe("NOT_FOUND");
    expect(parLaCuisine.status).toBe(200);
  });

  it("GET /orders : un client ne voit que ses commandes, la cuisine les voit toutes", async () => {
    const { app, tokenFor } = createTestApp();
    const alice = await tokenFor("alice@test.fr");
    const bob = await tokenFor("bob@test.fr");
    const cuisine = await tokenFor("cuisine@test.fr", "STAFF");
    const commande = { items: [{ dishId: 1, quantity: 1 }] };
    await request(app).post("/orders").set("Authorization", `Bearer ${alice}`).send(commande);
    await request(app).post("/orders").set("Authorization", `Bearer ${bob}`).send(commande);

    const pourAlice = await request(app).get("/orders").set("Authorization", `Bearer ${alice}`);
    const pourLaCuisine = await request(app).get("/orders").set("Authorization", `Bearer ${cuisine}`);

    expect(pourAlice.body.total).toBe(1);
    expect(pourLaCuisine.body.total).toBe(2);
  });
});

describe("Commandes : creation", () => {
  it("201 + Location, prix et totaux calcules par le serveur", async () => {
    const { app, tokenFor } = createTestApp();
    const token = await tokenFor("alice@test.fr");

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ dishId: 1, quantity: 2 }, { dishId: 2, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/orders/${res.body.id}`);
    expect(res.body).toMatchObject({
      status: "RECEIVED",
      note: null,
      totalCents: 2400,
      items: [
        { dishId: 1, quantity: 2, unitPriceCents: 1000, lineTotalCents: 2000 },
        { dishId: 2, quantity: 1, unitPriceCents: 400, lineTotalCents: 400 },
      ],
    });
  });

  it("un prix envoye par le client est refuse → 400 VALIDATION_ERROR", async () => {
    const { app, tokenFor } = createTestApp();
    const token = await tokenFor("alice@test.fr");

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ dishId: 1, quantity: 1, unitPriceCents: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("deux lignes pour le meme plat → 400", async () => {
    const { app, tokenFor } = createTestApp();
    const token = await tokenFor("alice@test.fr");

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ dishId: 1, quantity: 1 }, { dishId: 1, quantity: 2 }] });

    expect(res.status).toBe(400);
  });

  it("plat indisponible ou inexistant → 422 DISH_UNAVAILABLE avec tous les plats refuses", async () => {
    const { app, tokenFor } = createTestApp();
    const token = await tokenFor("alice@test.fr");

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ dishId: 3, quantity: 1 }, { dishId: 99, quantity: 1 }] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("DISH_UNAVAILABLE");
    expect(res.body.error.details).toEqual([
      { dishId: 3, reason: "UNAVAILABLE" },
      { dishId: 99, reason: "NOT_FOUND" },
    ]);
  });
});