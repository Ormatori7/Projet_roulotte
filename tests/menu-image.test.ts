//- Tests de l'upload des photos (palier 3) : service avec faux stockage + routes HTTP
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { ImageStorage } from "../src/modules/menu/image.storage.js";
import { MenuService } from "../src/modules/menu/menu.service.js";
import { fakeMenuRepository, plat } from "./helpers/fake-menu.js";
import { createTestApp } from "./helpers/test-app.js";

// . un vrai PNG de 1 pixel, et un fichier texte déguisé
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const FAUX_PNG = Buffer.from("je ne suis pas une image");

// . faux stockage : n'écrit rien sur le disque, garde la trace des appels
function fauxStockage() {
  const saved: string[] = [];
  const removed: string[] = [];
  const storage: ImageStorage = {
    save: async (_buffer, extension) => {
      const url = `/uploads/dishes/nouvelle.${extension}`;
      saved.push(url);
      return url;
    },
    remove: async (url) => {
      removed.push(url);
    },
  };
  return { storage, saved, removed };
}

describe("MenuService.setDishImage", () => {
  it("enregistre un vrai PNG et renvoie la nouvelle imageUrl", async () => {
    const { storage, saved } = fauxStockage();
    const service = new MenuService(fakeMenuRepository([plat(1, "Brownie")]), storage);

    const dish = await service.setDishImage(1, PNG);

    expect(dish.imageUrl).toBe("/uploads/dishes/nouvelle.png");
    expect(saved).toHaveLength(1);
  });

  it("supprime l'ancienne photo quand on en envoie une nouvelle", async () => {
    const { storage, removed } = fauxStockage();
    const avecPhoto = { ...plat(1, "Brownie"), imageUrl: "/uploads/dishes/ancienne.png" };
    const service = new MenuService(fakeMenuRepository([avecPhoto]), storage);

    await service.setDishImage(1, PNG);

    expect(removed).toEqual(["/uploads/dishes/ancienne.png"]);
  });

  it("refuse un fichier qui n'est pas une image → 415, rien n'est enregistré", async () => {
    const { storage, saved } = fauxStockage();
    const service = new MenuService(fakeMenuRepository([plat(1, "Brownie")]), storage);

    await expect(service.setDishImage(1, FAUX_PNG)).rejects.toMatchObject({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    expect(saved).toHaveLength(0);
  });

  it("plat inexistant → 404 NOT_FOUND", async () => {
    const { storage } = fauxStockage();
    const service = new MenuService(fakeMenuRepository([]), storage);

    await expect(service.setDishImage(999, PNG)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});

describe("PUT /dishes/:id/image", () => {
  const { app, tokenFor } = createTestApp();
  let admin = "";
  let client = "";

  beforeAll(async () => {
    admin = await tokenFor("admin-image@test.fr", "ADMIN");
    client = await tokenFor("client-image@test.fr");
  });

  it("sans token → 401", async () => {
    const res = await request(app).put("/dishes/1/image").attach("image", PNG, "a.png");

    expect(res.status).toBe(401);
  });

  it("avec un compte client → 403", async () => {
    const res = await request(app)
      .put("/dishes/1/image")
      .set("Authorization", `Bearer ${client}`)
      .attach("image", PNG, "a.png");

    expect(res.status).toBe(403);
  });

  it("sans fichier → 400 VALIDATION_ERROR", async () => {
    const res = await request(app).put("/dishes/1/image").set("Authorization", `Bearer ${admin}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("image de plus de 2 Mo → 413 PAYLOAD_TOO_LARGE", async () => {
    const gros = Buffer.concat([PNG, Buffer.alloc(2.5 * 1024 * 1024)]);
    const res = await request(app)
      .put("/dishes/1/image")
      .set("Authorization", `Bearer ${admin}`)
      .attach("image", gros, "gros.png");

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("texte déguisé en PNG → 415 UNSUPPORTED_MEDIA_TYPE", async () => {
    const res = await request(app)
      .put("/dishes/1/image")
      .set("Authorization", `Bearer ${admin}`)
      .attach("image", FAUX_PNG, { filename: "piege.png", contentType: "image/png" });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});