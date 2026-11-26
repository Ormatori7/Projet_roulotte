// - Tests HTTP avec Supertest : la vraie application, avec un faux repository
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Container } from "../src/container.js";
import { createAuth, type AuthUserStore } from "../src/fourni/auth/index.js";
import { MenuController } from "../src/modules/menu/menu.controller.js";
import { MenuService } from "../src/modules/menu/menu.service.js";
import { OrderController } from "../src/modules/orders/order.controller.js";
import type { OrderRepository } from "../src/modules/orders/order.repository.js";
import { OrderService } from "../src/modules/orders/order.service.js";
import { fakeMenuRepository, plat } from "./helpers/fake-menu.js";

// . Construit une application de test, sans base de données
function createTestApp() {
  const menu = fakeMenuRepository([
    plat(1, "Le Classique"),
    plat(2, "Frites maison"),
  ]);
  const users: AuthUserStore = {
    findByEmail: async () => null,
    findById: async () => null,
    create: async (data) => ({ id: 1, ...data }),
  };
  const config = {
    PORT: 0,
    DATABASE_URL: "file:./test.db",
    JWT_SECRET: "secret-de-test-assez-long",
    JWT_EXPIRES_IN: "2h",
    CORS_ORIGIN: "http://localhost:5173",
  };
  // Faux repository des commandes : pas utilisé par ces tests
  const orders: OrderRepository = {
    create: async () => {
      throw new Error("non utilisé dans ces tests");
    },
    findById: async () => null,
    list: async () => ({ items: [], total: 0 }),
  };
  const container: Container = {
    config,
    auth: createAuth({ users, jwtSecret: config.JWT_SECRET }),
    repositories: { users, menu, dishes: menu, orders },
    controllers: {
      menu: new MenuController(new MenuService(menu)),
      orders: new OrderController(new OrderService(orders, menu)),
    },
  };
  return createApp(container);
}

describe("Routes du menu", () => {
  const app = createTestApp();

  it("GET /categories → 200 et un tableau", async () => {
    const res = await request(app).get("/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: "Burgers", position: 1 }]);
  });

  it("GET /dishes → 200, page 1 et 20 par page par défaut", async () => {
    const res = await request(app).get("/dishes");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
  });

  it("GET /dishes?pageSize=51 → 400 VALIDATION_ERROR", async () => {
    const res = await request(app).get("/dishes?pageSize=51");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /dishes/999 → 404 NOT_FOUND", async () => {
    const res = await request(app).get("/dishes/999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /dishes/abc → 400 VALIDATION_ERROR", async () => {
    const res = await request(app).get("/dishes/abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
