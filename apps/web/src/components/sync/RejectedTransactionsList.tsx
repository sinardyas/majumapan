import { useEffect, useState } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { Button } from '@pos/ui';
import { RefreshCw, Trash2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function RejectedTransactionsList() {
  const {
    rejectedTransactions,
    isSyncing,
    loadRejectedTransactions,
    retryRejected,
    deleteRejected,
  } = useSyncStore();

  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    loadRejectedTransactions();
  }, [loadRejectedTransactions]);

  const total = rejectedTransactions.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedTransactions = rejectedTransactions.slice(startIndex, startIndex + limit);

  const handleRetryAll = async () => {
    for (const txn of rejectedTransactions) {
      await retryRejected(txn.clientId);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all rejected transactions?')) {
      for (const txn of rejectedTransactions) {
        await deleteRejected(txn.clientId);
      }
    }
  };

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Rejected Transactions</h3>
          <span className="text-sm text-gray-500">0</span>
        </div>
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No rejected transactions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          Rejected Transactions
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-sm">
            {total.toLocaleString()}
          </span>
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

      <div className="space-y-3">
        {paginatedTransactions.map((txn) => (
          <div key={txn.clientId} className="border border-red-200 rounded-lg p-3 bg-red-50">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {txn.transactionNumber || txn.clientId.slice(0, 8)}
                  </span>
                  <span className="text-xs text-red-600 font-medium">
                    {txn.reason}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(txn.clientId), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => retryRejected(txn.clientId)}
                  variant="ghost"
                  size="sm"
                  disabled={isSyncing}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button
                  onClick={() => deleteRejected(txn.clientId)}
                  variant="ghost"
                  size="sm"
                  disabled={isSyncing}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {txn.stockIssues && txn.stockIssues.length > 0 && (
              <div className="mt-2 pt-2 border-t border-red-200">
                <p className="text-xs font-medium text-red-700 mb-1">Stock Issues:</p>
                {txn.stockIssues.map((issue) => (
                  <div key={issue.productId} className="text-xs text-red-600 ml-2">
                    {issue.productName}: requested {issue.requested}, available {issue.available}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {startIndex + 1} to {Math.min(startIndex + limit, total)} of {total}
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
