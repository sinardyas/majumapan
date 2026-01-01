import { useEffect, useState } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { Button } from '@pos/ui';
import { RefreshCw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function PendingTransactionsList() {
  const {
    pendingTransactions,
    pendingTotal,
    isSyncing,
    loadPendingTransactions,
    retryPending,
    clearPending,
  } = useSyncStore();

  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    loadPendingTransactions(limit, (page - 1) * limit);
  }, [page, loadPendingTransactions]);

  const totalPages = Math.ceil(pendingTotal / limit);

  const handleRetryAll = async () => {
    for (const txn of pendingTransactions) {
      await retryPending(txn.clientId);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all pending transactions?')) {
      await clearPending();
    }
  };

  if (pendingTotal === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Pending Transactions</h3>
          <span className="text-sm text-gray-500">0</span>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p>No pending transactions</p>
          <p className="text-sm mt-1">All transactions have been synced</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">
          Pending Transactions ({pendingTotal.toLocaleString()})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRetryAll}
            variant="outline"
            size="sm"
            disabled={isSyncing}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry All
          </Button>
          <Button
            onClick={handleClearAll}
            variant="outline"
            size="sm"
            disabled={isSyncing}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear All
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Transaction
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pendingTransactions.map((txn) => (
              <tr key={txn.clientId} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {txn.transactionNumber || txn.clientId.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {formatCurrency(txn.total)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDistanceToNow(new Date(txn.clientTimestamp), { addSuffix: true })}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      onClick={() => retryPending(txn.clientId)}
                      variant="ghost"
                      size="sm"
                      disabled={isSyncing}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => clearPending(txn.clientId)}
                      variant="ghost"
                      size="sm"
                      disabled={isSyncing}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pendingTotal)} of {pendingTotal}
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage(page - 1)}
              variant="outline"
              size="sm"
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              onClick={() => setPage(page + 1)}
              variant="outline"
              size="sm"
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
