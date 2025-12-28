import { registerSW } from 'virtual:pwa-register';
import { syncService } from '@/services/sync';

// Register service worker with auto-update
export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Show a prompt to the user to refresh
      if (confirm('New version available. Reload to update?')) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('App is ready to work offline');
    },
    onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      console.log('Service Worker registered:', swUrl);
      
      // Set up periodic sync if supported
      if (registration && 'periodicSync' in registration) {
        registerPeriodicSync(registration);
      }
      
      // Set up background sync if supported
      if (registration && 'sync' in registration) {
        registerBackgroundSync();
      }
    },
    onRegisterError(error: Error) {
      console.error('Service Worker registration failed:', error);
    },
  });

  return updateSW;
}

// Register periodic background sync
async function registerPeriodicSync(registration: ServiceWorkerRegistration) {
  try {
    // Check if permission is granted
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    });
    
    if (status.state === 'granted') {
      // Request periodic sync every 15 minutes
      await (registration as any).periodicSync.register('pos-sync', {
        minInterval: 15 * 60 * 1000, // 15 minutes
      });
      console.log('Periodic sync registered');
    }
  } catch (error) {
    console.log('Periodic sync not supported or permission denied');
  }
}

// Register one-time background sync
async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('pos-transaction-sync');
      console.log('Background sync registered');
    } catch (error) {
      console.log('Background sync registration failed:', error);
    }
  }
}

// Trigger background sync manually (when coming back online)
export async function triggerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('pos-transaction-sync');
    } catch (error) {
      // Fall back to direct sync
      console.log('Background sync failed, using direct sync');
      await syncService.sync();
    }
  } else {
    // Browser doesn't support background sync, use direct sync
    await syncService.sync();
  }
}

// Listen for messages from service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'SYNC_TRANSACTIONS') {
      console.log('Service worker requested sync');
      await syncService.pushTransactions();
    }
  });
}

// Export for use in components
export { syncService };
