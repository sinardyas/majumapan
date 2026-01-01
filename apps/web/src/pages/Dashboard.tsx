import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db, type LocalTransaction } from '@/db';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@pos/ui';
import { DollarSign, Clipboard, RefreshCw, AlertTriangle } from 'lucide-react';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  pendingSync: number;
  lowStockItems: number;
}

interface ProductSales {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const { isOnline } = useOnlineStatus();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    pendingSync: 0,
    lowStockItems: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Array<{
    clientId: string;
    transactionNumber?: string;
    total: number;
    status: string;
    syncStatus: string;
    clientTimestamp: string;
  }>>([]);
  const [topProducts, setTopProducts] = useState<ProductSales[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [allTransactions, setAllTransactions] = useState<LocalTransaction[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?.storeId) {
        setIsLoading(false);
        return;
      }

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString();

        // Get today's transactions
        const todayTransactions = await db.transactions
          .where('storeId')
          .equals(user.storeId)
          .filter(t => t.clientTimestamp >= todayStr && t.status === 'completed')
          .toArray();

        // Calculate today's sales
        const todaySales = todayTransactions.reduce((sum, t) => sum + t.total, 0);

        // Get pending sync count
        const pendingSync = await db.transactions
          .where('syncStatus')
          .equals('pending')
          .count();

        // Get low stock items
        const stockItems = await db.stock
          .where('storeId')
          .equals(user.storeId)
          .toArray();
        const lowStockItems = stockItems.filter(s => s.quantity <= s.lowStockThreshold).length;

        setStats({
          todaySales,
          todayTransactions: todayTransactions.length,
          pendingSync,
          lowStockItems,
        });

        // Get recent transactions
        const recent = await db.transactions
          .where('storeId')
          .equals(user.storeId)
          .reverse()
          .limit(10)
          .toArray();

        setRecentTransactions(recent.map(t => ({
          clientId: t.clientId,
          transactionNumber: t.transactionNumber,
          total: t.total,
          status: t.status,
          syncStatus: t.syncStatus,
          clientTimestamp: t.clientTimestamp,
        })));

        // Store all transactions for reports
        const all = await db.transactions
          .where('storeId')
          .equals(user.storeId)
          .toArray();
        setAllTransactions(all);

        // Calculate top products from today's transactions
        const productSales: Record<string, ProductSales> = {};
        for (const txn of todayTransactions) {
          for (const item of txn.items) {
            if (!productSales[item.productId]) {
              productSales[item.productId] = {
                productId: item.productId,
                productName: item.productName,
                quantitySold: 0,
                totalRevenue: 0,
              };
            }
            productSales[item.productId].quantitySold += item.quantity;
            productSales[item.productId].totalRevenue += item.subtotal;
          }
        }
        const sortedProducts = Object.values(productSales)
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 5);
        setTopProducts(sortedProducts);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user?.storeId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReportTransactions = () => {
    const now = new Date();
    let startDate = new Date();
    
    if (reportPeriod === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (reportPeriod === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (reportPeriod === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    }
    
    return allTransactions.filter(
      t => new Date(t.clientTimestamp) >= startDate && t.status === 'completed'
    );
  };

  const calculateReportData = () => {
    const txns = getReportTransactions();
    const totalSales = txns.reduce((sum, t) => sum + t.total, 0);
    const totalTax = txns.reduce((sum, t) => sum + t.taxAmount, 0);
    const totalDiscounts = txns.reduce((sum, t) => sum + t.discountAmount, 0);
    const avgTransaction = txns.length > 0 ? totalSales / txns.length : 0;
    
    const paymentMethods = txns.reduce((acc, t) => {
      acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + t.total;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      transactionCount: txns.length,
      totalSales,
      totalTax,
      totalDiscounts,
      avgTransaction,
      paymentMethods,
    };
  };

  const exportToCSV = () => {
    const txns = getReportTransactions();
    
    const headers = ['Transaction #', 'Date', 'Items', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment Method'];
    const rows = txns.map(t => [
      t.transactionNumber || t.clientId,
      new Date(t.clientTimestamp).toLocaleString(),
      t.items.length.toString(),
      t.subtotal.toFixed(2),
      t.taxAmount.toFixed(2),
      t.discountAmount.toFixed(2),
      t.total.toFixed(2),
      t.paymentMethod,
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales-report-${reportPeriod}-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportData = calculateReportData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show message for admin users without a store assigned
  if (!user?.storeId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Store Assigned</h2>
          <p className="text-gray-600 mb-4">
            Your admin account is not assigned to a specific store. 
            Please use the store selector feature (coming soon) or contact the system administrator.
          </p>
          <p className="text-sm text-amber-600">
            Tip: Login with a manager or cashier account to access store data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.todaySales)}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Today's Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.todayTransactions}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clipboard className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Pending Sync */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Sync</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.pendingSync}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              stats.pendingSync > 0 ? 'bg-yellow-100' : 'bg-gray-100'
            }`}>
              <RefreshCw className={`h-6 w-6 ${stats.pendingSync > 0 ? 'text-yellow-600' : 'text-gray-600'}`} />
            </div>
          </div>
          {!isOnline && stats.pendingSync > 0 && (
            <p className="text-xs text-yellow-600 mt-2">Will sync when online</p>
          )}
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.lowStockItems}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              stats.lowStockItems > 0 ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              <AlertTriangle className={`h-6 w-6 ${stats.lowStockItems > 0 ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Top Products & Reports Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top Products Today</h2>
          </div>
          <div className="p-6">
            {topProducts.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No sales today</p>
            ) : (
              <ul className="space-y-3">
                {topProducts.map((product, index) => (
                  <li key={product.productId} className="flex items-center gap-3">
                    <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-sm font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{product.productName}</p>
                      <p className="text-sm text-gray-500">{product.quantitySold} sold</p>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(product.totalRevenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sales Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Sales Report</h2>
            <div className="flex items-center gap-2">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as typeof reportPeriod)}
                className="input py-1.5 px-3 text-sm"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                Export CSV
              </Button>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{reportData.transactionCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.totalSales)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Transaction</p>
                <p className="text-xl font-semibold text-gray-700">{formatCurrency(reportData.avgTransaction)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tax Collected</p>
                <p className="text-xl font-semibold text-gray-700">{formatCurrency(reportData.totalTax)}</p>
              </div>
            </div>
            
            {reportData.totalDiscounts > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Total Discounts Given</p>
                <p className="text-lg font-semibold text-green-600">-{formatCurrency(reportData.totalDiscounts)}</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Payment Methods</p>
              <div className="flex gap-4">
                {Object.entries(reportData.paymentMethods).map(([method, amount]) => (
                  <div key={method} className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      method === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {method}
                    </span>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        </div>
        <div className="p-6">
          {recentTransactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Transaction #</th>
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium">Total</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTransactions.map((txn) => (
                    <tr key={txn.clientId}>
                      <td className="py-3 font-medium">
                        {txn.transactionNumber || txn.clientId.slice(0, 8)}
                      </td>
                      <td className="py-3 text-gray-600">
                        {formatTime(txn.clientTimestamp)}
                      </td>
                      <td className="py-3 font-medium">
                        {formatCurrency(txn.total)}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          txn.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : txn.status === 'voided'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          txn.syncStatus === 'synced'
                            ? 'bg-green-100 text-green-700'
                            : txn.syncStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {txn.syncStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
