# Admin Store Selector Feature

## Status: Planned

## Problem Statement

When logging in as an admin user (`admin@pos.local`), the application shows infinite loading spinners on all pages. This occurs because:

1. **Admin users have `storeId: null`** - By design, admins can manage all stores and aren't tied to a specific one
2. **Pages early-return without stopping the loading state** - All pages check `if (!user?.storeId) return;` but never call `setIsLoading(false)`
3. **Sync endpoints reject null storeId** - API returns 400 errors when `storeId` is missing

### Affected Pages
- Dashboard
- Products
- Categories
- Discounts
- Transactions
- POS

## Solution

Implement a **Store Selector** feature that allows admin users to choose which store they want to view/manage.

### User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Admin Store Selector Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Admin Login (admin@pos.local)                                      │
│         │                                                            │
│         ▼                                                            │
│   user.storeId === null                                              │
│         │                                                            │
│         ▼                                                            │
│   Navigate to /pos                                                   │
│         │                                                            │
│         ▼                                                            │
│   ┌─────────────────────────────────────────┐                       │
│   │  Amber Banner: "Select a store" [▼]     │                       │
│   └─────────────────────────────────────────┘                       │
│   ┌─────────────────────────────────────────┐                       │
│   │                                         │                       │
│   │     🏪 Please select a store            │                       │
│   │     to continue                         │                       │
│   │                                         │                       │
│   └─────────────────────────────────────────┘                       │
│         │                                                            │
│         ▼                                                            │
│   Admin selects "Downtown Store"                                     │
│         │                                                            │
│         ▼                                                            │
│   Clear IndexedDB → fullSync(storeId) → Show loading                │
│         │                                                            │
│         ▼                                                            │
│   Page renders with store data                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Store Switching Flow

```
Current: Downtown Store
        │
        ▼
Click dropdown → Select "Mall Branch"
        │
        ▼
Show loading indicator in banner
        │
        ▼
clearAllData() → fullSync("mall-branch-id")
        │
        ▼
Update selectedStoreId in authStore
        │
        ▼
All pages reload with new store data
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Selector location | **Top banner** | Always visible, doesn't interfere with page content |
| Data on switch | **Clear all + resync** | Cleaner state, avoids data mixing between stores |
| Default behavior | **"Select store" prompt** | Explicit action required, no accidental data access |
| Sync indicator | **Yes** | User feedback during potentially slow operation |
| Banner color | **Amber/Yellow** | Stands out, indicates action needed |
| Store display | **Name only** | Keep it simple and clean |
| Visibility | **Admins only** | Managers already have assigned storeId |

## Implementation

### New Files

#### 1. `apps/web/src/components/layout/StoreSelectorBanner.tsx`

Banner component shown at top of authenticated pages for admins.

**Features:**
- Fetches stores from `GET /stores` API
- Dropdown to select store
- Shows current selected store name
- Loading indicator during sync
- Only renders when `user.role === 'admin' && !user.storeId`

**UI:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  🏪 Viewing store: [Downtown Store ▼]              Syncing... ⟳    │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. `apps/web/src/components/shared/NoStoreSelected.tsx`

Full-page component shown when admin hasn't selected a store.

**UI:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                           🏪                                        │
│                                                                     │
│              Please select a store to continue                      │
│                                                                     │
│      Use the store selector at the top of the page to choose       │
│      which store you want to view.                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Modified Files

#### 1. `apps/web/src/stores/authStore.ts`

**Add state:**
```typescript
selectedStoreId: string | null;
```

**Add actions:**
```typescript
setSelectedStore: (storeId: string) => void;
clearSelectedStore: () => void;
```

**Add helper (exported separately):**
```typescript
// Helper function to get effective store ID
export function getEffectiveStoreId(state: AuthState): string | null {
  return state.user?.storeId || state.selectedStoreId;
}
```

**Persist:** Add `selectedStoreId` to localStorage persistence.

#### 2. `apps/api/src/routes/sync.ts`

Modify all sync endpoints (`/full`, `/pull`, `/push`, `/status`) to:

```typescript
let storeId = user.storeId;

// Allow admins to specify store via query param
if (!storeId && user.role === 'admin') {
  const queryStoreId = c.req.query('storeId');
  if (queryStoreId) {
    // Validate store exists
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, queryStoreId),
    });
    if (!store) {
      return c.json({ success: false, error: 'Store not found' }, 404);
    }
    storeId = queryStoreId;
  }
}

if (!storeId) {
  return c.json({ success: false, error: 'Store ID is required' }, 400);
}
```

#### 3. `apps/web/src/services/sync.ts`

**Modify `fullSync()` signature:**
```typescript
async fullSync(storeId?: string): Promise<SyncResult>
```

**Pass storeId as query param:**
```typescript
const url = storeId ? `/sync/full?storeId=${storeId}` : '/sync/full';
const response = await api.get<FullSyncResponse>(url);
```

#### 4. `apps/web/src/stores/syncStore.ts`

**Modify `fullSync` action:**
```typescript
fullSync: async (storeId?: string) => {
  // ... existing logic
  const result = await syncService.fullSync(storeId);
  // ...
}
```

#### 5. `apps/web/src/App.tsx`

**Modify `AuthenticatedLayout`:**
```tsx
function AuthenticatedLayout() {
  const { user } = useAuthStore();
  const showStoreBanner = user?.role === 'admin' && !user?.storeId;
  
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 flex flex-col">
        {showStoreBanner && <StoreSelectorBanner />}
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
      <OfflineBanner />
    </div>
  );
}
```

#### 6-11. All Page Components

**Pattern applied to each page:**

```tsx
// Import
import { useAuthStore, getEffectiveStoreId } from '@/stores/authStore';
import { NoStoreSelected } from '@/components/shared/NoStoreSelected';

// In component
const authState = useAuthStore();
const effectiveStoreId = getEffectiveStoreId(authState);

// In loadData
const loadData = async () => {
  if (!effectiveStoreId) {
    setIsLoading(false);
    return;
  }
  // Use effectiveStoreId instead of user?.storeId
};

// In useEffect
useEffect(() => {
  loadData();
}, [effectiveStoreId]);

// In render
if (!effectiveStoreId) {
  return <NoStoreSelected />;
}
```

**Files:**
- `apps/web/src/pages/Dashboard.tsx`
- `apps/web/src/pages/Products.tsx`
- `apps/web/src/pages/Categories.tsx`
- `apps/web/src/pages/Discounts.tsx`
- `apps/web/src/pages/Transactions.tsx`
- `apps/web/src/pages/POS.tsx`

#### 12. `apps/web/src/pages/Login.tsx`

**Modify post-login logic:**
```typescript
if (isOnline && user.storeId) {
  // Normal user - sync their store
  await fullSync();
} else if (isOnline && user.role === 'admin' && selectedStoreId) {
  // Admin with previously selected store
  await fullSync(selectedStoreId);
}
// Admin without selectedStoreId: skip sync, they'll select a store first

navigate('/pos');
```

## Files Summary

| Action | File |
|--------|------|
| CREATE | `apps/web/src/components/layout/StoreSelectorBanner.tsx` |
| CREATE | `apps/web/src/components/shared/NoStoreSelected.tsx` |
| MODIFY | `apps/web/src/stores/authStore.ts` |
| MODIFY | `apps/api/src/routes/sync.ts` |
| MODIFY | `apps/web/src/services/sync.ts` |
| MODIFY | `apps/web/src/stores/syncStore.ts` |
| MODIFY | `apps/web/src/App.tsx` |
| MODIFY | `apps/web/src/pages/Dashboard.tsx` |
| MODIFY | `apps/web/src/pages/Products.tsx` |
| MODIFY | `apps/web/src/pages/Categories.tsx` |
| MODIFY | `apps/web/src/pages/Discounts.tsx` |
| MODIFY | `apps/web/src/pages/Transactions.tsx` |
| MODIFY | `apps/web/src/pages/POS.tsx` |
| MODIFY | `apps/web/src/pages/Login.tsx` |

**Total: 2 new files, 12 modified files**

## API Dependencies

### Existing Endpoint Used
```
GET /stores
- Permission: stores:read (admin, manager)
- Returns: Array of all stores
- Already implemented in apps/api/src/routes/stores.ts
```

### Modified Endpoints
```
GET /sync/full?storeId={id}     - Add optional storeId query param for admins
GET /sync/pull?storeId={id}     - Add optional storeId query param for admins
POST /sync/push?storeId={id}    - Add optional storeId query param for admins
GET /sync/status?storeId={id}   - Add optional storeId query param for admins
```

## Testing Checklist

- [ ] Admin login shows store selector banner
- [ ] Admin login shows "No store selected" message on pages
- [ ] Store dropdown fetches and displays all stores
- [ ] Selecting a store triggers IndexedDB clear + sync
- [ ] Loading indicator shows during sync
- [ ] After sync, pages display correct store data
- [ ] Switching stores clears old data and loads new data
- [ ] Selected store persists across page refresh
- [ ] Selected store persists across logout/login
- [ ] Manager login does NOT show store selector
- [ ] Cashier login does NOT show store selector
- [ ] Offline state handled gracefully

## Estimated Effort

| Phase | Tasks | Time |
|-------|-------|------|
| Core Infrastructure | authStore, API routes, sync service | ~1.5 hours |
| UI Components | Banner, NoStoreSelected, App.tsx | ~1 hour |
| Page Updates | 6 pages + Login | ~1.5 hours |
| Testing | Manual testing all flows | ~30 min |
| **Total** | | **~4.5 hours** |

## Future Enhancements

1. **Remember last viewed page per store** - When switching back to a store, navigate to the last page viewed
2. **Store favorites** - Allow admins to pin frequently accessed stores
3. **Multi-store dashboard** - Admin-only view showing metrics across all stores
4. **Store search** - For admins managing many stores, add search/filter to dropdown
