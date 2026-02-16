import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Button, Card, Badge, Skeleton, Switch } from '@pos/ui';
import { ArrowLeft, Plus, RefreshCw, Trash2, Monitor, User as UserIcon, Mail, Key, History } from 'lucide-react';
import type { User } from '@pos/shared';
import { DayCloseHistoryItem } from '@pos/shared';
import { formatCurrency } from '@/lib/utils';

interface DeviceBinding {
  id: string;
  storeId: string;
  bindingCode: string;
  status: 'pending' | 'active' | 'revoked';
  deviceName: string;
  isMasterTerminal?: boolean;
  masterTerminalName?: string;
  boundAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function StoreDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [devices, setDevices] = useState<DeviceBinding[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dayCloseHistory, setDayCloseHistory] = useState<DayCloseHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'users' | 'eod'>('overview');
  const [showCreateDevice, setShowCreateDevice] = useState(false);
  const [deviceExpiresIn, setDeviceExpiresIn] = useState<'24h' | '7d' | '30d' | 'never'>('24h');
  const [revokeDevice, setRevokeDevice] = useState<DeviceBinding | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [masterToggleDevice, setMasterToggleDevice] = useState<DeviceBinding | null>(null);
  const [masterToggleLoading, setMasterToggleLoading] = useState(false);

  const fetchStore = async () => {
    try {
      const response = await api.get<{ store: Store }>(`/stores/${id}`);
      if (response.success && response.data) {
        setStore(response.data.store);
      }
    } catch (error) {
      console.error('Failed to load store');
    }
  };

  const fetchDevices = async () => {
    if (!id) return;
    try {
      const response = await api.get<DeviceBinding[]>(`/device-bindings?storeId=${id}`);
      if (response.success && response.data) {
        setDevices(response.data);
      }
    } catch (error) {
      console.error('Failed to load devices');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>(`/users?storeId=${id}`);
      if (response.success && response.data) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  const fetchDayCloseHistory = async () => {
    if (!id) return;
    try {
      const response = await api.get<{ dayCloses: DayCloseHistoryItem[]; total: number }>(
        `/day-close/history?storeId=${id}&pageSize=10`
      );
      if (response.success && response.data) {
        setDayCloseHistory(response.data.dayCloses || []);
      }
    } catch (error) {
      console.error('Failed to load day close history');
    }
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchStore();
      await fetchDevices();
      await fetchUsers();
      setIsLoading(false);
    };
    load();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'eod') {
      fetchDayCloseHistory();
    }
  }, [activeTab, id]);

  const handleCreateDevice = async () => {
    try {
      const response = await api.post<{ data: DeviceBinding }>('/device-bindings', {
        storeId: id,
        expiresIn: deviceExpiresIn,
      });
      if (response.success) {
        setShowCreateDevice(false);
        await fetchDevices();
      } else {
        alert(response.error || 'Failed to create device');
      }
    } catch (error) {
      console.error('Failed to create device');
    }
  };

  const handleRevoke = async () => {
    if (!revokeDevice) return;
    try {
      const response = await api.post(`/device-bindings/${revokeDevice.id}/revoke`, {
        reason: revokeReason,
      });
      if (response.success) {
        setRevokeDevice(null);
        setRevokeReason('');
        await fetchDevices();
      } else {
        alert(response.error || 'Failed to revoke device');
      }
    } catch (error) {
      console.error('Failed to revoke device');
    }
  };

  const handleRegenerate = async (deviceId: string) => {
    if (!confirm('Are you sure you want to regenerate the code? The old code will stop working.')) return;
    try {
      const response = await api.post<{ data: DeviceBinding }>(`/device-bindings/${deviceId}/regenerate`, {});
      if (response.success) {
        await fetchDevices();
        alert('Code regenerated successfully!');
      } else {
        alert(response.error || 'Failed to regenerate code');
      }
    } catch (error) {
      console.error('Failed to regenerate code');
    }
  };

  const handleDownloadCSV = async (dayClose: DayCloseHistoryItem) => {
    try {
      const response = await api.get<string>(`/day-close/${dayClose.id}/export/csv/all`, { responseType: 'text' });

      if (response.success && response.data) {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eod-report-${dayClose.operationalDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="success">Active</Badge>;
      case 'pending': return <Badge variant="warning">Pending</Badge>;
      case 'revoked': return <Badge variant="destructive">Revoked</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p>Store not found</p>
        <Button onClick={() => navigate('/stores')}>Back to Stores</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/stores')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
          <p className="text-gray-500">
            {store.address || 'No address'} {store.phone && `• ${store.phone}`}
          </p>
        </div>
        <Badge variant={store.isActive ? 'success' : 'destructive'}>
          {store.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'devices'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Devices ({devices.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('eod')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'eod'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            End of Day
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <Card>
          <div className="p-6 grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Store ID</h3>
              <p className="text-sm font-mono">{store.id}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Created</h3>
              <p className="text-sm">{formatDate(store.createdAt)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Devices</h3>
              <p className="text-sm">{devices.length}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Active Devices</h3>
              <p className="text-sm">{devices.filter(d => d.status === 'active').length}</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateDevice(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Device
            </Button>
          </div>

          {devices.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No devices for this store</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Master</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bound</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {devices.map((device) => (
                      <tr key={device.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{device.deviceName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{device.bindingCode}</code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(device.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {device.status === 'active' ? (
                            <Switch
                              checked={device.isMasterTerminal}
                              onCheckedChange={() => setMasterToggleDevice(device)}
                              disabled={masterToggleLoading}
                            />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(device.boundAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {device.expiresAt ? formatDate(device.expiresAt) : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            {device.status !== 'revoked' && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => handleRegenerate(device.id)}>
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setRevokeDevice(device)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          {users.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No users assigned to this store</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PIN</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <UserIcon className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-gray-500 flex items-center gap-1 text-sm">
                                <Mail className="w-3 h-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'manager' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.pin ? (
                            <Badge variant="success">
                              <Key className="w-3 h-3 mr-1" />
                              Set
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not Set</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={user.isActive ? 'success' : 'outline'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'eod' && (
        <div className="space-y-6">
          {/* Day Close History Section */}
          <Card>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Day Close History</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">Recent day close records for this store</p>
            </div>
            <div className="p-4">
              {dayCloseHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No day close records for this store</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day Close #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closed By</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dayCloseHistory.map((dayClose) => (
                        <tr key={dayClose.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(dayClose.operationalDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-mono text-gray-900">
                              {dayClose.dayCloseNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {dayClose.totalTransactions}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(dayClose.totalSales)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-500">
                              {dayClose.closedByUserName || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              dayClose.syncStatus === 'clean'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {dayClose.syncStatus === 'clean' ? 'Synced' : 'Pending Sync'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => navigate(`/eod/day-close/${dayClose.id}`)}
                                className="text-blue-600 hover:text-blue-900"
                                title="View Details"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleDownloadCSV(dayClose)}
                                className="text-gray-600 hover:text-gray-900"
                                title="Download CSV"
                              >
                                CSV
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Create Device Modal */}
      {showCreateDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Create Device</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Expiration</label>
                <select
                  value={deviceExpiresIn}
                  onChange={(e) => setDeviceExpiresIn(e.target.value as any)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="never">Never</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowCreateDevice(false)}>Cancel</Button>
                <Button onClick={handleCreateDevice}>Create</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {revokeDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Revoke Device</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to revoke <strong>{revokeDevice.deviceName}</strong>?
              All active sessions will be ended.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setRevokeDevice(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleRevoke}>Revoke</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Master Toggle Confirmation Modal */}
      {masterToggleDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            {masterToggleDevice.isMasterTerminal ? (
              <>
                <h2 className="text-lg font-bold mb-4">Remove Master Terminal?</h2>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>{masterToggleDevice.deviceName}</strong> will no longer be the master terminal for this store.
                  Only the designated master terminal can execute End of Day operations.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold mb-4">Set as Master Terminal?</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Set <strong>{masterToggleDevice.deviceName}</strong> as the master terminal for this store?
                  {devices.find(d => d.isMasterTerminal) && (
                    <>
                      <br />
                      <span className="text-yellow-600">
                        This will replace the current master terminal: <strong>{devices.find(d => d.isMasterTerminal)?.deviceName}</strong>
                      </span>
                    </>
                  )}
                </p>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMasterToggleDevice(null)}>Cancel</Button>
              <Button
                onClick={async () => {
                  const isCurrentlyMaster = masterToggleDevice.isMasterTerminal;
                  setMasterToggleLoading(true);
                  try {
                    const response = await api.put(`/device-bindings/${masterToggleDevice.id}/master-status`, {
                      isMasterTerminal: !isCurrentlyMaster,
                    });
                    if (response.success) {
                      await fetchDevices();
                      setMasterToggleDevice(null);
                      alert(isCurrentlyMaster 
                        ? 'Device removed from master terminal' 
                        : 'Device set as master terminal');
                    } else {
                      alert(response.error || 'Failed to update master status');
                    }
                  } catch (error) {
                    alert('Failed to update master status');
                  } finally {
                    setMasterToggleLoading(false);
                  }
                }}
                isLoading={masterToggleLoading}
              >
                {masterToggleDevice.isMasterTerminal ? 'Remove Master' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
