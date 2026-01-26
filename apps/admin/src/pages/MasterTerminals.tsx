import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { Monitor, Plus, Check, X } from 'lucide-react';

interface Device {
  id: string;
  deviceName: string | null;
  deviceIdentifier: string;
  isMasterTerminal: boolean;
  masterTerminalName: string | null;
}

export default function MasterTerminals() {
  const { user, selectedStoreId } = useAuthStore();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDevices();
    }
  }, [user, selectedStoreId]);

  const getEffectiveStoreId = () => {
    if (selectedStoreId && selectedStoreId !== 'all') {
      return selectedStoreId;
    }
    return user?.storeId;
  };

  const fetchDevices = async () => {
    const storeId = getEffectiveStoreId();
    if (!storeId) {
      setError('Please select a store to manage master terminals.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get<Device[]>(`/stores/${storeId}/devices`);

      if (response.success && response.data) {
        setDevices(response.data);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError('Failed to load devices.');
    } finally {
      setIsLoading(false);
    }
  };

  const setAsMaster = async (deviceId: string) => {
    try {
      const response = await api.put(`/devices/${deviceId}/master-status`, {
        isMasterTerminal: true,
      });

      if (response.success) {
        fetchDevices();
        setMessage({ type: 'success', text: 'Device set as master terminal' });
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to update device' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update device' });
    }
  };

  const removeFromMaster = async (deviceId: string) => {
    try {
      const response = await api.put(`/devices/${deviceId}/master-status`, {
        isMasterTerminal: false,
      });

      if (response.success) {
        fetchDevices();
        setMessage({ type: 'success', text: 'Device removed from master terminal' });
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to update device' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update device' });
    }
  };

  const addDevice = async () => {
    if (!newDeviceName.trim()) return;

    const storeId = getEffectiveStoreId();
    if (!storeId) {
      setMessage({ type: 'error', text: 'Store not selected.' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post(
        `/stores/${storeId}/devices`,
        {
          deviceName: newDeviceName,
          deviceIdentifier: `device-${Date.now()}`,
        }
      );

      if (response.success) {
        fetchDevices();
        setNewDeviceName('');
        setMessage({ type: 'success', text: 'Device added successfully' });
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to add device' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add device' });
    } finally {
      setIsSaving(false);
    }
  };

  const masterDevice = devices.find(d => d.isMasterTerminal);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Master Terminals</h1>
          <p className="text-gray-600">
            Configure which devices can perform End of Day operations
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Master Terminals</h1>
        <p className="text-gray-600">
          Configure which devices can perform End of Day operations
        </p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Current Master */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Monitor className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-blue-900">Current Master Terminal</h2>
        </div>
        {masterDevice ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {masterDevice.masterTerminalName || masterDevice.deviceName || 'Unknown Device'}
              </p>
              <p className="text-sm text-gray-500">{masterDevice.deviceIdentifier}</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Check className="h-3 w-3 mr-1" />
              Master
            </span>
          </div>
        ) : (
          <p className="text-gray-600">No master terminal configured</p>
        )}
      </div>

      {/* All Devices */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">All Devices</h2>
        </div>
        
        {devices.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No devices registered for this store
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {devices.map((device) => (
              <li key={device.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      device.isMasterTerminal ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Monitor className={`h-5 w-5 ${
                        device.isMasterTerminal ? 'text-blue-600' : 'text-gray-500'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {device.deviceName || 'Unnamed Device'}
                      </p>
                      <p className="text-sm text-gray-500">{device.deviceIdentifier}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {device.isMasterTerminal ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromMaster(device.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove Master
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAsMaster(device.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Set as Master
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Device */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Register New Device</h2>
        </div>
        <div className="p-6">
          <div className="flex space-x-3">
            <input
              type="text"
              placeholder="Device Name (e.g., Manager Station)"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Button onClick={addDevice} disabled={!newDeviceName.trim() || isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Device
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Register a new device to make it available as a master terminal
          </p>
        </div>
      </div>
    </div>
  );
}
