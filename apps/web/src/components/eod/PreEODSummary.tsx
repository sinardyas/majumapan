import type { PreEODSummary } from '@pos/shared';
import { Clock, DollarSign, CreditCard, AlertCircle, CheckCircle, ShoppingCart } from 'lucide-react';

interface PreEODSummaryProps {
  summary: PreEODSummary;
}

export function PreEODSummary({ summary }: PreEODSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const hasIssues = summary.syncStatus.pendingTransactions > 0 || 
                    summary.shifts.activeCount > 0 ||
                    summary.syncStatus.pendingCarts > 0;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pre-EOD Summary</h2>
            <p className="text-sm text-gray-500">
              {new Date(summary.operationalDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {hasIssues ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                <AlertCircle className="h-4 w-4 mr-1" />
                Issues Detected
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <CheckCircle className="h-4 w-4 mr-1" />
                Ready for EOD
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Transactions */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ShoppingCart className="h-5 w-5 text-gray-500" />
              <h3 className="font-medium text-gray-900">Transactions</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Total</span>
                <span className="font-semibold">{summary.transactions.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Completed</span>
                <span className="font-semibold text-green-600">{summary.transactions.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Voided</span>
                <span className="font-semibold text-red-600">{summary.transactions.voided}</span>
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <DollarSign className="h-5 w-5 text-gray-500" />
              <h3 className="font-medium text-gray-900">Revenue</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Total Sales</span>
                <span className="font-semibold">{formatCurrency(summary.revenue.totalSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Cash</span>
                <span className="font-semibold">{formatCurrency(summary.revenue.cashRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Card</span>
                <span className="font-semibold">{formatCurrency(summary.revenue.cardRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <CreditCard className="h-5 w-5 text-gray-500" />
              <h3 className="font-medium text-gray-900">Payment Breakdown</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Refunds</span>
                <span className="font-semibold text-red-600">-{formatCurrency(summary.revenue.refunds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Discounts</span>
                <span className="font-semibold text-red-600">-{formatCurrency(summary.revenue.discounts)}</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden mt-2">
                <div 
                  className="h-full bg-green-500"
                  style={{ 
                    width: `${summary.revenue.totalSales > 0 
                      ? (summary.revenue.cashRevenue / summary.revenue.totalSales) * 100 
                      : 0}%` 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Cash: {summary.revenue.totalSales > 0 
                  ? Math.round((summary.revenue.cashRevenue / summary.revenue.totalSales) * 100)
                  : 0}%</span>
                <span>Card: {summary.revenue.totalSales > 0 
                  ? Math.round((summary.revenue.cardRevenue / summary.revenue.totalSales) * 100)
                  : 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shifts */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <h3 className="font-medium text-gray-900">Shifts</h3>
            </div>
            {summary.shifts.activeCount > 0 ? (
              <span className="text-sm text-yellow-600 font-medium">
                {summary.shifts.activeCount} active shift(s)
              </span>
            ) : (
              <span className="text-sm text-green-600 font-medium">
                All shifts closed
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            Total Variance: 
            <span className={`ml-1 font-semibold ${
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

        {/* Sync Status */}
        <div className="mt-4 flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center space-x-2">
            {summary.syncStatus.pendingTransactions > 0 ? (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            <span className="text-sm text-yellow-800">
              {summary.syncStatus.pendingTransactions > 0 
                ? `${summary.syncStatus.pendingTransactions} pending transaction(s) need sync`
                : 'All transactions synced'}
            </span>
          </div>
          {summary.syncStatus.pendingCarts > 0 && (
            <div className="flex items-center space-x-2 text-sm text-yellow-800">
              <ShoppingCart className="h-4 w-4" />
              <span>{summary.syncStatus.pendingCarts} pending cart(s)</span>
            </div>
          )}
        </div>

        {/* Period Info */}
        <div className="mt-4 text-sm text-gray-500 text-center">
          Period: {new Date(summary.periodStart).toLocaleString()} → {new Date(summary.periodEnd).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
