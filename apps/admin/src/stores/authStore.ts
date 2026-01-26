import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@pos/shared';

interface AuthState {
  user: Omit<User, 'passwordHash'> | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedStoreId: string | 'all' | null;
  selectedStoreName: string | null;

  setAuth: (user: Omit<User, 'passwordHash'>, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setSelectedStore: (storeId: string | 'all', storeName?: string) => void;
  clearSelectedStore: () => void;
  isAllStores: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      selectedStoreId: null,
      selectedStoreName: null,

      setAuth: (user, accessToken, refreshToken) => {
        const defaultStoreId = user.role === 'admin'
          ? 'all'
          : user.storeId || null;

        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
          selectedStoreId: defaultStoreId,
          selectedStoreName: user.role === 'admin' ? 'All Stores' : null,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set((state) => ({
          accessToken,
          refreshToken: refreshToken ?? state.refreshToken,
        }));
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          selectedStoreId: null,
          selectedStoreName: null,
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setSelectedStore: (storeId, storeName) => {
        set({
          selectedStoreId: storeId,
          selectedStoreName: storeName || null,
        });
      },

      clearSelectedStore: () => {
        set({
          selectedStoreId: null,
          selectedStoreName: null,
        });
      },

      isAllStores: () => {
        return get().selectedStoreId === 'all';
      },
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        selectedStoreId: state.selectedStoreId,
        selectedStoreName: state.selectedStoreName,
      }),
    }
  )
);
