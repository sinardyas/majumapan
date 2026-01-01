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
  skipAuthHandling?: boolean;
  queryParams?: Record<string, string | number | boolean | undefined>;
  responseType?: 'json' | 'text';
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface AuthActions {
  setTokens?: (accessToken: string, refreshToken?: string) => void;
  logout?: () => void;
}
