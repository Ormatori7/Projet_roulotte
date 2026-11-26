import express from "express";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { errorHandler, notFoundHandler } from "./shared/errors";

import { createOrderRouter } from "./modules/orders/order.routes";

export function createApp(container: Container) {
  const app = express();

  // Sécurité (Helmet, CORS, parseur JSON) : avant toutes les routes
  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN });

  // Routes
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", container.auth.router);
  app.use("/orders", createOrderRouter(container.controllers.orders, container.auth));
  // Les routes menu et orders viendront ici

  // Aucune route n'a répondu : 404
  app.use(notFoundHandler);

  // Erreurs : celles du module auth d'abord, puis les nôtres
  app.use(authErrorHandler);
  app.use(errorHandler);

  return app;
}
