import type { PrismaClient } from "../../generated/prisma/client";

export interface HealthRepository {
    isDatabaseUp(): Promise<boolean>;
};

export class PrismaHealthRepository implements HealthRepository {
    constructor(private readonly prisma: PrismaClient) {}
    
    // La requête la plus légère possible : si elle échoue, la base est injoignable
    async isDatabaseUp(): Promise<boolean> {
        try {
            await this.prisma.$queryRawUnsafe("SELECT 1");
            return true;
        } catch {
            return false;
        }
    }
}
