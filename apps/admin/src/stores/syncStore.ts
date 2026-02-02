import { create } from 'zustand';
import { syncService, type SyncResult } from '@/services/sync';

interface RejectedTransaction {
  clientId: string;
  transactionNumber?: string;
  reason: string;
  stockIssues?: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}

interface PendingTransaction {
  clientId: string;
  transactionNumber?: string;
  storeId: string;
  cashierId: string;
  total: number;
  clientTimestamp: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'rejected';
  rejectionReason?: string;
}

interface EntityCounts {
  categories: { synced: number; pending: number };
  products: { synced: number; pending: number };
  stock: { synced: number; pending: number };
  transactions: { synced: number; pending: number; rejected: number };
}

interface SyncState {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingCount: number;
  rejectedTransactions: RejectedTransaction[];

  entityCounts: EntityCounts;
  selectedEntities: Set<'products' | 'categories' | 'transactions' | 'stock'>;
  isAutoRefreshing: boolean;
  pendingTransactions: PendingTransaction[];
  pendingTotal: number;

  lastError: string | null;

  fullSync: (entities?: Array<'products' | 'categories' | 'transactions' | 'stock'>) => Promise<SyncResult>;
  pullChanges: () => Promise<SyncResult>;
  pushTransactions: () => Promise<SyncResult>;
  sync: () => Promise<SyncResult>;
  cleanup: () => Promise<number>;
  updatePendingCount: () => Promise<void>;
  loadRejectedTransactions: () => Promise<void>;
  loadPendingTransactions: (limit?: number, offset?: number) => Promise<void>;
  loadEntityCounts: () => Promise<void>;
  retryRejected: (clientId: string) => Promise<boolean>;
  deleteRejected: (clientId: string) => Promise<boolean>;
  retryPending: (clientId: string) => Promise<boolean>;
  clearPending: (clientId?: string) => Promise<boolean>;
  clearError: () => void;
  toggleEntity: (entity: 'products' | 'categories' | 'transactions' | 'stock') => void;
  selectAllEntities: () => void;
  clearEntitySelection: () => void;
  setAutoRefreshing: (enabled: boolean) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  lastSyncTime: null,
  pendingCount: 0,
  rejectedTransactions: [],
  lastError: null,

  entityCounts: {
    categories: { synced: 0, pending: 0 },
    products: { synced: 0, pending: 0 },
    stock: { synced: 0, pending: 0 },
    transactions: { synced: 0, pending: 0, rejected: 0 },
  },
  selectedEntities: new Set(['products', 'categories', 'transactions']),
  isAutoRefreshing: true,
  pendingTransactions: [],
  pendingTotal: 0,

  fullSync: async (entities) => {
    set({ isSyncing: true, lastError: null });

    try {
      const result = await syncService.fullSync(entities);

      if (result.success) {
        set({ lastSyncTime: new Date() });
        await get().updatePendingCount();
        await get().loadEntityCounts();
      } else {
        set({ lastError: result.error || 'Full sync failed' });
      }

      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  pullChanges: async () => {
    set({ isSyncing: true, lastError: null });

    try {
      const result = await syncService.pullChanges();

      if (result.success) {
        set({ lastSyncTime: new Date() });
        await get().loadEntityCounts();
      } else {
        set({ lastError: result.error || 'Pull failed' });
      }

      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  pushTransactions: async () => {
    set({ isSyncing: true, lastError: null });

    try {
      const result = await syncService.pushTransactions();

      if (result.success) {
        await get().updatePendingCount();
        await get().loadPendingTransactions();

        if (result.rejectedTransactions && result.rejectedTransactions.length > 0) {
          set({ rejectedTransactions: result.rejectedTransactions });
        }
      } else {
        set({ lastError: result.error || 'Push failed' });
      }

      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  sync: async () => {
    set({ isSyncing: true, lastError: null });

    try {
      const result = await syncService.sync();

      if (result.success) {
        set({ lastSyncTime: new Date() });
        await get().updatePendingCount();
        await get().loadPendingTransactions();
        await get().loadEntityCounts();

        if (result.rejectedTransactions && result.rejectedTransactions.length > 0) {
          set({ rejectedTransactions: result.rejectedTransactions });
        }
      } else {
        set({ lastError: result.error || 'Sync failed' });
      }

      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  cleanup: async () => {
    return syncService.cleanup();
  },

  updatePendingCount: async () => {
    const count = await syncService.getPendingCount();
    set({ pendingCount: count });
  },

  loadRejectedTransactions: async () => {
    const rejected = await syncService.getRejectedTransactions();
    set({
      rejectedTransactions: rejected.map(t => ({
        clientId: t.clientId,
        transactionNumber: t.transactionNumber,
        reason: t.rejectionReason || 'Unknown reason',
      })),
    });
  },

  loadPendingTransactions: async (limit = 20, offset = 0) => {
    const result = await syncService.getPendingTransactions(limit, offset);
    set({
      pendingTransactions: result.items,
      pendingTotal: result.total,
    });
  },

  loadEntityCounts: async () => {
    const result = await syncService.getEntitySyncStatus();
    if (result.success && result.data) {
      set({ entityCounts: result.data.entities });
    }
  },

  retryRejected: async (clientId: string) => {
    const success = await syncService.retryRejectedTransaction(clientId);

    if (success) {
      await get().loadRejectedTransactions();
      await get().updatePendingCount();
    }

    return success;
  },

  deleteRejected: async (clientId: string) => {
    const success = await syncService.deleteRejectedTransaction(clientId);

    if (success) {
      await get().loadRejectedTransactions();
    }

    return success;
  },

  retryPending: async (clientId: string) => {
    const success = await syncService.retryPendingTransaction(clientId);

    if (success) {
      await get().loadPendingTransactions();
      await get().updatePendingCount();
    }

    return success;
  },

  clearPending: async (clientId?: string) => {
    const success = await syncService.clearPendingTransaction(clientId);

    if (success) {
      await get().loadPendingTransactions();
      await get().updatePendingCount();
    }

    return success;
  },

  clearError: () => {
    set({ lastError: null });
  },

  toggleEntity: (entity) => {
    set((state) => {
      const newSelected = new Set(state.selectedEntities);
      if (newSelected.has(entity)) {
        newSelected.delete(entity);
      } else {
        newSelected.add(entity);
      }
      return { selectedEntities: newSelected };
    });
  },

  selectAllEntities: () => {
    set({ selectedEntities: new Set(['products', 'categories', 'transactions']) });
  },

  clearEntitySelection: () => {
    set({ selectedEntities: new Set() });
  },

  setAutoRefreshing: (enabled) => {
    set({ isAutoRefreshing: enabled });
  },
}));
