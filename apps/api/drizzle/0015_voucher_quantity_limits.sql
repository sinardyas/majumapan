-- Migration: Voucher Quantity Limits
-- Version: 0015
-- Description: Add quantity limitation fields to vouchers table and create usage tracking tables
-- Created: 2026-02-03

-- 1. Add new columns to vouchers table
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS total_usage_limit INTEGER;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS current_usage_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS daily_limit INTEGER;

-- 2. Create voucher_customer_usage table
CREATE TABLE IF NOT EXISTS voucher_customer_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(voucher_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_vcu_voucher_customer ON voucher_customer_usage(voucher_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_vcu_customer ON voucher_customer_usage(customer_id);
CREATE INDEX IF NOT EXISTS idx_vcu_voucher ON voucher_customer_usage(voucher_id);

-- 3. Create voucher_daily_usage table
CREATE TABLE IF NOT EXISTS voucher_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  usage_date DATE NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(voucher_id, usage_date),
  UNIQUE(voucher_id, customer_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_vdu_voucher_date ON voucher_daily_usage(voucher_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_vdu_voucher_customer_date ON voucher_daily_usage(voucher_id, customer_id, usage_date);
