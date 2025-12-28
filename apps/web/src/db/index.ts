import Dexie, { type Table } from 'dexie';

// Local database types
export interface LocalCategory {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalProduct {
  id: string;
  storeId: string;
  categoryId: string | null;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  price: number;
  costPrice: number | null;
  imageUrl: string | null;
  imageBase64: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalStock {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface LocalDiscount {
  id: string;
  storeId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  discountScope: 'product' | 'cart';
  value: number;
  minPurchaseAmount: number | null;
  maxDiscountAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  productIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalTransaction {
  clientId: string;
  serverId?: string;
  storeId: string;
  cashierId: string;
  transactionNumber?: string;
  items: Array<{
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    discountId?: string;
    discountName?: string;
    discountValue: number;
    subtotal: number;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountId?: string;
  discountCode?: string;
  discountName?: string;
  total: number;
  paymentMethod: 'cash' | 'card';
  amountPaid: number;
  changeAmount: number;
  status: 'completed' | 'voided' | 'pending_sync';
  syncStatus: 'pending' | 'synced' | 'failed' | 'rejected';
  rejectionReason?: string;
  clientTimestamp: string;
  createdAt: string;
}

export interface SyncMeta {
  key: string;
  value: string;
}

export interface LocalStore {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

class PosDatabase extends Dexie {
  categories!: Table<LocalCategory>;
  products!: Table<LocalProduct>;
  stock!: Table<LocalStock>;
  discounts!: Table<LocalDiscount>;
  transactions!: Table<LocalTransaction>;
  syncMeta!: Table<SyncMeta>;
  store!: Table<LocalStore>;

  constructor() {
    super('pos-database');
    
    // Version 1: Initial schema
    this.version(1).stores({
      categories: 'id, storeId, name, isActive',
      products: 'id, storeId, categoryId, sku, barcode, name, isActive',
      stock: 'id, storeId, productId',
      discounts: 'id, storeId, code, discountScope, isActive',
      transactions: 'clientId, storeId, syncStatus, clientTimestamp, createdAt',
      syncMeta: 'key',
      store: 'id',
    });

    // Version 2: Attempted compound indexes (failed due to boolean index limitation)
    // Kept for migration path - Dexie requires version history
    this.version(2).stores({
      categories: 'id, storeId, name',
      products: 'id, storeId, categoryId, sku, barcode, name',
      stock: 'id, storeId, productId, [storeId+productId]',
      discounts: 'id, storeId, code, discountScope',
      transactions: 'clientId, storeId, syncStatus, clientTimestamp, createdAt',
      syncMeta: 'key',
      store: 'id',
    });

    // Version 3: Remove boolean indexes, use filter-based queries instead
    // See ADR-0001: docs/adr/0001-dexie-compound-indexes-for-offline-queries.md
    // IndexedDB does not support boolean values as index keys
    this.version(3).stores({
      categories: 'id, storeId, name',
      products: 'id, storeId, categoryId, sku, barcode, name',
      stock: 'id, storeId, productId, [storeId+productId]',
      discounts: 'id, storeId, code, discountScope',
      transactions: 'clientId, storeId, syncStatus, clientTimestamp, createdAt',
      syncMeta: 'key',
      store: 'id',
    });
  }
}

export const db = new PosDatabase();

// Helper functions
export async function getLastSyncTimestamp(): Promise<string | null> {
  const meta = await db.syncMeta.get('lastSyncTimestamp');
  return meta?.value ?? null;
}

export async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  await db.syncMeta.put({ key: 'lastSyncTimestamp', value: timestamp });
}

export async function getPendingTransactions(): Promise<LocalTransaction[]> {
  return db.transactions
    .where('syncStatus')
    .equals('pending')
    .toArray();
}

export async function getProductByBarcode(barcode: string, storeId: string): Promise<LocalProduct | undefined> {
  return db.products
    .where('barcode')
    .equals(barcode)
    .filter(p => p.storeId === storeId && p.isActive === true)
    .first();
}

export async function getProductWithStock(productId: string): Promise<(LocalProduct & { stockQuantity: number }) | undefined> {
  const product = await db.products.get(productId);
  if (!product) return undefined;

  // Use compound index [storeId+productId] for efficient lookup
  const stockRecord = await db.stock
    .where('[storeId+productId]')
    .equals([product.storeId, productId])
    .first();

  return {
    ...product,
    stockQuantity: stockRecord?.quantity ?? 0,
  };
}

export async function clearOldTransactions(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffTimestamp = cutoffDate.toISOString();

  // Only delete synced transactions older than cutoff
  const toDelete = await db.transactions
    .where('syncStatus')
    .equals('synced')
    .filter(t => t.createdAt < cutoffTimestamp)
    .toArray();

  const ids = toDelete.map(t => t.clientId);
  await db.transactions.bulkDelete(ids);

  return ids.length;
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.categories.clear(),
    db.products.clear(),
    db.stock.clear(),
    db.discounts.clear(),
    db.transactions.clear(),
    db.syncMeta.clear(),
    db.store.clear(),
  ]);
}
