import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db, type LocalTransaction } from '@/db';
import { Button } from '@/components/ui/Button';

export default function Transactions() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'voided' | 'pending'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    const loadTransactions = async () => {
      if (!user?.storeId) return;

      try {
        let query = db.transactions
          .where('storeId')
          .equals(user.storeId);

        let txns = await query.reverse().toArray();

        // Apply date filter
        if (dateFilter !== 'all') {
          const filterDate = new Date();
          if (dateFilter === 'today') {
            filterDate.setHours(0, 0, 0, 0);
          } else if (dateFilter === 'week') {
            filterDate.setDate(filterDate.getDate() - 7);
          } else if (dateFilter === 'month') {
            filterDate.setMonth(filterDate.getMonth() - 1);
          }
          const filterStr = filterDate.toISOString();
          txns = txns.filter(t => t.clientTimestamp >= filterStr);
        }

        // Apply status filter
        if (filter !== 'all') {
          if (filter === 'pending') {
            txns = txns.filter(t => t.syncStatus === 'pending');
          } else {
            txns = txns.filter(t => t.status === filter);
          }
        }

        setTransactions(txns);
      } catch (error) {
        console.error('Error loading transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactions();
  }, [user?.storeId, filter, dateFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">View and manage your transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Date:</span>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
            className="input py-1.5 px-3 text-sm"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="input py-1.5 px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
            <option value="pending">Pending Sync</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="h-16 w-16 mx-auto text-gray-300 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">Transaction #</th>
                  <th className="px-6 py-3 font-medium">Date & Time</th>
                  <th className="px-6 py-3 font-medium">Items</th>
                  <th className="px-6 py-3 font-medium">Payment</th>
                  <th className="px-6 py-3 font-medium">Total</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((txn) => (
                  <tr key={txn.clientId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm">
                        {txn.transactionNumber || txn.clientId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDateTime(txn.clientTimestamp)}
                    </td>
                    <td className="px-6 py-4">
                      {txn.items.length} items
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize">{txn.paymentMethod}</span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(txn.total)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          txn.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : txn.status === 'voided'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {txn.status}
                        </span>
                        {txn.syncStatus !== 'synced' && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            txn.syncStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {txn.syncStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTransaction(txn)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Transaction Details</h3>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Transaction #</p>
                  <p className="font-mono">{selectedTransaction.transactionNumber || selectedTransaction.clientId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p>{formatDateTime(selectedTransaction.clientTimestamp)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="capitalize">{selectedTransaction.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="capitalize">{selectedTransaction.status}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-sm text-gray-500 mb-2">Items</p>
                <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                  {selectedTransaction.items.map((item, index) => (
                    <div key={index} className="px-4 py-3 flex justify-between">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(item.unitPrice)} x {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(selectedTransaction.subtotal)}</span>
                </div>
                {selectedTransaction.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount {selectedTransaction.discountCode && `(${selectedTransaction.discountCode})`}</span>
                    <span>-{formatCurrency(selectedTransaction.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span>{formatCurrency(selectedTransaction.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(selectedTransaction.total)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(selectedTransaction.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Change</span>
                  <span>{formatCurrency(selectedTransaction.changeAmount)}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedTransaction(null)}>
                Close
              </Button>
              <Button>
                Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
