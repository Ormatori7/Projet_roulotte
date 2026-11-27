import { config, type Config } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import {
  PrismaDishRepository,
  type DishRepository,
} from "./modules/menu/dish.repository.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import {
  PrismaMenuRepository,
  type MenuRepository,
} from "./modules/menu/menu.repository.js";
import { DiskImageStorage } from "./modules/menu/image.storage.js";
import { MenuService } from "./modules/menu/menu.service.js";
import { OrderController } from "./modules/orders/order.controller.js";
import {
  PrismaOrderRepository,
  type OrderRepository,
} from "./modules/orders/order.repository.js";
import { OrderService } from "./modules/orders/order.service.js";
import {
  PrismaUserRepository,
  type UserRepository,
} from "./modules/users/user.repository.js";
import { SseHub } from "./modules/events/sse-hub.js";

export type Container = {
  config: Config;
  auth: Auth;
  repositories: {
    users: UserRepository;
    menu: MenuRepository;
    dishes: DishRepository;
    orders: OrderRepository;
  };
  controllers: {
    menu: MenuController;
    orders: OrderController;
  };
};

export function createContainer(): Container {
  // Les repositories (accès aux données)
  const repositories = {
    users: new PrismaUserRepository(prisma),
    menu: new PrismaMenuRepository(prisma),
    dishes: new PrismaDishRepository(prisma),
    orders: new PrismaOrderRepository(prisma),
  };

  // L'authentification fournie, branchée sur NOTRE repository d'utilisateurs
  const auth = createAuth({
    users: repositories.users,
    jwtSecret: config.JWT_SECRET,
    jwtExpiresIn: config.JWT_EXPIRES_IN,
  });

  // Les services (règles métier) reçoivent les repositories
  const menuService = new MenuService(
    repositories.menu,
    new DiskImageStorage(),
  );
  const orderService = new OrderService(
    repositories.orders,
    repositories.dishes,
  );

  // Les controllers (HTTP) reçoivent les services
  const controllers = {
    menu: new MenuController(menuService),
    orders: new OrderController(orderService),
  };

  return { config, auth, repositories, controllers };
}
