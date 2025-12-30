import { useState, useEffect } from 'react';
import { useToast } from '@pos/ui';
import { dashboardApi } from '@/services/api';
import { formatCurrency } from '@/lib/utils';

interface SalesData {
  date: string;
  totalRevenue: number;
  transactionCount: number;
}

interface StoreStats {
  storeId: string;
  storeName: string;
  totalRevenue: number;
  transactionCount: number;
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'stores' | 'sales' | 'top'>('stores');
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [storeComparison, setStoreComparison] = useState<StoreStats[]>([]);
  const [topStores, setTopStores] = useState<StoreStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { error } = useToast();

  useEffect(() => {
    loadData();
  }, [activeTab, dateRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'stores') {
        const response = await dashboardApi.getStoresComparison(dateRange);
        if (response.success && response.data) {
          setStoreComparison(response.data);
        }
      } else if (activeTab === 'sales') {
        const response = await dashboardApi.getSalesByStore(dateRange);
        if (response.success && response.data) {
          setSalesData(response.data);
        }
      } else if (activeTab === 'top') {
        const response = await dashboardApi.getTopStores({
          ...dateRange,
          metric: 'revenue',
        });
        if (response.success && response.data) {
          setTopStores(response.data);
        }
      }
    } catch {
      error('Error', 'Failed to load reports data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">From:</span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="border rounded px-3 py-1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">To:</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="border rounded px-3 py-1"
            />
          </label>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: 'stores', label: 'Store Comparison' },
            { id: 'sales', label: 'Sales by Store' },
            { id: 'top', label: 'Top Performing Stores' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!isLoading && activeTab === 'stores' && (
        <StoreComparisonTable data={storeComparison} />
      )}

      {!isLoading && activeTab === 'sales' && (
        <SalesByStoreChart data={salesData} />
      )}

      {!isLoading && activeTab === 'top' && (
        <TopStoresTable data={topStores} />
      )}
    </div>
  );
}

function StoreComparisonTable({ data }: { data: StoreStats[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No data available for selected date range</p>
      </div>
    );
  }

  const totalRevenue = data.reduce((sum, store) => sum + store.totalRevenue, 0);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Store
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Revenue
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              % of Total
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Transactions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((store) => (
            <tr key={store.storeId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {store.storeName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(store.totalRevenue)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded">
                    <div
                      className="h-2 bg-blue-600 rounded"
                      style={{
                        width: `${(store.totalRevenue / totalRevenue) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs">
                    {((store.totalRevenue / totalRevenue) * 100).toFixed(1)}%
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {store.transactionCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="px-6 py-4 text-sm font-bold text-gray-900">Total</td>
            <td className="px-6 py-4 text-sm font-bold text-gray-900">
              {formatCurrency(totalRevenue)}
            </td>
            <td className="px-6 py-4 text-sm text-gray-500">100%</td>
            <td className="px-6 py-4 text-sm font-bold text-gray-900">
              {data.reduce((sum, s) => sum + s.transactionCount, 0).toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SalesByStoreChart({ data }: { data: SalesData[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No data available for selected date range</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map(d => d.totalRevenue));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Sales Over Time</h3>
      <div className="space-y-4">
        {data.map((day) => (
          <div key={day.date} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                {new Date(day.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="font-medium text-gray-900">
                {formatCurrency(day.totalRevenue)}
              </span>
            </div>
            <div className="h-6 bg-gray-200 rounded">
              <div
                className="h-6 bg-blue-600 rounded"
                style={{
                  width: `${(day.totalRevenue / maxRevenue) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopStoresTable({ data }: { data: StoreStats[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No data available for selected date range</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Rank
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Store
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Revenue
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Transactions
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Avg Transaction
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((store, index) => (
            <tr key={store.storeId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                #{index + 1}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {store.storeName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(store.totalRevenue)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {store.transactionCount.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(store.totalRevenue / store.transactionCount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
