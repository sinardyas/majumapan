-- Migration: Add is_master_terminal to device_bindings
-- Date: 2026-02-16

ALTER TABLE device_bindings ADD COLUMN is_master_terminal BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS device_bindings_master_idx ON device_bindings(is_master_terminal);
