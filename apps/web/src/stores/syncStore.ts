import { create } from 'zustand';
import { syncService, type SyncResult } from '@/services/sync';

interface RejectedTransaction {
  clientId: string;
  reason: string;
  stockIssues?: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}

interface SyncState {
  // Status
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingCount: number;
  rejectedTransactions: RejectedTransaction[];
  
  // Error handling
  lastError: string | null;
  
  // Actions
  fullSync: () => Promise<SyncResult>;
  pullChanges: () => Promise<SyncResult>;
  pushTransactions: () => Promise<SyncResult>;
  sync: () => Promise<SyncResult>;
  cleanup: () => Promise<number>;
  updatePendingCount: () => Promise<void>;
  loadRejectedTransactions: () => Promise<void>;
  retryRejected: (clientId: string) => Promise<boolean>;
  deleteRejected: (clientId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  lastSyncTime: null,
  pendingCount: 0,
  rejectedTransactions: [],
  lastError: null,

  fullSync: async () => {
    set({ isSyncing: true, lastError: null });
    
    try {
      const result = await syncService.fullSync();
      
      if (result.success) {
        set({ lastSyncTime: new Date() });
        await get().updatePendingCount();
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
        reason: t.rejectionReason || 'Unknown reason',
      })),
    });
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

  clearError: () => {
    set({ lastError: null });
  },
}));
