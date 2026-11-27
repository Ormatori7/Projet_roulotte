import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET doti faire au moins 16 caractères"),
    JWT_EXPIRES_IN: z.string().default("2h"),
    CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN est obligatoire")
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error("Configuration invalide (.env) :");
    for (const issue of result.error.issues) {
        console.error(`- ${issue.path.join(".")} : ${issue.message}`)
    }
    process.exit(1);
}

export const config = result.data;
export type Config = typeof config;
