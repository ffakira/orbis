CREATE TYPE "public"."restaurant_membership_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."restaurant_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TABLE "restaurant_memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "restaurant_role" NOT NULL,
	"status" "restaurant_membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurant_memberships" ADD CONSTRAINT "restaurant_memberships_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_memberships" ADD CONSTRAINT "restaurant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_memberships_restaurant_user_uidx" ON "restaurant_memberships" USING btree ("restaurant_id","user_id");--> statement-breakpoint
CREATE INDEX "restaurant_memberships_user_id_idx" ON "restaurant_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "restaurant_memberships_restaurant_id_idx" ON "restaurant_memberships" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_memberships_active_owner_uidx" ON "restaurant_memberships" USING btree ("restaurant_id") WHERE "restaurant_memberships"."role" = 'owner' AND "restaurant_memberships"."status" = 'active';