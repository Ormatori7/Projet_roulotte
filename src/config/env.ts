import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET doti faire au moins 16 caractères"),
    JWT_EXPIRES_IN: z.string().default("2h"),
    PAYMENT_PROVIDER: z.enum(["http", "fake"]).default("http"),
    PAYMENT_URL: z.string().url().default("http://localhost:4010"),
    PAYMENT_API_KEY: z.string().min(1).default("sk_test_roulotte"),
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
