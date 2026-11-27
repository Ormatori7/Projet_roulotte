import { config, type Config } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import {
  PrismaDishRepository,
  type DishRepository,
} from "./modules/menu/dish.repository.js";
import {
  PrismaHealthRepository,
  type HealthRepository,
} from "./modules/health/health.repository.js";
import { CachedMenuRepository } from "./modules/menu/cached-menu.repository.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import {
  PrismaMenuRepository,
  type MenuRepository,
} from "./modules/menu/menu.repository.js";
import { MenuService } from "./modules/menu/menu.service.js";
import { OrderController } from "./modules/orders/order.controller.js";
import {
  PrismaOrderRepository,
  type OrderRepository,
} from "./modules/orders/order.repository.js";
import { OrderService } from "./modules/orders/order.service.js";
import { EventBus } from "./shared/event-bus.js";
import {
  PrismaUserRepository,
  type UserRepository,
} from "./modules/users/user.repository.js";

export type Container = {
  config: Config;
  auth: Auth;
  events: EventBus;
  repositories: {
    users: UserRepository;
    menu: MenuRepository;
    dishes: DishRepository;
    orders: OrderRepository;
    health: HealthRepository;
  };
  controllers: {
    menu: MenuController;
    orders: OrderController;
  };
};

export function createContainer(): Container {
  // Le bus d'événements, partagé par toute l'application
  const events = new EventBus();

  // Decorator : le repository Prisma du menu est enveloppé dans un cache
  const menu = new CachedMenuRepository(new PrismaMenuRepository(prisma));

  // Observer : une commande créée ou modifiée peut changer un stock, donc on vide le cache
  events.on("order.created", () => menu.invalidate());
  events.on("order.updated", () => menu.invalidate());

  // Les repositories (accès aux données)
  const repositories = {
    users: new PrismaUserRepository(prisma),
    menu,
    dishes: new PrismaDishRepository(prisma),
    orders: new PrismaOrderRepository(prisma),
    health: new PrismaHealthRepository(prisma),
  };

  // L'authentification fournie, branchée sur NOTRE repository d'utilisateurs
  const auth = createAuth({
    users: repositories.users,
    jwtSecret: config.JWT_SECRET,
    jwtExpiresIn: config.JWT_EXPIRES_IN,
  });

  // Les services (règles métier) reçoivent les repositories
  const menuService = new MenuService(repositories.menu);
  const orderService = new OrderService(
    repositories.orders,
    repositories.dishes,
    events,
  );

  // Les controllers (HTTP) reçoivent les services
  const controllers = {
    menu: new MenuController(menuService),
    orders: new OrderController(orderService),
  };

  return { config, auth, events, repositories, controllers };
}
