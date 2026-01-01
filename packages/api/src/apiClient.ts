import type { ApiResponse, RequestOptions, AuthState, AuthActions } from './types';

export class ApiClient {
  private baseUrl: string;
  private getAuth: () => AuthState;
  private actions?: AuthActions;

  constructor(baseUrl: string, getAuth: () => AuthState, actions?: AuthActions) {
    this.baseUrl = baseUrl;
    this.getAuth = getAuth;
    this.actions = actions;
  }

  private async getHeaders(skipAuth: boolean = false): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (!skipAuth) {
      const { accessToken } = this.getAuth();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response, responseType?: 'json' | 'text', skipAuthHandling = false): Promise<ApiResponse<T>> {
    if (responseType === 'text') {
      if (!response.ok) {
        if (response.status === 401 && !skipAuthHandling) {
          const refreshed = await this.refreshToken();
          if (!refreshed && this.actions?.logout) {
            this.actions.logout();
            window.location.href = '/login';
          }
        }
        return { success: false, error: 'An error occurred' };
      }
      const text = await response.text();
      return { success: true, data: text as T };
    }

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 && !skipAuthHandling) {
        const refreshed = await this.refreshToken();
        if (!refreshed && this.actions?.logout) {
          this.actions.logout();
          window.location.href = '/login';
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
    const { refreshToken } = this.getAuth();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        if (this.actions?.setTokens) {
          this.actions.setTokens(data.data.accessToken);
        }
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, skipAuthHandling, queryParams, responseType, ...fetchOptions } = options;

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

      return this.handleResponse<T>(response, responseType, skipAuthHandling);
    } catch (error) {
      console.error('API GET error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, skipAuthHandling, responseType, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: await this.getHeaders(skipAuth),
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      });

      return this.handleResponse<T>(response, responseType, skipAuthHandling);
    } catch (error) {
      console.error('API POST error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async put<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, skipAuthHandling, responseType, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: await this.getHeaders(skipAuth),
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      });

      return this.handleResponse<T>(response, responseType, skipAuthHandling);
    } catch (error) {
      console.error('API PUT error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, skipAuthHandling, responseType, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: await this.getHeaders(skipAuth),
        ...fetchOptions,
      });

      return this.handleResponse<T>(response, responseType, skipAuthHandling);
    } catch (error) {
      console.error('API DELETE error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}
