//- Tests unitaires du service : administration de la carte (palier 2)
import { describe, expect, it } from "vitest";
import { MenuService } from "../src/modules/menu/menu.service.js";
import { fakeMenuRepository, plat } from "./helpers/fake-menu.js";

// . un plat valide à créer (catégorie 1 = Burgers dans le faux repository)
const nouveauPlat = {
  name: "Tarte du jour",
  description: "",
  priceCents: 500,
  categoryId: 1,
  allergens: ["gluten"],
  available: true,
  stock: null,
};

describe("MenuService - administration de la carte", () => {
  it("crée un plat et le renvoie au format du contrat", async () => {
    const service = new MenuService(fakeMenuRepository([]));

    const dish = await service.createDish(nouveauPlat);

    expect(dish).toHaveProperty("id");
    expect(dish).toHaveProperty("stock");
    expect(dish).not.toHaveProperty("categoryId");
  });

  it("refuse un nom déjà pris → 409 CONFLICT", async () => {
    const service = new MenuService(
      fakeMenuRepository([plat(1, "Tarte du jour")]),
    );

    await expect(service.createDish(nouveauPlat)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("refuse une catégorie inconnue → 422 INVALID_REFERENCE", async () => {
    const service = new MenuService(fakeMenuRepository([]));

    await expect(
      service.createDish({ ...nouveauPlat, categoryId: 9999 }),
    ).rejects.toMatchObject({ status: 422, code: "INVALID_REFERENCE" });
  });

  it("refuse un code allergène inconnu → 422 avec le code fautif", async () => {
    const service = new MenuService(fakeMenuRepository([]));

    await expect(
      service.createDish({
        ...nouveauPlat,
        allergens: ["gluten", "kryptonite"],
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: "INVALID_REFERENCE",
      details: [{ field: "allergens", value: ["kryptonite"] }],
    });
  });

  it("modifier un plat inexistant → 404 NOT_FOUND", async () => {
    const service = new MenuService(fakeMenuRepository([]));

    await expect(
      service.updateDish(999, { priceCents: 600 }),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("modifier un plat en gardant son propre nom → pas de 409", async () => {
    const service = new MenuService(fakeMenuRepository([plat(1, "Brownie")]));

    await expect(
      service.updateDish(1, { name: "Brownie" }),
    ).resolves.toBeDefined();
  });

  it("supprimer un plat déjà commandé → 409 CONFLICT", async () => {
    // on remplace une seule méthode du faux repository : le plat a été commandé
    const repo = {
      ...fakeMenuRepository([plat(1, "Brownie")]),
      isDishOrdered: async () => true,
    };
    const service = new MenuService(repo);

    await expect(service.deleteDish(1)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });
});