import { useEffect } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useAuthStore } from '@/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { EntityProgressCard, SyncControls, PendingTransactionsList, RejectedTransactionsList } from '@/components/sync';
import { Button } from '@pos/ui';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Navigate } from 'react-router-dom';

export default function SyncStatus() {
  const { user } = useAuthStore();
  const { isOnline } = useOnlineStatus();
  const {
    entityCounts,
    lastSyncTime,
    isSyncing,
    isAutoRefreshing,
    loadEntityCounts,
    loadPendingTransactions,
    loadRejectedTransactions,
    sync,
    setAutoRefreshing,
  } = useSyncStore();

  useEffect(() => {
    loadEntityCounts();
    loadPendingTransactions();
    loadRejectedTransactions();
  }, [loadEntityCounts, loadPendingTransactions, loadRejectedTransactions]);

  useEffect(() => {
    if (!isAutoRefreshing) return;

    const interval = setInterval(() => {
      if (isOnline) {
        loadEntityCounts();
        loadPendingTransactions();
        loadRejectedTransactions();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isAutoRefreshing, isOnline, loadEntityCounts, loadPendingTransactions, loadRejectedTransactions]);

  if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
    return <Navigate to="/pos" replace />;
  }

  const handleRefresh = async () => {
    await sync();
  };

  const handleToggleAutoRefresh = () => {
    setAutoRefreshing(!isAutoRefreshing);
  };

  const totalPending = entityCounts.products.pending + entityCounts.categories.pending + entityCounts.transactions.pending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sync Status</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor and manage data synchronization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <Button
            onClick={handleToggleAutoRefresh}
            variant={isAutoRefreshing ? 'default' : 'outline'}
            size="sm"
          >
            {isAutoRefreshing ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            onClick={handleRefresh}
            isLoading={isSyncing}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {lastSyncTime && (
        <div className="text-sm text-gray-500">
          Last sync: {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EntityProgressCard
          entity="products"
          synced={entityCounts.products.synced}
          pending={entityCounts.products.pending}
          isLoading={isSyncing}
        />
        <EntityProgressCard
          entity="categories"
          synced={entityCounts.categories.synced}
          pending={entityCounts.categories.pending}
          isLoading={isSyncing}
        />
        <EntityProgressCard
          entity="transactions"
          synced={entityCounts.transactions.synced}
          pending={entityCounts.transactions.pending}
          rejected={entityCounts.transactions.rejected}
          isLoading={isSyncing}
        />
      </div>

      <SyncControls />

      {totalPending > 0 && (
        <PendingTransactionsList />
      )}

      <RejectedTransactionsList />
    </div>
  );
}
