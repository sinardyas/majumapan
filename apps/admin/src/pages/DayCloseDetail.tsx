import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@pos/ui';
import { 
  ArrowLeft, 
  Download, 
  Mail, 
  DollarSign, 
  CreditCard, 
  Package, 
  FileText, 
  Clock
} from 'lucide-react';
import type { DayClose, DailySalesReport, CashReconReport, InventoryMovementReport, TransactionAuditLogReport, ShiftAggregationReport } from '@pos/shared';

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
    audit: TransactionAuditLogReport | null;
    shifts: ShiftAggregationReport | null;
  }>({
    sales: null,
    cash: null,
    inventory: null,
    audit: null,
    shifts: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchDayCloseData();
    }
  }, [id]);

  const fetchDayCloseData = async () => {
    try {
      const [dayCloseRes, salesRes, cashRes, inventoryRes, auditRes, shiftsRes] = await Promise.all([
        fetch(`/api/v1/day-close/${id}`),
        fetch(`/api/v1/day-close/${id}/report/sales`),
        fetch(`/api/v1/day-close/${id}/report/cash`),
        fetch(`/api/v1/day-close/${id}/report/inventory`),
        fetch(`/api/v1/day-close/${id}/report/audit`),
        fetch(`/api/v1/day-close/${id}/report/shifts`),
      ]);

      const dayCloseData = await dayCloseRes.json();
      const salesData = await salesRes.json();
      const cashData = await cashRes.json();
      const inventoryData = await inventoryRes.json();
      const auditData = await auditRes.json();
      const shiftsData = await shiftsRes.json();

      if (dayCloseData.success) {
        setDayClose(dayCloseData.data);
      }
      if (salesData.success) setReports(prev => ({ ...prev, sales: salesData.data }));
      if (cashData.success) setReports(prev => ({ ...prev, cash: cashData.data }));
      if (inventoryData.success) setReports(prev => ({ ...prev, inventory: inventoryData.data }));
      if (auditData.success) setReports(prev => ({ ...prev, audit: auditData.data }));
      if (shiftsData.success) setReports(prev => ({ ...prev, shifts: shiftsData.data }));
    } catch (error) {
      console.error('Error fetching day close data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleDownloadCSV = () => {
    const endpoint = activeTab === 'sales' ? '/csv/sales' 
      : activeTab === 'cash' ? '/csv/cash'
      : activeTab === 'inventory' ? '/csv/inventory'
      : activeTab === 'audit' ? '/csv/audit'
      : '/csv/shifts';
    
    window.open(`/api/v1/day-close/${id}${endpoint}`, '_blank');
  };

  const handleEmailReport = async () => {
    const email = prompt('Enter email address:');
    if (email) {
      try {
        const response = await fetch(`/api/v1/day-close/${id}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients: [email] }),
        });
        const data = await response.json();
        if (data.success) alert('Report sent!');
        else alert('Failed: ' + data.error);
      } catch (error) {
        console.error('Error sending email:', error);
      }
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
        <Button onClick={() => navigate('/admin/day-close-history')} className="mt-4">
          Back to History
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/admin/day-close-history')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{dayClose.dayCloseNumber}</h1>
            <p className="text-gray-500">
              {new Date(dayClose.operationalDate).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleDownloadCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
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

          {activeTab === 'audit' && reports.audit && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Transaction Audit Log</h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-500">Total Volume</p>
                <p className="text-xl font-bold">{formatCurrency(reports.audit.summary.totalVolume)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left">Transaction</th>
                      <th className="px-3 py-2 text-left">Time</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.audit.transactions.slice(0, 20).map((txn, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2 font-mono">{txn.transactionNumber}</td>
                        <td className="px-3 py-2">{new Date(txn.timestamp).toLocaleTimeString()}</td>
                        <td className="px-3 py-2">{formatCurrency(txn.amount)}</td>
                        <td className="px-3 py-2">{txn.paymentMethod}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            txn.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {txn.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
