// - but du fichier => recevoir le fichier "image" du formulaire (multer, en mémoire, 2 Mo max)

import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../../shared/errors.js";

const upload = multer({
  storage: multer.memoryStorage(), // le fichier reste en mémoire (req.file.buffer)
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo
}).single("image");

//! Middleware : lit le champ "image", transforme les erreurs de multer au format de l'API
export const uploadImage: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(
        new AppError(
          413,
          "PAYLOAD_TOO_LARGE",
          "Image trop lourde (2 Mo maximum)",
        ),
      );
    }
    if (err) {
      return next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "Formulaire invalide : un seul fichier, dans le champ image",
        ),
      );
    }
    next();
  });
};
