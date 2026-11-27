// Le middleware de log écrit une ligne par requête, avec l'identifiant de la requête.
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../src/shared/logger.js";
import { createTestApp } from "./helpers/test-app.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Logs des requêtes", () => {
  it("journalise la méthode, l'adresse, le statut et le même identifiant que l'en-tête", async () => {
    const info = vi.spyOn(logger, "info");
    const { app } = createTestApp();

    const res = await request(app).get("/health");

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: res.headers["x-request-id"],
        method: "GET",
        url: "/health",
        status: 200,
      }),
      expect.any(String),
    );
  });
});
