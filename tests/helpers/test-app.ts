import request from "supertest";
import { createApp } from "../../src/app.js";
import type { Container } from "../../src/container.js";
import { createAuth, hashPassword, type Role, type StoredUser } from "../../src/fourni/auth/index.js";
import { MenuController } from "../../src/modules/menu/menu.controller.js";
import { MenuService } from "../../src/modules/menu/menu.service.js";
import { OrderController } from "../../src/modules/orders/order.controller.js";
import type { OrderRepository } from "../../src/modules/orders/order.repository.js";
import { OrderService } from "../../src/modules/orders/order.service.js";
import type { OrderRecord } from "../../src/modules/orders/order.types.js";
import type { UserRepository } from "../../src/modules/users/user.repository.js";
import { fakeMenuRepository, plat } from "./fake-menu.js";
import { EventBus } from "../../src/shared/event-bus";

// Les utilisateurs sont ranges dans un simple tableau
export function memoryUserRepository(): UserRepository {
  const users: StoredUser[] = [];
  return {
    findByEmail: async (email) => users.find((user) => user.email === email) ?? null,
    findById: async (id) => users.find((user) => user.id === id) ?? null,
    create: async (data) => {
      const user = { id: users.length + 1, ...data };
      users.push(user);
      return user;
    },
  };
}

// Les commandes aussi : meme interface que le repository Prisma
export function memoryOrderRepository(): OrderRepository {
  const orders: OrderRecord[] = [];
  return {
    create: async (data) => {
      const order: OrderRecord = {
        id: orders.length + 1,
        status: "RECEIVED",
        note: data.note,
        totalCents: data.totalCents,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: data.userId,
        user: { id: data.userId, name: `Client ${data.userId}` },
        items: data.items.map((item) => ({
          ...item,
          dish: { name: `Plat ${item.dishId}` },
        })),
      };
      orders.push(order);
      return order;
    },
    findById: async (id) => orders.find((order) => order.id === id) ?? null,

    list: async (filter) => {
      const found = orders.filter(
        (order) =>
          (filter.userId === undefined || order.userId === filter.userId) &&
          (filter.statuses === undefined ||
            filter.statuses.includes(order.status)),
      );

      const start = (filter.page - 1) * filter.pageSize;
      return {
        items: found.slice(start, start + filter.pageSize),
        total: found.length,
      };
    },
    updateStatus: async (id, from, to) => {
      const order = orders.find((candidate) => candidate.id === id && candidate.status === from);
      if(!order) return null;
      order.status = to;
      return order;
    }
  };
}

// L'application de test : plat 1 a 1000 centimes, plat 2 a 400, plat 3 indisponible
export function createTestApp(options: { databaseUp?: boolean } = {}) {
  const users = memoryUserRepository();
  const orders = memoryOrderRepository();
  const menu = fakeMenuRepository([
    plat(1, "Le Classique"),
    { ...plat(2, "Frites maison"), priceCents: 400 },
    { ...plat(3, "Le Burger du mois"), available: false },
  ]);

  const config = {
    PORT: 0,
    DATABASE_URL: "file:./inutilise.db",
    JWT_SECRET: "secret-de-test-assez-long",
    JWT_EXPIRES_IN: "2h",
    CORS_ORIGIN: "http://localhost:5173",
  };

  const container: Container = {
    config,
    auth: createAuth({ users, jwtSecret: config.JWT_SECRET }),
    events: new EventBus(),
    repositories: {
      users,
      menu,
      dishes: menu,
      orders,
      health: { isDatabaseUp: async () => options.databaseUp ?? true},
    },
    controllers: {
      menu: new MenuController(new MenuService(menu)),
      orders: new OrderController(new OrderService(orders, menu)),
    },
  };

  const app = createApp(container);

  // Cree un compte avec le role voulu, se connecte, et renvoie son jeton
  async function tokenFor(email: string, role: Role = "CUSTOMER") {
    const password = "MotDePasse123!";
    await users.create({ email, name: email, role, passwordHash: await hashPassword(password) });
    const res = await request(app).post("/auth/login").send({ email, password });
    return res.body.token as string;
  }

  return { app, tokenFor };
}
