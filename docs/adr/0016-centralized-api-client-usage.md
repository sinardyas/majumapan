# ADR-0016: Centralized API Client Usage Standard

## Status

Accepted

## Date

2026-01-17

## Context

On 2026-01-17, multiple admin pages (`EODSettings.tsx`, `MasterTerminals.tsx`, `DayCloseHistory.tsx`) and the POS app's `eodStore.ts` were found to use raw `fetch()` calls instead of the centralized `api` client from `@/services/api`.

### Symptoms

- Admin pages displayed infinite loading on navigation
- POS End of Day page showed "Unauthorized: No token provided" snackbar
- API requests returned 401 errors

### Root Cause Analysis

All affected files used raw `fetch()` without authentication headers:

```typescript
// ❌ INCORRECT: Raw fetch without auth token
const response = await fetch(`/api/v1/stores/${user?.storeId}/eod-settings`);
const data = await response.json();
```

The centralized `api` client (`@/services/api`) provides:
1. Automatic `Authorization: Bearer <token>` header injection
2. Token refresh on 401 responses
3. Consistent `ApiResponse<T>` format handling

### Audit Findings

| File | Issue | Impact |
|------|-------|--------|
| `apps/admin/src/pages/EODSettings.tsx` | 2 raw `fetch()` calls | Infinite loading |
| `apps/admin/src/pages/MasterTerminals.tsx` | 4 raw `fetch()` calls | Infinite loading |
| `apps/admin/src/pages/DayCloseHistory.tsx` | 3 raw `fetch()` calls | Infinite loading |
| `apps/web/src/stores/eodStore.ts` | 7 raw `fetch()` calls | "Unauthorized" errors |

### Existing Architecture

ADR-0007 established a shared `packages/api-client` package with the `ApiClient` class. Both apps configure it in their respective `api.ts`:

```typescript
// apps/web/src/services/api.ts
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

The `ApiClient` class automatically:
- Reads `accessToken` from `useAuthStore`
- Adds `Authorization: Bearer <token>` header to all requests
- Handles 401 by attempting token refresh
- Redirects to login on refresh failure

## Decision

All frontend code MUST use the centralized `api` client from `@/services/api` for all API calls. Raw `fetch()` is prohibited for authenticated endpoints.

### Enforced Pattern

#### Import the API Client

```typescript
// In any component, store, or service file
import { api } from '@/services/api';
```

#### GET Requests

```typescript
// ❌ INCORRECT: Raw fetch
const response = await fetch(`/api/v1/stores/${storeId}/settings`);
const data = await response.json();

// ✅ CORRECT: Using api client
const response = await api.get('/stores/{storeId}/settings', {
  queryParams: { storeId },
});
if (response.success && response.data) {
  // Handle success
}
```

#### POST Requests

```typescript
// ❌ INCORRECT: Raw fetch
const response = await fetch('/api/v1/day-close/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ storeId, operationalDate }),
});
const data = await response.json();

// ✅ CORRECT: Using api client
const response = await api.post('/day-close/execute', {
  storeId,
  operationalDate,
});
if (response.success && response.data) {
  // Handle success
}
```

#### PUT Requests

```typescript
// ❌ INCORRECT: Raw fetch
const response = await fetch(`/api/v1/devices/${deviceId}/master-status`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isMasterTerminal: true }),
});

// ✅ CORRECT: Using api client
const response = await api.put(`/devices/${deviceId}/master-status`, {
  isMasterTerminal: true,
});
```

#### DELETE Requests

```typescript
// ❌ INCORRECT: Raw fetch
const response = await fetch(`/api/v1/pending-carts/${cartId}`, {
  method: 'DELETE',
});

// ✅ CORRECT: Using api client
const response = await api.delete(`/pending-carts/${cartId}`);
```

#### Handling Responses

The `api` client returns `ApiResponse<T>` with consistent format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Check for success
if (response.success && response.data) {
  // Process response.data
}

// Handle errors
if (!response.success) {
  console.error(response.error);
  // Show error to user
}
```

### Query Parameters

For GET requests with query parameters:

```typescript
// ✅ CORRECT: Use queryParams option
const response = await api.get('/day-close/history', {
  queryParams: {
    storeId: user.storeId,
    page: 1,
    pageSize: 20,
    startDate: '2026-01-01', // Only include if defined
  },
});
```

### Response Type

For non-JSON responses (e.g., CSV exports):

```typescript
// ✅ CORRECT: Specify responseType
const response = await api.get('/day-close/{id}/export/csv/all', {
  responseType: 'text',
});

if (response.success && response.data) {
  // response.data is the raw CSV string
}
```

### Path Parameters

For path parameters, dynamic use template literals:

```typescript
const dayCloseId = 'abc-123';

// ✅ CORRECT: Template literal for path params
const response = await api.get(`/day-close/${dayCloseId}`);
```

## Implementation Checklist

### Before Adding New API Calls

- [ ] Import `api` from `@/services/api`
- [ ] Use `api.get()`, `api.post()`, `api.put()`, or `api.delete()`
- [ ] Handle response using `response.success` and `response.data`
- [ ] Handle errors with `response.error`

### Code Review Checklist

- [ ] No raw `fetch()` calls for authenticated endpoints
- [ ] Response handling checks `response.success`
- [ ] Data access uses `response.data` (not `response` directly)
- [ ] Error messages use `response.error`

### Linting (Future Enhancement)

Consider adding an ESLint rule to prohibit `fetch` for authenticated endpoints:

```typescript
// .eslintrc.json (future)
{
  "rules": {
    "no-restricted-globals": ["error", "fetch"],
    "@typescript-eslint/no-floating-promises": "warn"
  }
}
```

## Consequences

### Positive

1. **Consistent authentication** - All requests include Bearer token automatically
2. **Token refresh handled** - 401 errors trigger refresh, then retry
3. **Cleaner error handling** - Single pattern for all endpoints
4. **Type safety** - `ApiResponse<T>` provides typed responses
5. **Maintainable** - Changes to auth logic only in one place

### Negative

1. **Migration required** - Existing raw `fetch()` calls must be converted
2. **Learning curve** - New developers must learn the `api` pattern

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Developers forget to use `api` | Code review enforcement, documentation |
| Legacy code not migrated | Audit and fix all raw `fetch()` calls |
| `api` not available in some files | Always import from `@/services/api` |

## Files Fixed

| File | Changes |
|------|---------|
| `apps/web/src/stores/eodStore.ts` | Replaced 7 `fetch()` with `api` calls |
| `apps/admin/src/pages/EODSettings.tsx` | Replaced 2 `fetch()` with `api` calls |
| `apps/admin/src/pages/MasterTerminals.tsx` | Replaced 4 `fetch()` with `api` calls |
| `apps/admin/src/pages/DayCloseHistory.tsx` | Replaced 3 `fetch()` with `api` calls |

## Related Documents

- [ADR-0007: Shared API Client Package](/docs/adr/0007-shared-api-client.md) - Defines the `ApiClient` class
- [ADR-0012: API Response Format Standard](/docs/adr/0012-api-response-format-standard.md) - Defines `ApiResponse<T>` format
- `packages/api-client/src/apiClient.ts` - Implementation reference
- `apps/web/src/services/api.ts` - Web app configuration
- `apps/admin/src/services/api.ts` - Admin app configuration

## Examples

### Complete Example: Fetching Day Close History

```typescript
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect } from 'react';
import type { DayCloseHistoryItem } from '@pos/shared';

export function DayCloseHistory() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<DayCloseHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.storeId) {
      fetchHistory();
    }
  }, [user?.storeId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);

    const response = await api.get<{ dayCloses: DayCloseHistoryItem[]; total: number }>(
      '/day-close/history',
      {
        queryParams: {
          storeId: user.storeId,
          page: 1,
          pageSize: 20,
        },
      }
    );

    if (response.success && response.data) {
      setHistory(response.data.dayCloses);
    } else {
      setError(response.error || 'Failed to fetch history');
    }

    setIsLoading(false);
  };

  const handleDownloadCSV = async (dayClose: DayCloseHistoryItem) => {
    const response = await api.get(`/day-close/${dayClose.id}/export/csv/all`, {
      responseType: 'text',
    });

    if (response.success && response.data) {
      // Download CSV
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eod-report-${dayClose.operationalDate}.csv`;
      a.click();
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    // ... render UI
  );
}
```

### Complete Example: Saving Settings

```typescript
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';

interface EODSettings {
  operationalDayStartHour: number;
  allowAutoDayTransition: boolean;
  eodNotificationEmails: string[];
}

export function EODSettings() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<EODSettings>({
    operationalDayStartHour: 6,
    allowAutoDayTransition: true,
    eodNotificationEmails: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    const response = await api.put(
      `/stores/${user?.storeId}/eod-settings`,
      settings
    );

    if (response.success) {
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } else {
      setMessage({ type: 'error', text: response.error || 'Failed to save settings' });
    }

    setIsSaving(false);
  };

  return (
    // ... render UI
  );
}
```

---

## Changelog

### 2026-01-17: Initial ADR

**Issue**: Multiple pages used raw `fetch()` causing authentication failures.

**Root Cause**: Developers bypassed the centralized `api` client.

**Solution**: Created this ADR to establish `api` client usage as mandatory standard.

**Files Fixed**:
- `apps/web/src/stores/eodStore.ts`
- `apps/admin/src/pages/EODSettings.tsx`
- `apps/admin/src/pages/MasterTerminals.tsx`
- `apps/admin/src/pages/DayCloseHistory.tsx`
