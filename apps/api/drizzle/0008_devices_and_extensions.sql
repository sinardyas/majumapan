CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  device_name VARCHAR(255),
  device_identifier VARCHAR(255) NOT NULL UNIQUE,
  is_master_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  master_terminal_name VARCHAR(100),
  last_active_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_store ON devices(store_id);
CREATE INDEX IF NOT EXISTS idx_devices_identifier ON devices(device_identifier);

ALTER TABLE stores ADD COLUMN IF NOT EXISTS operational_day_start_hour INTEGER NOT NULL DEFAULT 6;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS allow_auto_day_transition BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS eod_notification_emails TEXT[];

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS operational_date DATE;

CREATE INDEX IF NOT EXISTS idx_transactions_operational_date ON transactions(operational_date);
