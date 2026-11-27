// Le contrat du prestataire de paiement, vu depuis notre application
// Le service ne connait que cette interface : il ignore si derrière il y a 
// le vrai prestatraire (HTTP) ou un faux (tests)

export type ChargeRequest = {
    orderId: number;
    amountCents: number;
    token: string; // le jeton de carte envoyé par le front (tok_visa, ...)
}

export interface PaymentGateway {
    // Débite le client. Ne revnoei rien si le paiement est accepté
    // Lève une AppError sinon : 402 PAYMENT_DECLINED, 502 PAYMENT_PROVIDER_TIMEOUT
    charge(request: ChargeRequest): Promise<void>;
}
