//- Lien entre HTTP (req/res) et le service

import type { RequestHandler } from "express";
import { dishIdParamsSchema, dishQuerySchema } from "./menu.schemas.js";
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
}
