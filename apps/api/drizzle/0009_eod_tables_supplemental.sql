-- Migration: EOD Tables (supplemental)
-- This migration adds End of Day tables without recreating existing types

-- Operational Days
CREATE TABLE IF NOT EXISTS operational_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  store_id UUID REFERENCES stores(id) NOT NULL,
  operational_date DATE NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'OPEN' NOT NULL,
  closed_by_user_id UUID,
  closed_by_user_name VARCHAR(255),
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL,
  UNIQUE (store_id, operational_date)
);

-- Day Closes
CREATE TABLE IF NOT EXISTS day_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  store_id UUID REFERENCES stores(id) NOT NULL,
  operational_day_id UUID REFERENCES operational_days(id) NOT NULL,
  operational_date DATE NOT NULL,
  day_close_number VARCHAR(50) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_transactions INTEGER DEFAULT 0 NOT NULL,
  completed_transactions INTEGER DEFAULT 0 NOT NULL,
  voided_transactions INTEGER DEFAULT 0 NOT NULL,
  total_sales DECIMAL(10,2) DEFAULT 0 NOT NULL,
  cash_revenue DECIMAL(10,2) DEFAULT 0 NOT NULL,
  card_revenue DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_refunds DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_discounts DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_variance DECIMAL(10,2) DEFAULT 0 NOT NULL,
  pending_transactions_at_close INTEGER DEFAULT 0 NOT NULL,
  sync_status VARCHAR(20) DEFAULT 'clean' NOT NULL,
  closed_by_user_id UUID NOT NULL,
  closed_by_user_name VARCHAR(255) NOT NULL,
  closed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  UNIQUE (store_id, operational_date),
  UNIQUE (day_close_number)
);

-- Day Close Shifts
CREATE TABLE IF NOT EXISTS day_close_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  day_close_id UUID REFERENCES day_closes(id) ON DELETE CASCADE NOT NULL,
  shift_id UUID REFERENCES shifts(id) NOT NULL,
  cashier_id UUID NOT NULL,
  cashier_name VARCHAR(255) NOT NULL,
  opening_float DECIMAL(10,2) NOT NULL,
  closing_cash DECIMAL(10,2) NOT NULL,
  variance DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Pending Carts Queue
CREATE TABLE IF NOT EXISTS pending_carts_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  store_id UUID REFERENCES stores(id) NOT NULL,
  cart_id VARCHAR(100) NOT NULL,
  cart_data TEXT NOT NULL,
  operational_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

-- Devices
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  store_id UUID REFERENCES stores(id) NOT NULL,
  device_name VARCHAR(255),
  device_identifier VARCHAR(255) NOT NULL UNIQUE,
  is_master_terminal BOOLEAN DEFAULT FALSE,
  master_terminal_name VARCHAR(100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_operational_days_date ON operational_days(operational_date);
CREATE INDEX IF NOT EXISTS idx_day_closes_date ON day_closes(operational_date);
CREATE INDEX IF NOT EXISTS idx_day_close_shifts_day_close ON day_close_shifts(day_close_id);
CREATE INDEX IF NOT EXISTS idx_day_close_shifts_shift ON day_close_shifts(shift_id);
CREATE INDEX IF NOT EXISTS idx_pending_carts_store_date ON pending_carts_queue(store_id, operational_date);
CREATE INDEX IF NOT EXISTS idx_pending_carts_expires ON pending_carts_queue(expires_at);

-- Add columns to existing tables (if not exist)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS operational_day_start_hour INTEGER DEFAULT 6 NOT NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS allow_auto_day_transition BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS eod_notification_emails TEXT[];
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS operational_date DATE;
