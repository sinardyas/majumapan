import { useState, useEffect } from 'react';
import { useToast } from '@pos/ui';
import { dashboardApi } from '@/services/api';
import { formatCurrency } from '@/lib/utils';

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

export default function Dashboard() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [topStores, setTopStores] = useState<StoreStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { error } = useToast();

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
      error('Error', 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Failed to load dashboard data</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={loadData}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue Today"
          value={formatCurrency(overview.today.totalRevenue)}
          icon="💰"
          color="bg-green-500"
        />
        <MetricCard
          title="Total Transactions Today"
          value={overview.today.totalTransactions.toLocaleString()}
          icon="📊"
          color="bg-blue-500"
        />
        <MetricCard
          title="Active Stores"
          value={overview.activeStores.toLocaleString()}
          icon="🏪"
          color="bg-purple-500"
        />
        <MetricCard
          title="Pending Syncs"
          value={overview.pendingSyncs.toLocaleString()}
          icon="🔄"
          color={overview.pendingSyncs > 0 ? 'bg-yellow-500' : 'bg-gray-500'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Low Stock Alerts"
          value={overview.lowStockAlerts.toLocaleString()}
          icon="⚠️"
          color={overview.lowStockAlerts > 0 ? 'bg-red-500' : 'bg-gray-500'}
        />
        <MetricCard
          title="Active Users Today"
          value={overview.activeUsersToday.toLocaleString()}
          icon="👥"
          color="bg-blue-500"
        />
        <MetricCard
          title="New Users This Week"
          value={overview.newUsersThisWeek.toLocaleString()}
          icon="🆕"
          color="bg-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top Performing Stores (This Month)
          </h2>
          {topStores.length === 0 ? (
            <p className="text-gray-500 text-sm">No data available</p>
          ) : (
            <div className="space-y-3">
              {topStores.map((store, index) => (
                <div key={store.storeId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                    <span className="font-medium text-gray-900">{store.storeName}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(store.totalRevenue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {store.transactionCount} transactions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    log.action === 'create' ? 'bg-green-100 text-green-800' :
                    log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                    log.action === 'delete' ? 'bg-red-100 text-red-800' :
                    log.action === 'login' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {log.action}
                  </span>
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
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
}

function MetricCard({ title, value, icon, color }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <span className={`text-3xl ${color} bg-opacity-20 rounded-full p-3`}>
          {icon}
        </span>
      </div>
    </div>
  );
}
