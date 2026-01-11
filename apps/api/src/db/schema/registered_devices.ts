import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { stores } from '../schema';
import { users } from '../schema';

export const deviceApprovalStatusEnum = pgEnum('device_approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const registeredDevices = pgTable('registered_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  storeId: uuid('store_id')
    .references(() => stores.id, { onDelete: 'cascade' })
    .notNull(),
  deviceTokenHash: varchar('device_token_hash', { length: 255 }).notNull(),
  deviceName: varchar('device_name', { length: 100 }).notNull(),
  deviceFingerprint: text('device_fingerprint'),
  ipAddress: varchar('ip_address', { length: 45 }),
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
  approvalStatus: deviceApprovalStatusEnum('approval_status')
    .default('PENDING')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_registered_devices_company').on(table.companyId),
  index('idx_registered_devices_store').on(table.storeId),
  index('idx_registered_devices_token').on(table.deviceTokenHash),
  index('idx_registered_devices_active').on(table.isActive),
  index('idx_registered_devices_expires').on(table.expiresAt),
  index('idx_registered_devices_approval').on(table.approvalStatus),
]);
