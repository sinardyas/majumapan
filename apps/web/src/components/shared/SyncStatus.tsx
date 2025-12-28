import { useSync } from '@/hooks/useSync';
import { Button } from '@/components/ui/Button';

interface SyncStatusProps {
  showDetails?: boolean;
}

export function SyncStatus({ showDetails = false }: SyncStatusProps) {
  const {
    isSyncing,
    isOnline,
    lastSyncTime,
    pendingCount,
    hasRejectedTransactions,
    sync,
    canSync,
  } = useSync();

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Online status indicator */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        isOnline ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
      }`}>
        <span className={`h-2 w-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-yellow-500'
        }`}></span>
        {isOnline ? 'Online' : 'Offline'}
      </div>

      {/* Pending transactions badge */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-blue-100 text-blue-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {pendingCount} pending
        </div>
      )}

      {/* Rejected transactions warning */}
      {hasRejectedTransactions && (
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-red-100 text-red-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Rejected
        </div>
      )}

      {showDetails && (
        <>
          {/* Last sync time */}
          <span className="text-sm text-gray-500">
            Last sync: {formatTime(lastSyncTime)}
          </span>

          {/* Manual sync button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync()}
            disabled={!canSync}
            className="flex items-center gap-1"
          >
            {isSyncing ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
