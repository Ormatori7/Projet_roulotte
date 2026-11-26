// Le controller fait le lient HTTP <-> service : il valide l'entrée
// appelle le service et met en forme la réponse. Aucune règle métier ici.
import type { Request, Response } from "express";
import { currentUser } from "../../fourni/auth/index";
import { toOrderDto } from "./order.dto";
import { createOrderSchema, listOrdersQuerySchema, orderIdParamSchema, updateStatusSchema } from "./order.schemas"; 
import type { OrderService } from "./order.service";

export class OrderController {
    constructor(private readonly service: OrderService) {}

    // POST /orders
    place = async (req: Request, res: Response) => {
        const input = createOrderSchema.parse(req.body);
        const order = await this.service.place(currentUser(req), input);
        res.status(201).location(`/orders/${order.id}`).json(toOrderDto(order));
    };

    // GET /orders
    list = async (req: Request, res: Response) => {
        const query = listOrdersQuerySchema.parse(req.query);
        const page = await this.service.listFor(currentUser(req), query);
        res.json({ ...page, items: page.items.map(toOrderDto)});
    }

    // GET /orders/:id
    getOne = async (req: Request, res: Response) => {
        const { id } = orderIdParamSchema.parse(req.params);
        const order = await this.service.getFor(currentUser(req), id);
        res.json(toOrderDto(order));
    }

    // PATCH /orders/:id/status
    changeStatus = async (req: Request, res: Response) => {
        const { id } = orderIdParamSchema.parse(req.params);
        const { status } = updateStatusSchema.parse(req.body);
        const order = await this.service.changeStatus(currentUser(req), id, status);
        res.json(toOrderDto(order));
    }
}
