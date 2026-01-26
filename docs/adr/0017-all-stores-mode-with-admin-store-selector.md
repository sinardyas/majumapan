# ADR-0017: All Stores Mode with Admin Store Selector

## Status

Accepted

## Date

2026-01-26

## Context

On 2026-01-26, the admin panel's End of Day feature was found to display infinite loading for admin users. Investigation revealed that:

### Problem Statement

Admin users have `storeId: null` in the database (by design) to grant them access to all stores. However, the frontend pages assumed all users have a `storeId`:

```typescript
// apps/admin/src/pages/DayCloseHistory.tsx:18-22
useEffect(() => {
  if (user?.storeId) {  // ❌ Never true for admin (storeId is null)
    fetchHistory();
  }
}, [user?.storeId, page]);
```

This caused the admin panel to never fetch data, resulting in infinite loading indicators.

### User Roles and Store Access

| Role | Store Access | storeId in JWT |
|------|-------------|----------------|
| Admin | All stores | `null` |
| Manager | Single assigned store | Assigned store UUID |
| Cashier | Single assigned store | Assigned store UUID |

### Existing Architecture

ADR-0005 established admin panel separation for multi-store management. The current implementation supports:

- Single-store queries via `storeId` query parameter
- Per-store day close operations
- Manager/Cashier with assigned stores

However, admin users require access to:
1. View data across all stores (global overview)
2. Perform operations on any specific store
3. Manage store-wide settings

## Decision

Implement **All Stores Mode** with an **Admin Store Selector** component to allow admin users to:

1. View aggregated data from all stores by default
2. Switch to a specific store view when needed
3. Maintain backward compatibility with manager/cashier workflows

### Core Design Decisions

| Requirement | Decision |
|------------|---------|
| Default view for admin | All Stores (aggregated data) |
| Pagination | Global (across all stores combined) |
| Detail navigation | Store-specific URLs (per-store context) |
| Store list | Include all stores (active and archived) |
| Store selector location | Header area, visible to admin only |

### API Changes

#### Day Close History Endpoint

**Modified:** `GET /api/v1/day-close/history`

**New Query Parameters:**
```typescript
const historyQuerySchema = z.object({
  storeId: z.string().uuid().optional(),    // Specific store (optional)
  allStores: z.coerce.boolean().optional(), // All stores mode flag
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
```

**Behavior:**
| Condition | Query | Result |
|-----------|-------|--------|
| `allStores=true` + admin | No filter | All stores data |
| `storeId` provided | `eq(dayCloses.storeId, storeId)` | Single store data |
| Neither provided | `eq(dayCloses.storeId, user.storeId)` | User's store data |

#### Stores List Endpoint

**Modified:** `GET /api/v1/stores`

**Changes:**
- Require `admin` role (not just `stores:read` permission)
- Return all stores (active and archived)
- Include `isActive` flag in response for UI filtering

### Frontend Changes

#### Auth Store Enhancement

**File:** `apps/admin/src/stores/authStore.ts`

```typescript
interface AuthState {
  // ... existing fields
  selectedStoreId: string | 'all' | null;
  selectedStoreName: string | null;

  setSelectedStore: (storeId: string | 'all', storeName?: string) => void;
  clearSelectedStore: () => void;
  isAllStores: () => boolean;
}
```

**Initialization Logic:**
```typescript
setAuth: (user, accessToken, refreshToken) => {
  const defaultStoreId = user.role === 'admin' 
    ? 'all' 
    : user.storeId || null;
  
  set({
    // ...existing fields
    selectedStoreId: defaultStoreId,
    selectedStoreName: user.role === 'admin' ? 'All Stores' : null,
  });
},
```

#### Store Selector Component

**File:** `apps/admin/src/components/StoreSelector.tsx`

**Features:**
- Dropdown component in admin header
- Fetches stores from `GET /api/v1/stores`
- Options: "All Stores" + all store names
- Persists selection in localStorage
- Visible only to admin users

#### Page Updates

All admin pages using `user.storeId` must be updated to use `selectedStoreId`:

```typescript
// Before: Only works for non-admin users
const storeId = user?.storeId;

// After: Works for all users
let storeId;
if (selectedStoreId === 'all') {
  storeId = undefined;  // Backend will query all stores
} else if (selectedStoreId) {
  storeId = selectedStoreId;
} else {
  storeId = user?.storeId;  // Fallback for non-admin
}
```

### Database Changes

**Migration:** `0009_add_store_name_to_day_closes.sql`

Add `store_name` column to `day_closes` table for easier access in detail views:

```sql
ALTER TABLE day_closes ADD COLUMN store_name text;

-- Update existing records
UPDATE day_closes dc
SET store_name = s.name
FROM stores s
WHERE dc.store_id = s.id;
```

### User Experience

#### Admin User Flow

```
1. Admin logs in
   └─> Default view: All Stores (aggregated day close history)
   
2. Admin selects "Downtown Store" from dropdown
   └─> View updates to show only Downtown Store data
   
3. Admin clicks a day close record
   └─> Navigates to day close detail with store context
   └─> URL: /admin/day-close/{dayCloseId}
   
4. Admin selects "All Stores" again
   └─> View returns to aggregated overview
```

#### Manager User Flow (No Change)

```
1. Manager logs in
   └─> View: Their assigned store (unchanged)
   
2. All pages use assigned store
   └─> No store selector visible
```

### Response Format

#### History Response with All Stores

```json
{
  "success": true,
  "data": {
    "dayCloses": [...],
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "isAllStores": true
  }
}
```

#### Stores List Response

```json
{
  "success": true,
  "data": {
    "stores": [
      { "id": "...", "name": "Downtown Store", "isActive": true },
      { "id": "...", "name": "Mall Branch", "isActive": true },
      { "id": "...", "name": "Old Store", "isActive": false }
    ],
    "total": 3
  }
}
```

## Consequences

### Positive

1. **Admin Productivity**: Single view of all stores enables faster oversight
2. **Consistent UX**: Admin users can easily switch between global and specific views
3. **Backward Compatible**: Manager/Cashier workflows unchanged
4. **Scalable**: New stores automatically appear in dropdown

### Negative

1. **Complexity Increase**: Additional state management required
2. **Migration Needed**: Database migration for store_name column
3. **Testing Surface**: More scenarios to test (all stores + specific stores)

### Neutral

1. **Archived Stores**: Included in dropdown per decision, but can be visually distinguished
2. **Pagination**: Global pagination may show mixed store data on single page

## Implementation Plan

| Phase | Task | Files |
|-------|------|-------|
| 1 | Backend - Update day-close API | `apps/api/src/routes/day-close.ts` |
| 2 | Backend - Update stores API | `apps/api/src/routes/stores.ts` |
| 3 | Database - Migration | `apps/api/drizzle/0009_*.sql` |
| 4 | Frontend - Auth store | `apps/admin/src/stores/authStore.ts` |
| 5 | Frontend - StoreSelector | `apps/admin/src/components/StoreSelector.tsx` |
| 6 | Frontend - Layout | `apps/admin/src/components/layout/Header.tsx` |
| 7 | Frontend - Pages | `DayCloseHistory.tsx`, `DayCloseDetail.tsx`, etc. |
| 8 | Testing | All affected features |

## Related Documents

- [End of Day Feature Spec](../features/end-of-day.md)
- [End of Day PRD](../prd/end-of-day-prd.md)
- [Admin Store Selector Feature Spec](../features/admin-store-selector.md)
- ADR-0005: Admin Panel Separation
- ADR-0016: Centralized API Client Usage Standard
