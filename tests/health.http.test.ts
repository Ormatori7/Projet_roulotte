// Health vérifie la base, et chaque réponse porte un X-Request-Id
import request from "supertest"
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/test-app";

describe("GET /health", () => {
    it("base joignable -> 200 { status : ok, database: up }", async () => {
        const { app } = createTestApp();

        const res = await request(app).get("/health");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok", database: "up" });
    });

    it("base injoignable -> 503 { status : degraded, database: down }", async () => {
        const { app } = createTestApp({ databaseUp: false });

        const res = await request(app).get("/health");

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: "degraded", database: "down"})
    });
});

describe("En-tête X-Request-Id", () => {
    it("est présent sur une réponse normale et sur une erreur", async () => {
        const { app } = createTestApp();
        
        const ok = await request(app).get("/health");
        const notFound = await request(app).get("/n'import-quoi");

        expect(ok.headers["x-request-id"]).toEqual(expect.any(String));
        expect(notFound.headers["x-request-id"]).toEqual(expect.any(String));
    });

    it("est différent à chaque requête", async () => {
        const { app } = createTestApp();

        const first = await request(app).get("/health");
        const second = await request(app).get("/health");

        expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
    })
})
