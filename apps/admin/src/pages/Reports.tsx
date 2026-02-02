import { useState, useEffect } from 'react';
import { dashboardApi } from '@/services/api';
import { formatCurrency, formatCompact } from '@/lib/utils';
import { Card, CardContent, Button, Badge, Skeleton } from '@pos/ui';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { RefreshCw, Calendar, TrendingUp, Tag, Percent, DollarSign } from 'lucide-react';

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

interface PromoStat {
  productId: string;
  productName: string;
  productSku: string;
  hasPromo: boolean;
  promoType: 'percentage' | 'fixed' | null;
  promoValue: number | null;
  promoMinQty: number;
  usageCount: number;
  totalQuantity: number;
  revenueWithPromo: number;
}

interface ActivePromo {
  productId: string;
  productName: string;
  productSku: string;
  hasPromo: boolean;
  promoType: 'percentage' | 'fixed' | null;
  promoValue: number | null;
  promoMinQty: number;
  promoStartDate: string | null;
  promoEndDate: string | null;
}

type TabType = 'stores' | 'sales' | 'top' | 'promo';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabType>('stores');
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [storeComparison, setStoreComparison] = useState<StoreStats[]>([]);
  const [topStores, setTopStores] = useState<StoreStats[]>([]);
  const [promoStats, setPromoStats] = useState<PromoStat[]>([]);
  const [activePromos, setActivePromos] = useState<ActivePromo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

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
      } else if (activeTab === 'promo') {
        const response = await dashboardApi.getPromoPerformance({
          ...dateRange,
          storeId: selectedStoreId || undefined,
        });
        if (response.success && response.data) {
          setPromoStats(response.data.promoStats || []);
          setActivePromos(response.data.activePromos || []);
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
    { id: 'promo' as TabType, label: 'Promo Performance' },
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

      {activeTab === 'promo' && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Stores</option>
            </select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {activeTab === 'stores' && <StoreComparisonView data={storeComparison} />}
          {activeTab === 'sales' && <SalesByStoreView data={salesData} />}
          {activeTab === 'top' && <TopStoresView data={topStores} />}
          {activeTab === 'promo' && <PromoPerformanceView promoStats={promoStats} activePromos={activePromos} />}
        </>
      )}
    </div>
  );
}

function PromoPerformanceView({ promoStats, activePromos }: { promoStats: PromoStat[]; activePromos: ActivePromo[] }) {
  const totalUsage = promoStats.reduce((sum, p) => sum + p.usageCount, 0);
  const totalRevenue = promoStats.reduce((sum, p) => sum + p.revenueWithPromo, 0);

  const chartData = promoStats.map((promo, index) => ({
    name: promo.productName.length > 20 ? promo.productName.substring(0, 20) + '...' : promo.productName,
    fullName: promo.productName,
    usage: promo.usageCount,
    revenue: promo.revenueWithPromo,
    fill: COLORS[index % COLORS.length],
  }));

  if (promoStats.length === 0 && activePromos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Tag className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No promo data available for selected date range</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Tag className="w-5 h-5" />
              <span className="text-sm">Active Promos</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{activePromos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Percent className="w-5 h-5" />
              <span className="text-sm">Total Promo Uses</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalUsage.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm">Revenue from Promos</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {promoStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Promo Usage</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => value.toLocaleString()} />
                    <Bar dataKey="usage" radius={[0, 4, 4, 0]}>
                      {chartData.slice(0, 10).map((entry, index) => (
                        <Bar key={`bar-${index}`} dataKey="usage" fill={entry.fill} radius={[0, 4, 4, 0]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Promo</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={(value) => formatCompact(value as number)} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => [formatCurrency(value as number), '']} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Promo Performance Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {promoStats.map((promo) => (
                  <tr key={promo.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {promo.productName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {promo.productSku}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {promo.promoType && promo.promoValue !== null ? (
                        <Badge variant="destructive">
                          {promo.promoType === 'percentage' ? `${promo.promoValue}%` : `$${promo.promoValue}`} OFF
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {promo.promoMinQty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {promo.usageCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {promo.totalQuantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(promo.revenueWithPromo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {activePromos.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">All Active Promos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promo Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activePromos.map((promo) => {
                    const now = new Date();
                    const startDate = promo.promoStartDate ? new Date(promo.promoStartDate) : null;
                    const endDate = promo.promoEndDate ? new Date(promo.promoEndDate) : null;
                    const isActive = (!startDate || startDate <= now) && (!endDate || endDate >= now);

                    return (
                      <tr key={promo.productId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {promo.productName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {promo.productSku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {promo.promoType && promo.promoValue !== null ? (
                            <Badge variant="destructive">
                              {promo.promoType === 'percentage' ? `${promo.promoValue}%` : `$${promo.promoValue}`} OFF
                              {promo.promoMinQty > 1 && ` (Min ${promo.promoMinQty})`}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {startDate ? startDate.toLocaleDateString() : 'Always'}
                          {' - '}
                          {endDate ? endDate.toLocaleDateString() : 'Ongoing'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge variant={isActive ? 'success' : 'warning'}>
                            {isActive ? 'Active' : 'Scheduled'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
                  <XAxis type="number" tickFormatter={(value) => formatCompact(value as number)} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => [formatCurrency(value as number), '']} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
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
              <YAxis yAxisId="left" tickFormatter={(value) => formatCompact(value as number)} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value: any, name?: string) => [
                name === 'revenue' ? formatCurrency(value as number) : value?.toLocaleString(),
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
                  <YAxis tickFormatter={(value) => formatCompact(value as number)} />
                  <Tooltip formatter={(value: any) => [formatCurrency(value as number), '']} />
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
                  <YAxis tickFormatter={(value) => formatCompact(value as number)} />
                  <Tooltip formatter={(value: any) => [formatCurrency(value as number), '']} />
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
