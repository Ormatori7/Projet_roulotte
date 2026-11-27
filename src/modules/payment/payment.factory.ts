// Factory : l'unique endroit qui choisit QUEL prestataire de paiement fabriquer.
// Le reste de l'application reçoit un PaymentGateway sans savoir lequel.
import type { Config } from "../../config/env.js";
import { FakePaymentGateway } from "./fake-payment.gateway.js";
import { HttpPaymentGateway } from "./http-payment.gateway.js";
import type { PaymentGateway } from "./payment.gateway.js";

export function createPaymentGateway(config: Config): PaymentGateway {
  if (config.PAYMENT_PROVIDER === "fake") {
    return new FakePaymentGateway();
  }
  return new HttpPaymentGateway({ url: config.PAYMENT_URL, apiKey: config.PAYMENT_API_KEY });
}
