// DTO d'entrée :ce que le client a le droit d'envoyer
import { z } from "zod";
import { ORDER_STATUSES } from "./order.types"

// POST /orders - strictObject: un champ inconnu (unitPriceCents, totalCents..) est refusé
export const createOrderSchema = z.strictObject({
    items: z
    .array(
        z.strictObject({
            dishId: z.number().int().min(1),
            quantity: z.number().int().min(1).max(10),
        }),
    )
    .min(1)
    .max(20)
    .refine((items) => new Set(items.map((item) => item.dishId)).size === items.length, {
        message: "Un plat ne peut apparaître qu'une seule fois"
    }),
    note: z.string().max(200).optional(),
})
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// GET /orders?status=RECEIVED,PREPARING&sort=-createdAt&page=1&pageSize=20
export const listOrdersQuerySchema = z.object({
    status: z
        .string()
        .transform((value) => value.split(","))
        .pipe(z.array(z.enum(ORDER_STATUSES)))
        .optional(),
    sort: z.enum(["createdAt", "-createdAt"]).default("-createdAt"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// GET /orders/:id - l'id de l'URL est une chaine : on le convertit en tier >=1
export const orderIdParamSchema = z.object({
    id: z.coerce.number().int().min(1)
});

// PATCH /orders/:id/status
export const updateStatusSchema = z.strictObject({
    status: z.enum(ORDER_STATUSES)
});
