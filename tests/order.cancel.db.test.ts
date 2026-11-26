// L'annulation remet les portions en stock dans une transaction : test sur une vraie base de test.
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaOrderRepository } from "../src/modules/orders/order.repository.js";

const DB_FILE = "test-cancel.db";
let prisma: PrismaClient;
let orders: PrismaOrderRepository;

const stockDe = async (id: number) => (await prisma.dish.findUniqueOrThrow({ where: { id } })).stock;

beforeAll(async () => {
  // Base neuve : on rejoue toutes les migrations dans l'ordre
  rmSync(DB_FILE, { force: true });
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:./${DB_FILE}` }) });
  for (const entry of readdirSync("prisma/migrations", { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sql = readFileSync(`prisma/migrations/${entry.name}/migration.sql`, "utf-8");
    for (const statement of sql.split(";")) {
      if (statement.trim()) await prisma.$executeRawUnsafe(statement);
    }
  }
  orders = new PrismaOrderRepository(prisma);
});

beforeEach(async () => {
  // Une commande n° 1 « reçue » : 2 cookies (il en reste 1 en stock) et 1 frites (illimité)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({ data: { id: 1, email: "client@test.fr", name: "Client", passwordHash: "x" } });
  await prisma.category.create({ data: { id: 1, name: "Desserts", position: 1 } });
  await prisma.dish.create({ data: { id: 1, name: "Cookie", description: "", priceCents: 300, categoryId: 1, stock: 1 } });
  await prisma.dish.create({ data: { id: 2, name: "Frites", description: "", priceCents: 400, categoryId: 1, stock: null } });
  await prisma.order.create({
    data: {
      id: 1,
      userId: 1,
      totalCents: 1000,
      items: {
        create: [
          { dishId: 1, quantity: 2, unitPriceCents: 300 },
          { dishId: 2, quantity: 1, unitPriceCents: 400 },
        ],
      },
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(DB_FILE, { force: true });
});

describe("Changement de statut en base", () => {
  it("faire avancer une commande change son statut sans toucher au stock", async () => {
    const updated = await orders.updateStatus(1, "RECEIVED", "PREPARING");

    expect(updated?.status).toBe("PREPARING");
    expect(await stockDe(1)).toBe(1);
  });

  it("annuler remet les portions en stock", async () => {
    const updated = await orders.updateStatus(1, "RECEIVED", "CANCELLED");

    expect(updated?.status).toBe("CANCELLED");
    expect(await stockDe(1)).toBe(3);
  });

  it("annuler laisse un stock illimité à null", async () => {
    await orders.updateStatus(1, "RECEIVED", "CANCELLED");

    expect(await stockDe(2)).toBeNull();
  });

  it("si le statut a changé entre-temps, rien n'est écrit et le stock n'est pas rendu deux fois", async () => {
    await orders.updateStatus(1, "RECEIVED", "CANCELLED");

    // Deuxième annulation, qui croit encore la commande « reçue »
    const second = await orders.updateStatus(1, "RECEIVED", "CANCELLED");

    expect(second).toBeNull();
    expect(await stockDe(1)).toBe(3);
  });
});