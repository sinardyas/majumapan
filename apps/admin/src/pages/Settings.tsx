import { useState } from 'react';
import { useToast } from '@pos/ui';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { Input } from '@pos/ui';
import type { AppSetting } from '@pos/shared';

export default function Settings() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [formData, setFormData] = useState({
    taxRate: '0.10',
    currency: 'USD',
    currencySymbol: '$',
    transactionPrefix: 'TXN',
    localRetentionDays: '30',
    auditLogRetentionDays: '90',
  });
  const { success, error } = useToast();

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Record<string, string>>('/settings');
      if (response.success && response.data) {
        const settingsArray = Object.entries(response.data).map(([key, value]) => ({
          id: key,
          key,
          value,
          updatedAt: new Date().toISOString(),
        })) as unknown as AppSetting[];
        setSettings(settingsArray);
      } else {
        error('Error', 'Failed to load settings');
      }
    } catch {
      error('Error', 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload: Record<string, string> = {
        tax_rate: formData.taxRate,
        currency: formData.currency,
        currency_symbol: formData.currencySymbol,
        transaction_prefix: formData.transactionPrefix,
        local_retention_days: formData.localRetentionDays,
        audit_log_retention_days: formData.auditLogRetentionDays,
      };

      const response = await api.put('/settings', payload);
      if (response.success) {
        success('Success', 'Settings updated successfully');
        await fetchSettings();
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        error('Error', response.error || 'Failed to update settings');
      }
    } catch {
      error('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {isLoading && settings.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="max-w-2xl">
            <div className="space-y-4">
              <div>
                <label className="label">Tax Rate</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.taxRate}
                  onChange={(e) => handleChange('taxRate', e.target.value)}
                  className="input"
                  placeholder="0.10"
                  required
                />
              </div>

              <div>
                <label className="label">Currency Code</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="input"
                  placeholder="USD"
                  maxLength={3}
                  required
                />
              </div>

              <div>
                <label className="label">Currency Symbol</label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => handleChange('currencySymbol', e.target.value)}
                  className="input"
                  placeholder="$"
                  maxLength={10}
                  required
                />
              </div>

              <div>
                <label className="label">Transaction Prefix</label>
                <input
                  type="text"
                  value={formData.transactionPrefix}
                  onChange={(e) => handleChange('transactionPrefix', e.target.value)}
                  className="input"
                  placeholder="TXN"
                  maxLength={10}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Local Retention Days</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={formData.localRetentionDays}
                    onChange={(e) => handleChange('localRetentionDays', e.target.value)}
                    className="input"
                    placeholder="30"
                    required
                  />
                </div>

                <div>
                  <label className="label">Audit Log Retention Days</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={formData.auditLogRetentionDays}
                    onChange={(e) => handleChange('auditLogRetentionDays', e.target.value)}
                    className="input"
                    placeholder="90"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" isLoading={isLoading}>
                Save Settings
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Settings</h3>
            {settings.length === 0 ? (
              <p className="text-gray-500">No settings found</p>
            ) : (
              <div className="space-y-3">
                {settings.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{setting.key}</p>
                      <p className="text-xs text-gray-500">
                        Last updated: {new Date(setting.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-sm text-gray-900 font-mono">
                      {setting.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
