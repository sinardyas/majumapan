import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Textarea } from '@pos/ui';
import { z } from 'zod';
import { Settings as SettingsIcon, Save, Loader2, CheckCircle, AlertCircle, Sun } from 'lucide-react';
import { format } from 'date-fns';

interface SettingItem {
  key: string;
  value: string;
  updatedAt: string;
}

interface SettingsFormData {
  taxRate: string;
  currency: string;
  currencySymbol: string;
  transactionPrefix: string;
  localRetentionDays: string;
  auditLogRetentionDays: string;
}

interface EODSettingsFormData {
  operationalDayStartHour: number;
  allowAutoDayTransition: boolean;
  notificationEmails: string;
}

const settingsSchema = z.object({
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Tax rate must be a valid number'),
  currency: z.string().length(3, 'Currency code must be 3 characters').toUpperCase(),
  currencySymbol: z.string().min(1, 'Currency symbol is required').max(10),
  transactionPrefix: z.string().min(1, 'Transaction prefix is required').max(10),
  localRetentionDays: z.string().regex(/^\d+$/, 'Must be a number').refine(val => parseInt(val) >= 1 && parseInt(val) <= 365, 'Must be between 1 and 365'),
  auditLogRetentionDays: z.string().regex(/^\d+$/, 'Must be a number').refine(val => parseInt(val) >= 1 && parseInt(val) <= 365, 'Must be between 1 and 365'),
});

type SettingsErrors = Partial<Record<keyof SettingsFormData, string>>;

export default function Settings() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [eodSaveSuccess, setEodSaveSuccess] = useState(false);
  const [formData, setFormData] = useState<SettingsFormData>({
    taxRate: '0.10',
    currency: 'USD',
    currencySymbol: '$',
    transactionPrefix: 'TXN',
    localRetentionDays: '30',
    auditLogRetentionDays: '90',
  });
  const [eodFormData, setEodFormData] = useState<EODSettingsFormData>({
    operationalDayStartHour: 6,
    allowAutoDayTransition: true,
    notificationEmails: '',
  });
  const [errors, setErrors] = useState<SettingsErrors>({});

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Record<string, string>>('/settings');
      if (response.success && response.data) {
        const settingsArray = Object.entries(response.data).map(([key, value]) => ({
          key,
          value,
          updatedAt: new Date().toISOString(),
        }));
        setSettings(settingsArray);

        const formSettings: Partial<SettingsFormData> = {};
        Object.entries(response.data).forEach(([key, value]) => {
          switch (key) {
            case 'tax_rate':
              formSettings.taxRate = value;
              break;
            case 'currency':
              formSettings.currency = value;
              break;
            case 'currency_symbol':
              formSettings.currencySymbol = value;
              break;
            case 'transaction_prefix':
              formSettings.transactionPrefix = value;
              break;
            case 'local_retention_days':
              formSettings.localRetentionDays = value;
              break;
            case 'audit_log_retention_days':
              formSettings.auditLogRetentionDays = value;
              break;
          }
        });
        if (formSettings.taxRate) setFormData(prev => ({ ...prev, ...formSettings }));
      }

      const eodResponse = await api.get<{
        operationalDayStartHour: number;
        allowAutoDayTransition: boolean;
        notificationEmails: string[];
      }>('/settings/eod');
      if (eodResponse.success && eodResponse.data) {
        setEodFormData({
          operationalDayStartHour: eodResponse.data.operationalDayStartHour,
          allowAutoDayTransition: eodResponse.data.allowAutoDayTransition,
          notificationEmails: eodResponse.data.notificationEmails?.join(', ') || '',
        });
      }
    } catch {
      console.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEodSaveSuccess(false);

    const emailsArray = eodFormData.notificationEmails
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    setIsSaving(true);
    try {
      const response = await api.put('/settings/eod', {
        operationalDayStartHour: eodFormData.operationalDayStartHour,
        allowAutoDayTransition: eodFormData.allowAutoDayTransition,
        notificationEmails: emailsArray,
      });
      if (response.success) {
        setEodSaveSuccess(true);
        await fetchSettings();
        setTimeout(() => setEodSaveSuccess(false), 3000);
      }
    } catch {
      console.error('Failed to update EOD settings');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: keyof SettingsFormData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
    setSaveSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaveSuccess(false);

    const result = settingsSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: SettingsErrors = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof SettingsFormData;
        if (field) {
          newErrors[field] = issue.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        tax_rate: formData.taxRate,
        currency: formData.currency.toUpperCase(),
        currency_symbol: formData.currencySymbol,
        transaction_prefix: formData.transactionPrefix,
        local_retention_days: formData.localRetentionDays,
        audit_log_retention_days: formData.auditLogRetentionDays,
      };

      const response = await api.put('/settings', payload);
      if (response.success) {
        setSaveSuccess(true);
        await fetchSettings();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      console.error('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && settings.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        {saveSuccess && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Settings saved successfully</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            System Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tax Rate</label>
                <Input
                  type="text"
                  value={formData.taxRate}
                  onChange={(e) => handleChange('taxRate', e.target.value)}
                  placeholder="0.10"
                  className={errors.taxRate ? 'border-red-500' : ''}
                />
                {errors.taxRate && <p className="text-sm text-red-500">{errors.taxRate}</p>}
                <p className="text-xs text-gray-500">Enter as decimal (e.g., 0.10 for 10%)</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Currency Code</label>
                <Input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  placeholder="USD"
                  maxLength={3}
                  className={errors.currency ? 'border-red-500' : ''}
                />
                {errors.currency && <p className="text-sm text-red-500">{errors.currency}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Currency Symbol</label>
                <Input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => handleChange('currencySymbol', e.target.value)}
                  placeholder="$"
                  maxLength={10}
                  className={errors.currencySymbol ? 'border-red-500' : ''}
                />
                {errors.currencySymbol && <p className="text-sm text-red-500">{errors.currencySymbol}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Transaction Prefix</label>
                <Input
                  type="text"
                  value={formData.transactionPrefix}
                  onChange={(e) => handleChange('transactionPrefix', e.target.value)}
                  placeholder="TXN"
                  maxLength={10}
                  className={errors.transactionPrefix ? 'border-red-500' : ''}
                />
                {errors.transactionPrefix && <p className="text-sm text-red-500">{errors.transactionPrefix}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Local Retention Days</label>
                <Input
                  type="number"
                  value={formData.localRetentionDays}
                  onChange={(e) => handleChange('localRetentionDays', e.target.value)}
                  placeholder="30"
                  min={1}
                  max={365}
                  className={errors.localRetentionDays ? 'border-red-500' : ''}
                />
                {errors.localRetentionDays && <p className="text-sm text-red-500">{errors.localRetentionDays}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Audit Log Retention Days</label>
                <Input
                  type="number"
                  value={formData.auditLogRetentionDays}
                  onChange={(e) => handleChange('auditLogRetentionDays', e.target.value)}
                  placeholder="90"
                  min={1}
                  max={365}
                  className={errors.auditLogRetentionDays ? 'border-red-500' : ''}
                />
                {errors.auditLogRetentionDays && <p className="text-sm text-red-500">{errors.auditLogRetentionDays}</p>}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" isLoading={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5" />
            End of Day Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEodSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Operational Day Start Hour</label>
                <select
                  value={eodFormData.operationalDayStartHour}
                  onChange={(e) => setEodFormData(prev => ({ ...prev, operationalDayStartHour: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i}:00</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Hour when new operational day begins</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  Auto Day Transition
                </label>
                <button
                  onClick={() => setEodFormData(prev => ({ ...prev, allowAutoDayTransition: !prev.allowAutoDayTransition }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    eodFormData.allowAutoDayTransition ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      eodFormData.allowAutoDayTransition ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <p className="text-xs text-gray-500">Automatically advance to next day after EOD</p>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700">Notification Emails</label>
                <Textarea
                  value={eodFormData.notificationEmails}
                  onChange={(e) => setEodFormData(prev => ({ ...prev, notificationEmails: e.target.value }))}
                  placeholder="email1@store.com, email2@store.com"
                  rows={3}
                />
                <p className="text-xs text-gray-500">Comma-separated list of emails to receive EOD notifications</p>
              </div>
            </div>

            {eodSaveSuccess && (
              <div className="flex items-center gap-2 text-green-600 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">EOD settings saved successfully</span>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" isLoading={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save EOD Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <div className="flex items-center gap-2 text-gray-500">
              <AlertCircle className="w-5 h-5" />
              <span>No settings found</span>
            </div>
          ) : (
            <div className="space-y-3">
              {settings.map((setting) => (
                <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700 font-mono">{setting.key}</p>
                    <p className="text-xs text-gray-500">
                      Last updated: {format(new Date(setting.updatedAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-sm text-gray-900 font-mono bg-white px-3 py-1 rounded border">
                    {setting.value}
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
