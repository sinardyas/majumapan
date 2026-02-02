import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [isSyncingAfterReconnect, setIsSyncingAfterReconnect] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    if (!navigator.onLine) {
      // Double-check with a small delay
      setTimeout(() => {
        setIsOnline(navigator.onLine);
      }, 100);
    }
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Called when sync starts after reconnection
  const startSyncingAfterReconnect = useCallback(() => {
    setIsSyncingAfterReconnect(true);
  }, []);

  // Called when sync completes after reconnection
  const finishSyncingAfterReconnect = useCallback(() => {
    setIsSyncingAfterReconnect(false);
    // Note: wasOffline will be reset by OfflineBanner after showing success (auto-dismiss)
  }, []);

  // Reset wasOffline flag (for manual dismiss or after auto-dismiss timer)
  const acknowledgeReconnection = useCallback(() => {
    setWasOffline(false);
  }, []);

  return {
    isOnline,
    wasOffline,
    isSyncingAfterReconnect,
    startSyncingAfterReconnect,
    finishSyncingAfterReconnect,
    acknowledgeReconnection,
  };
}
