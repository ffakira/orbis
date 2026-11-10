ALTER TABLE "restaurants" ADD COLUMN "street" varchar(160);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "number" varchar(20);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "complement" varchar(100);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "neighbourhood" varchar(100);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "postal_code" varchar(8);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "country_code" varchar(2);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_address_complete_check" CHECK (
        (
          "restaurants"."street" IS NULL
          AND "restaurants"."number" IS NULL
          AND "restaurants"."neighbourhood" IS NULL
          AND "restaurants"."city" IS NULL
          AND "restaurants"."state" IS NULL
          AND "restaurants"."postal_code" IS NULL
          AND "restaurants"."country_code" IS NULL
        )
        OR
        (
          "restaurants"."street" IS NOT NULL
          AND "restaurants"."number" IS NOT NULL
          AND "restaurants"."neighbourhood" IS NOT NULL
          AND "restaurants"."city" IS NOT NULL
          AND "restaurants"."state" IS NOT NULL
          AND "restaurants"."postal_code" IS NOT NULL
          AND "restaurants"."country_code" IS NOT NULL
        )
      );--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_coordinates_pair_check" CHECK (
        ("restaurants"."latitude" IS NULL AND "restaurants"."longitude" IS NULL)
        OR
        ("restaurants"."latitude" IS NOT NULL AND "restaurants"."longitude" IS NOT NULL)
      );--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_latitude_range_check" CHECK ("restaurants"."latitude" IS NULL OR ("restaurants"."latitude" >= -90 AND "restaurants"."latitude" <= 90));--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_longitude_range_check" CHECK ("restaurants"."longitude" IS NULL OR ("restaurants"."longitude" >= -180 AND "restaurants"."longitude" <= 180));