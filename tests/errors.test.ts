import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { AppError, errorHandler, notFoundHandler } from "../src/shared/errors"

// sert a simuler toutes les erreurs possibles
function createTestApp() {
  const app = express();
  app.use(express.json());

  app.get("/metier", (_req, _res, next) => {
    next(new AppError(422, "DISH_UNAVAILABLE", "Plat indisponible", [{ dishId: 1 }]));
  });

  // Route de test qui déclenche une ZodError
  app.post("/zod", (req, res, next) => {
    const schema = z.object({ quantity: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    res.status(200).json({ ok: true });
  });

  // Route de test qui déclenche une erreur inattendue (500)
  app.get("/crash", () => {
    throw new Error("Bug imprévu");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe("Gestion des erreurs", () => {
  it("retourne 404 NOT_FOUND sur une route inexistante", async () => {
    const app = createTestApp();
    const res = await request(app).get("/route-qui-nexiste-pas");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Ressource introuvable",
      },
    });
  });

  it("retourne une AppError avec son statut, son code et ses details", async () => {
    const app = createTestApp();
    const res = await request(app).get("/metier");

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: "DISH_UNAVAILABLE",
        message: "Plat indisponible",
        details: [{ dishId: 1 }],
      },
    });
  });

  it("retourne 400 VALIDATION_ERROR sur une ZodError", async () => {
    const app = createTestApp();
    const res = await request(app).post("/zod").send({ quantity: -2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { path: "quantity", message: expect.any(String) },
    ]);
  });

  it("retourne 500 INTERNAL_ERROR sans fuite technique sur une erreur inconnue", async () => {
    const app = createTestApp();
    const res = await request(app).get("/crash");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Erreur interne",
      },
    });
  });
});