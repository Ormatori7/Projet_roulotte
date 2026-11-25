import type { AuthUserStore, Role, StoredUser } from "../../fourni/auth/index";
import type { PrismaClient } from "../../generated/prisma/client";

export type UserRepository = AuthUserStore;

export class PrismaUserRepository implements UserRepository {
    constructor(private readonly prisma: PrismaClient) {}

    findByEmail(email: string): Promise<StoredUser | null> {
        return this.prisma.user.findUnique({ where: {email}})
    }

    findById(id: number): Promise<StoredUser | null> {
        return this.prisma.user.findUnique({ where: {id}})
    }

    create(data: { email: string; name: string; passwordHash: string; role: Role }): Promise<StoredUser> {
        return this.prisma.user.create({ data });
    }
}
