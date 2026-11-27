// - but du fichier => vérifier et convertir ce qui arrive dans l'URL

// ! zod =>  librairie JS/TS qui sert à vérifier que des données ont la bonne forme
import { z } from "zod";

//! /dishes/:id => l'id doit être un entier positif (sinon error 400)
//! dishes/:id → id = nombre entier > 0
export const dishIdParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
});

//! dishes?... → les filtres de la carte
export const dishQuerySchema = z.strictObject({
  // numéro de catégorie : "3" → 3
  category: z.coerce.number().int().positive().optional(),

  // "true" / "false" (texte) → true / false (booléen)
  available: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),

  // "gluten,lait" → ["gluten", "lait"]
  allergenFree: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    )
    .optional(),

  // recherche par nom ( max 50 char)
  q: z.string().trim().max(50).optional(),

  // page 1 et 20 plats par défaut, 50 max
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

//! Les champs d'un plat (sans valeurs par défaut), règles du contrat DishInput
const dishFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().max(300),
  priceCents: z.number().int().min(50).max(10000),
  categoryId: z.number().int().positive(),
  allergens: z.array(z.string()), // codes : ["gluten", "lait"]
  available: z.boolean(),
  stock: z.number().int().min(0).nullable(), // null = illimité
};

//! POST /dishes → name, priceCents, categoryId obligatoires, le reste a une valeur par défaut
export const createDishSchema = z.strictObject({
  ...dishFields,
  description: dishFields.description.default(""),
  allergens: dishFields.allergens.default([]),
  available: dishFields.available.default(true),
  stock: dishFields.stock.default(null),
});

//! PATCH /dishes/:id → tout est optionnel, mais au moins un champ
export const updateDishSchema = z
  .strictObject(dishFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ à modifier",
  });

//! Les types TypeScript créer à partir du schéma
export type DishQuery = z.infer<typeof dishQuerySchema>;
export type CreateDishInput = z.infer<typeof createDishSchema>;
export type UpdateDishInput = z.infer<typeof updateDishSchema>;
