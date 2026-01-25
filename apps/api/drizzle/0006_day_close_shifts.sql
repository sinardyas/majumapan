CREATE TABLE IF NOT EXISTS day_close_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_close_id UUID NOT NULL REFERENCES day_closes(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id),
  cashier_id UUID NOT NULL,
  cashier_name VARCHAR(255) NOT NULL,
  opening_float DECIMAL(10,2) NOT NULL,
  closing_cash DECIMAL(10,2) NOT NULL,
  variance DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_day_close_shifts_day_close ON day_close_shifts(day_close_id);
CREATE INDEX IF NOT EXISTS idx_day_close_shifts_shift ON day_close_shifts(shift_id);
