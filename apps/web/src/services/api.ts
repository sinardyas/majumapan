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
