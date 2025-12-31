import { useState, useEffect } from 'react';
import { dashboardApi } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton } from '@/components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Store, Users, AlertTriangle } from 'lucide-react';

interface SystemOverview {
  today: {
    totalRevenue: number;
    totalTransactions: number;
  };
  activeStores: number;
  pendingSyncs: number;
  lowStockAlerts: number;
  activeUsersToday: number;
  newUsersThisWeek: number;
}

interface StoreStats {
  storeId: string;
  storeName: string;
  totalRevenue: number;
  transactionCount: number;
}

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityName: string | null;
  createdAt: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

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

export default function Dashboard() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [topStores, setTopStores] = useState<StoreStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, topStoresRes, logsRes] = await Promise.all([
        dashboardApi.getSystemOverview(),
        dashboardApi.getTopStores({ metric: 'revenue' }),
        dashboardApi.getAuditLogs({ limit: 10 }),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }

      if (topStoresRes.success && topStoresRes.data) {
        setTopStores(topStoresRes.data);
      }

      if (logsRes.success && logsRes.data) {
        setRecentActivity(logsRes.data);
      }
    } catch {
      console.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Failed to load dashboard data</p>
          <Button onClick={loadData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const storeChartData = topStores.slice(0, 5).map((store, index) => ({
    name: store.storeName.length > 15 ? store.storeName.substring(0, 15) + '...' : store.storeName,
    fullName: store.storeName,
    revenue: store.totalRevenue,
    transactions: store.transactionCount,
    fill: COLORS[index % COLORS.length],
  }));

  const syncStatusData = [
    { name: 'Synced', value: overview.activeStores - overview.pendingSyncs },
    { name: 'Pending', value: overview.pendingSyncs },
  ].filter(d => d.value > 0);

  const getActionBadgeVariant = (action: string): 'default' | 'destructive' | 'outline' | 'secondary' | 'success' | 'warning' => {
    switch (action) {
      case 'create':
        return 'success';
      case 'update':
        return 'default';
      case 'delete':
        return 'destructive';
      case 'login':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue Today"
          value={formatCurrency(overview.today.totalRevenue)}
          icon={<DollarSign className="w-6 h-6" />}
          color="text-green-600"
          bgColor="bg-green-50"
          trend={overview.today.totalRevenue > 0 ? 'up' : null}
        />
        <MetricCard
          title="Total Transactions"
          value={overview.today.totalTransactions.toLocaleString()}
          icon={<ShoppingCart className="w-6 h-6" />}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <MetricCard
          title="Active Stores"
          value={overview.activeStores.toLocaleString()}
          icon={<Store className="w-6 h-6" />}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <MetricCard
          title="Pending Syncs"
          value={overview.pendingSyncs.toLocaleString()}
          icon={<RefreshCw className="w-6 h-6" />}
          color={overview.pendingSyncs > 0 ? 'text-yellow-600' : 'text-gray-600'}
          bgColor={overview.pendingSyncs > 0 ? 'bg-yellow-50' : 'bg-gray-50'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Low Stock Alerts"
          value={overview.lowStockAlerts.toLocaleString()}
          icon={<AlertTriangle className="w-6 h-6" />}
          color={overview.lowStockAlerts > 0 ? 'text-red-600' : 'text-gray-600'}
          bgColor={overview.lowStockAlerts > 0 ? 'bg-red-50' : 'bg-gray-50'}
        />
        <MetricCard
          title="Active Users Today"
          value={overview.activeUsersToday.toLocaleString()}
          icon={<Users className="w-6 h-6" />}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <MetricCard
          title="New Users This Week"
          value={overview.newUsersThisWeek.toLocaleString()}
          icon={<TrendingUp className="w-6 h-6" />}
          color="text-green-600"
          bgColor="bg-green-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Stores</CardTitle>
          </CardHeader>
          <CardContent>
            {topStores.length === 0 ? (
              <p className="text-gray-500 text-sm">No data available</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={storeChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={formatCompactValue} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any) => formatChartValue(value)}
                      labelFormatter={(label: any) => label}
                    />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {storeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            {syncStatusData.length === 0 ? (
              <p className="text-gray-500 text-sm">No stores available</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={syncStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {syncStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => value?.toLocaleString() ?? '0'} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <Badge variant={getActionBadgeVariant(log.action)}>
                    {log.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 truncate">
                      <span className="font-medium">{log.userEmail}</span> {log.action}ed{' '}
                      <span className="font-medium">{log.entityType}</span>
                      {log.entityName && (
                        <span className="text-gray-600">: {log.entityName}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  trend?: 'up' | 'down' | null;
}

function MetricCard({ title, value, icon, color, bgColor, trend }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
            {trend && (
              <div className={`flex items-center mt-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              </div>
            )}
          </div>
          <div className={`${bgColor} rounded-full p-3`}>
            <span className={color}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
