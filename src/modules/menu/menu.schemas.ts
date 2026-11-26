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

//! Le type TypeScript créer à partir du schéma 
export type DishQuery = z.infer<typeof dishQuerySchema>;