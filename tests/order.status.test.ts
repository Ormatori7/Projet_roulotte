// Tests unitaires de la machine à états : aucune base, aucun serveur.
import { describe, expect, it } from "vitest";
import { canTransition, customerCanCancel } from "../src/modules/orders/order.status.js";
import { ORDER_STATUSES } from "../src/modules/orders/order.types.js";

describe("Machine à états des commandes", () => {
  it("suit le parcours normal : reçue → en préparation → prête → retirée", () => {
    expect(canTransition("RECEIVED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "READY")).toBe(true);
    expect(canTransition("READY", "PICKED_UP")).toBe(true);
  });

  it("autorise l'annulation tant que la commande n'est pas retirée", () => {
    expect(canTransition("RECEIVED", "CANCELLED")).toBe(true);
    expect(canTransition("PREPARING", "CANCELLED")).toBe(true);
    expect(canTransition("READY", "CANCELLED")).toBe(true);
  });

  it("refuse de sauter une étape ou de revenir en arrière", () => {
    expect(canTransition("RECEIVED", "READY")).toBe(false);
    expect(canTransition("RECEIVED", "PICKED_UP")).toBe(false);
    expect(canTransition("READY", "PREPARING")).toBe(false);
  });

  it("ne laisse sortir d'aucun état final (retirée, annulée)", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("PICKED_UP", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
  });

  it("un client ne peut annuler que depuis « reçue »", () => {
    expect(customerCanCancel("RECEIVED")).toBe(true);
    expect(customerCanCancel("PREPARING")).toBe(false);
    expect(customerCanCancel("READY")).toBe(false);
  });
});