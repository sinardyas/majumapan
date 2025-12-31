import { createApiClient } from '@pos/api-client';
import { useAuthStore } from '@/stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = createApiClient(
  API_URL,
  () => useAuthStore.getState(),
  {
    setTokens: (accessToken: string, refreshToken?: string) =>
      useAuthStore.getState().setTokens(accessToken, refreshToken),
    logout: () => useAuthStore.getState().logout(),
  }
);

export const dashboardApi = {
  getSystemOverview: () => api.get<any>('/reports/system-overview'),
  getStoresComparison: (params?: { startDate?: string; endDate?: string }) =>
    api.get<any>('/reports/stores-comparison', { queryParams: params }),
  getSalesByStore: (params?: { storeId?: string; startDate?: string; endDate?: string }) =>
    api.get<any>('/reports/sales-by-store', { queryParams: params }),
  getTopStores: (params?: { startDate?: string; endDate?: string; metric?: string }) =>
    api.get<any>('/reports/top-stores', { queryParams: params }),
  getAuditLogs: (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    entityType?: string;
    search?: string;
  }) => api.get<any>('/audit-logs', { queryParams: params }),
  exportData: async (type: 'products' | 'categories' | 'users', storeId?: string) => {
    const queryParams = storeId ? { storeId } : undefined;
    return api.get<string>(`/data/export/${type}`, {
      queryParams,
      responseType: 'text',
    });
  },
};

export const dataApi = {
  importData: async (type: 'products' | 'categories' | 'users', items: Record<string, unknown>[]) => {
    return api.post<any>(`/data/import/${type}`, { items });
  },
};
