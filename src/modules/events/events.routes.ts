import { Router } from "express";
import { currentUser, type Auth } from "../../fourni/auth/index.js";
import type { SseHub } from "./sse-hub.js";

// Un commentaire SSE toutes les 25 secondes garde la connexion ouverte
const PING_INTERVAL_MS = 25_000;

export function createEventsRouter(hub: SseHub, auth: Auth) {
  const router = Router();

  router.get("/events", auth.requireAuth, (req, res) => {
    // Les en-têtes d'un flux SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // envoie les en-têtes tout de suite

    // On inscrit ce client auprès du hub
    const remove = hub.add({ user: currentUser(req), write: (chunk) => res.write(chunk) });

    // Une ligne qui commence par « : » est un commentaire, ignoré par le client
    const ping = setInterval(() => res.write(": ping\n\n"), PING_INTERVAL_MS);

    req.on("close", () => {
      clearInterval(ping);
      remove();
    });
  });

  return router;
}