-- Migration: Fix users.pin column size for bcrypt hash
-- Version: 0017
-- Description: Change users.pin from VARCHAR(6) to VARCHAR(100) to accommodate bcrypt hash
-- Created: 2026-02-14

ALTER TABLE users ALTER COLUMN pin TYPE VARCHAR(100);
