// Logs structurés avec pino : une ligne JSON par événement, avec l'identifiant de la requête.
import type { RequestHandler } from "express";
import pino from "pino";

// Pendant les tests (NODE_ENV=test), on coupe les logs pour garder une sortie lisible
export const logger = pino({ level: process.env.NODE_ENV === "test" ? "silent" : "info" });

// Journalise chaque requête une fois la réponse envoyée
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();

  // "finish" est émis par Node quand la réponse est entièrement partie
  res.on("finish", () => {
    logger.info(
      {
        requestId: res.locals.requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      },
      "requête traitée",
    );
  });

  next();
};
