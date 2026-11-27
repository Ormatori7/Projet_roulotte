// Erreurs métier et gestionnaire d'erreurs unique, au format du contrat :
// { error: { code, message, details? } }
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "./logger";

// Une erreur « prévue » : on connaît son statut HTTP et son code
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Aucune route n'a répondu : 404
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Ressource introuvable"));
};

// Dernier middleware de l'application : transforme toute erreur en réponse JSON
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Erreur métier levée par un service
  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message, ...(err.details === undefined ? {} : { details: err.details }) };
    res.status(err.status).json({ error: body });
    return;
  }

  // Entrée invalide : un schéma Zod a refusé le body, les params ou la query
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Données invalides", details } });
    return;
  }

  // Erreur imprévue : on la journalise, mais on ne renvoie aucun détail technique
  logger.error({ err, requestId: res.locals.requestId, method: req.method, url: req.originalUrl }, "erreur imprévue");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erreur interne" } });
};
