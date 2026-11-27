// -  repository du menu : respecte l'interface, sans bdd
import type { Allergen, Category } from "../../src/generated/prisma/client.js";
import type {
  DishWithRelations,
  MenuRepository,
} from "../../src/modules/menu/menu.repository.js";

export const burgers: Category = { id: 1, name: "Burgers", position: 1 };
export const gluten: Allergen = { id: 1, code: "gluten", label: "Gluten" };

// . pour fabriquer un faux plat
export function plat(id: number, name: string): DishWithRelations {
  return {
    id,
    name,
    description: "",
    priceCents: 1000,
    available: true,
    stock: null,
    imageUrl: null,
    categoryId: burgers.id,
    category: burgers,
    allergens: [gluten],
  };
}

// . pour fabriquer un faux repository qui contient ces plats
export function fakeMenuRepository(
  dishes: DishWithRelations[] = [],
): MenuRepository {
  return {
    findCategories: async () => [burgers],
    findAllergens: async () => [gluten],
    findDishes: async () => ({ items: dishes, total: dishes.length }),
    findDishById: async (id) => dishes.find((d) => d.id === id) ?? null,
    findByIds: async (ids) => dishes.filter((d) => ids.includes(d.id)),
    // .Palier 2 : le faux repository répond simplement
    findDishByName: async (name) => dishes.find((d) => d.name === name) ?? null,
    categoryExists: async (id) => id === burgers.id,
    findAllergensByCodes: async (codes) =>
      codes.includes(gluten.code) ? [gluten] : [],
    isDishOrdered: async () => false,
    createDish: async () => plat(99, "Nouveau plat"),
    updateDish: async (id) => plat(id, "Plat modifié"),
    deleteDish: async () => {},
  };
}
