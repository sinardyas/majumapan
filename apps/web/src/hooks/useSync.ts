import { useEffect, useCallback, useRef } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useOnlineStatus } from './useOnlineStatus';
import { useAuthStore } from '@/stores/authStore';

interface UseSyncOptions {
  // Auto sync interval in milliseconds (default: 5 minutes)
  autoSyncInterval?: number;
  // Whether to sync on mount (default: false - handled by login flow)
  syncOnMount?: boolean;
  // Whether to sync when coming back online (default: true)
  syncOnReconnect?: boolean;
  // Whether to enable background sync (default: true)
  enableBackgroundSync?: boolean;
}

export function useSync(options: UseSyncOptions = {}) {
  const {
    autoSyncInterval = 5 * 60 * 1000, // 5 minutes
    syncOnMount = false,
    syncOnReconnect = true,
    enableBackgroundSync = true,
  } = options;

  const { 
    isOnline, 
    wasOffline,
    startSyncingAfterReconnect,
    finishSyncingAfterReconnect,
  } = useOnlineStatus();
  const { isAuthenticated } = useAuthStore();
  const {
    isSyncing,
    lastSyncTime,
    pendingCount,
    rejectedTransactions,
    lastError,
    fullSync,
    pullChanges,
    pushTransactions,
    sync,
    cleanup,
    updatePendingCount,
    loadRejectedTransactions,
    retryRejected,
    deleteRejected,
    clearError,
  } = useSyncStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInitialSyncRef = useRef(false);
  
  // Refs for reconnect sync protection (prevents infinite loop)
  const reconnectSyncTriggeredRef = useRef(false);
  const reconnectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when coming back online (with debounce and re-trigger protection)
  // FIX: Removed isSyncing from dependencies to prevent infinite loop
  // See: The effect was re-triggering every time isSyncing changed from true->false
  // because wasOffline was never being reset after sync completed.
  useEffect(() => {
    // Reset the triggered flag when going offline
    if (!isOnline) {
      reconnectSyncTriggeredRef.current = false;
      if (reconnectDebounceRef.current) {
        clearTimeout(reconnectDebounceRef.current);
        reconnectDebounceRef.current = null;
      }
      return;
    }

    // Trigger sync when coming back online (with debounce)
    if (isOnline && wasOffline && syncOnReconnect && isAuthenticated && !reconnectSyncTriggeredRef.current) {
      // Clear any pending debounce
      if (reconnectDebounceRef.current) {
        clearTimeout(reconnectDebounceRef.current);
      }

      // Debounce the sync trigger by 300ms to prevent rapid reconnection events
      reconnectDebounceRef.current = setTimeout(async () => {
        // Double-check the flag inside the timeout (in case it was set by another call)
        if (!reconnectSyncTriggeredRef.current) {
          reconnectSyncTriggeredRef.current = true;
          console.log('Back online, triggering sync...');
          
          startSyncingAfterReconnect();
          try {
            await sync();
          } finally {
            finishSyncingAfterReconnect();
          }
        }
      }, 300);
    }

    return () => {
      if (reconnectDebounceRef.current) {
        clearTimeout(reconnectDebounceRef.current);
      }
    };
  }, [isOnline, wasOffline, syncOnReconnect, isAuthenticated, sync, startSyncingAfterReconnect, finishSyncingAfterReconnect]);
  // NOTE: Removed isSyncing from dependencies - we use reconnectSyncTriggeredRef to prevent re-triggers

  // Auto sync interval
  useEffect(() => {
    if (!enableBackgroundSync || !isAuthenticated) {
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval
    intervalRef.current = setInterval(() => {
      if (isOnline && !isSyncing) {
        console.log('Auto sync triggered...');
        sync();
      }
    }, autoSyncInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoSyncInterval, enableBackgroundSync, isAuthenticated, isOnline, isSyncing, sync]);

  // Initial sync on mount (if enabled)
  useEffect(() => {
    if (syncOnMount && isAuthenticated && isOnline && !hasInitialSyncRef.current) {
      hasInitialSyncRef.current = true;
      sync();
    }
  }, [syncOnMount, isAuthenticated, isOnline, sync]);

  // Load pending count and rejected transactions on mount
  useEffect(() => {
    if (isAuthenticated) {
      updatePendingCount();
      loadRejectedTransactions();
    }
  }, [isAuthenticated, updatePendingCount, loadRejectedTransactions]);

  // Cleanup old transactions periodically (once per day)
  useEffect(() => {
    if (!isAuthenticated) return;

    const cleanupInterval = setInterval(() => {
      cleanup();
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Also run cleanup on mount
    cleanup();

    return () => clearInterval(cleanupInterval);
  }, [isAuthenticated, cleanup]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      return { success: false, error: 'No internet connection' };
    }
    return sync();
  }, [isOnline, sync]);

  // Manual full sync trigger
  const triggerFullSync = useCallback(async () => {
    if (!isOnline) {
      return { success: false, error: 'No internet connection' };
    }
    return fullSync();
  }, [isOnline, fullSync]);

  // Manual push trigger
  const triggerPush = useCallback(async () => {
    if (!isOnline) {
      return { success: false, error: 'No internet connection' };
    }
    return pushTransactions();
  }, [isOnline, pushTransactions]);

  // Manual pull trigger
  const triggerPull = useCallback(async () => {
    if (!isOnline) {
      return { success: false, error: 'No internet connection' };
    }
    return pullChanges();
  }, [isOnline, pullChanges]);

  return {
    // State
    isSyncing,
    isOnline,
    lastSyncTime,
    pendingCount,
    rejectedTransactions,
    lastError,
    
    // Actions
    sync: triggerSync,
    fullSync: triggerFullSync,
    push: triggerPush,
    pull: triggerPull,
    retryRejected,
    deleteRejected,
    clearError,
    
    // Helpers
    canSync: isOnline && !isSyncing && isAuthenticated,
    hasPendingTransactions: pendingCount > 0,
    hasRejectedTransactions: rejectedTransactions.length > 0,
  };
}
