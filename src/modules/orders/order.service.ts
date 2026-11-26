// Les règles métier des commandes. Ni req, ni res, ni Prisma ici :
// le service ne connaît que les interfaces des repositories.
import type { AuthUser } from "../../fourni/auth/index";
import { AppError } from "../../shared/errors";
import type { DishRepository } from "../menu/dish.repository";
import type { OrderRepository } from "./order.repository";
import type { CreateOrderInput, ListOrdersQuery } from "./order.schemas";
import type { OrderRecord } from "./order.types";

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly dishes: DishRepository,
  ) {}

  // Passer une commande : les prix viennent de la base, jamais du client
  async place(user: AuthUser, input: CreateOrderInput): Promise<OrderRecord> {
    const ids = input.items.map((item) => item.dishId);
    const found = await this.dishes.findByIds(ids);
    const dishById = new Map(found.map((dish) => [dish.id, dish]));

    // On vérifie TOUS les plats avant de refuser, pour lister tous les problèmes d'un coup
    const refused: { dishId: number; reason: "NOT_FOUND" | "UNAVAILABLE" }[] = [];
    const lines: { dishId: number; quantity: number; unitPriceCents: number }[] = [];

    for (const item of input.items) {
      const dish = dishById.get(item.dishId);
      if (!dish) {
        refused.push({ dishId: item.dishId, reason: "NOT_FOUND" });
      } else if (!dish.available) {
        refused.push({ dishId: item.dishId, reason: "UNAVAILABLE" });
      } else {
        // unitPriceCents fige le prix du jour
        lines.push({ dishId: dish.id, quantity: item.quantity, unitPriceCents: dish.priceCents });
      }
    }

    if (refused.length > 0) {
      throw new AppError(422, "DISH_UNAVAILABLE", "Certains plats ne peuvent pas être commandés", refused);
    }

    const totalCents = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);

    return this.orders.create({
      userId: user.id,
      note: input.note ?? null,
      totalCents,
      items: lines,
    });
  }

  // Une commande : la sienne pour un client, n'importe laquelle pour la cuisine et l'admin
  async getFor(user: AuthUser, id: number): Promise<OrderRecord> {
    const order = await this.orders.findById(id);

    // 404 dans les deux cas : on ne révèle pas qu'une commande d'un autre client existe
    if (!order || (user.role === "CUSTOMER" && order.userId !== user.id)) {
      throw new AppError(404, "NOT_FOUND", "Commande introuvable");
    }
    return order;
  }

  // La liste : un client ne voit que SES commandes
  async listFor(user: AuthUser, query: ListOrdersQuery) {
    const { items, total } = await this.orders.list({
      userId: user.role === "CUSTOMER" ? user.id : undefined,
      statuses: query.status,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
