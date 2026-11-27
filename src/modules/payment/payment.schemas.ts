import { z } from "zod";

// Corps de POST /orders/:id/payment : uniquement le token de la carte, rien d'autre
export const payOrderSchema = z.strictObject({
    token: z.string().min(1)
})
