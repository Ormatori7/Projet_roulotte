// - but du fichier => définir règles métiers du menu
// => renvoyer catégories/allérgenes/ plat au format demandé (json)
// => rep 404 si plat n'éxiste pas

import { AppError } from "../../shared/errors.js";
import { toAllergenDto, toCategoryDto, toDishDto } from "./menu.dto.js";
import type { MenuRepository } from "./menu.repository.js";
import type { DishQuery } from "./menu.schemas.js";

export class MenuService {
  // on reçoit le repository (vrai ou faux) de l'extérieur
  constructor(private readonly menu: MenuRepository) {}

  // toutes les catégories
  async listCategories() {
    const categories = await this.menu.findCategories();
    return categories.map(toCategoryDto);
  }

  // tous les allergènes
  async listAllergens() {
    const allergens = await this.menu.findAllergens();
    return allergens.map(toAllergenDto);
  }

  // une page de plats
  async listDishes(query: DishQuery) {
    const { items, total } = await this.menu.findDishes(query);
    return {
      items: items.map(toDishDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // un plat, ou 404
  async getDish(id: number) {
    const dish = await this.menu.findDishById(id);
    if (!dish) {
      throw new AppError(404, "NOT_FOUND", "Plat introuvable");
    }
    return toDishDto(dish);
  }
}