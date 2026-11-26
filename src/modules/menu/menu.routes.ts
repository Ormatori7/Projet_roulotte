// - Les adresses du menu (toutes publiques)

import { Router } from "express";
import type { MenuController } from "./menu.controller.js";

export function createMenuRouter(controller: MenuController) {
  const router = Router();

  router.get("/categories", controller.listCategories);
  router.get("/allergens", controller.listAllergens);
  router.get("/dishes", controller.listDishes);
  router.get("/dishes/:id", controller.getDish);

  return router;
}
