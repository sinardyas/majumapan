-- Migration: Add store_name column to day_closes
-- Purpose: Store store name in day_closes for easier access in detail views

-- Add store_name column
ALTER TABLE day_closes ADD COLUMN store_name text;

-- Update existing records with store names
UPDATE day_closes dc
SET store_name = s.name
FROM stores s
WHERE dc.store_id = s.id;

-- Update day_close_shifts cashier_name to be properly populated
-- This will be handled by the execute endpoint going forward
