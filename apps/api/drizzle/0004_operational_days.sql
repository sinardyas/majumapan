CREATE TABLE IF NOT EXISTS operational_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  operational_date DATE NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  closed_by_user_id UUID,
  closed_by_user_name VARCHAR(255),
  closed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, operational_date)
);

CREATE INDEX IF NOT EXISTS idx_operational_days_store ON operational_days(store_id);
CREATE INDEX IF NOT EXISTS idx_operational_days_date ON operational_days(operational_date);
