-- Migration: Device Binding Login System
-- Version: 0016
-- Description: Add device_bindings and user_sessions tables for device binding login system
-- Created: 2026-02-14

-- Create device_bindings table
CREATE TABLE IF NOT EXISTS device_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id),
    device_id UUID REFERENCES devices(id),
    binding_code VARCHAR(6) NOT NULL UNIQUE,
    qr_data TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    device_name VARCHAR(255) NOT NULL,
    device_fingerprint TEXT,
    bound_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES users(id),
    revoked_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for device_bindings
CREATE INDEX IF NOT EXISTS idx_device_bindings_store ON device_bindings(store_id);
CREATE INDEX IF NOT EXISTS idx_device_bindings_status ON device_bindings(status);
CREATE INDEX IF NOT EXISTS idx_device_bindings_binding_code ON device_bindings(binding_code);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    device_id UUID NOT NULL,
    store_id UUID NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
    pin_locked_until TIMESTAMP,
    last_active_at TIMESTAMP,
    last_pin_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP
);

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device ON user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- Add binding_id column to devices table (if not exists)
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS binding_id UUID REFERENCES device_bindings(id);

-- Add last_active_at column to devices table (if not exists)
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;

-- Add is_master_terminal column to devices table (if not exists)
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS is_master_terminal BOOLEAN NOT NULL DEFAULT false;

-- Ensure users table has the required columns
-- Note: pin and role already exist, but store_id needs to be NOT NULL for this system
ALTER TABLE users 
ALTER COLUMN store_id SET NOT NULL;
