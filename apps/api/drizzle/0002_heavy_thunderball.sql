ALTER TABLE "products" ADD COLUMN "has_promo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_type" "discount_type";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_min_qty" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_end_date" timestamp;--> statement-breakpoint
CREATE INDEX "idx_products_has_promo" ON "products" USING btree ("has_promo");