import { randomUUID } from "node:crypto";

import { createAsyncSingleton } from "#bootstrap/async-singleton.js";
import { getDatabase } from "#infrastructure/database/client.js";
import { SystemClock } from "#infrastructure/time/system-clock.js";
import { CreateRestaurantHandler } from "#modules/restaurants/application/commands/create-restaurant.handler.js";
import { GetUserRestaurantsHandler } from "#modules/restaurants/application/queries/get-user-restaurants.handler.js";
import { DrizzleRestaurantsUnitOfWork } from "#modules/restaurants/infrastructure/persistence/drizzle-restaurants-unit-of-work.js";
import { DrizzleUserRestaurantsRepository } from "#modules/restaurants/infrastructure/persistence/repositories/drizzle-user-restaurants-repository.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { IdGenerator } from "#modules/identity/application/ports/id-generator.js";

class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

const clock: Clock = new SystemClock();
const ids: IdGenerator = new UuidGenerator();

export const getCreateRestaurantHandler = createAsyncSingleton(async () => {
  const db = await getDatabase();

  return new CreateRestaurantHandler({
    ids,
    clock,
    unitOfWork: new DrizzleRestaurantsUnitOfWork(db),
  });
});

export const getUserRestaurantsHandler = createAsyncSingleton(async () => {
  const db = await getDatabase();

  return new GetUserRestaurantsHandler({
    userRestaurants: new DrizzleUserRestaurantsRepository(db),
  });
});
