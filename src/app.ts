import express from "express";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { errorHandler, notFoundHandler } from "./shared/errors";
import { createMenuRouter } from "./modules/menu/menu.routes.js";

export function createApp(container: Container) {
  const app = express();

  // Sécurité (Helmet, CORS, parseur JSON) : avant toutes les routes
  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN });

  // 2. Routes
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/auth", container.auth.router);
  app.use(createMenuRouter(container.controllers.menu));
  // les routes orders seront ici
  
  // Aucune route n'a répondu : 404
  app.use(notFoundHandler);

  // Erreurs : celles du module auth d'abord, puis les nôtres
  app.use(authErrorHandler);
  app.use(errorHandler);

  return app;
}
