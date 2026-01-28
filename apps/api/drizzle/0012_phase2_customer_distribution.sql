-- Migration: phase2_customer_distribution
-- Description: Add customer management and voucher distribution tables
-- Created: 2026-01-28

-- Create enum for distribution channels if not exists
DO $$ BEGIN
  CREATE TYPE distribution_channel AS ENUM ('whatsapp', 'email', 'print');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Customer Groups
CREATE TABLE IF NOT EXISTS customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  min_spend DECIMAL(15, 2) DEFAULT '0' NOT NULL,
  min_visits INT DEFAULT 0 NOT NULL,
  priority INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_groups_priority ON customer_groups(priority);

-- Insert default customer groups
INSERT INTO customer_groups (name, min_spend, min_visits, priority, created_at, updated_at)
VALUES 
  ('Bronze', 0, 0, 0, NOW(), NOW()),
  ('Silver', 500000, 5, 1, NOW(), NOW()),
  ('Gold', 1000000, 10, 2, NOW(), NOW()),
  ('VIP', 2500000, 25, 3, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100),
  email VARCHAR(100),
  customer_group_id UUID REFERENCES customer_groups(id),
  total_spend DECIMAL(15, 2) DEFAULT '0' NOT NULL,
  visit_count INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_group ON customers(customer_group_id);

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_default ON message_templates(is_default) WHERE is_default = TRUE;

-- Insert default templates
INSERT INTO message_templates (name, subject, message, is_default, created_at, updated_at)
VALUES 
  (
    'Formal',
    'Your Exclusive Voucher from {store_name}',
    'Hi {name}! 🎁 Here''s your exclusive voucher from {store_name}:

CODE: {code}

{discount}
Valid until: {expires}

Show this message at checkout to redeem.

Best regards,
{store_name}',
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'Casual',
    '🎁 Your voucher is here!',
    'Hey {name}! 🎉 Got something for you:

{code} = {discount}

Use it before {expires}! See you soon! 🛒',
    FALSE,
    NOW(),
    NOW()
  ),
  (
    'Limited Time',
    '⏰ {name}, your voucher expires soon!',
    '⏰ {name}, your {discount} voucher expires soon!

CODE: {code}

Use it by {expires}. Don''t miss out! 🛍️',
    FALSE,
    NOW(),
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Distribution History
CREATE TABLE IF NOT EXISTS distribution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id),
  channel VARCHAR(20) NOT NULL,
  recipient_count INT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_distribution_voucher ON distribution_history(voucher_id);
CREATE INDEX IF NOT EXISTS idx_distribution_created ON distribution_history(created_at);

-- Add customer_id FK constraint to vouchers table if not exists
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_customer_id_fkey;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
