import { ApiClient } from './apiClient';
import type { AuthState, AuthActions } from './types';

export function createApiClient(
  baseUrl: string,
  getAuth: () => AuthState,
  actions?: AuthActions
) {
  return new ApiClient(baseUrl, getAuth, actions);
}
