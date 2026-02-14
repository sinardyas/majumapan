import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@pos/shared';
import { useCartStore } from './cartStore';

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

interface AuthState {
  user: Omit<User, 'passwordHash'> | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Device binding state
  isDeviceBound: boolean;
  deviceInfo: DeviceInfo | null;
  deviceUsers: DeviceUser[];
  selectedUserId: string | null;

  // Actions
  setAuth: (user: Omit<User, 'passwordHash'>, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  
  // Device binding actions
  setDeviceInfo: (device: DeviceInfo) => void;
  setDeviceUsers: (users: DeviceUser[]) => void;
  selectUser: (userId: string) => void;
  clearDeviceBinding: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      
      isDeviceBound: false,
      deviceInfo: null,
      deviceUsers: [],
      selectedUserId: null,

      setAuth: (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set((state) => ({
          accessToken,
          refreshToken: refreshToken ?? state.refreshToken,
        }));
      },

      logout: () => {
        useCartStore.getState().clearCart();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },
      
      setDeviceInfo: (device) => {
        set({
          isDeviceBound: true,
          deviceInfo: device,
        });
      },
      
      setDeviceUsers: (users) => {
        set({ deviceUsers: users });
      },
      
      selectUser: (userId) => {
        set({ selectedUserId: userId });
      },
      
      clearDeviceBinding: () => {
        set({
          isDeviceBound: false,
          deviceInfo: null,
          deviceUsers: [],
          selectedUserId: null,
        });
      },
    }),
    {
      name: 'pos-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isDeviceBound: state.isDeviceBound,
        deviceInfo: state.deviceInfo,
      }),
    }
  )
);
