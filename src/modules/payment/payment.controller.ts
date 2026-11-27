// Le controller du paiement : il valide l'entrée, appelle le service, met en forme la réponse
import type { Request, Response } from "express";
import { currentUser } from "../../fourni/auth/index";
import { toOrderDto } from "../orders/order.dto";
import { orderIdParamSchema } from "../orders/order.schemas";
import type { PaymentService } from "./payment.service";
import { payOrderSchema } from "./payment.schemas";

export class PaymentController {
    constructor(private readonly service: PaymentService) {}

    // POST /orders/:id/payment
    pay = async (req: Request, res: Response) => {
        const { id } = orderIdParamSchema.parse(req.params);
        const { token } = payOrderSchema.parse(req.body);
        const order = await this.service.pay(currentUser(req), id, token);
        res.json(toOrderDto(order));
    }
}
