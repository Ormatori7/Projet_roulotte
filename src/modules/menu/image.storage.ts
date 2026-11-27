// - but du fichier => enregistrer et supprimer les photos des plats sur le disque

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

//! Dossier où sont rangées les photos : <projet>/uploads/dishes
export const UPLOADS_DIR = path.resolve("uploads");
const DISHES_DIR = path.join(UPLOADS_DIR, "dishes");

//! L'interface : CE QUE le stockage sait faire
export interface ImageStorage {
  save(buffer: Buffer, extension: string): Promise<string>; // renvoie l'URL publique
  remove(url: string): Promise<void>;
}

//! L'implémentation sur le disque : COMMENT il le fait
export class DiskImageStorage implements ImageStorage {
  // enregistre le fichier sous un nom généré par le serveur → "/uploads/dishes/<uuid>.png"
  async save(buffer: Buffer, extension: string) {
    await mkdir(DISHES_DIR, { recursive: true }); // crée le dossier s'il n'existe pas
    const fileName = `${randomUUID()}.${extension}`;
    await writeFile(path.join(DISHES_DIR, fileName), buffer);
    return `/uploads/dishes/${fileName}`;
  }

  // supprime le fichier d'une ancienne photo
  async remove(url: string) {
    const fileName = path.basename(url); // garde seulement "<uuid>.png" (pas de "../")
    try {
      await unlink(path.join(DISHES_DIR, fileName));
    } catch {
      // fichier déjà absent : rien à faire
    }
  }
}
