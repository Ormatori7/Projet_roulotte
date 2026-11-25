import { config, type Config } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import { PrismaUserRepository, type UserRepository } from "./modules/users/user.repository.js";

export type Container = {
  config: Config;
  auth: Auth;
  repositories: {
    users: UserRepository;
  };
};

export function createContainer(): Container {
  // Les repositories (accès aux données)
  const repositories = {
    users: new PrismaUserRepository(prisma),
  };

  // L'authentification fournie, branchée sur NOTRE repository d'utilisateurs
  const auth = createAuth({
    users: repositories.users,
    jwtSecret: config.JWT_SECRET,
    jwtExpiresIn: config.JWT_EXPIRES_IN,
  });

  return { config, auth, repositories };
}
