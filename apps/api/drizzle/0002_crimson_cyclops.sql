-- Migration: Add promotions table
-- Created: 2026-01-03

CREATE TABLE IF NOT EXISTS "promotions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid REFERENCES "stores"("id") NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "banner_image_url" text NOT NULL,
  "discount_id" uuid REFERENCES "discounts"("id"),
  "color_theme" varchar(50) DEFAULT 'sunset-orange',
  "display_priority" integer DEFAULT 0,
  "display_duration" integer DEFAULT 5,
  "show_on_display" boolean DEFAULT true,
  "start_date" timestamp,
  "end_date" timestamp,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

-- Indexes for promotions
CREATE INDEX IF NOT EXISTS "idx_promotions_store" ON "promotions"("store_id");
CREATE INDEX IF NOT EXISTS "idx_promotions_priority" ON "promotions"("store_id", "display_priority");
CREATE INDEX IF NOT EXISTS "idx_promotions_active" ON "promotions"("is_active", "show_on_display");
