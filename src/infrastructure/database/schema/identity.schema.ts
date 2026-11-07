import { sql } from "drizzle-orm";

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userStatus = pgEnum("user_status", [
  "pending_email_verification",
  "active",
  "suspended",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),

  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),

  email: varchar("email", { length: 320 }).notNull().unique(),
  phone: varchar("phone", { length: 16 }).notNull(),

  passwordHash: varchar("password_hash", { length: 255 }).notNull(),

  status: userStatus("status").notNull().default("pending_email_verification"),

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

export const termsAcceptances = pgTable(
  "terms_acceptances",
  {
    id: uuid("id").primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    document: varchar("document", { length: 64 }).notNull(),

    version: varchar("version", { length: 64 }).notNull(),

    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("terms_acceptances_user_id_idx").on(table.userId),

    index("terms_acceptances_document_version_idx").on(
      table.document,
      table.version,
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey(),

    aggregateType: varchar("aggregate_type", {
      length: 64,
    }).notNull(),

    aggregateId: uuid("aggregate_id").notNull(),

    eventType: varchar("event_type", {
      length: 128,
    }).notNull(),

    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),

    availableAt: timestamp("available_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),

    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),

    attempts: integer("attempts").notNull().default(0),

    lastError: text("last_error"),
  },
  (table) => [
    index("outbox_events_pending_idx")
      .on(table.availableAt, table.createdAt)
      .where(sql`${table.publishedAt} IS NULL`),

    index("outbox_events_aggregate_idx").on(
      table.aggregateType,
      table.aggregateId,
    ),
  ],
);
