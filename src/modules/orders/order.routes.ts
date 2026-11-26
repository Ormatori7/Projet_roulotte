// Les routes des commandes et leur protection
import { Router } from "express";
import type { Auth } from "../../fourni/auth/index";
import type { OrderController } from "./order.controller";

export function createOrderRouter(controller: OrderController, auth: Auth) {
    const router = Router();

    // Toutes les routes /orders exigent d'être connecté
    router.use(auth.requireAuth);

    router.post("/", controller.place);
    router.get("/", controller.list);
    router.get("/:id", controller.getOne);
    router.get("/:id/status", controller.changeStatus);

    return router;
}
