//-  Tests unitaires du service : pas de base, pas de HTTP
import { describe, expect, it } from "vitest";
import { MenuService } from "../src/modules/menu/menu.service.js";
import { fakeMenuRepository, plat } from "./helpers/fake-menu.js";

describe("MenuService", () => {
  it("renvoie un plat au format du contrat (category et allergens)", async () => {
    const service = new MenuService(
      fakeMenuRepository([plat(1, "Le Classique")]),
    );

    const dish = await service.getDish(1);

    expect(dish.category).toEqual({ id: 1, name: "Burgers" });
    expect(dish.allergens).toEqual([{ code: "gluten", label: "Gluten" }]);
    expect(dish).not.toHaveProperty("categoryId");
  });

  it("lève une erreur 404 NOT_FOUND si le plat n'existe pas", async () => {
    const service = new MenuService(fakeMenuRepository([]));

    await expect(service.getDish(99)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("renvoie la pagination { items, total, page, pageSize }", async () => {
    const service = new MenuService(
      fakeMenuRepository([plat(1, "A"), plat(2, "B")]),
    );

    const page = await service.listDishes({ page: 1, pageSize: 20 });

    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(page.items).toHaveLength(2);
  });
});
