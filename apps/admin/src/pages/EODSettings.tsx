import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { Button, Input } from '@pos/ui';
import { Save, Bell, Clock } from 'lucide-react';

interface EODSettings {
  operationalDayStartHour: number;
  allowAutoDayTransition: boolean;
  eodNotificationEmails: string[];
}

export default function EODSettings() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<EODSettings>({
    operationalDayStartHour: 6,
    allowAutoDayTransition: true,
    eodNotificationEmails: [],
  });
  const [emailInput, setEmailInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.storeId) {
      fetchSettings();
    }
  }, [user?.storeId]);

  const fetchSettings = async () => {
    try {
      const response = await api.get<{
        operationalDayStartHour: number;
        allowAutoDayTransition: boolean;
        eodNotificationEmails: string[];
      }>(`/stores/${user?.storeId}/eod-settings`);

      if (response.success && response.data) {
        setSettings({
          operationalDayStartHour: response.data.operationalDayStartHour || 6,
          allowAutoDayTransition: response.data.allowAutoDayTransition ?? true,
          eodNotificationEmails: response.data.eodNotificationEmails || [],
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await api.put(
        `/stores/${user?.storeId}/eod-settings`,
        settings
      );

      if (response.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const addEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      setSettings(prev => ({
        ...prev,
        eodNotificationEmails: [...prev.eodNotificationEmails, emailInput],
      }));
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setSettings(prev => ({
      ...prev,
      eodNotificationEmails: prev.eodNotificationEmails.filter(e => e !== email),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">EOD Settings</h1>
        <p className="text-gray-600">Configure End of Day behavior for this store</p>
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

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {/* Operational Day Settings */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Operational Day</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day Start Hour
              </label>
              <select
                value={settings.operationalDayStartHour}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  operationalDayStartHour: parseInt(e.target.value),
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00 - {(i + 1).toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                The hour when a new operational day begins
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Auto Day Transition</p>
                <p className="text-sm text-gray-500">
                  Automatically switch to next operational day after EOD
                </p>
              </div>
              <button
                onClick={() => setSettings(prev => ({
                  ...prev,
                  allowAutoDayTransition: !prev.allowAutoDayTransition,
                }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.allowAutoDayTransition ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.allowAutoDayTransition ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <Bell className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notification Emails
              </label>
              <div className="flex space-x-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                />
                <Button variant="outline" onClick={addEmail}>Add</Button>
              </div>
            </div>

            {settings.eodNotificationEmails.length > 0 && (
              <ul className="space-y-2">
                {settings.eodNotificationEmails.map((email) => (
                  <li key={email} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700">{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-sm text-gray-500">
              Email addresses to receive EOD completion notifications
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50">
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
