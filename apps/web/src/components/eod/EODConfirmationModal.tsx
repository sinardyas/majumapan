import type { PreEODSummary } from '@pos/shared';
import { Button } from '@pos/ui';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

interface EODConfirmationModalProps {
  summary: PreEODSummary;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function EODConfirmationModal({ 
  summary, 
  onConfirm, 
  onCancel, 
  isLoading 
}: EODConfirmationModalProps) {
  const hasIssues = summary.syncStatus.pendingTransactions > 0 || 
                    summary.shifts.activeCount > 0 ||
                    summary.syncStatus.pendingCarts > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onCancel} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-2">
              {hasIssues ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                Confirm End of Day
              </h3>
            </div>
            <button 
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {hasIssues ? (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">
                  There are issues that need attention:
                </p>
                <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                  {summary.syncStatus.pendingTransactions > 0 && (
                    <li>{summary.syncStatus.pendingTransactions} pending transactions</li>
                  )}
                  {summary.shifts.activeCount > 0 && (
                    <li>{summary.shifts.activeCount} active shift(s)</li>
                  )}
                  {summary.syncStatus.pendingCarts > 0 && (
                    <li>{summary.syncStatus.pendingCarts} pending cart(s) - will be auto-saved</li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  All checks passed. Ready to close the day.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Operational Date</span>
                <span className="font-medium">
                  {new Date(summary.operationalDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Transactions</span>
                <span className="font-medium">
                  {summary.transactions.completed}/{summary.transactions.total}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Total Sales</span>
                <span className="font-semibold">
                  {formatCurrency(summary.revenue.totalSales)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Variance</span>
                <span className={`font-semibold ${
                  summary.shifts.totalVariance === 0 
                    ? 'text-green-600' 
                    : summary.shifts.totalVariance > 0 
                      ? 'text-blue-600' 
                      : 'text-red-600'
                }`}>
                  {summary.shifts.totalVariance === 0 
                    ? 'Balanced' 
                    : `${summary.shifts.totalVariance > 0 ? '+' : ''}${summary.shifts.totalVariance.toFixed(2)}`}
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">
                By confirming, you will:
              </p>
              <ul className="mt-2 text-xs text-gray-600 list-disc list-inside space-y-1">
                <li>Create a permanent day close record</li>
                <li>Close all transactions for this operational day</li>
                <li>Mark the operational day as CLOSED</li>
                <li>Auto-save any pending carts to the queue</li>
                <li>Generate all daily reports</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                'Confirm End of Day'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
