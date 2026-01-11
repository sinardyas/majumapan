-- Migration: Add shift management tables
-- Version: 0003
-- Description: Adds shifts table for cashier shift management

CREATE TYPE shift_status AS ENUM ('ACTIVE', 'CLOSED', 'SUSPENDED');

-- Update user_role enum to include supervisor (if not already updated)
-- Note: This requires special handling in production due to enum modification
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'supervisor';

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_number VARCHAR(50) NOT NULL UNIQUE,
  cashier_id UUID NOT NULL REFERENCES users(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  status shift_status NOT NULL DEFAULT 'ACTIVE',
  opening_float DECIMAL(10, 2) NOT NULL,
  opening_note TEXT,
  opening_image_url TEXT,
  opening_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  ending_cash DECIMAL(10, 2),
  ending_note TEXT,
  closing_timestamp TIMESTAMP,
  variance DECIMAL(10, 2),
  variance_reason TEXT,
  variance_approved_by UUID REFERENCES users(id),
  variance_approved_at TIMESTAMP,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  server_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_cashier_status ON shifts (cashier_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_store_status ON shifts (store_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_number ON shifts (shift_number);
CREATE INDEX IF NOT EXISTS idx_shifts_opening_timestamp ON shifts (opening_timestamp);
