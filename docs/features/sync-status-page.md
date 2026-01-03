# Feature Specification: Sync Status Page

## Status

**Implemented** - 2025-01-01

> **Business Context**: See [Sync Status Page PRD](../prd/sync-status-page-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

## Overview

A dedicated Sync Status page for store managers to monitor and control the offline-first synchronization process. The page displays real-time sync progress per entity (Products, Categories, Transactions) with individual progress bars, entity selection for manual sync operations, and bulk actions for pending/rejected transactions.

## Motivation

The current sync implementation provides limited visibility into sync status:

1. **Limited visibility**: Only shows pending count in sidebar, no progress per entity
2. **No entity control**: Users can't select which entities to sync
3. **Scattered UI**: Pending transactions shown in Transactions page, rejected in modal
4. **No auto-refresh**: Users must manually refresh to see updated status

This new page consolidates all sync-related information and controls into one place.

## User Stories

| As a... | I want to... | So that... |
|---------|--------------|------------|
| Manager | See sync progress per entity | I know which data is up to date |
| Manager | Select entities to sync | I can focus sync on specific data types |
| Manager | Force sync selected entities | I can trigger immediate sync when needed |
| Manager | Auto-refresh sync status | I see real-time progress without manual refresh |
| Manager | Bulk retry pending transactions | I can quickly resolve all pending items |
| Manager | Bulk clear pending transactions | I can remove transactions that are no longer needed |
| Manager | See rejected transactions with details | I understand why transactions failed |
| Cashier | Not access sync controls | Only managers can manage sync operations |

## User Interface

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Sync Status                                     [Last: 2m ago] ⟳│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🟢 Online | Auto-refreshing every 10s                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Sync Progress by Entity                                 │   │
│  │                                                         │   │
│  │  Products     ████████████████████████████████░░  92%   │   │
│  │  145 synced, 12 pending                                    │   │
│  │                                                         │   │
│  │  Categories  █████████████████████████████████████  100% │   │
│  │  12 synced, 0 pending                                     │   │
│  │                                                         │   │
│  │  Transactions ██████████████████████████████████░░░░  85%│   │
│  │  847 synced, 148 pending                                  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Sync Options                                            │   │
│  │  [✓] Products  [✓] Categories  [✓] Transactions          │   │
│  │                                                         │   │
│  │  [─────── Force Sync Selected ───────]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Pending Transactions (148)              [Retry All]     │   │
│  │                                                 [Clear All]│
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ TXN-20260101-001  │  $125.00  │  5 min ago     │   │   │
│  │  │ TXN-20260101-002  │  $89.50   │  3 min ago     │   │   │
│  │  │ TXN-20260101-003  │  $45.00   │  1 min ago     │   │   │
│  │  │ ... and 145 more                                     │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │           Showing 3 of 148 items                        │   │
│  │           [View All Pending]                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Rejected Transactions (3)              [Retry All]     │   │
│  │                                                 [Clear All]│
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ TXN-20260101-015  │  Stock unavailable          │   │   │
│  │  │ Product: Wireless Earbuds (req: 5, avail: 2)    │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

#### Entity Progress Card

```
┌─────────────────────────────────────────┐
│ Products                                │
│ ████████████████████████████████░░  92% │
│ 145 synced, 12 pending                  │
└─────────────────────────────────────────┘
```

**Props:**
- `entity`: 'products' | 'categories' | 'transactions'
- `synced`: number
- `pending`: number
- `isLoading`: boolean

**Features:**
- Animated progress bar
- Percentage calculation: `(synced / (synced + pending)) * 100`
- Color coding: green (100%), blue (>50%), yellow (<50%), red (error)

#### Sync Controls

```
[✓] Products  [✓] Categories  [✓] Transactions
[─────── Force Sync Selected ───────]
```

**Features:**
- Checkbox for each entity
- Select All / Deselect All buttons
- Force Sync button (triggers full sync for selected entities)
- Disable during active sync

#### Pending Transactions List

| TXN Number | Amount | Created | Actions |
|------------|--------|---------|---------|
| TXN-20260101-001 | $125.00 | 5 min ago | [Retry] [Clear] |
| TXN-20260101-002 | $89.50 | 3 min ago | [Retry] [Clear] |
| TXN-20260101-003 | $45.00 | 1 min ago | [Retry] [Clear] |

**Features:**
- Pagination (20 items per page)
- Bulk actions: Retry All, Clear All
- Individual retry/clear per row
- Empty state when no pending transactions

#### Rejected Transactions List

| TXN Number | Reason | Details | Actions |
|------------|--------|---------|---------|
| TXN-20260101-015 | Stock unavailable | Wireless Earbuds (req: 5, avail: 2) | [Retry] [Clear] |

**Features:**
- Stock issue details (product name, requested vs available)
- Bulk actions: Retry All, Clear All
- Different icon/color for rejected vs pending

## Data Model

### API Response

**`GET /sync/status`**

```typescript
interface SyncStatusResponse {
  storeId: string;
  lastSyncTimestamp: string | null;
  serverTime: string;
  entities: {
    products: { synced: number; pending: number };
    categories: { synced: number; pending: number };
    transactions: { synced: number; pending: number; rejected: number };
  };
  pendingTransactions: {
    items: LocalTransaction[];
    total: number;
    limit: number;
  };
  rejectedTransactions: {
    items: RejectedTransaction[];
    total: number;
  };
}

interface LocalTransaction {
  clientId: string;
  transactionNumber?: string;
  storeId: string;
  cashierId: string;
  total: number;
  clientTimestamp: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'rejected';
  rejectionReason?: string;
  stockIssues?: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}

interface RejectedTransaction {
  clientId: string;
  transactionNumber?: string;
  rejectionReason: string;
  stockIssues?: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
  createdAt: string;
}
```

### Client Store State

```typescript
interface EntityCounts {
  products: { synced: number; pending: number };
  categories: { synced: number; pending: number };
  transactions: { synced: number; pending: number; rejected: number };
}

interface SyncState {
  // Existing state
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingCount: number;
  rejectedTransactions: RejectedTransaction[];
  lastError: string | null;

  // New state
  entityCounts: EntityCounts;
  selectedEntities: Set<'products' | 'categories' | 'transactions'>;
  isAutoRefreshing: boolean;
  pendingTransactions: LocalTransaction[];
  pendingTotal: number;
}
```

## Technical Implementation

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sync/status` | Get comprehensive sync status with entity counts |
| `POST` | `/sync/full?entities=products,categories,transactions` | Force full sync for selected entities |
| `POST` | `/sync/push/retry` | Retry all pending transactions |
| `DELETE` | `/sync/pending` | Clear all pending transactions |
| `POST` | `/sync/push/:clientId/retry` | Retry single pending transaction |
| `DELETE` | `/sync/push/:clientId` | Clear single pending transaction |

### Files to Create

```
apps/web/src/
├── pages/
│   └── SyncStatus.tsx              # Main page component
└── components/
    └── sync/
        ├── index.ts                # Barrel export
        ├── EntityProgressCard.tsx  # Progress bar per entity
        ├── SyncControls.tsx        # Entity selector + force sync
        ├── PendingTransactionsList.tsx    # Pending list with bulk actions
        └── RejectedTransactionsList.tsx   # Rejected list with details
```

### Files to Modify

```
apps/api/src/
└── routes/
    └── sync.ts                     # Add entity counts to status

apps/web/src/
├── stores/
│   └── syncStore.ts                # Add entity counts, auto-refresh state
├── services/
│   └── sync.ts                     # Add new sync methods
├── App.tsx                         # Add /sync-status route
└── components/
    └── layout/
        └── Sidebar.tsx             # Add Sync Status nav item (managers only)
```

### Page Component Structure

```tsx
// apps/web/src/pages/SyncStatus.tsx

export default function SyncStatus() {
  const { isOnline, entityCounts, selectedEntities, pendingTransactions } = useSyncStore();
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true);

  useEffect(() => {
    if (!isAutoRefreshing) return;
    const interval = setInterval(refreshStatus, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [isAutoRefreshing]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader onRefresh={refreshStatus} />

      <ConnectionStatus isOnline={isOnline} lastSync={lastSyncTime} />

      <EntityProgressSection entityCounts={entityCounts} />

      <SyncControls
        selectedEntities={selectedEntities}
        onToggleEntity={toggleEntity}
        onForceSync={forceSyncSelected}
        disabled={isSyncing}
      />

      <PendingTransactionsList
        transactions={pendingTransactions}
        onRetryAll={retryAllPending}
        onClearAll={clearAllPending}
        onRetry={retryTransaction}
        onClear={clearTransaction}
      />

      <RejectedTransactionsList
        transactions={rejectedTransactions}
        onRetryAll={retryAllRejected}
        onClearAll={clearAllRejected}
      />
    </div>
  );
}
```

### Permissions

| Role | Access |
|------|--------|
| Admin | Full access |
| Manager | Full access |
| Cashier | No access (route protected) |

Add new permission:
```typescript
'sync:status': ['admin', 'manager'],
```

## Implementation Phases

### Phase 1: Backend API Updates - COMPLETED

1. ✅ Update `GET /sync/status` to return entity-specific counts
2. ✅ Add new endpoints for bulk retry/clear operations (`/sync/pending`, `/sync/rejected`)
3. ✅ Add pagination for pending transactions list

### Phase 2: Store Updates - COMPLETED

1. ✅ Add `entityCounts` state to syncStore
2. ✅ Add `selectedEntities` state
3. ✅ Add `pendingTransactions` and `pendingTotal` state
4. ✅ Add actions for entity selection and bulk operations

### Phase 3: Service Updates - COMPLETED

1. ✅ Add `getEntitySyncStatus()` method
2. ✅ Add `fullSync(entities?)` method with entity filter
3. ✅ Add `getPendingTransactions()` method
4. ✅ Add `retryPendingTransaction()` and `clearPendingTransaction()` methods

### Phase 4: UI Components - COMPLETED

1. ✅ Create `EntityProgressCard` component
2. ✅ Create `SyncControls` component
3. ✅ Create `PendingTransactionsList` component
4. ✅ Create `RejectedTransactionsList` component

### Phase 5: Page Integration - COMPLETED

1. ✅ Create `SyncStatus` page
2. ✅ Add route to App.tsx with manager-only access
3. ✅ Add sidebar navigation for managers
4. ✅ Test auto-refresh functionality

## Auto-Refresh Behavior

- **Interval**: 10 seconds
- **Pauses when**: Page is not visible (use Page Visibility API)
- **Pauses when**: Sync is in progress
- **Manual override**: User can pause/resume via toggle

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| User goes offline | Show offline indicator, pause auto-refresh |
| Sync in progress | Disable entity selection, show spinner |
| No pending transactions | Show "All synced" message |
| All transactions rejected | Show rejected section prominently |
| Bulk retry partially fails | Show success/failure counts |
| Session expires during auto-refresh | Stop auto-refresh, redirect to login |

## Testing Scenarios

1. Manager can access the page
2. Cashier cannot access the page (redirected)
3. Progress bars show correct percentages
4. Entity selection works correctly
5. Force sync triggers sync for selected entities
6. Auto-refresh updates data every 10 seconds
7. Manual refresh works
8. Retry All pending works
9. Clear All pending works
10. Retry All rejected works
11. Clear All rejected works
12. Offline status displayed correctly
13. Page handles empty states gracefully
14. Pagination works for long lists

## Related Documents

- **PRD**: [Sync Status Page PRD](../prd/sync-status-page-prd.md) - Product requirements, user personas, goals, success metrics
- **PLAN.md**: Original system plan
- **docs/adr/0003-browser-compatible-timer-types.md**: Timer types for auto-refresh
- Sync service implementation: `apps/web/src/services/sync.ts`
- Sync store: `apps/web/src/stores/syncStore.ts`
