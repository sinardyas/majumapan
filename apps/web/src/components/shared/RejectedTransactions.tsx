import { useState, useEffect } from 'react';
import { useSync } from '@/hooks/useSync';
import { db, type LocalTransaction } from '@/db';
import { Button } from '@/components/ui/Button';

interface RejectedTransactionsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RejectedTransactions({ isOpen, onClose }: RejectedTransactionsProps) {
  const { retryRejected, deleteRejected, push } = useSync();
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTransactions = async () => {
    const rejected = await db.transactions
      .where('syncStatus')
      .equals('rejected')
      .toArray();
    setTransactions(rejected);
  };

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen]);

  const handleRetry = async (clientId: string) => {
    setIsLoading(true);
    try {
      await retryRejected(clientId);
      await push();
      await loadTransactions();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This cannot be undone.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await deleteRejected(clientId);
      await loadTransactions();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryAll = async () => {
    setIsLoading(true);
    try {
      for (const txn of transactions) {
        await retryRejected(txn.clientId);
      }
      await push();
      await loadTransactions();
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Rejected Transactions</h2>
            <p className="text-sm text-gray-500 mt-1">
              These transactions failed due to stock issues or other errors
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No rejected transactions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((txn) => (
                <div key={txn.clientId} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {txn.transactionNumber || txn.clientId.slice(0, 8)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(txn.clientTimestamp)}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(txn.total)}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="text-sm text-gray-600 mb-3">
                    {txn.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.quantity}x {item.productName}</span>
                        <span>{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Rejection reason */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="font-medium text-red-700">
                          {txn.rejectionReason || 'Transaction rejected'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(txn.clientId)}
                      disabled={isLoading}
                    >
                      Retry Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(txn.clientId)}
                      disabled={isLoading}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {transactions.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleRetryAll} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Retry All'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
