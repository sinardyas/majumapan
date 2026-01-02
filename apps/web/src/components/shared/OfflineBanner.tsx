import { useEffect, useRef } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const { 
    isOnline, 
    wasOffline, 
    isSyncingAfterReconnect, 
    acknowledgeReconnection 
  } = useOnlineStatus();
  
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss success banner after 2.5 seconds
  useEffect(() => {
    // Clear any existing timer
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }

    // When sync completes (online, was offline, not syncing anymore)
    if (isOnline && wasOffline && !isSyncingAfterReconnect) {
      autoDismissRef.current = setTimeout(() => {
        acknowledgeReconnection();
      }, 2500); // 2.5 seconds
    }

    return () => {
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
      }
    };
  }, [isOnline, wasOffline, isSyncingAfterReconnect, acknowledgeReconnection]);

  // Don't show banner if online, not recently offline, and not syncing
  if (isOnline && !wasOffline && !isSyncingAfterReconnect) {
    return null;
  }

  // Offline banner (yellow)
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-2 text-center font-medium">
        <span className="inline-flex items-center gap-2">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          You are offline. Changes will be synced when you reconnect.
        </span>
      </div>
    );
  }

  // Syncing after reconnection (blue with spinner)
  if (isSyncingAfterReconnect) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 text-white px-4 py-2 text-center font-medium">
        <span className="inline-flex items-center gap-2">
          <svg 
            className="animate-spin h-5 w-5" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Back online! Syncing your data...
        </span>
      </div>
    );
  }

  // Sync complete (green, auto-dismisses after 2.5s)
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white px-4 py-2 text-center font-medium">
      <span className="inline-flex items-center gap-2">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Back online! Sync complete.
        <button
          onClick={acknowledgeReconnection}
          className="ml-4 underline hover:no-underline"
        >
          Dismiss
        </button>
      </span>
    </div>
  );
}
