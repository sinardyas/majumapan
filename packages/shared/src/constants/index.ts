export * from './permissions';

export const TAX_RATE = 0.1; // 10%
export const CURRENCY = 'USD';
export const CURRENCY_SYMBOL = '$';
export const TRANSACTION_PREFIX = 'TXN';
export const LOCAL_RETENTION_DAYS = 30;

export const PAYMENT_METHODS = ['cash', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TRANSACTION_STATUSES = ['completed', 'voided', 'pending_sync'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const SYNC_STATUSES = ['pending', 'synced', 'failed', 'rejected'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_SCOPES = ['product', 'cart'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];
