import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  integer,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'cashier']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card']);
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'voided', 'pending_sync']);
export const syncStatusEnum = pgEnum('sync_status', ['pending', 'synced', 'failed', 'rejected']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);
export const discountScopeEnum = pgEnum('discount_scope', ['product', 'cart']);

// App Settings
export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Stores
export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_stores_active').on(table.isActive),
]);

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').default('cashier').notNull(),
  pin: varchar('pin', { length: 6 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_users_store').on(table.storeId),
  index('idx_users_email').on(table.email),
]);

// Categories
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_categories_store').on(table.storeId),
]);

// Products
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  sku: varchar('sku', { length: 100 }).notNull(),
  barcode: varchar('barcode', { length: 100 }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
  imageUrl: text('image_url'),
  imageBase64: text('image_base64'),
  isActive: boolean('is_active').default(true).notNull(),
  hasPromo: boolean('has_promo').default(false).notNull(),
  promoType: discountTypeEnum('promo_type'),
  promoValue: decimal('promo_value', { precision: 12, scale: 2 }),
  promoMinQty: integer('promo_min_qty').default(1),
  promoStartDate: timestamp('promo_start_date'),
  promoEndDate: timestamp('promo_end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_products_store').on(table.storeId),
  index('idx_products_category').on(table.categoryId),
  index('idx_products_barcode').on(table.barcode),
  index('idx_products_has_promo').on(table.hasPromo),
  uniqueIndex('idx_products_store_sku').on(table.storeId, table.sku),
  uniqueIndex('idx_products_store_barcode').on(table.storeId, table.barcode),
]);

// Stock
export const stock = pgTable('stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').default(0).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_stock_store_product').on(table.storeId, table.productId),
]);

// Discounts
export const discounts = pgTable('discounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  discountType: discountTypeEnum('discount_type').notNull(),
  discountScope: discountScopeEnum('discount_scope').notNull(),
  value: decimal('value', { precision: 12, scale: 2 }).notNull(),
  minPurchaseAmount: decimal('min_purchase_amount', { precision: 12, scale: 2 }),
  maxDiscountAmount: decimal('max_discount_amount', { precision: 12, scale: 2 }),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_discounts_store_code').on(table.storeId, table.code),
]);

// Product Discounts (for product-level discounts)
export const productDiscounts = pgTable('product_discounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  discountId: uuid('discount_id').references(() => discounts.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
  uniqueIndex('idx_product_discounts_unique').on(table.discountId, table.productId),
]);

// Transactions
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id', { length: 100 }).notNull().unique(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  cashierId: uuid('cashier_id').references(() => users.id).notNull(),
  transactionNumber: varchar('transaction_number', { length: 50 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  discountId: uuid('discount_id').references(() => discounts.id),
  discountCode: varchar('discount_code', { length: 50 }),
  discountName: varchar('discount_name', { length: 255 }),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).notNull(),
  changeAmount: decimal('change_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  status: transactionStatusEnum('status').default('completed').notNull(),
  syncStatus: syncStatusEnum('sync_status').default('synced').notNull(),
  rejectionReason: text('rejection_reason'),
  rejectedAt: timestamp('rejected_at'),
  clientTimestamp: timestamp('client_timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_transactions_store').on(table.storeId),
  index('idx_transactions_cashier').on(table.cashierId),
  index('idx_transactions_date').on(table.createdAt),
  index('idx_transactions_client_id').on(table.clientId),
]);

// Transaction Items
export const transactionItems = pgTable('transaction_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  productSku: varchar('product_sku', { length: 100 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  discountId: uuid('discount_id').references(() => discounts.id),
  discountName: varchar('discount_name', { length: 255 }),
  discountValue: decimal('discount_value', { precision: 12, scale: 2 }).default('0').notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_transaction_items_transaction').on(table.transactionId),
]);

// Sync Log
export const syncLog = pgTable('sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 20 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => [
  index('idx_sync_log_store_timestamp').on(table.storeId, table.timestamp),
]);

// Refresh Tokens
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  }, (table) => [
  index('idx_refresh_tokens_user').on(table.userId),
  ]);

// Audit Logs
export const auditLogTable = pgTable('audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    userEmail: varchar('user_email', { length: 255 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id'),
    entityName: varchar('entity_name', { length: 255 }),
    changes: jsonb('changes'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }, (table) => [
    index('idx_audit_logs_user').on(table.userId),
    index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_date').on(table.createdAt),
  ]);
