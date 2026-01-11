import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { registeredDevices } from './registered_devices';
import { users } from '../schema';

export const deviceAuditActionEnum = pgEnum('device_audit_action', [
  'REGISTERED',
  'APPROVED',
  'REJECTED',
  'REVOKED',
  'TRANSFERRED',
  'RENAMED',
  'EXPIRED',
  'LOGIN_FAILED_MISMATCH',
  'TOKEN_INVALIDATED',
]);

export const deviceAuditLogs = pgTable('device_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id')
    .references(() => registeredDevices.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id),
  action: deviceAuditActionEnum('action').notNull(),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_device_audit_device').on(table.deviceId),
  index('idx_device_audit_user').on(table.userId),
  index('idx_device_audit_action').on(table.action),
  index('idx_device_audit_created').on(table.createdAt),
]);
