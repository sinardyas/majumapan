CREATE TABLE IF NOT EXISTS pending_carts_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  cart_id VARCHAR(100) NOT NULL,
  cart_data TEXT NOT NULL,
  operational_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_carts_store_date ON pending_carts_queue(store_id, operational_date);
CREATE INDEX IF NOT EXISTS idx_pending_carts_expires ON pending_carts_queue(expires_at);
