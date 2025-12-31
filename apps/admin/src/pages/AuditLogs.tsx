import { useState, useEffect } from 'react';
import { dashboardApi } from '@/services/api';
import { Card, CardContent, Badge, Button, Skeleton } from '@/components/ui';
import { Search, Filter, X, ChevronLeft, ChevronRight, Calendar, User, Activity, Globe } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityName: string | null;
  entityId: string | null;
  changes: Record<string, { old: any; new: any }> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type ActionType = 'create' | 'update' | 'delete' | 'login' | 'logout' | '';
type EntityType = 'user' | 'store' | 'product' | 'category' | 'discount' | 'transaction' | 'settings' | '';

interface Filters {
  action: ActionType;
  entityType: EntityType;
  search: string;
}

const ACTIONS: { value: ActionType; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
];

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: '', label: 'All Entities' },
  { value: 'user', label: 'User' },
  { value: 'store', label: 'Store' },
  { value: 'product', label: 'Product' },
  { value: 'category', label: 'Category' },
  { value: 'discount', label: 'Discount' },
  { value: 'transaction', label: 'Transaction' },
  { value: 'settings', label: 'Settings' },
];

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
    case 'logout':
      return 'outline';
    default:
      return 'outline';
  }
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<Filters>({
    action: '',
    entityType: '',
    search: '',
  });

  useEffect(() => {
    loadLogs(1);
  }, []);

  const loadLogs = async (page: number) => {
    setIsLoading(true);
    try {
      const response = await dashboardApi.getAuditLogs({
        page,
        limit: pagination.limit,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        search: filters.search || undefined,
      });

      if (response.success && response.data) {
        setLogs(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      }
    } catch {
      console.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    loadLogs(1);
  };

  const handleClearFilters = () => {
    setFilters({ action: '', entityType: '', search: '' });
    loadLogs(1);
  };

  const handlePageChange = (newPage: number) => {
    loadLogs(newPage);
  };

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track all system activities and changes
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => updateFilter('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {ACTIONS.map(action => (
                  <option key={action.value} value={action.value}>{action.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Entity Type
              </label>
              <select
                value={filters.entityType}
                onChange={(e) => updateFilter('entityType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {ENTITY_TYPES.map(entity => (
                  <option key={entity.value} value={entity.value}>{entity.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by user or entity..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleSearch}>
                <Filter className="w-4 h-4 mr-2" />
                Search
              </Button>
              {(filters.action || filters.entityType || filters.search) && (
                <Button variant="outline" onClick={handleClearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && logs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No audit logs found</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && logs.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2 text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">{log.userEmail}</div>
                          <div className="text-xs text-gray-500 font-mono">{log.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="font-medium text-gray-900 capitalize">{log.entityType}</span>
                          {log.entityName && (
                            <span className="text-gray-600 ml-1">: {log.entityName}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="font-mono">{log.ipAddress || '-'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{logs.length}</span> of <span className="font-medium">{pagination.total}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm text-gray-600">
                  Page <span className="font-medium">{pagination.page}</span> of <span className="font-medium">{pagination.totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
