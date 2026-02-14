import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { api } from '@/services/api';
import { DeviceLoginScreen } from '@/components/auth/DeviceLoginScreen';
import { UserSelectionScreen } from '@/components/auth/UserSelectionScreen';
import { PinEntryScreen } from '@/components/auth/PinEntryScreen';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface DeviceInfo {
  id: string;
  storeId: string;
  storeName: string;
  deviceName: string;
  isNewBinding: boolean;
}

interface DeviceUser {
  id: string;
  name: string;
  role: 'manager' | 'cashier';
  lastLoginAt: string | null;
}

interface DeviceLoginResponse {
  device: DeviceInfo;
  users: DeviceUser[];
}

interface PinLoginResponse {
  user: {
    id: string;
    name: string;
    role: string;
    storeId: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type LoginStep = 'device' | 'users' | 'pin';

export default function Login() {
  const navigate = useNavigate();
  const { 
    setAuth,
    isDeviceBound,
    deviceInfo,
    deviceUsers,
    selectedUserId,
    setDeviceInfo,
    setDeviceUsers,
    selectUser,
    clearDeviceBinding,
  } = useAuthStore();
  
  const { fullSync } = useSyncStore();
  const { isOnline } = useOnlineStatus();

  // Local state for login flow
  const [step, setStep] = useState<LoginStep>('device');
  const [mode, setMode] = useState<'qr' | 'manual'>('manual');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore device binding state on mount
  useEffect(() => {
    if (isDeviceBound && deviceInfo && deviceUsers.length > 0) {
      setStep('users');
    }
  }, []);

  const handleDeviceLogin = async (bindingCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<DeviceLoginResponse>(
        '/auth/device-login',
        { bindingCode },
        { skipAuth: true, skipAuthHandling: true }
      );

      if (response.success && response.data) {
        const { device, users } = response.data;
        setDeviceInfo(device);
        setDeviceUsers(users);
        
        if (users.length === 0) {
          setError('No users found for this store. Please contact admin.');
          return;
        }
        
        setStep('users');
      } else {
        const err = response.error as any;
        if (err?.code === 'CODE_NOT_FOUND') {
          setError('Invalid binding code. Please check and try again.');
        } else if (err?.code === 'CODE_EXPIRED') {
          setError('This binding code has expired. Please request a new code from admin.');
        } else if (err?.code === 'CODE_REVOKED') {
          setError('This device binding has been revoked. Please contact admin.');
        } else {
          setError(err?.message || 'Failed to connect device. Please try again.');
        }
      }
    } catch (err) {
      console.error('Device login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = (userId: string) => {
    selectUser(userId);
    setStep('pin');
    setError(null);
  };

  const handleSwitchDevice = () => {
    clearDeviceBinding();
    setStep('device');
    setError(null);
  };

  const handlePinSubmit = async (pin: string) => {
    if (!selectedUserId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<PinLoginResponse>(
        '/auth/pin-login-device',
        { userId: selectedUserId, pin },
        { skipAuth: true, skipAuthHandling: true }
      );

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        setAuth(
          {
            id: user.id,
            email: '',
            name: user.name,
            role: user.role as 'manager' | 'cashier',
            storeId: user.storeId,
            pin: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          accessToken,
          refreshToken
        );

        // Perform initial sync if online
        if (isOnline && user.storeId) {
          try {
            await fullSync();
          } catch (syncError) {
            console.warn('Initial sync failed:', syncError);
          }
        }

        navigate('/pos');
      } else {
        const err = response.error as any;
        if (err?.code === 'INVALID_PIN') {
          setError(err.message || 'Incorrect PIN. Please try again.');
        } else if (err?.code === 'PIN_LOCKED') {
          setError(err.message || 'Account locked. Try again later.');
        } else if (err?.code === 'PIN_NOT_SET') {
          setError('PIN not set. Please contact admin to set your PIN.');
        } else if (err?.code === 'USER_INACTIVE') {
          setError('Your account has been deactivated. Please contact admin.');
        } else {
          setError(err?.message || 'Login failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('PIN login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    setStep('users');
    setError(null);
  };

  const handleSwitchToManual = () => {
    setMode('manual');
    setError(null);
  };

  const handleSwitchToQr = () => {
    setMode('qr');
    setError(null);
  };

  // Render based on step
  if (step === 'device') {
    return (
      <DeviceLoginScreen
        onDeviceLogin={handleDeviceLogin}
        onSwitchToManual={handleSwitchToManual}
        onSwitchToQr={handleSwitchToQr}
        isLoading={isLoading}
        error={error}
        mode={mode}
      />
    );
  }

  if (step === 'users') {
    return (
      <UserSelectionScreen
        users={deviceUsers}
        onSelectUser={handleSelectUser}
        onSwitchDevice={handleSwitchDevice}
        deviceName={deviceInfo?.deviceName || 'POS Device'}
        storeName={deviceInfo?.storeName || 'Store'}
        isLoading={isLoading}
      />
    );
  }

  if (step === 'pin') {
    const selectedUser = deviceUsers.find(u => u.id === selectedUserId);
    if (!selectedUser) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p>User not found. <button onClick={() => setStep('users')} className="text-primary-600">Go back</button></p>
        </div>
      );
    }

    return (
      <PinEntryScreen
        user={selectedUser}
        onSubmit={handlePinSubmit}
        onGoBack={handleGoBack}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  // Fallback - should not reach here
  return null;
}
