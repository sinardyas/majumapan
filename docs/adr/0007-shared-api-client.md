# ADR-0007: Shared API Client Package

## Status

Accepted

## Date

2024-12-31

## Context

The Majumapan POS system has two web applications:
- `apps/web` - POS app for managers and cashiers
- `apps/admin` - Admin panel for administrators

Both applications have nearly identical `api.ts` files with duplicated HTTP client logic (~85% code similarity). This creates maintenance burden and inconsistency risks.

### Current State

**`apps/web/src/services/api.ts`** (164 lines):
- Uses Zustand `useAuthStore` for auth state
- Core `ApiClient` class with get/post/put/delete methods
- Token refresh on 401 responses
- No global window state

**`apps/admin/src/services/api.ts`** (259 lines):
- Uses global `window.__ADMIN_AUTH_STORE__` for auth state
- Same core `ApiClient` class
- Additional `dashboardApi` convenience methods
- Global window state adds unnecessary complexity

### Problem Statement

1. **Code duplication** - ~130 lines of identical HTTP client code
2. **Different auth patterns** - Global window state vs Zustand
3. **Inconsistent behavior** - Admin has commented-out logout logic (lines 102-103)
4. **Maintenance burden** - Changes must be applied in two places

## Decision

We will create a shared `packages/api-client` package containing the core `ApiClient` class with an abstract auth interface. Both applications will import and configure this client.

### Architecture

```
packages/api-client/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Exports
    ├── types.ts              # Shared types (ApiResponse, RequestOptions, Auth interfaces)
    ├── apiClient.ts          # Core ApiClient class
    └── createApiClient.ts    # Factory function

apps/web/src/services/
└── api.ts                    # Imports from @pos/api-client, configures with Zustand auth

apps/admin/src/services/
├── api.ts                    # Imports from @pos/api-client, configures with Zustand auth
└── dashboardApi.ts           # Admin-specific convenience methods (not shared)
```

## Implementation

### New Package: `packages/api-client`

**`packages/api-client/src/types.ts`**
```typescript
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

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface AuthActions {
  setTokens?: (accessToken: string, refreshToken?: string) => void;
  logout?: () => void;
}
```

**`packages/api-client/src/apiClient.ts`**
```typescript
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

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
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

      if (responseType === 'text') {
        if (!response.ok) {
          return { success: false, error: 'An error occurred' };
        }
        const text = await response.text();
        return { success: true, data: text as T };
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      console.error('API GET error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: await this.getHeaders(skipAuth),
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      console.error('API POST error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async put<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: await this.getHeaders(skipAuth),
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      console.error('API PUT error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, ...fetchOptions } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: await this.getHeaders(skipAuth),
        ...fetchOptions,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      console.error('API DELETE error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}
```

**`packages/api-client/src/createApiClient.ts`**
```typescript
import { ApiClient } from './apiClient';
import type { AuthState, AuthActions } from './types';

export function createApiClient(
  baseUrl: string,
  getAuth: () => AuthState,
  actions?: AuthActions
) {
  return new ApiClient(baseUrl, getAuth, actions);
}
```

**`packages/api-client/src/index.ts`**
```typescript
export { createApiClient, ApiClient } from './apiClient';
export * from './types';
```

**`packages/api-client/package.json`**
```json
{
  "name": "@pos/api-client",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**`packages/api-client/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "declaration": true,
    "declarationDir": "dist",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Admin App Changes

**`apps/admin/src/stores/authStore.ts`**
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken: refreshToken || null }),
      logout: () => set({ accessToken: null, refreshToken: null }),
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**`apps/admin/src/services/api.ts`**
```typescript
import { createApiClient } from '@pos/api-client';
import { useAuthStore } from '@/stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = createApiClient(
  API_URL,
  () => useAuthStore.getState(),
  {
    setTokens: (accessToken, refreshToken) =>
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
```

### Web App Changes

**`apps/web/src/services/api.ts`**
```typescript
import { createApiClient } from '@pos/api-client';
import { useAuthStore } from '@/stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = createApiClient(
  API_URL,
  () => useAuthStore.getState(),
  {
    setTokens: (accessToken, refreshToken) =>
      useAuthStore.getState().setTokens(accessToken, refreshToken),
    logout: () => useAuthStore.getState().logout(),
  }
);
```

### Package.json Updates

**`apps/admin/package.json`** - Add dependency:
```json
"dependencies": {
  "@pos/api-client": "*",
  ...
}
```

**`apps/web/package.json`** - Add dependency:
```json
"dependencies": {
  "@pos/api-client": "*",
  ...
}
```

**`package.json`** - Update turbo pipeline:
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    ...
  }
}
```

## Files Changed

### New Files Created

| File | Purpose |
|------|---------|
| `packages/api/package.json` | Package manifest |
| `packages/api/tsconfig.json` | TypeScript config |
| `packages/api/src/types.ts` | Shared type definitions |
| `packages/api/src/apiClient.ts` | Core API client class |
| `packages/api/src/createApiClient.ts` | Factory function |
| `packages/api/src/index.ts` | Exports |
| `apps/admin/src/stores/authStore.ts` | Admin auth state management |

### Files Modified

| File | Change |
|------|--------|
| `apps/admin/src/services/api.ts` | Replace with imports from @pos/api-client |
| `apps/web/src/services/api.ts` | Replace with imports from @pos/api-client |
| `apps/admin/package.json` | Add @pos/api-client dependency |
| `apps/web/package.json` | Add @pos/api-client dependency |
| `package.json` | Update turbo pipeline |

### Files Deleted

| File | Reason |
|------|--------|
| `apps/admin/src/services/api.ts` (old) | Replaced by shared package |
| `apps/web/src/services/api.ts` (old) | Replaced by shared package |

## Consequences

### Positive

1. **Eliminates code duplication** - ~130 lines of HTTP client code shared
2. **Consistent behavior** - Both apps use identical client logic
3. **Maintainable** - Changes only needed in one place
4. **Testable** - Auth interface allows easy mocking
5. **Simple auth pattern** - Removes global window state in admin

### Negative

1. **Additional package** - Adds complexity to monorepo structure
2. **Build step required** - @pos/api-client must be built before apps
3. **Version management** - Must ensure dependency resolution works

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Circular dependency | Api package has no dependencies on apps |
| Build ordering | Turbo correctly handles `dependsOn` |
| Type conflicts | Shared types prevent divergence |

## Alternatives Considered

### Alternative A: Copy/Paste Fix

Keep both files but update admin to match web.

**Rejected because:**
- No abstraction layer
- Future changes still require dual updates
- No type safety between implementations

### Alternative B: Single Shared File in Apps

Create `apps/shared/src/api.ts` and import from both apps.

**Rejected because:**
- Not a proper package (can't have own tsconfig)
- Less clear dependency structure
- Can't easily publish or reuse

### Alternative C: Use axios or similar library

Replace custom fetch implementation with axios.

**Rejected because:**
- Adds ~200KB bundle size
- Fetch API is sufficient for current needs
- More complexity than value

## Rollout Plan

1. Create `packages/api` package structure
2. Implement core `ApiClient` class
3. Create admin `authStore`
4. Update `admin/api.ts` to use shared package
5. Update `web/api.ts` to use shared package
6. Update package.json dependencies
7. Verify build works
8. Test both apps work correctly

## Related Documents

- **ADR-0006**: UI Component Sharing Strategy (similar pattern)
- **PLAN.md**: Original system plan

## References

- [Turborepo Workspaces](https://turbo.build/repo/docs/core-concepts/monorepos/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
