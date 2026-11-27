// - but du fichier => définir règles métiers du menu
// => renvoyer catégories/allérgenes/ plat au format demandé (json)
// => rep 404 si plat n'éxiste pas

import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../../shared/errors.js";
import { DiskImageStorage, type ImageStorage } from "./image.storage.js";
import { toAllergenDto, toCategoryDto, toDishDto } from "./menu.dto.js";
import type { MenuRepository } from "./menu.repository.js";
import type {
  CreateDishInput,
  DishQuery,
  UpdateDishInput,
} from "./menu.schemas.js";

//! Types d'image acceptés (type réel → extension du fichier)
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export class MenuService {
  // on reçoit le repository (vrai ou faux) de l'extérieur
  constructor(
    private readonly menu: MenuRepository,
    private readonly images: ImageStorage = new DiskImageStorage(),
  ) {}

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

  // ---------- Palier 2 : administration de la carte ----------

  // créer un plat : nom libre (sinon 409), catégorie et allergènes connus (sinon 422)
  async createDish(input: CreateDishInput) {
    await this.checkNameIsFree(input.name);
    await this.checkReferences(input.categoryId, input.allergens);
    const dish = await this.menu.createDish(input);
    return toDishDto(dish);
  }

  // modifier un plat : il doit exister (sinon 404), puis mêmes règles que la création
  async updateDish(id: number, input: UpdateDishInput) {
    await this.getDish(id);
    if (input.name !== undefined) {
      await this.checkNameIsFree(input.name, id);
    }
    await this.checkReferences(input.categoryId, input.allergens);
    const dish = await this.menu.updateDish(id, input);
    return toDishDto(dish);
  }

  // supprimer un plat : il doit exister (404) et ne jamais avoir été commandé (409)
  async deleteDish(id: number) {
    await this.getDish(id);
    if (await this.menu.isDishOrdered(id)) {
      throw new AppError(
        409,
        "CONFLICT",
        "Plat déjà commandé : rendez-le plutôt indisponible",
      );
    }
    await this.menu.deleteDish(id);
  }

  // ---------- Palier 3 : photo ----------

  // nouvelle photo : plat existant (404), vrai PNG/JPEG/WebP (415), l'ancienne est supprimée
  async setDishImage(id: number, buffer: Buffer) {
    const dish = await this.menu.findDishById(id);
    if (!dish) {
      throw new AppError(404, "NOT_FOUND", "Plat introuvable");
    }

    const type = await fileTypeFromBuffer(buffer); // lit les premiers octets
    const extension = type ? ALLOWED_IMAGE_TYPES[type.mime] : undefined;
    if (!extension) {
      throw new AppError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "L'image doit être un PNG, un JPEG ou un WebP",
      );
    }

    const imageUrl = await this.images.save(buffer, extension);
    const updated = await this.menu.updateImageUrl(id, imageUrl);
    if (dish.imageUrl) {
      await this.images.remove(dish.imageUrl);
    }
    return toDishDto(updated);
  }

  // ---------- vérifications réutilisées ----------

  // 409 si un AUTRE plat porte déjà ce nom
  private async checkNameIsFree(name: string, currentId?: number) {
    const existing = await this.menu.findDishByName(name);
    if (existing && existing.id !== currentId) {
      throw new AppError(409, "CONFLICT", "Ce nom de plat est déjà pris");
    }
  }

  // 422 si la catégorie ou un code allergène n'existe pas
  private async checkReferences(categoryId?: number, allergens?: string[]) {
    if (
      categoryId !== undefined &&
      !(await this.menu.categoryExists(categoryId))
    ) {
      throw new AppError(422, "INVALID_REFERENCE", "Catégorie inconnue", [
        { field: "categoryId", value: categoryId },
      ]);
    }
    if (allergens && allergens.length > 0) {
      const found = await this.menu.findAllergensByCodes(allergens);
      const foundCodes = found.map((a) => a.code);
      const unknown = allergens.filter((code) => !foundCodes.includes(code));
      if (unknown.length > 0) {
        throw new AppError(422, "INVALID_REFERENCE", "Allergène inconnu", [
          { field: "allergens", value: unknown },
        ]);
      }
    }
  }
}
