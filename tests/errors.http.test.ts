import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/test-app.js";

describe("Gestion des erreurs", () => {
  const { app } = createTestApp();

  it("route inconnue → 404 NOT_FOUND au format du contrat", async () => {
    const res = await request(app).get("/nimporte-quoi");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
  });

  it("JSON mal forme → 400 INVALID_JSON", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("erreur de validation → 400 avec le chemin du champ fautif dans details", async () => {
    const res = await request(app).get("/dishes?page=0");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([{ path: "page", message: expect.any(String) }]);
  });

  it("aucune reponse ne contient de mot de passe ni de hash", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "nouveau@test.fr", name: "Nouveau", password: "MotDePasse123!" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(Number), email: "nouveau@test.fr", name: "Nouveau", role: "CUSTOMER" });
  });
});