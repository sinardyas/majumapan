-- Migration: Voucher Code Normalization
-- Version: 0014
-- Description: Remove dashes from existing voucher codes and update schema
--              to store codes without dashes (16 chars instead of 19)
-- Created: 2026-02-02

-- 1. Remove dashes from all existing voucher codes
UPDATE vouchers SET code = REPLACE(code, '-', '');

-- 2. Verify all codes are now 16 characters
-- This should return no rows if all codes were valid
SELECT id, code, LENGTH(code) as code_length
FROM vouchers
WHERE LENGTH(code) != 16;

-- 3. Update varchar length constraint (if using Drizzle schema)
-- Note: This change is also reflected in apps/api/src/db/schema.ts
-- The ALTER TABLE statement below is for reference if needed
-- ALTER TABLE vouchers ALTER COLUMN code TYPE VARCHAR(16);
