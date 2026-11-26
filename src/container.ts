import { config, type Config } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import { PrismaUserRepository, type UserRepository } from "./modules/users/user.repository.js";

import { DishRepository, PrismaDishRepository } from "./modules/menu/dish.repository.js";
import { OrderController } from "./modules/orders/order.controller";
import { PrismaOrderRepository, type OrderRepository } from "./modules/orders/order.repository";
import { OrderService } from "./modules/orders/order.service";

export type Container = {
  config: Config;
  auth: Auth;
  repositories: {
    users: UserRepository;
    dishes: DishRepository;
    orders: OrderRepository;
  };
  controllers: {
    orders: OrderController;
  }
};

export function createContainer(): Container {
  // Les repositories (accès aux données)
  const repositories = {
    users: new PrismaUserRepository(prisma),
    dishes: new PrismaDishRepository(prisma),
    orders: new PrismaOrderRepository(prisma)
  };

  // L'authentification fournie, branchée sur NOTRE repository d'utilisateurs
  const auth = createAuth({
    users: repositories.users,
    jwtSecret: config.JWT_SECRET,
    jwtExpiresIn: config.JWT_EXPIRES_IN,
  });

  const orderService = new OrderService(repositories.orders, repositories.dishes);

  const controllers = {
    orders: new OrderController(orderService)
  };

  return { config, auth, repositories, controllers };
}
