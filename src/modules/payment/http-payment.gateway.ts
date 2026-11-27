import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors.js";
import type { ChargeRequest, PaymentGateway } from "./payment.gateway.js";

export type HttpPaymentGatewayOptions = {
  url: string;
  apiKey: string;
  timeoutMs?: number; // durée maximale d'UNE tentative
  maxAttempts?: number; // nombre de tentatives au total
  fetchFn?: typeof fetch; // remplaçable dans les tests
};

// Ce qu'une tentative peut donner
type AttemptResult = "paid" | "declined" | "rejected" | "error" | "timeout";

export class HttpPaymentGateway implements PaymentGateway {
  private readonly url: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: HttpPaymentGatewayOptions) {
    this.url = options.url.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async charge(request: ChargeRequest): Promise<void> {
    // UNE par tentative de paiement si le prestataire a déjà
    // débité mais que sa réponse s'est perdue, il rejoue la réponse sans débiter deux fois.
    const idempotencyKey = randomUUID();
    let last: AttemptResult = "error";

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      last = await this.attempt(request, idempotencyKey);

      if (last === "paid") return;
      // Un refus de la banque est une vraie réponse : réessayer ne changerait rien
      if (last === "declined") {
        throw new AppError(402, "PAYMENT_DECLINED", "Paiement refusé");
      }
      // Notre requête est mal formée ou notre clé est fausse : inutile de réessayer
      if (last === "rejected") break;
      // "error" ou "timeout" : on retente
    }

    if (last === "timeout") {
      throw new AppError(504, "PAYMENT_PROVIDER_TIMEOUT", "Le prestataire de paiement ne répond pas");
    }
    throw new AppError(502, "PAYMENT_PROVIDER_ERROR", "Le prestataire de paiement est indisponible");
  }

  // Une tentative : un appel HTTP coupé au bout de timeoutMs
  private async attempt(request: ChargeRequest, idempotencyKey: string): Promise<AttemptResult> {
    try {
      const response = await this.fetchFn(`${this.url}/v1/charges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amountCents: request.amountCents,
          currency: "EUR",
          reference: `order-${request.orderId}`,
          token: request.token,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.status === 201) return "paid";
      if (response.status === 402) return "declined";
      if (response.status >= 500) return "error";
      return "rejected"; // 400, 401, 422...
    } catch (error) {
      // AbortSignal.timeout lève une erreur nommée "TimeoutError"
      if (error instanceof Error && error.name === "TimeoutError") return "timeout";
      return "error"; // prestataire injoignable, connexion coupée...
    }
  }
}