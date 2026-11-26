// - but du fichier => chercher les catégories, les allergènes et les plats dans la base.

import type {
  Allergen,
  Category,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";

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
}
