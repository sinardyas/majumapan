import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Numpad } from '@pos/ui';

interface User {
  id: string;
  name: string;
  role: 'manager' | 'cashier';
}

interface PinEntryScreenProps {
  user: User;
  onSubmit: (pin: string) => Promise<void>;
  onGoBack: () => void;
  isLoading: boolean;
  error: string | null;
}

export function PinEntryScreen({
  user,
  onSubmit,
  onGoBack,
  isLoading,
  error,
}: PinEntryScreenProps) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    // Focus the container for keyboard input
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'manager':
        return 'Store Manager';
      case 'cashier':
        return 'Cashier';
      default:
        return role;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 6) {
      onSubmit(pin);
    } else if (e.key === 'Backspace') {
      setPin((prev) => prev.slice(0, -1));
    } else if (/^\d$/.test(e.key)) {
      if (pin.length < 6) {
        setPin((prev) => prev + e.key);
      }
    }
  };

  return (
    <div 
      className="min-h-screen bg-gray-100 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        {/* User Info */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-2xl font-semibold mx-auto mb-3">
            {getInitials(user.name)}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
          <p className="text-gray-500 text-sm">{getRoleLabel(user.role)}</p>
        </div>

        <div className="border-t border-gray-200 my-4" />

        {/* PIN Display */}
        <div className="mb-6">
          <p className="text-center text-sm font-medium text-gray-700 mb-3">
            Enter your PIN:
          </p>
          
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center ${
                  pin.length > index
                    ? 'bg-primary-600 border-primary-600'
                    : 'bg-gray-50 border-gray-300'
                }`}
              >
                {pin.length > index && (
                  <div className="w-3 h-3 rounded-full bg-white" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad */}
        <Numpad
          value={pin}
          onChange={setPin}
          maxLength={6}
          showBackspace={true}
          submitLabel="✓"
          onSubmit={(value) => onSubmit(value)}
          autoSubmit={true}
          disabled={isLoading}
        />

        {/* Back Button */}
        <button
          onClick={onGoBack}
          disabled={isLoading}
          className="w-full mt-4 py-2 text-center text-gray-600 hover:text-gray-900 font-medium"
        >
          Back to profiles
        </button>

        {/* Forgot PIN */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Forgot PIN? Contact your admin
        </p>
      </div>
    </div>
  );
}
