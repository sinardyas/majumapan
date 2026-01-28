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
  date,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'cashier']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card']);
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'voided', 'pending_sync']);
export const syncStatusEnum = pgEnum('sync_status', ['pending', 'synced', 'failed', 'rejected']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);
export const discountScopeEnum = pgEnum('discount_scope', ['product', 'cart']);
export const voucherTypeEnum = pgEnum('voucher_type', ['GC', 'PR']);
export const voucherDiscountTypeEnum = pgEnum('voucher_discount_type', ['PERCENTAGE', 'FIXED', 'FREE_ITEM']);
export const voucherScopeEnum = pgEnum('voucher_scope', ['ENTIRE_ORDER', 'ITEMS_ONLY', 'SUBTOTAL', 'SPECIFIC_ITEMS']);
export const voucherFreeItemModeEnum = pgEnum('voucher_free_item_mode', ['AUTO_ADD', 'QUALIFY_FIRST']);
export const voucherQualifierTypeEnum = pgEnum('voucher_qualifier_type', ['CATEGORY', 'PRODUCT', 'BOTH']);
export const voucherItemTypeEnum = pgEnum('voucher_item_type', ['CATEGORY', 'PRODUCT']);
export const voucherTransactionTypeEnum = pgEnum('voucher_transaction_type', ['usage', 'refund', 'adjustment', 'void', 'create']);

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
  operationalDayStartHour: integer('operational_day_start_hour').notNull().default(6),
  allowAutoDayTransition: boolean('allow_auto_day_transition').notNull().default(true),
  eodNotificationEmails: text('eod_notification_emails').array(),
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
  isSplitPayment: boolean('is_split_payment').default(false).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).notNull(),
  changeAmount: decimal('change_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  status: transactionStatusEnum('status').default('completed').notNull(),
  syncStatus: syncStatusEnum('sync_status').default('synced').notNull(),
  rejectionReason: text('rejection_reason'),
  rejectedAt: timestamp('rejected_at'),
  clientTimestamp: timestamp('client_timestamp').notNull(),
  operationalDate: date('operational_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_transactions_store').on(table.storeId),
  index('idx_transactions_cashier').on(table.cashierId),
  index('idx_transactions_date').on(table.createdAt),
  index('idx_transactions_client_id').on(table.clientId),
  index('idx_transactions_operational_date').on(table.operationalDate),
]);

// Transaction Payments (for split payments)
export const transactionPayments = pgTable('transaction_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'cascade' }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  changeAmount: decimal('change_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_transaction_payments_transaction').on(table.transactionId),
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

// =============================================================================
// VOUCHER TABLES
// =============================================================================

// Vouchers
export const vouchers = pgTable('vouchers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 19 }).notNull().unique(),
  type: voucherTypeEnum('type').notNull(),
  discountType: voucherDiscountTypeEnum('discount_type'),
  initialValue: decimal('initial_value', { precision: 12, scale: 2 }),
  currentBalance: decimal('current_balance', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  percentageValue: decimal('percentage_value', { precision: 5, scale: 2 }),
  fixedValue: decimal('fixed_value', { precision: 12, scale: 2 }),
  scope: voucherScopeEnum('scope'),
  freeItemId: uuid('free_item_id').references(() => products.id),
  freeItemMode: voucherFreeItemModeEnum('free_item_mode'),
  minPurchase: decimal('min_purchase', { precision: 12, scale: 2 }),
  maxDiscount: decimal('max_discount', { precision: 12, scale: 2 }),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true).notNull(),
  isVoid: boolean('is_void').default(false).notNull(),
  customerId: uuid('customer_id'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  voidedAt: timestamp('voided_at'),
  voidedBy: uuid('voided_by').references(() => users.id),
  voidReason: text('void_reason'),
  notes: text('notes'),
}, (table) => [
  index('idx_vouchers_code').on(table.code),
  index('idx_vouchers_customer').on(table.customerId),
  index('idx_vouchers_expires').on(table.expiresAt).where(sql`${table.expiresAt} IS NOT NULL`),
  index('idx_vouchers_active').on(table.isActive, table.isVoid),
  index('idx_vouchers_type').on(table.type),
]);

// Voucher Applicable Items (for SPECIFIC_ITEMS scope)
export const voucherApplicableItems = pgTable('voucher_applicable_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  voucherId: uuid('voucher_id').references(() => vouchers.id, { onDelete: 'cascade' }).notNull(),
  itemType: voucherItemTypeEnum('item_type').notNull(),
  itemId: uuid('item_id').notNull(),
}, (table) => [
  index('idx_voucher_applicable_voucher').on(table.voucherId),
  index('idx_voucher_applicable_item').on(table.itemType, table.itemId),
]);

// Voucher Qualifier Items (for FREE_ITEM QUALIFY_FIRST mode)
export const voucherQualifierItems = pgTable('voucher_qualifier_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  voucherId: uuid('voucher_id').references(() => vouchers.id, { onDelete: 'cascade' }).notNull(),
  qualifierType: voucherQualifierTypeEnum('qualifier_type').notNull(),
  itemType: voucherItemTypeEnum('item_type').notNull(),
  itemId: uuid('item_id').notNull(),
}, (table) => [
  index('idx_voucher_qualifier_voucher').on(table.voucherId),
]);

// Voucher Transactions (ledger for audit trail)
export const voucherTransactions = pgTable('voucher_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  voucherId: uuid('voucher_id').references(() => vouchers.id).notNull(),
  type: voucherTransactionTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  orderId: uuid('order_id'),
  createdBy: uuid('created_by').references(() => users.id),
  balanceBefore: decimal('balance_before', { precision: 12, scale: 2 }),
  balanceAfter: decimal('balance_after', { precision: 12, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_voucher_transactions_voucher').on(table.voucherId),
  index('idx_voucher_transactions_order').on(table.orderId),
  index('idx_voucher_transactions_created').on(table.createdAt),
]);

// Order Vouchers (links vouchers to orders)
export const orderVouchers = pgTable('order_vouchers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => transactions.id, { onDelete: 'cascade' }).notNull(),
  voucherId: uuid('voucher_id').references(() => vouchers.id).notNull(),
  amountApplied: decimal('amount_applied', { precision: 12, scale: 2 }).notNull(),
  discountDetails: jsonb('discount_details'),
  type: voucherTypeEnum('type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_order_vouchers_order').on(table.orderId),
  index('idx_order_vouchers_voucher').on(table.voucherId),
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

// Shifts
export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftNumber: varchar('shift_number', { length: 50 }).notNull().unique(),
  cashierId: varchar('cashier_id', { length: 255 }).notNull(),
  storeId: uuid('store_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  openingFloat: decimal('opening_float', { precision: 10, scale: 2 }).notNull(),
  openingNote: text('opening_note'),
  openingImageUrl: text('opening_image_url'),
  openingTimestamp: timestamp('opening_timestamp').notNull().defaultNow(),
  endingCash: decimal('ending_cash', { precision: 10, scale: 2 }),
  endingNote: text('ending_note'),
  closingTimestamp: timestamp('closing_timestamp'),
  variance: decimal('variance', { precision: 10, scale: 2 }),
  varianceReason: text('variance_reason'),
  varianceApprovedBy: varchar('variance_approved_by', { length: 255 }),
  varianceApprovedAt: timestamp('variance_approved_at'),
  syncStatus: varchar('sync_status', { length: 20 }).notNull().default('pending'),
  serverId: uuid('server_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('shifts_cashier_status_idx').on(table.cashierId, table.status),
  index('shifts_store_status_idx').on(table.storeId, table.status),
  index('shifts_shift_number_idx').on(table.shiftNumber),
  index('shifts_opening_timestamp_idx').on(table.openingTimestamp),
]);

// =============================================================================
// END OF DAY TABLES
// =============================================================================

// Operational Days
export const operationalDays = pgTable('operational_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  operationalDate: date('operational_date').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  status: varchar('status', { length: 20 }).$type<'OPEN' | 'CLOSED'>().default('OPEN').notNull(),
  closedByUserId: uuid('closed_by_user_id'),
  closedByUserName: varchar('closed_by_user_name', { length: 255 }),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_operational_days_store_date').on(table.storeId, table.operationalDate),
  index('idx_operational_days_date').on(table.operationalDate),
]);

// Day Closes
export const dayCloses = pgTable('day_closes', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  operationalDayId: uuid('operational_day_id').references(() => operationalDays.id).notNull(),
  operationalDate: date('operational_date').notNull(),
  dayCloseNumber: varchar('day_close_number', { length: 50 }).notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  totalTransactions: integer('total_transactions').notNull().default(0),
  completedTransactions: integer('completed_transactions').notNull().default(0),
  voidedTransactions: integer('voided_transactions').notNull().default(0),
  totalSales: decimal('total_sales', { precision: 10, scale: 2 }).notNull().default('0'),
  cashRevenue: decimal('cash_revenue', { precision: 10, scale: 2 }).notNull().default('0'),
  cardRevenue: decimal('card_revenue', { precision: 10, scale: 2 }).notNull().default('0'),
  totalRefunds: decimal('total_refunds', { precision: 10, scale: 2 }).notNull().default('0'),
  totalDiscounts: decimal('total_discounts', { precision: 10, scale: 2 }).notNull().default('0'),
  totalVariance: decimal('total_variance', { precision: 10, scale: 2 }).notNull().default('0'),
  
  pendingTransactionsAtClose: integer('pending_transactions_at_close').notNull().default(0),
  syncStatus: varchar('sync_status', { length: 20 }).$type<'clean' | 'warning'>().default('clean').notNull(),
  
  closedByUserId: uuid('closed_by_user_id').notNull(),
  closedByUserName: varchar('closed_by_user_name', { length: 255 }).notNull(),
  closedAt: timestamp('closed_at').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_day_closes_store_date').on(table.storeId, table.operationalDate),
  uniqueIndex('idx_day_closes_number').on(table.dayCloseNumber),
  index('idx_day_closes_date').on(table.operationalDate),
]);

// Day Close Shifts
export const dayCloseShifts = pgTable('day_close_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  dayCloseId: uuid('day_close_id').references(() => dayCloses.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id).notNull(),
  cashierId: uuid('cashier_id').notNull(),
  cashierName: varchar('cashier_name', { length: 255 }).notNull(),
  openingFloat: decimal('opening_float', { precision: 10, scale: 2 }).notNull(),
  closingCash: decimal('closing_cash', { precision: 10, scale: 2 }).notNull(),
  variance: decimal('variance', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_day_close_shifts_day_close').on(table.dayCloseId),
  index('idx_day_close_shifts_shift').on(table.shiftId),
]);

// Pending Carts Queue
export const pendingCartsQueue = pgTable('pending_carts_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  cartId: varchar('cart_id', { length: 100 }).notNull(),
  cartData: text('cart_data').notNull(),
  operationalDate: date('operational_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => [
  index('idx_pending_carts_store_date').on(table.storeId, table.operationalDate),
  index('idx_pending_carts_expires').on(table.expiresAt),
]);

// Devices (for master terminal management)
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  deviceName: varchar('device_name', { length: 255 }),
  deviceIdentifier: varchar('device_identifier', { length: 255 }).notNull().unique(),
  isMasterTerminal: boolean('is_master_terminal').default(false).notNull(),
  masterTerminalName: varchar('master_terminal_name', { length: 100 }),
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_devices_store').on(table.storeId),
  index('idx_devices_identifier').on(table.deviceIdentifier),
]);

// =============================================================================
// RELATIONS
// =============================================================================

// Stores relations
export const storesRelations = relations(stores, ({ many }) => ({
  dayCloses: many(dayCloses),
  shifts: many(shifts),
  transactions: many(transactions),
  products: many(products),
  categories: many(categories),
  pendingCarts: many(pendingCartsQueue),
  devices: many(devices),
  users: many(users),
  syncLogs: many(syncLog),
  discounts: many(discounts),
  auditLogs: many(auditLogTable),
}));

// Users relations
export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
  shifts: many(shifts),
  refreshTokens: many(refreshTokens),
  auditLogs: many(auditLogTable),
}));

// Categories relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, {
    fields: [categories.storeId],
    references: [stores.id],
  }),
  products: many(products),
}));

// Products relations
export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  transactionItems: many(transactionItems),
  productDiscounts: many(productDiscounts),
}));

// Discounts relations
export const discountsRelations = relations(discounts, ({ one, many }) => ({
  store: one(stores, {
    fields: [discounts.storeId],
    references: [stores.id],
  }),
  productDiscounts: many(productDiscounts),
}));

// Product Discounts relations
export const productDiscountsRelations = relations(productDiscounts, ({ one }) => ({
  discount: one(discounts, {
    fields: [productDiscounts.discountId],
    references: [discounts.id],
  }),
  product: one(products, {
    fields: [productDiscounts.productId],
    references: [products.id],
  }),
}));

// Transactions relations
export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  store: one(stores, {
    fields: [transactions.storeId],
    references: [stores.id],
  }),
  user: one(users, {
    fields: [transactions.cashierId],
    references: [users.id],
  }),
  items: many(transactionItems),
  payments: many(transactionPayments),
}));

// Transaction Items relations
export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [transactionItems.productId],
    references: [products.id],
  }),
}));

// Transaction Payments relations
export const transactionPaymentsRelations = relations(transactionPayments, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionPayments.transactionId],
    references: [transactions.id],
  }),
}));

// Sync Log relations
export const syncLogRelations = relations(syncLog, ({ one }) => ({
  store: one(stores, {
    fields: [syncLog.storeId],
    references: [stores.id],
  }),
}));

// Refresh Tokens relations
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// Audit Logs relations
export const auditLogTableRelations = relations(auditLogTable, ({ one }) => ({
  user: one(users, {
    fields: [auditLogTable.userId],
    references: [users.id],
  }),
}));

// Shifts relations
export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  store: one(stores, {
    fields: [shifts.storeId],
    references: [stores.id],
  }),
  dayCloseShifts: many(dayCloseShifts),
}));

// Operational Days relations
export const operationalDaysRelations = relations(operationalDays, ({ one, many }) => ({
  store: one(stores, {
    fields: [operationalDays.storeId],
    references: [stores.id],
  }),
  dayCloses: many(dayCloses),
}));

// Day Closes relations
export const dayClosesRelations = relations(dayCloses, ({ one, many }) => ({
  store: one(stores, {
    fields: [dayCloses.storeId],
    references: [stores.id],
  }),
  operationalDay: one(operationalDays, {
    fields: [dayCloses.operationalDayId],
    references: [operationalDays.id],
  }),
  shifts: many(dayCloseShifts),
}));

// Day Close Shifts relations
export const dayCloseShiftsRelations = relations(dayCloseShifts, ({ one }) => ({
  dayClose: one(dayCloses, {
    fields: [dayCloseShifts.dayCloseId],
    references: [dayCloses.id],
  }),
  shift: one(shifts, {
    fields: [dayCloseShifts.shiftId],
    references: [shifts.id],
  }),
}));

// Pending Carts Queue relations
export const pendingCartsQueueRelations = relations(pendingCartsQueue, ({ one }) => ({
  store: one(stores, {
    fields: [pendingCartsQueue.storeId],
    references: [stores.id],
  }),
}));

// Devices relations
export const devicesRelations = relations(devices, ({ one }) => ({
  store: one(stores, {
    fields: [devices.storeId],
    references: [stores.id],
  }),
}));

// =============================================================================
// VOUCHER RELATIONS
// =============================================================================

// Vouchers relations
export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
  customer: one(users, {
    fields: [vouchers.customerId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [vouchers.createdBy],
    references: [users.id],
  }),
  voidedByUser: one(users, {
    fields: [vouchers.voidedBy],
    references: [users.id],
  }),
  freeItem: one(products, {
    fields: [vouchers.freeItemId],
    references: [products.id],
  }),
  applicableItems: many(voucherApplicableItems),
  qualifierItems: many(voucherQualifierItems),
  transactions: many(voucherTransactions),
  orderVouchers: many(orderVouchers),
}));

// Voucher Applicable Items relations
export const voucherApplicableItemsRelations = relations(voucherApplicableItems, ({ one }) => ({
  voucher: one(vouchers, {
    fields: [voucherApplicableItems.voucherId],
    references: [vouchers.id],
  }),
}));

// Voucher Qualifier Items relations
export const voucherQualifierItemsRelations = relations(voucherQualifierItems, ({ one }) => ({
  voucher: one(vouchers, {
    fields: [voucherQualifierItems.voucherId],
    references: [vouchers.id],
  }),
}));

// Voucher Transactions relations
export const voucherTransactionsRelations = relations(voucherTransactions, ({ one }) => ({
  voucher: one(vouchers, {
    fields: [voucherTransactions.voucherId],
    references: [vouchers.id],
  }),
  createdBy: one(users, {
    fields: [voucherTransactions.createdBy],
    references: [users.id],
  }),
  order: one(transactions, {
    fields: [voucherTransactions.orderId],
    references: [transactions.id],
  }),
}));

// Order Vouchers relations
export const orderVouchersRelations = relations(orderVouchers, ({ one }) => ({
  order: one(transactions, {
    fields: [orderVouchers.orderId],
    references: [transactions.id],
  }),
  voucher: one(vouchers, {
    fields: [orderVouchers.voucherId],
    references: [vouchers.id],
  }),
}));

// =============================================================================
// PHASE 2: CUSTOMER & DISTRIBUTION TABLES
// =============================================================================

// Customer Groups
export const customerGroups = pgTable('customer_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  minSpend: decimal('min_spend', { precision: 15, scale: 2 }).default('0').notNull(),
  minVisits: integer('min_visits').default(0).notNull(),
  priority: integer('priority').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_customer_groups_priority').on(table.priority),
]);

// Customers
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 100 }),
  customerGroupId: uuid('customer_group_id').references(() => customerGroups.id),
  totalSpend: decimal('total_spend', { precision: 15, scale: 2 }).default('0').notNull(),
  visitCount: integer('visit_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_customers_phone').on(table.phone),
  index('idx_customers_name').on(table.name),
  index('idx_customers_group').on(table.customerGroupId),
]);

// Message Templates
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  subject: varchar('subject', { length: 200 }),
  message: text('message').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_templates_default').on(table.isDefault).where(sql`${table.isDefault} = TRUE`),
]);

// Distribution History
export const distributionHistory = pgTable('distribution_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  voucherId: uuid('voucher_id').references(() => vouchers.id).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(), // 'whatsapp', 'email', 'print'
  recipientCount: integer('recipient_count').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_distribution_voucher').on(table.voucherId),
  index('idx_distribution_created').on(table.createdAt),
]);

// =============================================================================
// PHASE 2 RELATIONS
// =============================================================================

// Customer Groups relations
export const customerGroupsRelations = relations(customerGroups, ({ many }) => ({
  customers: many(customers),
}));

// Customers relations
export const customersRelations = relations(customers, ({ one, many }) => ({
  group: one(customerGroups, {
    fields: [customers.customerGroupId],
    references: [customerGroups.id],
  }),
  vouchers: many(vouchers),
}));

// Message Templates relations
export const messageTemplatesRelations = relations(messageTemplates, () => ({}));

// Distribution History relations
export const distributionHistoryRelations = relations(distributionHistory, ({ one }) => ({
  voucher: one(vouchers, {
    fields: [distributionHistory.voucherId],
    references: [vouchers.id],
  }),
  createdByUser: one(users, {
    fields: [distributionHistory.createdBy],
    references: [users.id],
  }),
}));
