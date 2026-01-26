-- Migration: Move EOD settings from stores table to app_settings
-- This is a one-time migration to consolidate EOD settings globally
-- Run this after deploying the API changes

-- Migrate operational_day_start_hour
INSERT INTO app_settings (key, value, updated_at)
SELECT
    'eod_operational_day_start_hour',
    operational_day_start_hour::text,
    NOW()
FROM stores
WHERE operational_day_start_hour IS NOT NULL
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Migrate allow_auto_day_transition
INSERT INTO app_settings (key, value, updated_at)
SELECT
    'eod_allow_auto_transition',
    CASE WHEN allow_auto_day_transition THEN 'true' ELSE 'false' END,
    NOW()
FROM stores
WHERE allow_auto_day_transition IS NOT NULL
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Migrate eod_notification_emails
-- Convert PostgreSQL array to JSON array
INSERT INTO app_settings (key, value, updated_at)
SELECT
    'eod_notification_emails',
    COALESCE(
        (
            SELECT json_agg(elem)::text
            FROM UNNEST(COALESCE(eod_notification_emails, '{}'::text[])) AS elem
        ),
        '[]'
    ),
    NOW()
FROM stores
WHERE eod_notification_emails IS NOT NULL AND array_length(eod_notification_emails, 1) > 0
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verify migration
SELECT key, value FROM app_settings WHERE key LIKE 'eod_%' ORDER BY key;
