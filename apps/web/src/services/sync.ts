import { api } from './api';
import type { ApiResponse } from '@pos/api-client';
import {
  db,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  getPendingTransactions,
  clearOldTransactions,
  type LocalCategory,
  type LocalProduct,
  type LocalStock,
  type LocalDiscount,
  type LocalTransaction,
  type LocalStore,
} from '@/db';
import { LOCAL_RETENTION_DAYS } from '@pos/shared';

// =============================================================================
// Data Transformation Helpers
// =============================================================================
// Drizzle ORM returns PostgreSQL decimal fields as strings to preserve precision.
// These helpers convert them to JavaScript numbers for use in the frontend.
// See ADR-0002: docs/adr/0002-decimal-string-to-number-conversion.md

/**
 * Safely converts a decimal string (or number) to a JavaScript number.
 * Returns null if the input is null/undefined.
 */
function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Safely converts a decimal string (or number) to a JavaScript number.
 * Returns 0 if the input is null/undefined.
 */
function toNumberOrZero(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Transforms a product from API response to local storage format.
 * Converts decimal string fields to numbers.
 */
function transformProduct(p: Record<string, unknown>): LocalProduct {
  return {
    id: p.id as string,
    storeId: p.storeId as string,
    categoryId: (p.categoryId as string) || null,
    sku: p.sku as string,
    barcode: (p.barcode as string) || null,
    name: p.name as string,
    description: (p.description as string) || null,
    price: toNumberOrZero(p.price as string | number),
    costPrice: toNumber(p.costPrice as string | number | null),
    imageUrl: (p.imageUrl as string) || null,
    imageBase64: (p.imageBase64 as string) || null,
    isActive: (p.isActive as boolean) ?? true,
    createdAt: p.createdAt as string,
    updatedAt: p.updatedAt as string,
  };
}

/**
 * Transforms a discount from API response to local storage format.
 * Converts decimal string fields to numbers.
 */
function transformDiscount(d: Record<string, unknown>): LocalDiscount {
  return {
    id: d.id as string,
    storeId: (d.storeId as string) || null,
    code: (d.code as string) || null,
    name: d.name as string,
    description: (d.description as string) || null,
    discountType: d.discountType as 'percentage' | 'fixed',
    discountScope: d.discountScope as 'product' | 'cart',
    value: toNumberOrZero(d.value as string | number),
    minPurchaseAmount: toNumber(d.minPurchaseAmount as string | number | null),
    maxDiscountAmount: toNumber(d.maxDiscountAmount as string | number | null),
    startDate: (d.startDate as string) || null,
    endDate: (d.endDate as string) || null,
    usageLimit: (d.usageLimit as number) || null,
    usageCount: (d.usageCount as number) ?? 0,
    isActive: (d.isActive as boolean) ?? true,
    productIds: (d.productIds as string[]) || [],
    createdAt: d.createdAt as string,
    updatedAt: d.updatedAt as string,
  };
}

// API response types
interface FullSyncResponse {
  store: LocalStore;
  categories: LocalCategory[];
  products: LocalProduct[];
  stock: LocalStock[];
  discounts: (LocalDiscount & { productIds?: string[] })[];
  lastSyncTimestamp: string;
}

interface PullSyncResponse {
  changes: {
    categories: { created: LocalCategory[]; updated: LocalCategory[]; deleted: string[] };
    products: { created: LocalProduct[]; updated: LocalProduct[]; deleted: string[] };
    stock: { updated: LocalStock[] };
    discounts: { created: LocalDiscount[]; updated: LocalDiscount[]; deleted: string[] };
  };
  lastSyncTimestamp: string;
}

interface PushSyncResponse {
  synced: Array<{ clientId: string; serverId: string; transactionNumber: string }>;
  rejected: Array<{
    clientId: string;
    reason: string;
    stockIssues?: Array<{
      productId: string;
      productName: string;
      requested: number;
      available: number;
    }>;
  }>;
  stockUpdates: Array<{ productId: string; newQuantity: number }>;
}

interface SyncStatusResponse {
  storeId: string;
  entities: {
    categories: { synced: number; pending: number };
    products: { synced: number; pending: number };
    transactions: { synced: number; pending: number; rejected: number };
  };
  lastSyncTimestamp: string | null;
  serverTime: string;
}

interface PendingTransactionsResponse {
  items: LocalTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  syncedCount?: number;
  rejectedCount?: number;
  rejectedTransactions?: PushSyncResponse['rejected'];
}

class SyncService {
  private isSyncing = false;

  /**
   * Perform a full sync - downloads all data for the user's store
   * Used on initial login or when local data is corrupted
   */
  async fullSync(entities?: Array<'products' | 'categories' | 'transactions'>): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      const entityParam = entities?.join(',') || '';
      const response = await api.get<FullSyncResponse>(`/sync/full${entityParam ? `?entities=${entityParam}` : ''}`);

      if (!response.success || !response.data) {
        return { success: false, error: response.error || 'Failed to fetch data' };
      }

      const { store, categories, products, stock, discounts, lastSyncTimestamp } = response.data;

      // Clear existing data and insert new data in a transaction
      await db.transaction('rw',
        [db.store, db.categories, db.products, db.stock, db.discounts],
        async () => {
          // Clear existing data
          await db.store.clear();
          await db.categories.clear();
          await db.products.clear();
          await db.stock.clear();
          await db.discounts.clear();

          // Insert store
          if (store) {
            await db.store.put(store);
          }

          // Insert categories
          if (categories?.length > 0) {
            await db.categories.bulkPut(categories.map(c => ({
              ...c,
              isActive: c.isActive ?? true,
            })));
          }

          // Insert products (with decimal string to number conversion)
          if (products?.length > 0) {
            await db.products.bulkPut(
              products.map(p => transformProduct(p as unknown as Record<string, unknown>))
            );
          }

          // Insert stock
          if (stock?.length > 0) {
            await db.stock.bulkPut(stock);
          }

          // Insert discounts (with decimal string to number conversion)
          if (discounts?.length > 0) {
            await db.discounts.bulkPut(
              discounts.map(d => transformDiscount(d as unknown as Record<string, unknown>))
            );
          }
        }
      );

      // Update last sync timestamp
      await setLastSyncTimestamp(lastSyncTimestamp);

      return { success: true };
    } catch (error) {
      console.error('Full sync error:', error);
      return { success: false, error: 'Sync failed' };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull incremental changes since last sync
   * Used to get updates while the app is running
   */
  async pullChanges(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      const lastSync = await getLastSyncTimestamp();

      if (!lastSync) {
        // No last sync, do a full sync instead
        this.isSyncing = false;
        return this.fullSync();
      }

      const response = await api.get<PullSyncResponse>(`/sync/pull?since=${encodeURIComponent(lastSync)}`);

      if (!response.success || !response.data) {
        return { success: false, error: response.error || 'Failed to fetch changes' };
      }

      const { changes, lastSyncTimestamp } = response.data;

      // Apply changes in a transaction
      await db.transaction('rw', 
        [db.categories, db.products, db.stock, db.discounts], 
        async () => {
          // Categories
          if (changes.categories.created.length > 0) {
            await db.categories.bulkPut(changes.categories.created);
          }
          if (changes.categories.updated.length > 0) {
            await db.categories.bulkPut(changes.categories.updated);
          }
          if (changes.categories.deleted.length > 0) {
            await db.categories.bulkDelete(changes.categories.deleted);
          }

          // Products (with decimal string to number conversion)
          if (changes.products.created.length > 0) {
            await db.products.bulkPut(
              changes.products.created.map(p => transformProduct(p as unknown as Record<string, unknown>))
            );
          }
          if (changes.products.updated.length > 0) {
            await db.products.bulkPut(
              changes.products.updated.map(p => transformProduct(p as unknown as Record<string, unknown>))
            );
          }
          if (changes.products.deleted.length > 0) {
            await db.products.bulkDelete(changes.products.deleted);
          }

          // Stock
          if (changes.stock.updated.length > 0) {
            await db.stock.bulkPut(changes.stock.updated);
          }

          // Discounts (with decimal string to number conversion)
          if (changes.discounts.created.length > 0) {
            await db.discounts.bulkPut(
              changes.discounts.created.map(d => transformDiscount(d as unknown as Record<string, unknown>))
            );
          }
          if (changes.discounts.updated.length > 0) {
            await db.discounts.bulkPut(
              changes.discounts.updated.map(d => transformDiscount(d as unknown as Record<string, unknown>))
            );
          }
          if (changes.discounts.deleted.length > 0) {
            await db.discounts.bulkDelete(changes.discounts.deleted);
          }
        }
      );

      // Update last sync timestamp
      await setLastSyncTimestamp(lastSyncTimestamp);

      return { success: true };
    } catch (error) {
      console.error('Pull sync error:', error);
      return { success: false, error: 'Failed to pull changes' };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push pending offline transactions to the server
   * Handles stock validation and rejection
   */
  async pushTransactions(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    try {
      const pendingTransactions = await getPendingTransactions();

      if (pendingTransactions.length === 0) {
        return { success: true, syncedCount: 0, rejectedCount: 0 };
      }

      this.isSyncing = true;

      // Format transactions for the API
      const transactionsToSync = pendingTransactions.map(txn => ({
        clientId: txn.clientId,
        clientTimestamp: txn.clientTimestamp,
        items: txn.items,
        subtotal: txn.subtotal,
        taxAmount: txn.taxAmount,
        discountAmount: txn.discountAmount,
        discountId: txn.discountId,
        discountCode: txn.discountCode,
        discountName: txn.discountName,
        total: txn.total,
        paymentMethod: txn.paymentMethod,
        amountPaid: txn.amountPaid,
        changeAmount: txn.changeAmount,
      }));

      const response = await api.post<PushSyncResponse>('/sync/push', {
        transactions: transactionsToSync,
      });

      if (!response.success || !response.data) {
        return { success: false, error: response.error || 'Failed to push transactions' };
      }

      const { synced, rejected, stockUpdates } = response.data;

      // Update synced transactions
      for (const syncedTxn of synced) {
        await db.transactions.update(syncedTxn.clientId, {
          serverId: syncedTxn.serverId,
          transactionNumber: syncedTxn.transactionNumber,
          syncStatus: 'synced',
        });
      }

      // Update rejected transactions
      for (const rejectedTxn of rejected) {
        await db.transactions.update(rejectedTxn.clientId, {
          syncStatus: 'rejected',
          rejectionReason: rejectedTxn.reason,
        });
      }

      // Update local stock with server values
      for (const update of stockUpdates) {
        const stockRecord = await db.stock
          .where({ productId: update.productId })
          .first();
        
        if (stockRecord) {
          await db.stock.update(stockRecord.id, {
            quantity: update.newQuantity,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return {
        success: true,
        syncedCount: synced.length,
        rejectedCount: rejected.length,
        rejectedTransactions: rejected.length > 0 ? rejected : undefined,
      };
    } catch (error) {
      console.error('Push sync error:', error);
      return { success: false, error: 'Failed to push transactions' };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get sync status from server
   */
  async getStatus(): Promise<SyncStatusResponse | null> {
    try {
      const response = await api.get<SyncStatusResponse>('/sync/status');
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Get sync status error:', error);
      return null;
    }
  }

  /**
   * Perform a complete sync cycle
   * 1. Push pending transactions
   * 2. Pull changes
   */
  async sync(): Promise<SyncResult> {
    // First, push any pending transactions
    const pushResult = await this.pushTransactions();
    
    if (!pushResult.success) {
      // Still try to pull even if push failed
      console.warn('Push failed, continuing with pull:', pushResult.error);
    }

    // Then pull changes
    const pullResult = await this.pullChanges();

    if (!pullResult.success) {
      return pullResult;
    }

    return {
      success: true,
      syncedCount: pushResult.syncedCount,
      rejectedCount: pushResult.rejectedCount,
      rejectedTransactions: pushResult.rejectedTransactions,
    };
  }

  /**
   * Clean up old synced transactions
   * Keeps only the last N days of transactions
   */
  async cleanup(): Promise<number> {
    try {
      const deletedCount = await clearOldTransactions(LOCAL_RETENTION_DAYS);
      console.log(`Cleaned up ${deletedCount} old transactions`);
      return deletedCount;
    } catch (error) {
      console.error('Cleanup error:', error);
      return 0;
    }
  }

  /**
   * Check if there are pending transactions to sync
   */
  async hasPendingTransactions(): Promise<boolean> {
    const pending = await getPendingTransactions();
    return pending.length > 0;
  }

  /**
   * Get count of pending transactions
   */
  async getPendingCount(): Promise<number> {
    const pending = await getPendingTransactions();
    return pending.length;
  }

  /**
   * Get rejected transactions
   */
  async getRejectedTransactions(): Promise<LocalTransaction[]> {
    return db.transactions
      .where('syncStatus')
      .equals('rejected')
      .toArray();
  }

  /**
   * Retry a rejected transaction
   * Resets status to pending so it will be synced again
   */
  async retryRejectedTransaction(clientId: string): Promise<boolean> {
    try {
      await db.transactions.update(clientId, {
        syncStatus: 'pending',
        rejectionReason: undefined,
      });
      return true;
    } catch (error) {
      console.error('Retry rejected transaction error:', error);
      return false;
    }
  }

  /**
   * Delete a rejected transaction
   */
  async deleteRejectedTransaction(clientId: string): Promise<boolean> {
    try {
      await db.transactions.delete(clientId);
      return true;
    } catch (error) {
      console.error('Delete rejected transaction error:', error);
      return false;
    }
  }

  /**
   * Get entity sync status from server
   */
  async getEntitySyncStatus(): Promise<ApiResponse<SyncStatusResponse>> {
    return api.get<SyncStatusResponse>('/sync/status');
  }

  /**
   * Get pending transactions from server
   */
  async getPendingTransactions(limit = 20, offset = 0): Promise<PendingTransactionsResponse> {
    const response = await api.get<PendingTransactionsResponse>(`/sync/pending?limit=${limit}&offset=${offset}`);

    if (response.success && response.data) {
      return response.data;
    }

    return { items: [], total: 0, limit, offset };
  }

  /**
   * Retry a pending transaction
   */
  async retryPendingTransaction(clientId: string): Promise<boolean> {
    try {
      await db.transactions.update(clientId, {
        syncStatus: 'pending',
        rejectionReason: undefined,
      });
      return true;
    } catch (error) {
      console.error('Retry pending transaction error:', error);
      return false;
    }
  }

  /**
   * Clear pending transaction(s)
   */
  async clearPendingTransaction(clientId?: string): Promise<boolean> {
    try {
      if (clientId) {
        await db.transactions.delete(clientId);
      } else {
        const pending = await getPendingTransactions();
        for (const txn of pending) {
          await db.transactions.delete(txn.clientId);
        }
      }
      return true;
    } catch (error) {
      console.error('Clear pending transaction error:', error);
      return false;
    }
  }
}

export const syncService = new SyncService();
