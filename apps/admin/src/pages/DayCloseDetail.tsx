import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@pos/ui';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft,
  Download,
  Mail,
  DollarSign,
  CreditCard,
  Package,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import type { DayClose, DailySalesReport, CashReconReport, InventoryMovementReport, ShiftAggregationReport, TransactionSummary } from '@pos/shared';
import { TransactionRow } from '@/components/day-close/TransactionRow';
import { TransactionLineItems } from '@/components/day-close/TransactionLineItems';

interface Tab {
  id: 'sales' | 'cash' | 'inventory' | 'audit' | 'shifts';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: 'sales', label: 'Sales', icon: DollarSign },
  { id: 'cash', label: 'Cash', icon: CreditCard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'audit', label: 'Audit', icon: FileText },
  { id: 'shifts', label: 'Shifts', icon: Clock },
];

export default function DayCloseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dayClose, setDayClose] = useState<DayClose | null>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'cash' | 'inventory' | 'audit' | 'shifts'>('sales');
  const [reports, setReports] = useState<{
    sales: DailySalesReport | null;
    cash: CashReconReport | null;
    inventory: InventoryMovementReport | null;
    shifts: ShiftAggregationReport | null;
  }>({
    sales: null,
    cash: null,
    inventory: null,
    shifts: null,
  });

  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [txSummary, setTxSummary] = useState<{
    total: number;
    completed: number;
    voided: number;
    totalAmount: number;
    totalRefunds: number;
  } | null>(null);
  const [txPagination, setTxPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [txFilters, setTxFilters] = useState({
    status: 'all',
    paymentMethod: 'all',
    search: '',
  });
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDayCloseData();
    }
  }, [id]);

  const fetchDayCloseData = async () => {
    try {
      const [dayCloseRes, salesRes, cashRes, inventoryRes, shiftsRes] = await Promise.all([
        api.get<DayClose>(`/day-close/${id}`),
        api.get<DailySalesReport>(`/day-close/${id}/report/sales`),
        api.get<CashReconReport>(`/day-close/${id}/report/cash`),
        api.get<InventoryMovementReport>(`/day-close/${id}/report/inventory`),
        api.get<ShiftAggregationReport>(`/day-close/${id}/report/shifts`),
      ]);

      if (dayCloseRes.success && dayCloseRes.data) {
        setDayClose(dayCloseRes.data);
      }
      if (salesRes.success && salesRes.data) setReports(prev => ({ ...prev, sales: salesRes.data! }));
      if (cashRes.success && salesRes.data) setReports(prev => ({ ...prev, cash: cashRes.data! }));
      if (inventoryRes.success && inventoryRes.data) setReports(prev => ({ ...prev, inventory: inventoryRes.data! }));
      if (shiftsRes.success && shiftsRes.data) setReports(prev => ({ ...prev, shifts: shiftsRes.data! }));
    } catch (error) {
      console.error('Error fetching day close data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async (page: number = 1) => {
    if (!id) return;
    setIsLoadingTx(true);
    try {
      const response = await api.get<{
        transactions: TransactionSummary[];
        summary: { total: number; completed: number; voided: number; totalAmount: number; totalRefunds: number };
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
      }>(`/day-close/${id}/transactions`, {
        queryParams: {
          page,
          pageSize: 25,
          status: txFilters.status,
          paymentMethod: txFilters.paymentMethod,
          search: txFilters.search,
        }
      });

      if (response.success && response.data) {
        setTransactions(response.data.transactions);
        setTxSummary(response.data.summary);
        setTxPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoadingTx(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit' && id) {
      fetchTransactions(1);
    }
  }, [activeTab, id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleDownloadCSV = async () => {
    const endpoint = activeTab === 'sales' ? '/csv/sales'
      : activeTab === 'cash' ? '/csv/cash'
      : activeTab === 'inventory' ? '/csv/inventory'
      : activeTab === 'audit' ? '/csv/audit'
      : '/csv/shifts';

    try {
      const response = await api.get<string>(`/day-close/${id}${endpoint}`, { responseType: 'text' });
      if (response.success && response.data) {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eod-${activeTab}-report-${dayClose?.operationalDate || 'unknown'}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const handleEmailReport = async () => {
    const email = prompt('Enter email address:');
    if (email) {
      try {
        const response = await api.post(`/day-close/${id}/email`, { recipients: [email] });
        if (response.success) {
          alert('Report sent!');
        } else {
          alert('Failed: ' + (response.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error sending email:', error);
      }
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const { accessToken } = useAuthStore.getState();
      
      const response = await fetch(`/api/v1/day-close/${id}/export/pdf/all`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eod-report-${dayClose?.operationalDate || 'unknown'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Error downloading PDF:', response.statusText);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dayClose) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Day close not found</p>
        <Button onClick={() => navigate('/eod/day-close-history')} className="mt-4">
          Back to History
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/eod/day-close-history')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{dayClose.dayCloseNumber}</h1>
            <p className="text-gray-500 flex items-center gap-2">
              {new Date(dayClose.operationalDate).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}
              <span className="text-gray-300">•</span>
              <span className="text-gray-600 font-medium">{dayClose.storeName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleDownloadCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={handleEmailReport}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Sales</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(Number(dayClose.totalSales))}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-xl font-bold text-gray-900">{dayClose.totalTransactions}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Cash Revenue</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(Number(dayClose.cashRevenue))}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Card Revenue</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(Number(dayClose.cardRevenue))}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'sales' && reports.sales && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Daily Sales Summary</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-xl font-bold">{reports.sales.overview.completedTransactions}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Voided</p>
                  <p className="text-xl font-bold">{reports.sales.overview.voidedTransactions}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Net Revenue</p>
                  <p className="text-xl font-bold">{formatCurrency(reports.sales.revenue.netRevenue)}</p>
                </div>
              </div>
              <h4 className="font-medium mb-2">Top Products</h4>
              <ul className="space-y-2">
                {reports.sales.topProducts.slice(0, 5).map((product, i) => (
                  <li key={i} className="flex justify-between py-2 border-b">
                    <span>{product.productName}</span>
                    <span className="font-medium">{product.quantitySold} sold</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'cash' && reports.cash && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Cash Reconciliation</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Expected Cash</p>
                  <p className="text-xl font-bold">{formatCurrency(reports.cash.cashHandling.expectedCash)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Total Variance</p>
                  <p className={`text-xl font-bold ${reports.cash.summary.totalVariance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(reports.cash.summary.totalVariance)}
                  </p>
                </div>
              </div>
              <h4 className="font-medium mb-2">Shift Breakdown</h4>
              <ul className="space-y-2">
                {reports.cash.shifts.map((shift, i) => (
                  <li key={i} className="flex justify-between py-2 border-b">
                    <span>{shift.cashierName}</span>
                    <span>Variance: {formatCurrency(shift.variance)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'inventory' && reports.inventory && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Inventory Movement</h3>
              <h4 className="font-medium mb-2">Low Stock Alerts</h4>
              {reports.inventory.lowStockAlerts.length === 0 ? (
                <p className="text-gray-500">No low stock items</p>
              ) : (
                <ul className="space-y-2 mb-6">
                  {reports.inventory.lowStockAlerts.map((item, i) => (
                    <li key={i} className="flex justify-between py-2 border-b bg-yellow-50 px-3 rounded">
                      <span>{item.productName}</span>
                      <span className="text-yellow-700">{item.currentStock} / {item.threshold}</span>
                    </li>
                  ))}
                </ul>
              )}
              <h4 className="font-medium mb-2">Items Sold</h4>
              <ul className="space-y-2">
                {reports.inventory.itemsSold.slice(0, 10).map((item, i) => (
                  <li key={i} className="flex justify-between py-2 border-b">
                    <span>{item.productName}</span>
                    <span className="font-medium">{item.quantitySold} sold</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'audit' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Transaction Audit Log</h3>

              {txSummary && (
                <div className="grid grid-cols-5 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-xl font-bold">{txSummary.total}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600">Completed</p>
                    <p className="text-xl font-bold text-green-700">{txSummary.completed}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-red-600">Voided</p>
                    <p className="text-xl font-bold text-red-700">{txSummary.voided}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Total Sales</p>
                    <p className="text-xl font-bold">{formatCurrency(txSummary.totalAmount)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Refunds</p>
                    <p className="text-xl font-bold">{formatCurrency(txSummary.totalRefunds)}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mb-4">
                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={txFilters.status}
                    onChange={(e) => setTxFilters(f => ({ ...f, status: e.target.value }))}
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="voided">Voided</option>
                    <option value="pending_sync">Pending Sync</option>
                  </select>
                </div>
                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={txFilters.paymentMethod}
                    onChange={(e) => setTxFilters(f => ({ ...f, paymentMethod: e.target.value }))}
                  >
                    <option value="all">All Payments</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Transaction number..."
                      className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 text-sm"
                      value={txFilters.search}
                      onChange={(e) => setTxFilters(f => ({ ...f, search: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && fetchTransactions(1)}
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => fetchTransactions(1)}>
                    Search
                  </Button>
                </div>
              </div>

              {isLoadingTx ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No transactions found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-4 py-2 text-left">Transaction</th>
                          <th className="px-4 py-2 text-left">Time</th>
                          <th className="px-4 py-2 text-left">Cashier</th>
                          <th className="px-4 py-2 text-left">Items</th>
                          <th className="px-4 py-2 text-left">Total</th>
                          <th className="px-4 py-2 text-left">Payment</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((txn) => (
                          <TransactionRow
                            key={txn.id}
                            transaction={txn}
                            isExpanded={expandedTxId === txn.id}
                            onToggle={() => setExpandedTxId(
                              expandedTxId === txn.id ? null : txn.id
                            )}
                          />
                        ))}
                        {expandedTxId && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="px-4 py-4">
                              <TransactionLineItems
                                transactionId={expandedTxId}
                                dayCloseId={id!}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {txPagination && txPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-500">
                        Showing {(txPagination.page - 1) * txPagination.pageSize + 1} to{' '}
                        {Math.min(txPagination.page * txPagination.pageSize, txPagination.total)} of {txPagination.total} transactions
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={txPagination.page === 1}
                          onClick={() => fetchTransactions(txPagination.page - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-gray-600">
                          Page {txPagination.page} of {txPagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={txPagination.page === txPagination.totalPages}
                          onClick={() => fetchTransactions(txPagination.page + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'shifts' && reports.shifts && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Shift Aggregation</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-xl font-bold">{formatCurrency(reports.shifts.dailyTotals.totalSales)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Total Transactions</p>
                  <p className="text-xl font-bold">{reports.shifts.dailyTotals.totalTransactions}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Combined Variance</p>
                  <p className={`text-xl font-bold ${reports.shifts.dailyTotals.combinedVariance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(reports.shifts.dailyTotals.combinedVariance)}
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {reports.shifts.shifts.map((shift, i) => (
                  <li key={i} className="flex justify-between py-3 border-b bg-gray-50 px-4 rounded">
                    <div>
                      <p className="font-medium">{shift.cashierName}</p>
                      <p className="text-sm text-gray-500">{shift.shiftId}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(shift.sales)}</p>
                      <p className="text-sm text-gray-500">Variance: {formatCurrency(shift.variance)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
