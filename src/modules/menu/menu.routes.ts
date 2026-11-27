// - Les adresses du menu : lecture publique, écriture réservée à l'admin

import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { MenuController } from "./menu.controller.js";

export function createMenuRouter(controller: MenuController, auth: Auth) {
  const router = Router();

  // Palier 1 : lecture, publique
  router.get("/categories", controller.listCategories);
  router.get("/allergens", controller.listAllergens);
  router.get("/dishes", controller.listDishes);
  router.get("/dishes/:id", controller.getDish);

  // Palier 2 : écriture, admin uniquement (sans token → 401, autre rôle → 403)
  const adminOnly = [auth.requireAuth, auth.requireRole("ADMIN")];
  router.post("/dishes", ...adminOnly, controller.createDish);
  router.patch("/dishes/:id", ...adminOnly, controller.updateDish);
  router.delete("/dishes/:id", ...adminOnly, controller.deleteDish);

  return router;
}
