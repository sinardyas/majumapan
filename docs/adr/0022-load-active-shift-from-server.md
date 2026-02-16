# ADR-0022: Load Active Shift from Server After Login

## Status

Accepted

## Date

2026-02-16

## Context

When a cashier logs into the POS application, the system needs to check if they already have an active shift from a previous session. The POS system supports offline functionality with local IndexedDB storage, but shift state must be synchronized with the server to prevent conflicts.

## Problem Statement

### Symptom

When a cashier logs in and attempts to open a shift, the API returns:

```
"You already have an active shift"
```

This error occurs even though the cashier has not opened a new shift in the current session.

### Root Cause Analysis

| Component | Behavior |
|-----------|----------|
| `loadActiveShift()` | Only queries **local** IndexedDB for active shift |
| Server API (`GET /api/shifts/active`) | Returns server-side active shift (exists but never called) |
| ShiftModal | Shows "open" mode because local state is `null` |
| User Action | Clicks "Open Shift", API rejects with active shift error |

The client was only checking local storage, not the server. If a shift was opened on another device or browser, the local IndexedDB would be empty, causing the client to incorrectly show the "Open Shift" flow.

## Decision

Add a new function `loadActiveShiftFromServer()` in the shift store that:

1. Fetches the active shift from the server API (`GET /api/shifts/active`)
2. Saves the server shift to local IndexedDB (syncing server state to local)
3. Updates the shift store state with the server shift

Call this function in `POS.tsx` after the initial local shift load, but only when online.

### Design Rationale

1. **Preserve Offline Support**: Local IndexedDB remains the primary source for shift state during offline operation
2. **Server Reconciliation**: After login (when connection is guaranteed), sync server state to local
3. **Minimal Change**: Reuses existing infrastructure (`saveShift`, API client)
4. **Online-Only**: Server sync only happens when `isOnline` is true, avoiding unnecessary network calls offline

## Implementation

### Changes to `apps/web/src/stores/shiftStore.ts`

Added new function:

```typescript
loadActiveShiftFromServer: async () => {
  const { user } = useAuthStore.getState();
  if (!user || !user.storeId) return;

  const response = await api.get<any>('/shifts/active');
  
  if (response.success && response.data?.shift) {
    const localShift = {
      id: serverShift.id,
      serverId: serverShift.id,
      shiftNumber: serverShift.shiftNumber,
      // ... map all fields from server to LocalShift
      syncStatus: 'synced',
    };

    await saveShift(localShift);
    set({ activeShift: localShift, status: 'active' });
  }
}
```

### Changes to `apps/web/src/pages/POS.tsx`

```typescript
useEffect(() => {
  const loadShift = async () => {
    await loadActiveShift();
    if (isOnline) {
      await loadActiveShiftFromServer();
    }
  };
  loadShift();
}, [loadActiveShift, loadActiveShiftFromServer, isOnline]);
```

## Consequences

| Positive | Negative |
|----------|----------|
| Fixes "already have active shift" bug | Additional network call after login |
| Syncs server state to local DB | Slight delay in shift state availability |
| Works with existing offline architecture | Requires online connection to reconcile |
| Maintains backward compatibility | - |

## Alternatives Considered

### Alternative 1: Always call server first

Call server API first, then fallback to local. Rejected because it would break offline-first behavior.

### Alternative 2: Merge shift state on every action

Check server before every shift open/close. Rejected - too many network calls, doesn't solve the initial state problem.

### Alternative 3: Use server as source of truth always

Skip local IndexedDB entirely for shifts. Rejected - breaks offline functionality which is critical for POS.

## Related Documentation

- [Shift Management Feature](../features/shift-management.md)
- [PRD: Reusable Numpad Component](../prd/reusable-numpad-component.md)
