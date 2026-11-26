// - but du fichier => transformer les données de la base au format json

import type { Allergen, Category } from "../../generated/prisma/client.js";
import type { DishWithRelations } from "./menu.repository.js";

//! Catégorie => { id, name, position }
export function toCategoryDto(c: Category) {
  return { id: c.id, name: c.name, position: c.position };
}

//! Allergène => { id, code, label }
export function toAllergenDto(a: Allergen) {
  return { id: a.id, code: a.code, label: a.label };
}

//! Plat => au format Dish du contrat
export function toDishDto(d: DishWithRelations) {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    priceCents: d.priceCents,
    available: d.available,
    category: { id: d.category.id, name: d.category.name }, // pas de categoryId
    allergens: d.allergens.map((a) => ({ code: a.code, label: a.label })), // pas d'id
  };
}