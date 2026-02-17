import { useState } from 'react';
import { Button, Numpad } from '@pos/ui';
import { QrCode, Keyboard, Camera, AlertCircle } from 'lucide-react';

interface DeviceLoginScreenProps {
  onDeviceLogin: (bindingCode: string) => Promise<void>;
  onSwitchToManual: () => void;
  onSwitchToQr: () => void;
  isLoading: boolean;
  error: string | null;
  mode: 'qr' | 'manual';
}

export function DeviceLoginScreen({
  onDeviceLogin,
  onSwitchToManual,
  onSwitchToQr,
  isLoading,
  error,
  mode,
}: DeviceLoginScreenProps) {
  const [bindingCode, setBindingCode] = useState('');
  const [inputError, setInputError] = useState('');

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Majumapan POS</h1>
          <p className="text-gray-500 mt-2">Connect your device to a store</p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={onSwitchToQr}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors ${
              mode === 'qr'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Camera className="w-5 h-5" />
            Scan QR Code
          </button>
          <button
            type="button"
            onClick={onSwitchToManual}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors ${
              mode === 'manual'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Keyboard className="w-5 h-5" />
            Enter Code
          </button>
        </div>

        {mode === 'qr' ? (
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center p-8">
                <QrCode className="w-24 h-24 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">Point camera at QR code</p>
                <p className="text-sm text-gray-400">
                  The QR code is displayed on the Admin Portal when creating a device
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSwitchToManual}
              className="w-full text-center text-primary-600 hover:text-primary-700 font-medium"
            >
              Switch to manual entry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
                Enter 6-digit binding code
              </label>
              
              {/* Display Area */}
              <div className="text-center text-3xl font-mono tracking-[0.5em] mb-6 py-4 bg-gray-50 rounded-lg">
                {bindingCode.padEnd(6, '•').split('').join(' ')}
              </div>
              
              {/* Numpad */}
              <Numpad
                value={bindingCode}
                onChange={(value) => {
                  setBindingCode(value);
                  setInputError('');
                }}
                maxLength={6}
                showBackspace={true}
                disabled={isLoading}
              />
            </div>

            {inputError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {inputError}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              onClick={async () => {
                if (bindingCode.length !== 6) {
                  setInputError('Code must be 6 digits');
                  return;
                }
                await onDeviceLogin(bindingCode);
              }}
              className="w-full"
              size="lg"
              isLoading={isLoading}
              disabled={bindingCode.length !== 6}
            >
              Connect Device
            </Button>

            <button
              type="button"
              onClick={onSwitchToQr}
              className="w-full text-center text-primary-600 hover:text-primary-700 font-medium"
            >
              Switch to QR scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
