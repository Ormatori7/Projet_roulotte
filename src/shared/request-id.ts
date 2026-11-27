// Donne un identifiant unique à chaque requête et le renvoie dans l'en-tête X-Request-Id.
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestId: RequestHandler = (_req, res, next) => {
    const id = randomUUID();
    //res.localss : l'espace prévu par Express pour transporter des données pendant une requête
    res.locals.requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
}
