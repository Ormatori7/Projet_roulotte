import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "../config/env";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({ url: config.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
