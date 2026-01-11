# Shift Management Implementation Tasks

## Overview

This document contains the step-by-step task list for implementing the Shift Management feature.

**Estimated Total Time:** ~22 hours (5 working days)

**Related Documents:**
- PRD: `docs/prd/shift-management-prd.md`
- FSD: `docs/features/shift-management.md`

---

## Phase 1A: Backend & Database

**Timeline:** Day 1 (~5 hours)

### Task 1.1: Add Shifts Table to Drizzle Schema
**Time:** 30 minutes

**File:** `apps/api/src/db/schema.ts`

**Description:** Add the shifts table to the existing Drizzle schema.

**Changes:**
```typescript
import { pgTable, uuid, timestamp, numeric, text, varchar, index } from 'drizzle-orm/pg-core';

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftNumber: varchar('shift_number', length: 50).notNull().unique(),
  cashierId: varchar('cashier_id', length: 255).notNull(),
  storeId: uuid('store_id').notNull(),
  status: varchar('status', length: 20).notNull().default('ACTIVE'),
  openingFloat: numeric('opening_float', { precision: 10, scale: 2 }).notNull(),
  openingNote: text('opening_note'),
  openingImageUrl: text('opening_image_url'),
  openingTimestamp: timestamp('opening_timestamp').notNull().defaultNow(),
  endingCash: numeric('ending_cash', { precision: 10, scale: 2 }),
  endingNote: text('ending_note'),
  closingTimestamp: timestamp('closing_timestamp'),
  variance: numeric('variance', { precision: 10, scale: 2 }),
  varianceReason: text('variance_reason'),
  varianceApprovedBy: varchar('variance_approved_by', length: 255),
  varianceApprovedAt: timestamp('variance_approved_at'),
  syncStatus: varchar('sync_status', length: 20).notNull().default('pending'),
  serverId: uuid('server_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('shifts_cashier_status_idx').on(table.cashierId, table.status),
  index('shifts_store_status_idx').on(table.storeId, table.status),
  index('shifts_shift_number_idx').on(table.shiftNumber),
  index('shifts_opening_timestamp_idx').on(table.openingTimestamp),
]);
```

**Validation:**
- Run `npm run typecheck`
- Ensure no conflicts with existing tables

---

### Task 1.2: Create Database Migration File
**Time:** 30 minutes

**File:** `apps/api/drizzle/0007_shift_management.sql`

**Description:** Create the PostgreSQL migration script for the shifts table.

**Content:**
```sql
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_number VARCHAR(50) NOT NULL UNIQUE,
  cashier_id VARCHAR(255) NOT NULL,
  store_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  opening_float DECIMAL(10, 2) NOT NULL,
  opening_note TEXT,
  opening_image_url TEXT,
  opening_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  ending_cash DECIMAL(10, 2),
  ending_note TEXT,
  closing_timestamp TIMESTAMP,
  variance DECIMAL(10, 2),
  variance_reason TEXT,
  variance_approved_by VARCHAR(255),
  variance_approved_at TIMESTAMP,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  server_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shifts_cashier_status_idx ON shifts (cashier_id, status);
CREATE INDEX IF NOT EXISTS shifts_store_status_idx ON shifts (store_id, status);
CREATE INDEX IF NOT EXISTS shifts_shift_number_idx ON shifts (shift_number);
CREATE INDEX IF NOT EXISTS shifts_opening_timestamp_idx ON shifts (opening_timestamp);
```

**Validation:**
- Test migration on local database
- Verify indexes are created

---

### Task 1.3: Add Shift API Types
**Time:** 15 minutes

**File:** `packages/api/src/types.ts`

**Description:** Add Shift-related TypeScript interfaces to the API types.

**Changes:**
```typescript
export interface Shift {
  id: string;
  shiftNumber: string;
  cashierId: string;
  storeId: string;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  openingFloat: number;
  openingNote?: string;
  openingImageUrl?: string;
  openingTimestamp: string;
  endingCash?: number;
  endingNote?: string;
  closingTimestamp?: string;
  variance?: number;
  varianceReason?: string;
  varianceApprovedBy?: string;
  varianceApprovedAt?: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ShiftApi {
  openShift(data: {
    floatAmount: number;
    note?: string;
  }): Promise<{ shift: Shift }>;

  closeShift(data: {
    shiftId: string;
    endingCash: number;
    note?: string;
    supervisorApproval?: {
      supervisorId: string;
      approvedAt: string;
    };
    varianceReason?: string;
  }): Promise<{ shift: Shift }>;

  getActiveShift(): Promise<{ shift: Shift | null }>;
  getShiftById(shiftId: string): Promise<{ shift: Shift }>;
  listShifts(filters?: {
    status?: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
    startDate?: string;
    endDate?: string;
  }): Promise<{ shifts: Shift[] }>;
  verifyPin(data: {
    pin: string;
    action: 'shift_approve';
    metadata?: { shiftId?: string; variance?: number };
  }): Promise<{
    success: boolean;
    supervisorId?: string;
    supervisorName?: string;
    error?: string;
  }>;
  sync(shifts: Shift[]): Promise<{ shifts: Shift[] }>;
}
```

**Validation:**
- Run `npm run typecheck`

---

### Task 1.4: Create Shift API Client Methods
**Time:** 30 minutes

**File:** `packages/api/src/apiClient.ts`

**Description:** Add Shift-related methods to the API client.

**Changes:**
```typescript
export interface ShiftApi {
  // ... existing methods ...

  openShift: (data: { floatAmount: number; note?: string }) => Promise<{ shift: Shift }>;
  closeShift: (data: {
    shiftId: string;
    endingCash: number;
    note?: string;
    supervisorApproval?: { supervisorId: string; approvedAt: string };
    varianceReason?: string;
  }) => Promise<{ shift: Shift }>;
  getActiveShift: () => Promise<{ shift: Shift | null }>;
  getShiftById: (shiftId: string) => Promise<{ shift: Shift }>;
  listShifts: (filters?: {
    status?: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
    startDate?: string;
    endDate?: string;
  }) => Promise<{ shifts: Shift[] }>;
  sync: (shifts: Shift[]) => Promise<{ shifts: Shift[] }>;
}

// In createApiClient implementation:
openShift: async (data) => {
  const response = await fetch('/api/shifts/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to open shift');
  return response.json();
},
closeShift: async (data) => {
  const response = await fetch('/api/shifts/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to close shift');
  return response.json();
},
getActiveShift: async () => {
  const response = await fetch('/api/shifts/active');
  if (!response.ok) throw new Error('Failed to get active shift');
  return response.json();
},
getShiftById: async (shiftId) => {
  const response = await fetch(`/api/shifts/${shiftId}`);
  if (!response.ok) throw new Error('Failed to get shift');
  return response.json();
},
listShifts: async (filters) => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  const response = await fetch(`/api/shifts?${params}`);
  if (!response.ok) throw new Error('Failed to list shifts');
  return response.json();
},
sync: async (shifts) => {
  const response = await fetch('/api/shifts/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shifts),
  });
  if (!response.ok) throw new Error('Failed to sync shifts');
  return response.json();
},
```

**Validation:**
- Run `npm run typecheck`

---

### Task 1.5: Implement Shift API Endpoints
**Time:** 2 hours

**File:** `apps/api/src/routes/shifts.ts`

**Description:** Implement all shift-related API endpoints.

**Endpoints to implement:**
- `POST /api/shifts/open` - Open a new shift
- `POST /api/shifts/close` - Close active shift
- `GET /api/shifts/active` - Get current active shift
- `GET /api/shifts/:id` - Get shift by ID
- `GET /api/shifts` - List shifts with filters
- `POST /api/shifts/sync` - Sync offline shifts

**Key functions:**
- `generateShiftNumber()` - Create human-readable shift ID (format: SHIFT-YYYYMMDD-XXX)
- Shift validation (check for existing active shift)
- Variance calculation in close endpoint
- Supervisor authorization check

**Validation:**
- Test each endpoint with Postman/cURL
- Run `npm run typecheck`

---

### Task 1.6: Implement PIN Verification Endpoint
**Time:** 30 minutes

**File:** `apps/api/src/routes/auth.ts`

**Description:** Add endpoint for supervisor PIN verification.

**Endpoint:**
- `POST /api/auth/verify-pin`

**Logic:**
1. Find user by PIN
2. Verify user has supervisor role
3. Log the verification
4. Return supervisor ID

**Validation:**
- Test with valid PIN
- Test with invalid PIN
- Test with non-supervisor PIN

---

### Task 1.7: TypeScript Build Validation
**Time:** 15 minutes

**Action:** Run full build and typecheck.

```bash
npm run typecheck
npm run build
```

**Fix any errors before proceeding.**

---

## Phase 1B: Frontend Store & IndexedDB

**Timeline:** Day 2 (~3.5 hours)

### Task 2.1: Add Shift Tables to IndexedDB Schema
**Time:** 30 minutes

**File:** `apps/web/src/db/index.ts`

**Description:** Add shifts and pendingShiftOperations tables to Dexie schema.

**Changes:**
```typescript
this.version(7).stores({
  // ... existing stores unchanged
  shifts: 'id, cashierId, storeId, status, openingTimestamp, closingTimestamp',
  pendingShiftOperations: 'id, type, shiftId, timestamp',
});
```

**Validation:**
- Run `npm run typecheck`

---

### Task 2.2: Create Shift DB Operations Module
**Time:** 1 hour

**File:** `apps/web/src/db/shifts.ts`

**Description:** Create module for shift-specific IndexedDB operations.

**Functions to implement:**
- `openShiftOffline(shiftData)` - Save shift with syncStatus: 'pending'
- `closeShiftOffline(shiftId, closingData)` - Update shift to closed
- `getActiveShift(cashierId)` - Get active shift for cashier
- `getPendingShiftOps()` - Get all pending operations
- `updateShiftSyncStatus(shiftId, status)` - Update sync status
- `deletePendingShiftOp(opId)` - Remove synced operation
- `incrementShiftOpRetry(opId)` - Increment retry count

**Validation:**
- Run `npm run typecheck`

---

### Task 2.3: Create Shift Interface Types
**Time:** 15 minutes

**File:** `apps/web/src/stores/shiftStore.ts`

**Description:** Define Shift and ShiftState interfaces.

**Content:**
```typescript
export interface Shift {
  id: string;
  shiftNumber: string;
  cashierId: string;
  cashierName: string;
  storeId: string;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  openingFloat: number;
  openingNote?: string;
  openingImageUrl?: string;
  openingTimestamp: string;
  endingCash?: number;
  endingNote?: string;
  closingTimestamp?: string;
  variance?: number;
  varianceReason?: string;
  varianceApprovedBy?: string;
  varianceApprovedAt?: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface PendingShiftOp {
  id: string;
  type: 'OPEN' | 'CLOSE' | 'UPDATE';
  shiftId: string;
  data: unknown;
  timestamp: string;
  retryCount: number;
}

interface ShiftFilters {
  status?: Shift['status'];
  startDate?: string;
  endDate?: string;
}
```

**Validation:**
- Run `npm run typecheck`

---

### Task 2.4: Create ShiftStore with Zustand
**Time:** 1.5 hours

**File:** `apps/web/src/stores/shiftStore.ts`

**Description:** Create Zustand store for shift state management.

**State properties:**
- `activeShift: Shift | null`
- `shifts: Shift[]`
- `shiftsLoading: boolean`
- `showOpenModal: boolean`
- `showCloseModal: boolean`
- `selectedShift: Shift | null`

**Actions:**
- `openShift(floatAmount, note)` - Call API, broadcast to tabs
- `closeShift(endingCash, note, supervisorApproval?, varianceReason?)` - Call API, broadcast
- `fetchActiveShift()` - Get active shift from API
- `fetchShiftHistory(filters)` - List shifts
- `clearError()` - Reset error state

**Validation:**
- Run `npm run typecheck`
- Test store functionality manually

---

### Task 2.5: Add Cross-Tab Sync
**Time:** 30 minutes

**File:** `apps/web/src/stores/shiftStore.ts`

**Description:** Implement BroadcastChannel for real-time sync across tabs.

**Implementation:**
```typescript
const SHIFT_SYNC_CHANNEL = 'pos-shift-sync';
const channel = typeof BroadcastChannel !== 'undefined' 
  ? new BroadcastChannel(SHIFT_SYNC_CHANNEL) 
  : null;

if (channel) {
  channel.onmessage = (event) => {
    const { type, payload } = event.data;
    switch (type) {
      case 'SHIFT_OPENED':
      case 'SHIFT_UPDATED':
        useShiftStore.setState({ activeShift: payload });
        break;
      case 'SHIFT_CLOSED':
        useShiftStore.setState({ activeShift: null });
        break;
    }
  };
}

function broadcastShiftState(message: { type: string; payload: Shift }) {
  if (!channel) return;
  channel.postMessage(message);
}
```

**Validation:**
- Test in two browser tabs

---

## Phase 1C: UI Components

**Timeline:** Day 3 (~5.5 hours)

### Task 3.1: Create SupervisorAuthModal
**Time:** 1.5 hours

**File:** `apps/web/src/components/shift/SupervisorAuthModal.tsx`

**Description:** Create modal for supervisor PIN verification.

**Features:**
- Display variance amount
- 4-digit PIN input
- Error handling
- Loading state
- Success/cancel callbacks

**Components needed:**
- Modal layout
- PIN input field
- Variance display
- Buttons (Cancel, Approve)

**Validation:**
- Run `npm run typecheck`
- Test PIN verification flow

---

### Task 3.2: Create ShiftOpenModal
**Time:** 1.5 hours

**File:** `apps/web/src/components/shift/ShiftOpenModal.tsx`

**Description:** Create modal for opening a new shift.

**Features:**
- Float amount input (required)
- Opening note (optional)
- Offline indicator
- Validation
- Loading state
- Error display

**Validation:**
- Run `npm run typecheck`
- Test opening shift flow

---

### Task 3.3: Create ShiftCloseModal
**Time:** 2 hours

**File:** `apps/web/src/components/shift/ShiftCloseModal.tsx`

**Description:** Create modal for closing a shift.

**Features:**
- Expected cash display (calculated)
- Ending cash input (required)
- Variance calculation and display
- Variance threshold checks:
  - < $1: Auto-forgive
  - $1-$5: Require comment
  - ≥ $5: Require supervisor PIN
- Signature confirmation
- Offline indicator

**Components needed:**
- Cash reconciliation display
- Variance indicator with color coding
- SupervisorAuthModal integration
- Comment input for medium variance
- Signature checkbox

**Validation:**
- Run `npm run typecheck`
- Test all variance scenarios

---

### Task 3.4: Create ShiftStatusBadge
**Time:** 30 minutes

**File:** `apps/web/src/components/shift/ShiftStatusBadge.tsx`

**Description:** Create badge component for header.

**Features:**
- Green badge when shift is ACTIVE
- Gray badge when no active shift
- Display cashier name
- Display shift duration
- Click to open modal

**Validation:**
- Run `npm run typecheck`
- Verify display in header

---

## Phase 1D: Pages & Routes

**Timeline:** Day 4 (~2.5 hours)

### Task 4.1: Create ShiftReport Page
**Time:** 2 hours

**File:** `apps/web/src/pages/ShiftReport.tsx`

**Description:** Create shift summary report page.

**Sections:**
- Header (shift info, dates, times)
- Opening section (float, note)
- Transactions summary (sales, refunds, paid outs)
- Cash reconciliation (expected, actual, variance)
- Performance metrics (transaction count, items sold, avg)
- Transaction list
- Print button

**Print styles:**
```css
@media print {
  .shift-report-container {
    width: 80mm !important;
    padding: 10px !important;
    font-size: 12px !important;
  }
  .no-print { display: none !important; }
}
```

**Validation:**
- Run `npm run typecheck`
- Test browser print functionality

---

### Task 4.2: Add Shift Routes to App.tsx
**Time:** 15 minutes

**File:** `apps/web/src/App.tsx`

**Description:** Add route for shift report page.

**Changes:**
```typescript
import ShiftReport from '@/pages/ShiftReport';

// Add route:
<Route path="/shift-report/:shiftId" element={<ShiftReport />} />
```

**Validation:**
- Run `npm run typecheck`

---

### Task 4.3: Add Offline Indicators to Modals
**Time:** 15 minutes

**Files:**
- `apps/web/src/components/shift/ShiftOpenModal.tsx`
- `apps/web/src/components/shift/ShiftCloseModal.tsx`

**Description:** Add offline indicator when network is unavailable.

**Implementation:**
```typescript
const isOnline = useOnlineStatus();

// In modal header:
{!isOnline && (
  <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">
    ⚠️ Offline Mode - Will sync when online
  </div>
)}
```

**Validation:**
- Test offline behavior

---

## Phase 1E: Integration & Testing

**Timeline:** Day 5 (~6 hours)

### Task 5.1: Add Shift Sync to Scheduler
**Time:** 1 hour

**File:** `apps/web/src/services/sync.ts`

**Description:** Integrate shift operations into the sync scheduler.

**Implementation:**
```typescript
class SyncService {
  async syncShifts(): Promise<void> {
    const pendingOps = await getPendingShiftOps();
    
    for (const op of pendingOps) {
      try {
        switch (op.type) {
          case 'OPEN':
            await this.syncOpenShift(op);
            break;
          case 'CLOSE':
            await this.syncCloseShift(op);
            break;
        }
        await deletePendingShiftOp(op.id);
        await updateShiftSyncStatus(op.shiftId, 'synced');
      } catch (error) {
        await incrementShiftOpRetry(op.id);
      }
    }
  }
}
```

**Validation:**
- Test offline shift creation
- Test sync when back online

---

### Task 5.2: Integration Testing
**Time:** 3 hours

**Description:** Test all components together.

**Test scenarios:**
1. Open shift with valid float
2. Close shift with no variance
3. Close shift with small variance (<$1)
4. Close shift with medium variance ($1-$5)
5. Close shift with large variance (≥$5) - blocked
6. Supervisor approves large variance
7. Offline shift open syncs when online
8. Offline shift close syncs when online
9. Cross-tab sync updates active shift
10. Shift summary displays correct calculations
11. Browser print generates correct report

**Tools:**
- Manual testing in browser
- Postman/cURL for API testing

---

### Task 5.3: Bug Fixes and Validation
**Time:** 2 hours

**Description:** Fix any issues found during testing.

**Actions:**
- Fix TypeScript errors
- Fix UI issues
- Fix API errors
- Verify all tests pass

**Final validation:**
```bash
npm run typecheck
npm run build
```

---

## Summary by Day

| Day | Phase | Focus | Time |
|-----|-------|-------|------|
| 1 | Phase 1A | Backend & Database | 5 hours |
| 2 | Phase 1B | Store & IndexedDB | 3.5 hours |
| 3 | Phase 1C | UI Components | 5.5 hours |
| 4 | Phase 1D | Pages & Routes | 2.5 hours |
| 5 | Phase 1E | Integration & Testing | 6 hours |
| **Total** | | | **~22 hours** |

---

## Files Created Summary

### New Files

| File | Description |
|------|-------------|
| `apps/api/drizzle/0007_shift_management.sql` | Database migration |
| `apps/web/src/stores/shiftStore.ts` | Zustand store |
| `apps/web/src/db/shifts.ts` | IndexedDB operations |
| `apps/web/src/components/shift/ShiftOpenModal.tsx` | Open shift modal |
| `apps/web/src/components/shift/ShiftCloseModal.tsx` | Close shift modal |
| `apps/web/src/components/shift/SupervisorAuthModal.tsx` | PIN verification modal |
| `apps/web/src/components/shift/ShiftStatusBadge.tsx` | Status badge |
| `apps/web/src/pages/ShiftReport.tsx` | Report page |

### Modified Files

| File | Changes |
|------|---------|
| `apps/api/src/db/schema.ts` | Added shifts table |
| `packages/api/src/types.ts` | Added Shift types |
| `packages/api/src/apiClient.ts` | Added shift methods |
| `apps/api/src/routes/shifts.ts` | Added shift endpoints |
| `apps/api/src/routes/auth.ts` | Added verifyPin endpoint |
| `apps/web/src/db/index.ts` | Added shift tables to schema |
| `apps/web/src/App.tsx` | Added shift routes |
| `apps/web/src/services/sync.ts` | Added shift sync |

---

## Dependencies

| Dependency | Status |
|------------|--------|
| Existing auth middleware | ✅ Ready |
| Existing Dexie setup | ✅ Ready |
| Existing Drizzle setup | ✅ Ready |
| Existing scheduler | ✅ Ready |
| Existing BroadcastChannel | ✅ Ready |

---

## Next Steps

When ready to start implementation:

1. Review this task list
2. Confirm start date
3. Begin with Task 1.1
