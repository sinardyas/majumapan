import { useState, useEffect } from 'react';
import { dashboardApi } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, Button, Badge, Skeleton } from '@/components/ui';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { RefreshCw, Calendar, TrendingUp } from 'lucide-react';

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

type TabType = 'stores' | 'sales' | 'top';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

const formatChartValue = (value: number | string) => {
  if (typeof value === 'string') value = parseFloat(value);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCompactValue = (value: number | string) => {
  if (typeof value === 'string') value = parseFloat(value);
  if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `Rp ${(value / 1000).toFixed(1)}K`;
  return formatCurrency(value);
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabType>('stores');
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [storeComparison, setStoreComparison] = useState<StoreStats[]>([]);
  const [topStores, setTopStores] = useState<StoreStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

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
      console.error('Failed to load reports data');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'stores' as TabType, label: 'Store Comparison' },
    { id: 'sales' as TabType, label: 'Sales by Store' },
    { id: 'top' as TabType, label: 'Top Performing Stores' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button onClick={loadData} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {activeTab === 'stores' && <StoreComparisonView data={storeComparison} />}
          {activeTab === 'sales' && <SalesByStoreView data={salesData} />}
          {activeTab === 'top' && <TopStoresView data={topStores} />}
        </>
      )}
    </div>
  );
}

function StoreComparisonView({ data }: { data: StoreStats[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No data available for selected date range</p>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = data.reduce((sum, store) => sum + store.totalRevenue, 0);
  const chartData = data.map((store, index) => ({
    name: store.storeName.length > 15 ? store.storeName.substring(0, 15) + '...' : store.storeName,
    fullName: store.storeName,
    revenue: store.totalRevenue,
    transactions: store.transactionCount,
    percentage: totalRevenue > 0 ? ((store.totalRevenue / totalRevenue) * 100).toFixed(1) : '0',
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Store</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={formatCompactValue} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => formatChartValue(value)} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Bar key={`bar-${index}`} dataKey="revenue" fill={entry.fill} radius={[0, 4, 4, 0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Volume</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => value.toLocaleString()} />
                  <Bar dataKey="transactions" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% of Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Transaction</th>
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
                        <div className="w-24 h-2 bg-gray-200 rounded">
                          <div
                            className="h-2 bg-primary-600 rounded"
                            style={{ width: `${totalRevenue > 0 ? (store.totalRevenue / totalRevenue) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs">{totalRevenue > 0 ? ((store.totalRevenue / totalRevenue) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {store.transactionCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(store.transactionCount > 0 ? store.totalRevenue / store.transactionCount : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">Total</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(totalRevenue)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">100%</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {data.reduce((sum, s) => sum + s.transactionCount, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {formatCurrency(data.reduce((sum, s) => sum + s.transactionCount, 0) > 0
                      ? totalRevenue / data.reduce((sum, s) => sum + s.transactionCount, 0)
                      : 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SalesByStoreView({ data }: { data: SalesData[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No data available for selected date range</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: day.totalRevenue,
    transactions: day.transactionCount,
  }));

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={formatCompactValue} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value: any, name?: string) => [
                name === 'revenue' ? formatChartValue(value) : value?.toLocaleString(),
                name === 'revenue' ? 'Revenue' : 'Transactions'
              ]} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="transactions" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TopStoresView({ data }: { data: StoreStats[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No data available for selected date range</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((store, index) => ({
    name: store.storeName.length > 15 ? store.storeName.substring(0, 15) + '...' : store.storeName,
    fullName: store.storeName,
    revenue: store.totalRevenue,
    transactions: store.transactionCount,
    avgTransaction: store.transactionCount > 0 ? store.totalRevenue / store.transactionCount : 0,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Stores by Revenue</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.slice(0, 5)} margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatCompactValue} />
                  <Tooltip formatter={(value: any) => formatChartValue(value)} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Transaction Value</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.slice(0, 5)} margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatCompactValue} />
                  <Tooltip formatter={(value: any) => formatChartValue(value)} />
                  <Bar dataKey="avgTransaction" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Transaction</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((store, index) => (
                  <tr key={store.storeId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge variant={index === 0 ? 'success' : index === 1 ? 'secondary' : index === 2 ? 'warning' : 'outline'}>
                        #{index + 1}
                      </Badge>
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
                      {formatCurrency(store.transactionCount > 0 ? store.totalRevenue / store.transactionCount : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
