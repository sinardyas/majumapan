-- Migration: Make promotions global (remove store scoping)
-- Created: 2026-01-03

-- Convert existing promotions to global (set store_id to NULL)
UPDATE "promotions" SET "store_id" = NULL;

-- Drop foreign key constraint
ALTER TABLE "promotions" DROP CONSTRAINT IF EXISTS "promotions_store_id_stores_id_fk";

-- Make store_id nullable
ALTER TABLE "promotions" ALTER COLUMN "store_id" DROP NOT NULL;

-- Drop old indexes that included store_id
DROP INDEX IF EXISTS "idx_promotions_store";
DROP INDEX IF EXISTS "idx_promotions_priority";

-- Create new index for global ordering
CREATE INDEX IF NOT EXISTS "idx_promotions_priority" ON "promotions"("display_priority");
