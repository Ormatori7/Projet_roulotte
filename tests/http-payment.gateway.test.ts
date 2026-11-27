import { describe, expect, it, vi } from "vitest";
import { HttpPaymentGateway } from "../src/modules/payment/http-payment.gateway.js";

const demande = { orderId: 12, amountCents: 1850, token: "tok_visa" };

// Fabrique un adaptateur branché sur un faux fetch (délai très court pour des tests rapides)
function adaptateur(fetchFn: typeof fetch) {
  return new HttpPaymentGateway({ url: "http://prestataire.test", apiKey: "sk_test", timeoutMs: 50, fetchFn });
}

const reponse = (status: number) => new Response("{}", { status });

// Un fetch qui s'arrête seulement quand le délai le coupe
const fetchTropLent = vi.fn(
  (_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }),
);

describe("HttpPaymentGateway", () => {
  it("envoie la requête attendue par le prestataire", async () => {
    const fetchFn = vi.fn(async () => reponse(201));

    await adaptateur(fetchFn).charge(demande);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("http://prestataire.test/v1/charges");
    expect(init.method).toBe("POST");
    expect(headers.Authorization).toBe("Bearer sk_test");
    expect(headers["Idempotency-Key"]).toBeTruthy();
    expect(JSON.parse(init.body as string)).toEqual({
      amountCents: 1850,
      currency: "EUR",
      reference: "order-12",
      token: "tok_visa",
    });
  });

  it("402 → PAYMENT_DECLINED, une seule tentative", async () => {
    const fetchFn = vi.fn(async () => reponse(402));

    await expect(adaptateur(fetchFn).charge(demande)).rejects.toMatchObject({ status: 402, code: "PAYMENT_DECLINED" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("503 puis 201 → payé à la 2e tentative, avec la MÊME Idempotency-Key", async () => {
    const fetchFn = vi.fn(async () => reponse(201)).mockResolvedValueOnce(reponse(503));

    await adaptateur(fetchFn).charge(demande);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const cles = fetchFn.mock.calls.map((call) => {
      const init = (call as unknown as [string, RequestInit])[1];
      return (init.headers as Record<string, string>)["Idempotency-Key"];
    });
    expect(cles[0]).toBe(cles[1]);
  });

  it("500 à chaque fois → PAYMENT_PROVIDER_ERROR après 3 tentatives", async () => {
    const fetchFn = vi.fn(async () => reponse(500));

    await expect(adaptateur(fetchFn).charge(demande)).rejects.toMatchObject({
      status: 502,
      code: "PAYMENT_PROVIDER_ERROR",
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("aucune réponse dans le délai → PAYMENT_PROVIDER_TIMEOUT après 3 tentatives", async () => {
    fetchTropLent.mockClear();

    await expect(adaptateur(fetchTropLent as unknown as typeof fetch).charge(demande)).rejects.toMatchObject({
      status: 504,
      code: "PAYMENT_PROVIDER_TIMEOUT",
    });
    expect(fetchTropLent).toHaveBeenCalledTimes(3);
  });

  it("prestataire injoignable → PAYMENT_PROVIDER_ERROR", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(adaptateur(fetchFn as unknown as typeof fetch).charge(demande)).rejects.toMatchObject({ status: 502 });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("deux paiements différents n'utilisent pas la même Idempotency-Key", async () => {
    const fetchFn = vi.fn(async () => reponse(201));
    const gateway = adaptateur(fetchFn);

    await gateway.charge(demande);
    await gateway.charge(demande);

    const cles = fetchFn.mock.calls.map((call) => {
      const init = (call as unknown as [string, RequestInit])[1];
      return (init.headers as Record<string, string>)["Idempotency-Key"];
    });
    expect(cles[0]).not.toBe(cles[1]);
  });
});