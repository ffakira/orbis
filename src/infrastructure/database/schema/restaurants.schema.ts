import { sql } from "drizzle-orm";
import {
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

export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey(),

  name: varchar("name", { length: 120 }).notNull(),

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
});

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
