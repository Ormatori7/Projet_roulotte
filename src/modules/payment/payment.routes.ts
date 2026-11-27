import { Router } from "express";
import type { Auth } from "../../fourni/auth/index";
import type { PaymentController } from "./payment.controller";

export function createPaymentRouter(controller: PaymentController, auth: Auth) {
    const router = Router();

    router.post("/orders/:id/payment", auth.requireAuth, controller.pay);

    return router;
}
