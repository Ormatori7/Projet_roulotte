import express from "express";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { createMenuRouter } from "./modules/menu/menu.routes.js";
import { createOrderRouter } from "./modules/orders/order.routes.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";
import { requestId } from "./shared/request-id";
import { requestLogger } from "./shared/logger";

export function createApp(container: Container) {
  const app = express();
  app.use(requestId);
  app.use(requestLogger);

  // Sécurité (Helmet, CORS, parseur JSON) : avant toutes les routes
  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN });

  // Routes
  app.get("/health", async (_req, res) => {
    const databaseUp = await container.repositories.health.isDatabaseUp();
    if (databaseUp) {
      res.json({ status: "ok", database: "up" });
    } else {
      res.status(503).json({ status: "degraded", database: "down" });
    }
  });
  app.use("/auth", container.auth.router);
  app.use(createMenuRouter(container.controllers.menu, container.auth));
  app.use(
    "/orders",
    createOrderRouter(container.controllers.orders, container.auth),
  );

  // Aucune route n'a répondu : 404
  app.use(notFoundHandler);

  // Erreurs : celles du module auth d'abord, puis les nôtres
  app.use(authErrorHandler);
  app.use(errorHandler);

  return app;
}
