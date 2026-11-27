// Un faux prestataire : aucune requête réseau. Sert aux tests et au développement
// quand le simulateur n'est pas lancé. Il respecte la même interface que le vrai.
import { AppError } from "../../shared/errors";
import type { ChargeRequest, PaymentGateway } from "./payment.gateway";

export class FakePaymentGateway implements PaymentGateway {
    // Les paiements demandés, pour que les tests puissent vérifier ce qui a été envoyé
    readonly charges: ChargeRequest[] = [];

    async charge(request: ChargeRequest): Promise<void> {
        this.charges.push(request);
        if(request.token === "tok_declined") {
            throw new AppError(402, "PAYMENT_DECLINED", "Paiement refusé");
        }
    }
} 
