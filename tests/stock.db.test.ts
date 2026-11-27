// une base de test, jamais celle de développement.
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaOrderRepository } from "../src/modules/orders/order.repository.js";

const DB_FILE = "test.db";
let prisma: PrismaClient;
let orders: PrismaOrderRepository;

// Une commande d'un seul plat, pour l'utilisateur 1
const commande = (dishId: number, quantity: number) => ({
  userId: 1,
  note: null,
  totalCents: 300 * quantity,
  items: [{ dishId, quantity, unitPriceCents: 300 }],
});

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
  // Avant chaque test : un client, un plat limité (id 1) et un plat illimité (id 2)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({ data: { id: 1, email: "client@test.fr", name: "Client", passwordHash: "x" } });
  await prisma.category.create({ data: { id: 1, name: "Desserts", position: 1 } });
  await prisma.dish.create({ data: { id: 1, name: "Cookie", description: "", priceCents: 300, categoryId: 1, stock: 3 } });
  await prisma.dish.create({ data: { id: 2, name: "Frites", description: "", priceCents: 300, categoryId: 1, stock: null } });
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(DB_FILE, { force: true });
});

describe("Stock à la commande", () => {
  it("commander décrémente le stock", async () => {
    await orders.create(commande(1, 2));

    expect(await stockDe(1)).toBe(1);
  });

  it("un stock null reste illimité", async () => {
    await orders.create(commande(2, 10));

    expect(await stockDe(2)).toBeNull();
  });

  it("stock insuffisant → 409 OUT_OF_STOCK avec le stock disponible", async () => {
    await expect(orders.create(commande(1, 4))).rejects.toMatchObject({
      status: 409,
      code: "OUT_OF_STOCK",
      details: [{ dishId: 1, available: 3 }],
    });
  });

  it("tout ou rien : une commande refusée ne consomme aucun stock et n'est pas enregistrée", async () => {
    // La première ligne passerait (2 cookies sur 3), la seconde non (2 brownies pour 1 en stock)
    await prisma.dish.create({ data: { id: 3, name: "Brownie", description: "", priceCents: 300, categoryId: 1, stock: 1 } });

    const refusee = orders.create({
      userId: 1,
      note: null,
      totalCents: 1200,
      items: [
        { dishId: 1, quantity: 2, unitPriceCents: 300 },
        { dishId: 3, quantity: 2, unitPriceCents: 300 },
      ],
    });

    await expect(refusee).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    expect(await stockDe(1)).toBe(3);
    expect(await prisma.order.count()).toBe(0);
  });

  it("six commandes en même temps pour la dernière portion : une seule passe", async () => {
    await prisma.dish.update({ where: { id: 1 }, data: { stock: 1 } });

    const results = await Promise.allSettled(Array.from({ length: 6 }, () => orders.create(commande(1, 1))));

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await stockDe(1)).toBe(0);
  });
});