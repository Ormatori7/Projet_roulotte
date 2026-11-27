//- Lien entre HTTP (req/res) et le service

import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors.js";
import {
  createDishSchema,
  dishIdParamsSchema,
  dishQuerySchema,
  updateDishSchema,
} from "./menu.schemas.js";
import type { MenuService } from "./menu.service.js";

export class MenuController {
  // ! on reçoit le service de l'extérieur
  constructor(private readonly service: MenuService) {}

  // ! GET /categories
  listCategories: RequestHandler = async (_req, res) => {
    res.json(await this.service.listCategories());
  };

  // ! GET /allergens
  listAllergens: RequestHandler = async (_req, res) => {
    res.json(await this.service.listAllergens());
  };

  // ! GET /dishes?...
  listDishes: RequestHandler = async (req, res) => {
    const query = dishQuerySchema.parse(req.query); // invalide → 400
    res.json(await this.service.listDishes(query));
  };

  //! GET /dishes/:id
  getDish: RequestHandler = async (req, res) => {
    const { id } = dishIdParamsSchema.parse(req.params); // invalide → 400
    res.json(await this.service.getDish(id)); // introuvable → 404
  };

  // ---------- Palier 2 : admin ----------

  //! POST /dishes → 201 + Location + le plat créé
  createDish: RequestHandler = async (req, res) => {
    const input = createDishSchema.parse(req.body); // invalide → 400
    const dish = await this.service.createDish(input); // 409 / 422
    res.status(201).location(`/dishes/${dish.id}`).json(dish);
  };

  //! PATCH /dishes/:id → 200 + le plat modifié
  updateDish: RequestHandler = async (req, res) => {
    const { id } = dishIdParamsSchema.parse(req.params);
    const input = updateDishSchema.parse(req.body); // vide ou champ inconnu → 400
    res.json(await this.service.updateDish(id, input)); // 404 / 409 / 422
  };

  //! DELETE /dishes/:id → 204 (pas de corps)
  deleteDish: RequestHandler = async (req, res) => {
    const { id } = dishIdParamsSchema.parse(req.params);
    await this.service.deleteDish(id); // 404 / 409
    res.status(204).end();
  };

  // ---------- Palier 3 : photo ----------

  //! PUT /dishes/:id/image → 200 + le plat avec sa nouvelle imageUrl
  setDishImage: RequestHandler = async (req, res) => {
    const { id } = dishIdParamsSchema.parse(req.params);
    if (!req.file) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Le fichier image est obligatoire",
      );
    }
    res.json(await this.service.setDishImage(id, req.file.buffer)); // 404 / 415
  };
}
