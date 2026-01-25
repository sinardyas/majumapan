import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { 
  PreEODSummary, 
  DayClose, 
  DayCloseHistoryItem, 
  PendingCartQueueItem 
} from '@pos/shared';
import { useCartStore, type PendingCartData } from './cartStore';
import { api } from '@/services/api';

interface EODState {
  isLoading: boolean;
  error: string | null;
  preEODSummary: PreEODSummary | null;
  currentDayClose: DayClose | null;
  dayCloseHistory: DayCloseHistoryItem[];
  historyLoading: boolean;
  historyTotal: number;
  historyPage: number;
  pendingCarts: PendingCartQueueItem[];
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  fetchPreEODSummary: (storeId: string) => Promise<PreEODSummary | null>;
  clearPreEODSummary: () => void;
  
  executeEOD: (
    storeId: string, 
    operationalDate: string,
    pendingCartData?: PendingCartData[]
  ) => Promise<DayClose | null>;
  
  fetchDayCloseHistory: (
    storeId: string, 
    page?: number, 
    pageSize?: number,
    filters?: { startDate?: string; endDate?: string }
  ) => Promise<void>;
  
  fetchDayClose: (dayCloseId: string) => Promise<DayClose | null>;
  
  fetchPendingCarts: (storeId: string, operationalDate: string) => Promise<void>;
  restorePendingCart: (cartId: string) => Promise<boolean>;
  voidPendingCart: (cartId: string) => Promise<boolean>;
  
  clearError: () => void;
  clearCurrentDayClose: () => void;
}

export const useEODStore = create<EODState>()(
  devtools(
    persist(
      (set, get) => ({
        isLoading: false,
        error: null,
        preEODSummary: null,
        currentDayClose: null,
        dayCloseHistory: [],
        historyLoading: false,
        historyTotal: 0,
        historyPage: 1,
        pendingCarts: [],
        
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        
        fetchPreEODSummary: async (storeId) => {
          set({ isLoading: true, error: null });
          try {
            const timezoneOffset = -new Date().getTimezoneOffset();
            const response = await api.get<PreEODSummary>('/day-close/preview', {
              queryParams: { storeId, timezoneOffset },
            });

            if (response.success && response.data) {
              set({ preEODSummary: response.data });
              return response.data;
            }
            throw new Error(response.error || 'Failed to fetch pre-EOD summary');
          } catch (error) {
            set({ error: (error as Error).message });
            return null;
          } finally {
            set({ isLoading: false });
          }
        },
        
        clearPreEODSummary: () => set({ preEODSummary: null }),
        
        executeEOD: async (storeId, operationalDate, pendingCartData) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.post<DayClose>('/day-close/execute', {
              storeId,
              operationalDate,
              pendingCarts: pendingCartData,
            });

            if (response.success && response.data) {
              set({ currentDayClose: response.data });
              get().clearPreEODSummary();
              useCartStore.getState().clearCart();
              return response.data;
            }
            throw new Error(response.error || 'Failed to execute EOD');
          } catch (error) {
            set({ error: (error as Error).message });
            return null;
          } finally {
            set({ isLoading: false });
          }
        },
        
        fetchDayCloseHistory: async (storeId, page = 1, pageSize = 20, filters) => {
          set({ historyLoading: true, error: null });
          try {
            const response = await api.get<{ dayCloses: DayCloseHistoryItem[]; total: number }>('/day-close/history', {
              queryParams: {
                storeId,
                page,
                pageSize,
                ...(filters?.startDate && { startDate: filters.startDate }),
                ...(filters?.endDate && { endDate: filters.endDate }),
              },
            });

            if (response.success && response.data) {
              set({
                dayCloseHistory: response.data.dayCloses,
                historyTotal: response.data.total,
                historyPage: page,
              });
            } else {
              throw new Error(response.error || 'Failed to fetch history');
            }
          } catch (error) {
            set({ error: (error as Error).message });
          } finally {
            set({ historyLoading: false });
          }
        },
        
        fetchDayClose: async (dayCloseId) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.get<{ dayClose: DayClose }>(`/day-close/${dayCloseId}`);

            if (response.success && response.data) {
              set({ currentDayClose: response.data.dayClose });
              return response.data.dayClose;
            }
            throw new Error(response.error || 'Failed to fetch day close');
          } catch (error) {
            set({ error: (error as Error).message });
            return null;
          } finally {
            set({ isLoading: false });
          }
        },
        
        fetchPendingCarts: async (storeId, operationalDate) => {
          try {
            const response = await api.get<PendingCartQueueItem[]>('/pending-carts', {
              queryParams: { storeId, operationalDate },
            });

            if (response.success) {
              set({ pendingCarts: response.data || [] });
            }
          } catch (error) {
            console.error('Failed to fetch pending carts:', error);
          }
        },
        
        restorePendingCart: async (cartId) => {
          try {
            const response = await api.post<{ success: boolean }>(`/pending-carts/${cartId}/restore`);

            if (response.success) {
              set((state) => ({
                pendingCarts: state.pendingCarts.filter((c) => c.cartId !== cartId),
              }));
              return true;
            }
            return false;
          } catch (error) {
            console.error('Failed to restore cart:', error);
            return false;
          }
        },
        
        voidPendingCart: async (cartId) => {
          try {
            const response = await api.delete<{ success: boolean }>(`/pending-carts/${cartId}`);

            if (response.success) {
              set((state) => ({
                pendingCarts: state.pendingCarts.filter((c) => c.cartId !== cartId),
              }));
              return true;
            }
            return false;
          } catch (error) {
            console.error('Failed to void cart:', error);
            return false;
          }
        },
        
        clearError: () => set({ error: null }),
        
        clearCurrentDayClose: () => set({ currentDayClose: null }),
      }),
      {
        name: 'eod-store',
        partialize: (state) => ({
          currentDayClose: state.currentDayClose,
        }),
      }
    )
  )
);
