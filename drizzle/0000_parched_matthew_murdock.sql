CREATE TYPE "public"."user_status" AS ENUM('pending_email_verification', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "terms_acceptances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"document" varchar(64) NOT NULL,
	"version" varchar(64) NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(16) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"status" "user_status" DEFAULT 'pending_email_verification' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "terms_acceptances_user_id_idx" ON "terms_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "terms_acceptances_document_version_idx" ON "terms_acceptances" USING btree ("document","version");