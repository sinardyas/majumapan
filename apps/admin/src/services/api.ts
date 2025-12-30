const API_URL = (import.meta as any).env.VITE_API_URL || '/api/v1';

declare const window: Window & {
  __ADMIN_AUTH_STORE__?: {
      accessToken: string | null;
      refreshToken: string | null;
    };
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RequestOptions extends Omit<RequestInit, 'headers'> {
  skipAuth?: boolean;
  queryParams?: Record<string, string | number | boolean | undefined>;
  responseType?: 'json' | 'text';
}

export function getAuthState() {
  try {
    return {
      accessToken: (window as any).__ADMIN_AUTH_STORE__?.accessToken || null,
      refreshToken: (window as any).__ADMIN_AUTH_STORE__?.refreshToken || null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export function setAuthTokens(accessToken: string, refreshToken?: string) {
  try {
    const current = (window as any).__ADMIN_AUTH_STORE__ || {};
    (window as any).__ADMIN_AUTH_STORE__ = {
      ...current,
      accessToken,
      refreshToken: refreshToken || current.refreshToken,
    };
  } catch {
  }
}

export function clearAuthTokens() {
  try {
    delete (window as any).__ADMIN_AUTH_STORE__;
  } catch {
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(skipAuth: boolean = false): Promise<Headers> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');

    if (!skipAuth) {
      const { accessToken } = getAuthState();
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response, responseType: 'json' | 'text' = 'json'): Promise<ApiResponse<T>> {
    if (responseType === 'text') {
      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await this.refreshToken();
          if (!refreshed) {
            clearAuthTokens();
            window.location.href = '/login';
          }
        }
        return { success: false, error: 'An error occurred' };
      }
      const text = await response.text();
      return { success: true, data: text as T };
    }

    const data = await response.json() as ApiResponse<T>;

    if (!response.ok) {
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          // clearAuthTokens();
          // window.location.href = '/login';
        }
      }

      return {
        success: false,
        error: data.error || 'An error occurred',
      };
    }

    return data;
  }

  private async refreshToken(): Promise<boolean> {
    const { refreshToken } = getAuthState();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearAuthTokens();
        return false;
      }

      const responseData = await response.json() as ApiResponse<{ accessToken: string }>;
      if (responseData.success && responseData.data?.accessToken) {
        setAuthTokens(responseData.data.accessToken);
        return true;
      }

      return false;
    } catch {
      clearAuthTokens();
      return false;
    }
  }

  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, queryParams, responseType, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (queryParams) {
      const searchParams = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getHeaders(skipAuth),
        ...fetchOptions,
      });

      return this.handleResponse<T>(response, responseType);
    } catch (error) {
      console.error('API GET error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, responseType, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: await this.getHeaders(skipAuth),
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      });

      return this.handleResponse<T>(response, responseType);
    } catch (error) {
      console.error('API POST error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async put<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, responseType, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: await this.getHeaders(skipAuth),
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      });

      return this.handleResponse<T>(response, responseType);
    } catch (error) {
      console.error('API PUT error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, responseType, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: await this.getHeaders(skipAuth),
        ...fetchOptions,
      });

      return this.handleResponse<T>(response, responseType);
    } catch (error) {
      console.error('API DELETE error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}

export const api = new ApiClient(API_URL);

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
