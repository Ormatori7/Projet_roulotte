import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client"

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });

// Singleton : un module Es n'est exécuté qu'une fois, donc tous les imports partagent ce même client.
export const prisma = new PrismaClient({ adapter })
