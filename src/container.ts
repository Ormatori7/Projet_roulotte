import { config, type Config } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import {
  PrismaMenuRepository,
  type MenuRepository,
} from "./modules/menu/menu.repository.js";
import { MenuService } from "./modules/menu/menu.service.js";
import {
  PrismaUserRepository,
  type UserRepository,
} from "./modules/users/user.repository.js";

export type Container = {
  config: Config;
  auth: Auth;
  repositories: {
    users: UserRepository;
    menu: MenuRepository;
  };
  controllers: {
    menu: MenuController;
  };
};

export function createContainer(): Container {
  //! Les repositories (accès aux données)
  const repositories = {
    users: new PrismaUserRepository(prisma),
    menu: new PrismaMenuRepository(prisma),
  };

  //! L'authentification fournie, branchée sur le repository d'utilisateurs
  const auth = createAuth({
    users: repositories.users,
    jwtSecret: config.JWT_SECRET,
    jwtExpiresIn: config.JWT_EXPIRES_IN,
  });

  //! Les services (règles métier) reçoivent les repositories
  const menuService = new MenuService(repositories.menu);

  //! Les controllers (HTTP) reçoivent les services
  const controllers = {
    menu: new MenuController(menuService),
  };

  return { config, auth, repositories, controllers };
}
