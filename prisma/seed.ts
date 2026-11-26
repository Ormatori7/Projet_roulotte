import { readFileSync } from "node:fs";
import { prisma } from "../src/db/prisma.js";
import { hashPassword, type Role } from "../src/fourni/auth/index.js";

type Menu = {
  categories: { name: string; position: number }[];
  allergens: { code: string; label: string }[];
  dishes: {
    name: string;
    description: string;
    priceCents: number;
    category: string; // nom de la categorie
    allergens: string[]; // codes des allergenes
    available: boolean;
    stock: number | null; // utilise a partir du palier 2
  }[];
  users: { email: string; name: string; password: string; role: Role }[];
};

const menuPath = new URL("./menu.json", import.meta.url);
const menu: Menu = JSON.parse(readFileSync(menuPath, "utf-8"));

async function main() {
  // 1. Vider la base, les tables "enfants" d'abord (sinon les cles etrangeres bloquent)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.allergen.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Remet les compteurs d'id a zero (SQLite) : les ids repartent de 1 a chaque seed
  await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence");

  // 2. Categories et allergenes
  await prisma.category.createMany({ data: menu.categories });
  await prisma.allergen.createMany({ data: menu.allergens });

  // 3. Plats : relies a leur categorie (par son nom) et a leurs allergenes (par leur code)
  for (const dish of menu.dishes) {
    await prisma.dish.create({
      data: {
        name: dish.name,
        description: dish.description,
        priceCents: dish.priceCents,
        available: dish.available,
        stock: dish.stock,
        category: { connect: { name: dish.category } },
        allergens: { connect: dish.allergens.map((code) => ({ code })) },
      },
    });
  }

  // 4. Comptes de demonstration, mot de passe hache par le module fourni
  for (const user of menu.users) {
    await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: await hashPassword(user.password),
      },
    });
  }

  console.log(
    `Seed OK : ${menu.categories.length} categories, ${menu.allergens.length} allergenes, ` +
      `${menu.dishes.length} plats, ${menu.users.length} comptes`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
