import express from "express";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { UPLOADS_DIR } from "./modules/menu/image.storage.js";
import { createMenuRouter } from "./modules/menu/menu.routes.js";
import { createOrderRouter } from "./modules/orders/order.routes.js";
import { createEventsRouter } from "./modules/events/events.routes.js";
import { createPaymentRouter } from "./modules/payment/payment.routes.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";
import { requestId } from "./shared/request-id.js";
import { requestLogger } from "./shared/logger.js";

export function createApp(container: Container) {
  const app = express();

  // Identifiant de requête et logs : en tout premier, pour que TOUTES les réponses les aient
  app.use(requestId);
  app.use(requestLogger);

  // Sécurité (Helmet, CORS, parseur JSON) : avant toutes les routes
  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN });

  // Photos des plats : fichiers servis tels quels, affichables depuis le front (autre origine)
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(UPLOADS_DIR),
  );

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
  app.use(createEventsRouter(container.sse, container.auth));
  app.use(createPaymentRouter(container.controllers.payment, container.auth));
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
