import express from "express";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { UPLOADS_DIR } from "./modules/menu/image.storage.js";
import { createMenuRouter } from "./modules/menu/menu.routes.js";
import { createOrderRouter } from "./modules/orders/order.routes.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";

export function createApp(container: Container) {
  const app = express();

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
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
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
