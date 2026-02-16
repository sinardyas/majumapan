# ADR-0021: Admin Store Selector Deprecation - Move to Per-Page Table Filters

## Status

Accepted

## Date

2026-02-15

## Context

ADR-0017 introduced a global StoreSelector component in the admin panel header, allowing admin users to switch between "All Stores" view and individual store views. This global selector was stored in the auth store and affected multiple pages.

After implementation and usage, several issues were identified that led to the decision to deprecate this approach in favor of per-page store filters.

## Problem Statement

### Issues with Global Store Selector

| Issue | Description |
|-------|-------------|
| **State Management Complexity** | Required global state in authStore with persistence, adding complexity to authentication flow |
| **Inconsistent Patterns** | Some pages (Products, Reports, Devices) already had local store filters, creating inconsistency |
| **Maintainability** | Changes to store selection affected multiple pages through global state dependency |
| **User Confusion** | Global selection applied to all pages, but not all pages benefited from it |

### Pages Using Store Filtering

| Page | Previous Approach | New Approach |
|------|------------------|--------------|
| Products | Local dropdown | Local dropdown (unchanged) |
| Reports | Local dropdown | Local dropdown (unchanged) |
| Devices | Local dropdown | Local dropdown (unchanged) |
| DayCloseHistory | Global selector | Local dropdown |
| MasterTerminals | Global selector | Local dropdown |
| Users | No filter | Local dropdown (new) |

## Decision

Remove the global StoreSelector from the admin panel header. Implement store filtering at the page level using local dropdown components.

### Design Rationale

1. **Consistency**: Products, Reports, and Devices already used local store filters - this aligns all pages to the same pattern
2. **Simplicity**: Each page controls its own filtering logic without global state dependencies
3. **Explicit UX**: Filter is visually associated with the data being filtered
4. **Maintainability**: Changes to one page's filtering don't affect other pages

## Implementation

### Code Changes

| File | Change |
|------|--------|
| `apps/admin/src/components/layout/Header.tsx` | Removed StoreSelector import and usage |
| `apps/admin/src/stores/authStore.ts` | Removed `selectedStoreId`, `selectedStoreName`, `setSelectedStore()`, `clearSelectedStore()`, `isAllStores()` |
| `apps/admin/src/components/StoreSelector.tsx` | Deleted component file |
| `apps/admin/src/pages/DayCloseHistory.tsx` | Added local `storeFilter` state + dropdown |
| `apps/admin/src/pages/MasterTerminals.tsx` | Added local `selectedStoreId` state + dropdown |
| `apps/admin/src/pages/Users.tsx` | Added local `storeFilter` state + dropdown |

### API Behavior Unchanged

The API already supported filtering by store via query parameters:
- `?storeId=<uuid>` - Filter by specific store
- No parameter - Returns user's assigned store data (for non-admin)

Pages now explicitly pass these parameters based on local filter selection.

### Example: DayCloseHistory.tsx

```typescript
const [storeFilter, setStoreFilter] = useState<string>('');

const queryParams = { page, pageSize };
if (storeFilter) {
  queryParams.storeId = storeFilter;
} else if (user?.storeId) {
  queryParams.storeId = user.storeId;
}

const response = await api.get('/day-close/history', { queryParams });
```

## Consequences

### Positive

1. **Simpler State Management**: No global store selection state to manage
2. **Consistent UX**: All pages with store filtering use the same pattern
3. **Better Maintainability**: Each page's filtering is self-contained
4. **Explicit User Intent**: Filter is visually part of the data context

### Negative

1. **Lost "Global View"**: Admin users can no longer switch to "All Stores" view from header - must use individual page filters or rely on pages that show aggregated data (Dashboard, Reports)
2. **More Duplicate Code**: Similar filter dropdown components exist in multiple pages (could be extracted to shared component in future)

### Neutral

1. **Users Page Enhancement**: Added store filter to Users page where it didn't exist before
2. **Dashboard Unchanged**: Dashboard continues to show aggregate data across all stores

## Alternative Considered

### Keep Global Selector, Move to Sidebar

Moving the selector from Header to Sidebar was considered but rejected because:
- Still requires global state management
- Same maintainability issues persist
- Doesn't solve the inconsistency with pages that have local filters

## Related Documents

- [ADR-0017: All Stores Mode with Admin Store Selector](./0017-all-stores-mode-with-admin-store-selector.md) - **Deprecated**
- [PRD: Admin Panel](../prd/admin-panel-prd.md) - Updated with deprecation note
