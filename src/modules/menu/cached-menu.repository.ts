// Cache de la carte (pattern Decorator) : même interface que MenuRepository,
// enveloppe le vrai repository et lui ajoute une mémoire, sans le modifier.
import type { CreateDishInput, UpdateDishInput } from "./menu.schemas.js";
import type { DishFilters, MenuRepository } from "./menu.repository.js";

export class CachedMenuRepository implements MenuRepository {
  private readonly cache = new Map<string, unknown>();

  // inner : le repository enveloppé (en pratique, celui de Prisma)
  constructor(private readonly inner: MenuRepository) {}

  // Renvoie la valeur en mémoire si elle existe, sinon la charge et la retient
  private async remember<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }
    const value = await load();
    this.cache.set(key, value);
    return value;
  }

  // Vide tout le cache : appelé dès que la carte ou un stock change
  invalidate(): void {
    this.cache.clear();
  }

  // --- Lectures de la carte : mises en cache ---

  findCategories() {
    return this.remember("categories", () => this.inner.findCategories());
  }

  findAllergens() {
    return this.remember("allergens", () => this.inner.findAllergens());
  }

  // Une entrée par combinaison de filtres (catégorie, page, recherche...)
  findDishes(filters: DishFilters) {
    return this.remember(`dishes:${JSON.stringify(filters)}`, () => this.inner.findDishes(filters));
  }

  findDishById(id: number) {
    return this.remember(`dish:${id}`, () => this.inner.findDishById(id));
  }

  // --- Vérifications avant écriture : jamais en cache, il faut la valeur exacte ---

  findByIds(ids: number[]) {
    return this.inner.findByIds(ids);
  }

  findDishByName(name: string) {
    return this.inner.findDishByName(name);
  }

  categoryExists(id: number) {
    return this.inner.categoryExists(id);
  }

  findAllergensByCodes(codes: string[]) {
    return this.inner.findAllergensByCodes(codes);
  }

  isDishOrdered(id: number) {
    return this.inner.isDishOrdered(id);
  }

  // --- Écritures : on délègue, puis on vide le cache ---

  async createDish(input: CreateDishInput) {
    const dish = await this.inner.createDish(input);
    this.invalidate();
    return dish;
  }

  async updateDish(id: number, input: UpdateDishInput) {
    const dish = await this.inner.updateDish(id, input);
    this.invalidate();
    return dish;
  }

  async deleteDish(id: number) {
    await this.inner.deleteDish(id);
    this.invalidate();
  }
}
