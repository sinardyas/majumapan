import { db } from './index';
import {
  companies,
  stores,
  users,
  registeredDevices,
  deviceAuditLogs,
  appSettings,
} from './schema';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Starting database migration...');

  try {
    // Step 1: Create companies table if not exists
    console.log('Creating companies table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        logo_url TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);`);

    // Step 2: Add company_id to stores table if not exists
    console.log('Adding company_id to stores table...');
    await db.execute(sql`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS company_id UUID;
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stores_company ON stores(company_id);`);

    // Step 3: Add company_id to users table if not exists
    console.log('Adding company_id to users table...');
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID;
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);`);

    // Step 4: Create device approval status enum if not exists
    console.log('Creating device_approval_status enum...');
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE device_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Step 5: Create registered_devices table if not exists
    console.log('Creating registered_devices table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS registered_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        device_token_hash VARCHAR(255) NOT NULL,
        device_name VARCHAR(100) NOT NULL,
        device_fingerprint TEXT,
        ip_address VARCHAR(45),
        is_active BOOLEAN DEFAULT true NOT NULL,
        last_used_at TIMESTAMP DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        approved_by_user_id UUID REFERENCES users(id),
        approval_status device_approval_status DEFAULT 'PENDING' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_registered_devices_company ON registered_devices(company_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_registered_devices_store ON registered_devices(store_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_registered_devices_token ON registered_devices(device_token_hash);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_registered_devices_active ON registered_devices(is_active);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_registered_devices_expires ON registered_devices(expires_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_registered_devices_approval ON registered_devices(approval_status);`);

    // Step 6: Create device audit action enum if not exists
    console.log('Creating device_audit_action enum...');
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE device_audit_action AS ENUM (
          'REGISTERED',
          'APPROVED',
          'REJECTED',
          'REVOKED',
          'TRANSFERRED',
          'RENAMED',
          'EXPIRED',
          'LOGIN_FAILED_MISMATCH',
          'TOKEN_INVALIDATED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Step 7: Create device_audit_logs table if not exists
    console.log('Creating device_audit_logs table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS device_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID NOT NULL REFERENCES registered_devices(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        action device_audit_action NOT NULL,
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_device_audit_device ON device_audit_logs(device_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_device_audit_user ON device_audit_logs(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_device_audit_action ON device_audit_logs(action);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_device_audit_created ON device_audit_logs(created_at);`);

    // Step 8: Add new app settings if not exists
    console.log('Adding new app settings...');
    const settingsToAdd = [
      { key: 'brand_email', value: '' },
      { key: 'device_token_expiry_days', value: '30' },
      { key: 'otp_expiry_minutes', value: '10' },
      { key: 'max_otp_attempts', value: '5' },
    ];

    for (const setting of settingsToAdd) {
      const existing = await db.select().from(appSettings).where(sql`${appSettings.key} = ${setting.key}`).limit(1);
      if (existing.length === 0) {
        await db.insert(appSettings).values(setting);
      }
    }

    console.log('\n========================================');
    console.log('Migration completed successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
