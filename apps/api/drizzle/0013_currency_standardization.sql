-- Migration: Currency Standardization
-- Version: 0013
-- Description: Add currency field to transactions and day_closes tables,
--              and initialize currency configuration in app_settings
-- Created: 2026-02-02

-- 1. Add currency column to transactions table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE transactions ADD COLUMN currency VARCHAR(3) DEFAULT 'IDR' NOT NULL;
  END IF;
END $$;

-- 2. Add currency column to day_closes table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'day_closes' AND column_name = 'currency'
  ) THEN
    ALTER TABLE day_closes ADD COLUMN currency VARCHAR(3) DEFAULT 'IDR' NOT NULL;
  END IF;
END $$;

-- 3. Update existing null values to IDR
UPDATE transactions SET currency = 'IDR' WHERE currency IS NULL;
UPDATE day_closes SET currency = 'IDR' WHERE currency IS NULL;

-- 4. Initialize currency configuration in app_settings table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'currency_config') THEN
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (
      'currency_config',
      '{"code":"IDR","symbol":"Rp","locale":"id-ID","decimals":0,"thousandsSeparator":".","decimalSeparator":",","isActive":true}',
      NOW()
    );
  END IF;
END $$;

-- 5. Initialize exchange rates in app_settings table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'exchange_rates') THEN
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (
      'exchange_rates',
      '{"USD":15650.00,"JPY":102.50,"EUR":16800.00,"GBP":19800.00,"SGD":11750.00,"MYR":3520.00,"updatedAt":"2026-02-02T00:00:00Z","source":"manual"}',
      NOW()
    );
  END IF;
END $$;

-- 6. Create indexes for currency-related queries (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'transactions' AND indexname = 'idx_transactions_currency'
  ) THEN
    CREATE INDEX idx_transactions_currency ON transactions(currency);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'day_closes' AND indexname = 'idx_day_closes_currency'
  ) THEN
    CREATE INDEX idx_day_closes_currency ON day_closes(currency);
  END IF;
END $$;
