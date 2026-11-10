import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "#infrastructure/database/schema/identity.schema.js";

export const restaurantRole = pgEnum("restaurant_role", [
  "owner",
  "manager",
  "staff",
]);

export const restaurantMembershipStatus = pgEnum(
  "restaurant_membership_status",
  ["active", "suspended"],
);

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").primaryKey(),

    name: varchar("name", { length: 120 }).notNull(),

    street: varchar("street", { length: 160 }),
    number: varchar("number", { length: 20 }),
    complement: varchar("complement", { length: 100 }),
    neighbourhood: varchar("neighbourhood", { length: 100 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 2 }),
    postalCode: varchar("postal_code", { length: 8 }),
    countryCode: varchar("country_code", { length: 2 }),

    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "restaurants_address_complete_check",
      sql`
        (
          ${table.street} IS NULL
          AND ${table.number} IS NULL
          AND ${table.neighbourhood} IS NULL
          AND ${table.city} IS NULL
          AND ${table.state} IS NULL
          AND ${table.postalCode} IS NULL
          AND ${table.countryCode} IS NULL
        )
        OR
        (
          ${table.street} IS NOT NULL
          AND ${table.number} IS NOT NULL
          AND ${table.neighbourhood} IS NOT NULL
          AND ${table.city} IS NOT NULL
          AND ${table.state} IS NOT NULL
          AND ${table.postalCode} IS NOT NULL
          AND ${table.countryCode} IS NOT NULL
        )
      `,
    ),

    check(
      "restaurants_coordinates_pair_check",
      sql`
        (${table.latitude} IS NULL AND ${table.longitude} IS NULL)
        OR
        (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL)
      `,
    ),

    check(
      "restaurants_latitude_range_check",
      sql`${table.latitude} IS NULL OR (${table.latitude} >= -90 AND ${table.latitude} <= 90)`,
    ),

    check(
      "restaurants_longitude_range_check",
      sql`${table.longitude} IS NULL OR (${table.longitude} >= -180 AND ${table.longitude} <= 180)`,
    ),
  ],
);

export const restaurantMemberships = pgTable(
  "restaurant_memberships",
  {
    id: uuid("id").primaryKey(),

    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    role: restaurantRole("role").notNull(),

    status: restaurantMembershipStatus("status").notNull().default("active"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("restaurant_memberships_restaurant_user_uidx").on(
      table.restaurantId,
      table.userId,
    ),

    index("restaurant_memberships_user_id_idx").on(table.userId),

    index("restaurant_memberships_restaurant_id_idx").on(table.restaurantId),

    uniqueIndex("restaurant_memberships_at_most_one_active_owner_uidx")
      .on(table.restaurantId)
      .where(sql`${table.role} = 'owner' AND ${table.status} = 'active'`),
  ],
);
