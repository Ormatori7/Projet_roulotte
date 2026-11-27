// - but du fichier => chercher les catégories, les allergènes et les plats dans la base.

import type {
  Allergen,
  Category,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";

import type { CreateDishInput, UpdateDishInput } from "./menu.schemas.js";

// ! Un plat est toujours chargé avec sa catégorie et ses allergènes
const dishInclude = {
  category: true,
  allergens: true,
} satisfies Prisma.DishInclude;
export type DishWithRelations = Prisma.DishGetPayload<{
  include: typeof dishInclude;
}>;

// ! Les filtres possibles sur la carte
export type DishFilters = {
  category?: number;
  available?: boolean;
  q?: string;
  allergenFree?: string[];
  page: number;
  pageSize: number;
};

// ! L'interface : CE QUE le repository sait faire (sans dire comment)
export interface MenuRepository {
  findCategories(): Promise<Category[]>;
  findAllergens(): Promise<Allergen[]>;
  findDishes(
    filters: DishFilters,
  ): Promise<{ items: DishWithRelations[]; total: number }>;
  findDishById(id: number): Promise<DishWithRelations | null>;
  findByIds(ids: number[]): Promise<DishWithRelations[]>; // pour le service des commandes

  // Palier 2 : vérifications avant d'écrire
  findDishByName(name: string): Promise<DishWithRelations | null>;
  categoryExists(id: number): Promise<boolean>;
  findAllergensByCodes(codes: string[]): Promise<Allergen[]>;
  isDishOrdered(id: number): Promise<boolean>;

  // Palier 2 : écrire
  createDish(input: CreateDishInput): Promise<DishWithRelations>;
  updateDish(id: number, input: UpdateDishInput): Promise<DishWithRelations>;
  deleteDish(id: number): Promise<void>;
  // Palier 3 : photo du plat
  updateImageUrl(id: number, imageUrl: string): Promise<DishWithRelations>;
}

// ! L'implémentation Prisma : COMMENT il le fait
export class PrismaMenuRepository implements MenuRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findCategories() {
    return this.prisma.category.findMany({ orderBy: { position: "asc" } });
  }

  findAllergens() {
    return this.prisma.allergen.findMany({ orderBy: { code: "asc" } });
  }

  async findDishes(f: DishFilters) {
    //  Un filtre "undefined" est ignoré par Prisma
    const where: Prisma.DishWhereInput = {
      categoryId: f.category,
      available: f.available,
      name: f.q ? { contains: f.q } : undefined,
      allergens: f.allergenFree?.length
        ? { none: { code: { in: f.allergenFree } } }
        : undefined,
    };

    // La page demandée + le nombre total, en une seule fois
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dish.findMany({
        where,
        include: dishInclude,
        orderBy: [{ category: { position: "asc" } }, { name: "asc" }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
      this.prisma.dish.count({ where }),
    ]);
    return { items, total };
  }

  findDishById(id: number) {
    return this.prisma.dish.findUnique({ where: { id }, include: dishInclude });
  }

  findByIds(ids: number[]) {
    return this.prisma.dish.findMany({
      where: { id: { in: ids } },
      include: dishInclude,
    });
  }
  // ---------- Palier 2 : vérifications ----------

  findDishByName(name: string) {
    return this.prisma.dish.findUnique({
      where: { name },
      include: dishInclude,
    });
  }

  async categoryExists(id: number) {
    const count = await this.prisma.category.count({ where: { id } });
    return count > 0;
  }

  findAllergensByCodes(codes: string[]) {
    return this.prisma.allergen.findMany({ where: { code: { in: codes } } });
  }

  async isDishOrdered(id: number) {
    const count = await this.prisma.orderItem.count({ where: { dishId: id } });
    return count > 0;
  }

  // ---------- Palier 2 : écriture ----------

  createDish({ categoryId, allergens, ...rest }: CreateDishInput) {
    return this.prisma.dish.create({
      data: {
        ...rest, // name, description, priceCents, available, stock
        category: { connect: { id: categoryId } },
        allergens: { connect: allergens.map((code) => ({ code })) },
      },
      include: dishInclude,
    });
  }

  updateDish(id: number, { categoryId, allergens, ...rest }: UpdateDishInput) {
    return this.prisma.dish.update({
      where: { id },
      data: {
        ...rest, // seulement les champs envoyés
        category:
          categoryId !== undefined
            ? { connect: { id: categoryId } }
            : undefined,
        allergens: allergens
          ? { set: allergens.map((code) => ({ code })) }
          : undefined,
      },
      include: dishInclude,
    });
  }

  async deleteDish(id: number) {
    await this.prisma.dish.delete({ where: { id } });
  }
  // ---------- Palier 3 : photo ----------

  updateImageUrl(id: number, imageUrl: string) {
    return this.prisma.dish.update({
      where: { id },
      data: { imageUrl },
      include: dishInclude,
    });
  }
}
