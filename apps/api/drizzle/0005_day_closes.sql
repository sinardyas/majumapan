CREATE TABLE IF NOT EXISTS day_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  operational_day_id UUID NOT NULL REFERENCES operational_days(id),
  operational_date DATE NOT NULL,
  day_close_number VARCHAR(50) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  total_transactions INTEGER NOT NULL DEFAULT 0,
  completed_transactions INTEGER NOT NULL DEFAULT 0,
  voided_transactions INTEGER NOT NULL DEFAULT 0,
  total_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
  cash_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  card_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_refunds DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_discounts DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_variance DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  pending_transactions_at_close INTEGER NOT NULL DEFAULT 0,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'clean' CHECK (sync_status IN ('clean', 'warning')),
  
  closed_by_user_id UUID NOT NULL,
  closed_by_user_name VARCHAR(255) NOT NULL,
  closed_at TIMESTAMP NOT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, operational_date),
  UNIQUE (day_close_number)
);

CREATE INDEX IF NOT EXISTS idx_day_closes_store ON day_closes(store_id);
CREATE INDEX IF NOT EXISTS idx_day_closes_date ON day_closes(operational_date);
CREATE INDEX IF NOT EXISTS idx_day_closes_number ON day_closes(day_close_number);
