import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button, Card, Modal, Badge, Skeleton } from '@pos/ui';
import { z } from 'zod';
import { Plus, Search, Monitor, RefreshCw, Trash2, Copy } from 'lucide-react';

interface DeviceBinding {
  id: string;
  storeId: string;
  storeName?: string;
  bindingCode: string;
  status: 'pending' | 'active' | 'revoked';
  deviceName: string;
  boundAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Store {
  id: string;
  name: string;
}

const createDeviceSchema = z.object({
  storeId: z.string().uuid('Invalid store ID'),
  expiresIn: z.enum(['never', '24h', '7d', '30d']).optional().default('24h'),
});

type CreateDeviceData = z.infer<typeof createDeviceSchema>;

export default function Devices() {
  const [devices, setDevices] = useState<DeviceBinding[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<DeviceBinding[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [formData, setFormData] = useState<CreateDeviceData>({
    storeId: '',
    expiresIn: '24h',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createdDevice, setCreatedDevice] = useState<DeviceBinding | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [revokeModalDevice, setRevokeModalDevice] = useState<DeviceBinding | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<DeviceBinding[]>('/device-bindings');
      if (response.success && response.data) {
        setDevices(response.data);
        setFilteredDevices(response.data);
      }
    } catch {
      console.error('Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await api.get<{ stores: Store[] }>('/stores');
      if (response.success && response.data) {
        setStores(response.data.stores || []);
      }
    } catch {
      console.error('Failed to load stores');
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchStores();
  }, []);

  useEffect(() => {
    let filtered = devices;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(device =>
        device.deviceName.toLowerCase().includes(query) ||
        device.bindingCode.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(device => device.status === statusFilter);
    }

    if (storeFilter) {
      filtered = filtered.filter(device => device.storeId === storeFilter);
    }

    setFilteredDevices(filtered);
  }, [searchQuery, statusFilter, storeFilter, devices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = createDeviceSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as string;
        if (field) {
          errors[field] = issue.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post<{ data: DeviceBinding }>('/device-bindings', formData);
      if (response.success && response.data) {
        setCreatedDevice(response.data.data);
        setShowQrModal(true);
        setShowModal(false);
        await fetchDevices();
        setFormData({ storeId: '', expiresIn: '24h' });
      } else {
        setFormErrors({ general: response.error || 'Failed to create device' });
      }
    } catch {
      setFormErrors({ general: 'Failed to create device' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeModalDevice) return;
    
    setIsLoading(true);
    try {
      const response = await api.post(`/device-bindings/${revokeModalDevice.id}/revoke`, {
        reason: revokeReason,
      });
      if (response.success) {
        setRevokeModalDevice(null);
        setRevokeReason('');
        await fetchDevices();
      } else {
        alert(response.error || 'Failed to revoke device');
      }
    } catch {
      console.error('Failed to revoke device');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async (deviceId: string) => {
    if (!confirm('Are you sure you want to regenerate the binding code? The old code will no longer work.')) return;
    
    setIsLoading(true);
    try {
      const response = await api.post<{ data: DeviceBinding }>(`/device-bindings/${deviceId}/regenerate`, {});
      if (response.success && response.data) {
        setCreatedDevice(response.data.data);
        setShowQrModal(true);
        await fetchDevices();
      } else {
        alert(response.error || 'Failed to regenerate code');
      }
    } catch {
      console.error('Failed to regenerate code');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading && devices.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
        <Button onClick={() => { setFormData({ storeId: '', expiresIn: '24h' }); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Create Device
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by device name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>

        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Stores</option>
          {stores.map(store => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
      </div>

      {filteredDevices.length === 0 ? (
        <div className="text-center py-12">
          <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchQuery || statusFilter || storeFilter ? 'No devices match your filters' : 'No devices yet. Create your first device!'}
          </p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Binding Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bound At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Monitor className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{device.deviceName}</div>
                          <div className="text-xs text-gray-500">Created {formatDate(device.createdAt)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {device.storeName || device.storeId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{device.bindingCode}</code>
                        <button
                          onClick={() => copyCode(device.bindingCode)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Copy code"
                        >
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(device.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(device.boundAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {device.expiresAt ? formatDate(device.expiresAt) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRegenerate(device.id)}
                          disabled={device.status === 'revoked'}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Regenerate
                        </Button>
                        {device.status !== 'revoked' && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => setRevokeModalDevice(device)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Revoke
                          </Button>
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

      {/* Create Device Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Device">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Store *</label>
              <select
                value={formData.storeId}
                onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Select a store</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
              {formErrors.storeId && <p className="text-sm text-red-500">{formErrors.storeId}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Expiration</label>
              <select
                value={formData.expiresIn}
                onChange={(e) => setFormData({ ...formData, expiresIn: e.target.value as 'never' | '24h' | '7d' | '30d' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="never">Never</option>
              </select>
            </div>

            {formErrors.general && <p className="text-sm text-red-500">{formErrors.general}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Device
            </Button>
          </div>
        </form>
      </Modal>

      {/* QR Code / Success Modal */}
      <Modal isOpen={showQrModal} onClose={() => setShowQrModal(false)} title="Device Created">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Device has been created. Share the binding code or QR code with the Store Manager to bind the device.
          </p>

          {createdDevice && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Device Name:</span>
                <span className="text-sm text-gray-900">{createdDevice.deviceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Binding Code:</span>
                <code className="px-2 py-1 bg-white border rounded text-sm font-mono">{createdDevice.bindingCode}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Expires:</span>
                <span className="text-sm text-gray-900">
                  {createdDevice.expiresAt ? formatDate(createdDevice.expiresAt) : 'Never'}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => copyCode(createdDevice?.bindingCode || '')}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </Button>
            <Button onClick={() => setShowQrModal(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal 
        isOpen={!!revokeModalDevice} 
        onClose={() => setRevokeModalDevice(null)} 
        title="Revoke Device"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to revoke <strong>{revokeModalDevice?.deviceName}</strong>? 
            All active sessions on this device will be ended immediately.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Reason (optional)</label>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Reason for revocation..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setRevokeModalDevice(null)} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} isLoading={isLoading}>
              Revoke Device
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
