// Les règles du paiement. Ni req, ni res, ni Prisma, ni HTTP ici
// le service ne connaît que deux interfaces OrderRepository et PaymentGateway
import type { AuthUser } from "../../fourni/auth/index";
import { AppError } from "../../shared/errors";
import { EventBus } from "../../shared/event-bus";
import type { OrderRepository } from "../orders/order.repository";
import type { OrderRecord } from "../orders/order.types"; 
import type { PaymentGateway } from "./payment.gateway";

export class PaymentService {
    constructor(
        private readonly orders: OrderRepository,
        private readonly gateway: PaymentGateway,
        private readonly events: EventBus = new EventBus(),
    ) {}

    async pay(user: AuthUser, orderId: number, token: string): Promise<OrderRecord> {
        // Seul un client paie: la cuisine et l'admin sont refusé
        if (user.role !== "CUSTOMER") {
            throw new AppError(403, "FORBIDDEN", "Seul le client peut payer sa commande");
        }

        // 401 si la commande n'existe pas OU appartient à un autre client (on ne révèle rien)
        const order = await this.orders.findById(orderId);
        if(!order || order.userId !== user.id) {
            throw new AppError(404, "NOT_FOUND", "Commande introuvable");
        }

        // Ces deux refus arrivent AVANT l'appel au prestataire : personne n'est débité
        if (order.paymentStatus === "PAID") {
            throw new AppError(409, "CONFLICT", "Cette commande est déjà payée");
        }
        if (order.status === "CANCELLED") {
            throw new AppError(409, "CONFLICT", "Une commande annulée ne peut pas être payée");
        }

        // Le montant vient de la base, jamais du client. Si le prestataire reuse, charge() lève une erreur et la commande rest UNPAID
        await this.gateway.charge({ orderId: order.id, amountCents: order.totalCents, token });

        // null: la commande a été payée ou annulée pendant qu'on appelait le prestataire
        const paid = await this.orders.markPaid(order.id);
        if (!paid) {
            throw new AppError(409, "CONFLICT", "L'état de la commande vient de changer");
        }

        this.events.emit("order.updated", paid);
        return paid;
    }
}
