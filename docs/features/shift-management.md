# Feature Specification: Shift Management

## Status

**Planned** - Not yet implemented

> **Business Context**: See [Shift Management PRD](../prd/shift-management-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

## Overview

Enable cashiers to open and close their work shifts with proper cash float management, authorization controls, and end-of-shift reporting.

## Use Case

**Scenario**: A cashier starts their work day and needs to:

1. **Open Shift**: Enter starting float amount to begin serving customers
2. **Process Transactions**: All transactions during the shift are tracked
3. **Close Shift**: Count ending cash, reconcile with expected amount, and generate summary
4. **View Reports**: Access shift summary with transaction breakdown and performance metrics

## Requirements

| Requirement | Decision |
|-------------|----------|
| Shift opening | Required with float amount |
| Shift closing | Required with cash count |
| Human-readable shift ID | Format: `SHIFT-YYYYMMDD-XXX` |
| Cash float management | Required |
| Variance handling | Auto-forgive <$1, comment $1-$5, supervisor approval ≥$5 |
| Supervisor PIN | Required for large variances |
| Shift summary report | Browser print (80mm width) |
| Offline support | IndexedDB + scheduler sync |
| Cashier-store binding | One store per cashier |
| Customer Display | Not shown (per PRD) |

## Data Model

### Shift Interface

```typescript
// apps/web/src/stores/shiftStore.ts

export interface Shift {
  id: string;
  shiftNumber: string; // Human-readable: SHIFT-YYYYMMDD-XXX
  cashierId: string;
  cashierName: string;
  storeId: string;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';

  // Opening
  openingFloat: number;
  openingNote?: string;
  openingImageUrl?: string;
  openingTimestamp: string;

  // Closing
  endingCash?: number;
  endingNote?: string;
  closingTimestamp?: string;

  // Variance
  variance?: number;
  varianceReason?: string;
  varianceApprovedBy?: string;
  varianceApprovedAt?: string;

  // Audit
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: string;
  updatedAt: string;
}
```

### ShiftStore State

```typescript
// apps/web/src/stores/shiftStore.ts

interface ShiftState {
  activeShift: Shift | null;
  shifts: Shift[];
  shiftsLoading: boolean;
  showOpenModal: boolean;
  showCloseModal: boolean;
  selectedShift: Shift | null;

  openShift: (floatAmount: number, note?: string) => Promise<void>;
  closeShift: (endingCash: number, note?: string, supervisorApproval?: {
    supervisorId: string;
    approvedAt: string;
  }, varianceReason?: string) => Promise<void>;
  fetchActiveShift: () => Promise<void>;
  fetchShiftHistory: (filters?: ShiftFilters) => Promise<void>;
  clearError: () => void;
}

interface ShiftFilters {
  status?: Shift['status'];
  startDate?: string;
  endDate?: string;
}
```

### Database Schema

#### IndexedDB (Dexie) - Version 7

```typescript
// apps/web/src/db/index.ts

class PosDatabase extends Dexie {
  shifts!: Dexie.Table<Shift, string>;
  pendingShiftOperations!: Dexie.Table<PendingShiftOp, string>;

  constructor() {
    super('pos-database');

    this.version(7).stores({
      // ... existing tables unchanged
      shifts: 'id, cashierId, storeId, status, openingTimestamp, closingTimestamp',
      pendingShiftOperations: 'id, type, shiftId, timestamp',
    });
  }
}

export interface PendingShiftOp {
  id: string;
  type: 'OPEN' | 'CLOSE' | 'UPDATE';
  shiftId: string;
  data: unknown;
  timestamp: string;
  retryCount: number;
}
```

#### PostgreSQL (Drizzle)

```typescript
// apps/api/src/db/schema.ts

import { pgTable, uuid, timestamp, numeric, text, varchar, index } from 'drizzle-orm/pg-core';

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftNumber: varchar('shift_number', length: 50).notNull().unique(),
  cashierId: varchar('cashier_id', length: 255).notNull(),
  storeId: uuid('store_id').notNull(),
  status: varchar('status', length: 20).notNull().default('ACTIVE'),

  // Opening
  openingFloat: numeric('opening_float', { precision: 10, scale: 2 }).notNull(),
  openingNote: text('opening_note'),
  openingImageUrl: text('opening_image_url'),
  openingTimestamp: timestamp('opening_timestamp').notNull().defaultNow(),

  // Closing
  endingCash: numeric('ending_cash', { precision: 10, scale: 2 }),
  endingNote: text('ending_note'),
  closingTimestamp: timestamp('closing_timestamp'),

  // Variance
  variance: numeric('variance', { precision: 10, scale: 2 }),
  varianceReason: text('variance_reason'),
  varianceApprovedBy: varchar('variance_approved_by', length: 255),
  varianceApprovedAt: timestamp('variance_approved_at'),

  // Audit
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

### API Types

```typescript
// packages/api/src/types.ts

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
    metadata?: {
      shiftId?: string;
      variance?: number;
    };
  }): Promise<{
    success: boolean;
    supervisorId?: string;
    supervisorName?: string;
    error?: string;
  }>;

  sync(shifts: Shift[]): Promise<{ shifts: Shift[] }>;
}
```

## User Flows

### Flow 1: Open a Shift

```
1. Cashier clicks [Start Shift] button
2. System validates:
   - User is authenticated
   - No active shift exists for this cashier
3. ShiftOpenModal appears with:
   - Float amount input (required)
   - Opening note (optional)
4. Cashier enters float amount and optional note
5. Cashier clicks [Start Shift]
6. System calls POST /api/shifts/open
7. On success:
   - Store shift locally (syncStatus: 'pending')
   - Broadcast to other tabs
   - Show success toast
   - Update active shift state
8. Shift is now ACTIVE
```

### Flow 2: Close a Shift

```
1. Cashier clicks [End Shift] button
2. System validates:
   - Active shift exists
   - All transactions are completed
3. ShiftCloseModal appears with:
   - Expected cash (calculated: openingFloat + cashSales - refunds - paidOuts)
   - Ending cash input (required)
   - Ending note (optional)
   - Signature confirmation checkbox
4. Cashier counts and enters ending cash
5. System calculates variance (endingCash - expectedCash)
6. Based on variance:
   a. |variance| < $1:
      - Log only, auto-forgive
      - Proceed to step 8
   b. $1 <= |variance| < $5:
      - Show warning
      - Require comment
      - Proceed to step 8
   c. |variance| >= $5:
      - Show SupervisorAuthModal
      - Require supervisor PIN
      - On approval, proceed to step 8
7. Cashier confirms variance and signs
8. System calls POST /api/shifts/close
9. On success:
   - Navigate to Shift Report
   - Broadcast to other tabs
10. Shift is now CLOSED
```

### Flow 3: View Shift Summary

```
1. Cashier completes shift close
2. Redirected to /shift-report/:shiftId
3. System fetches shift data and calculates report
4. Display ShiftSummary with:
   - Header (shift info, dates, times)
   - Opening section (float, note)
   - Transactions summary (sales, refunds, paid outs)
   - Cash reconciliation (expected, actual, variance)
   - Performance metrics (transaction count, items sold, avg)
   - Transaction list
5. Cashier can print report using browser print
```

### Flow 4: Offline Shift

```
1. When offline, shift operations store locally
2. POST /api/shifts/open → save to IndexedDB with syncStatus: 'pending'
3. POST /api/shifts/close → update IndexedDB with syncStatus: 'pending'
4. Queue operations in pendingShiftOperations table
5. When online, scheduler syncs pending operations:
   - Process in order
   - Update syncStatus to 'synced' on success
   - Retry up to 3 times
   - Flag as failed after max retries
```

## User Interface

### ShiftOpenModal

```
Props:
- isOpen: boolean
- onClose: () => void
- onSuccess: (shift: Shift) => void

State:
- floatAmount: number (required)
- openingNote: string (optional)
- isLoading: boolean
- error: string | null

Validation:
- floatAmount must be >= 0

Layout:
┌────────────────────────────────────────┐
│         START YOUR SHIFT               │
├────────────────────────────────────────┤
│  💰 Float Amount                       │
│  ┌────────────────────────────────┐    │
│  │ $100.00                       │    │
│  └────────────────────────────────┘    │
│                                        │
│  Opening Note (optional)               │
│  ┌────────────────────────────────┐    │
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
│  ⚠️ Offline indicator when offline     │
│                                        │
│  [ CANCEL ]    [ START SHIFT ]         │
└────────────────────────────────────────┘
```

### ShiftCloseModal

```
Props:
- isOpen: boolean
- onClose: () => void
- onSuccess: (shift: Shift) => void

State:
- endingCash: number (required)
- endingNote: string (optional)
- signatureConfirmed: boolean
- showSupervisorAuth: boolean
- isLoading: boolean

Calculated Values:
- expectedCash = openingFloat + cashSales - refunds - paidOuts
- variance = endingCash - expectedCash

Layout:
┌────────────────────────────────────────┐
│           END YOUR SHIFT               │
├────────────────────────────────────────┤
│  💰 CASH RECONCILIATION                │
│  ─────────────────────────────────     │
│  Opening Float:       $100.00          │
│  + Cash Sales:        $178.00          │
│  - Refunds:           -$12.50          │
│  - Paid Out:          -$20.00          │
│  ─────────────────────────────────     │
│  Expected:            $257.50          │
│                                        │
│  💵 Ending Cash Count                  │
│  ┌────────────────────────────────┐    │
│  │ $256.80                       │    │
│  └────────────────────────────────┘    │
│                                        │
│  Variance: -$0.70 ✓                    │
│                                        │
│  ☐ I confirm the cash count is correct │
│                                        │
│  [ CANCEL ]    [ END SHIFT ]           │
└────────────────────────────────────────┘
```

### SupervisorAuthModal

```
Props:
- isOpen: boolean
- variance: number
- onApprove: (supervisorId: string) => void
- onReject: () => void

State:
- pin: string (4 digits)
- error: string | null
- isLoading: boolean

Layout:
┌────────────────────────────────────────┐
│  🔒 Supervisor Authorization Required  │
├────────────────────────────────────────┤
│  Large variance detected.              │
│                                        │
│  Variance: -$12.50                     │
│                                        │
│  Enter Supervisor PIN:                 │
│  ┌────────────────────────────────┐    │
│  │ ●●●●                          │    │
│  └────────────────────────────────┘    │
│                                        │
│  [ CANCEL ]    [ APPROVE ]             │
└────────────────────────────────────────┘
```

### ShiftStatusBadge

```
Location: Header or top bar

When ACTIVE:
┌─────────────────┐
│ 🟢 SHIFT ACTIVE │ John D. • 2h 34m
└─────────────────┘

When NO ACTIVE SHIFT:
┌─────────────────┐
│ 🔴 NO SHIFT     │ [Start Shift]
└─────────────────┘
```

### ShiftReport Page

```
Route: /shift-report/:shiftId

Layout:
┌─────────────────────────────────────────────┐
│ SHIFT SUMMARY                               │
├─────────────────────────────────────────────┤
│ 🧑‍💼 John Doe  |  📅 Jan 7, 2025  |  ✅ Closed │
│ 9:00 AM - 2:30 PM                          │
├─────────────────────────────────────────────┤
│                                             │
│  💰 OPENING                    $100.00      │
│  Note: All counts verified                  │
│                                             │
├─────────────────────────────────────────────┤
│  📊 TRANSACTIONS                            │
│  ─────────────────────────────────────     │
│  Total Sales:           $523.45   42 txns  │
│    └ Cash:              $178.00            │
│    └ Card:              $345.45            │
│  Refunds:               -$12.50   2 txns   │
│  Paid Out:              -$20.00   1 txn    │
│                                             │
├─────────────────────────────────────────────┤
│  💵 CLOSING                                 │
│  ─────────────────────────────────────     │
│  Expected:                $257.50           │
│  Actual:                  $256.80           │
│  Variance:                -$0.70 ✓         │
│                                             │
├─────────────────────────────────────────────┤
│  📈 PERFORMANCE                            │
│  ─────────────────────────────────────     │
│  Items Sold:               67              │
│  Avg Transaction:        $12.46            │
│                                             │
├─────────────────────────────────────────────┤
│  ✍️ Signed: Jan 7, 2025 2:30 PM             │
│                                             │
│  [ PRINT ]    [ CLOSE ]                    │
└─────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/shifts/open

Request:
```json
{
  "floatAmount": 100.00,
  "note": "All counts verified"
}
```

Response (200):
```json
{
  "shift": {
    "id": "uuid",
    "shiftNumber": "SHIFT-20250107-001",
    "cashierId": "uuid",
    "storeId": "uuid",
    "status": "ACTIVE",
    "openingFloat": 100.00,
    "openingNote": "All counts verified",
    "openingTimestamp": "2025-01-07T09:00:00Z",
    "syncStatus": "pending",
    "createdAt": "2025-01-07T09:00:00Z",
    "updatedAt": "2025-01-07T09:00:00Z"
  }
}
```

Error (400):
```json
{
  "error": "You already have an active shift"
}
```

### POST /api/shifts/close

Request:
```json
{
  "shiftId": "uuid",
  "endingCash": 256.80,
  "note": "End of day count",
  "varianceReason": "Small shortage due to coin rounding",
  "supervisorApproval": {
    "supervisorId": "uuid",
    "approvedAt": "2025-01-07T14:30:00Z"
  }
}
```

Response (200):
```json
{
  "success": true
}
```

### GET /api/shifts/active

Response (200):
```json
{
  "shift": {
    "id": "uuid",
    "shiftNumber": "SHIFT-20250107-001",
    "status": "ACTIVE",
    ...
  }
}
```

### GET /api/shifts/:id

Response (200):
```json
{
  "shift": { ... }
}
```

### GET /api/shifts

Query params: `?status=CLOSED&startDate=2025-01-01`

Response (200):
```json
{
  "shifts": [
    { ... },
    { ... }
  ]
}
```

### POST /api/auth/verify-pin

Request:
```json
{
  "pin": "1234",
  "action": "shift_approve",
  "metadata": {
    "variance": -12.50
  }
}
```

Response (200):
```json
{
  "success": true,
  "supervisorId": "uuid",
  "supervisorName": "Jane Smith"
}
```

Response (401):
```json
{
  "success": false,
  "error": "Invalid PIN"
}
```

### POST /api/shifts/sync

Request:
```json
[
  {
    "id": "client-uuid",
    "shiftNumber": "SHIFT-20250107-001",
    ...
  }
]
```

Response (200):
```json
{
  "shifts": [
    {
      "id": "server-uuid",
      "shiftNumber": "SHIFT-20250107-001",
      ...
    }
  ]
}
```

## Offline Behavior

### Shift Operations When Offline

```typescript
// apps/web/src/db/shifts.ts

export async function openShiftOffline(shiftData: Omit<Shift, 'syncStatus'>): Promise<Shift> {
  const shift: Shift = {
    ...shiftData,
    syncStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await db.shifts.add(shift);
  
  await db.pendingShiftOperations.add({
    id: crypto.randomUUID(),
    type: 'OPEN',
    shiftId: shift.id,
    data: shift,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
  
  return shift;
}

export async function closeShiftOffline(
  shiftId: string,
  closingData: { endingCash: number; endingNote?: string }
): Promise<void> {
  const shift = await db.shifts.get(shiftId);
  if (!shift) throw new Error('Shift not found');
  
  const updatedShift: Shift = {
    ...shift,
    endingCash: closingData.endingCash,
    endingNote: closingData.endingNote,
    closingTimestamp: new Date().toISOString(),
    status: 'CLOSED',
    syncStatus: 'pending',
    updatedAt: new Date().toISOString(),
  };
  
  await db.shifts.put(updatedShift);
  
  await db.pendingShiftOperations.add({
    id: crypto.randomUUID(),
    type: 'CLOSE',
    shiftId: shift.id,
    data: { shiftId, ...closingData },
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}
```

### Sync Scheduler

```typescript
// apps/web/src/services/sync.ts

class SyncService {
  async syncShifts(): Promise<void> {
    const pendingOps = await db.pendingShiftOperations
      .where('retryCount')
      .below(3)
      .toArray();
    
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
        
        await db.pendingShiftOperations.delete(op.id);
        await db.shifts.update(op.shiftId, { syncStatus: 'synced' });
      } catch (error) {
        await db.pendingShiftOperations.update(op.id, {
          retryCount: op.retryCount + 1,
        });
      }
    }
  }
}
```

## Cross-Tab Sync

```typescript
// apps/web/src/stores/shiftStore.ts

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

## Implementation Tasks

| ID | Description | Files |
|----|-------------|-------|
| T-01 | Create Shift interface types | `apps/web/src/stores/shiftStore.ts` |
| T-02 | Add shifts table to IndexedDB schema | `apps/web/src/db/index.ts` |
| T-03 | Add shifts table to Drizzle schema | `apps/api/src/db/schema.ts` |
| T-04 | Create database migration files | `apps/api/drizzle/*.sql` |
| T-05 | Create shiftStore with Zustand | `apps/web/src/stores/shiftStore.ts` |
| T-06 | Create API client methods | `packages/api/src/apiClient.ts` |
| T-07 | Implement shift API endpoints (5 routes) | `apps/api/src/routes/shifts.ts` |
| T-08 | Implement PIN verification endpoint | `apps/api/src/routes/auth.ts` |
| T-09 | Implement ShiftOpenModal | `apps/web/src/components/shift/ShiftOpenModal.tsx` |
| T-10 | Implement ShiftCloseModal | `apps/web/src/components/shift/ShiftCloseModal.tsx` |
| T-11 | Implement SupervisorAuthModal | `apps/web/src/components/shift/SupervisorAuthModal.tsx` |
| T-12 | Implement ShiftStatusBadge | `apps/web/src/components/shift/ShiftStatusBadge.tsx` |
| T-13 | Create ShiftReport page | `apps/web/src/pages/ShiftReport.tsx` |
| T-14 | Add shift routes to App.tsx | `apps/web/src/App.tsx` |
| T-15 | Add shift DB operations module | `apps/web/src/db/shifts.ts` |
| T-16 | Add shift sync to scheduler | `apps/web/src/services/sync.ts` |
| T-17 | Add offline indicators to UI | In modals |
| T-18 | Add cross-tab sync | `apps/web/src/stores/shiftStore.ts` |
| T-19 | Integration testing | All components |

## Testing Strategy

| Test Case | Description |
|-----------|-------------|
| TC-01 | Cashier opens shift with valid float |
| TC-02 | System blocks opening shift when active shift exists |
| TC-03 | Cashier closes shift with matching cash (no variance) |
| TC-04 | Cashier closes shift with small variance (<$1) |
| TC-05 | Cashier closes shift with medium variance ($1-$5) |
| TC-06 | Cashier closes shift with large variance ($5+) - blocked |
| TC-07 | Supervisor approves large variance |
| TC-08 | Shift summary displays correct calculations |
| TC-09 | Offline shift open syncs when online |
| TC-10 | Offline shift close syncs when online |
| TC-11 | Cross-tab sync updates active shift |
| TC-12 | Browser print generates correct report |

## Files to Create

```
apps/web/src/
├── stores/
│   └── shiftStore.ts          # Zustand store
├── hooks/
│   └── useSupervisorAuth.ts   # PIN verification hook
├── db/
│   └── shifts.ts              # IndexedDB operations
├── components/
│   └── shift/
│       ├── ShiftOpenModal.tsx
│       ├── ShiftCloseModal.tsx
│       ├── SupervisorAuthModal.tsx
│       └── ShiftStatusBadge.tsx
└── pages/
    └── ShiftReport.tsx

apps/api/src/
├── routes/
│   ├── shifts.ts              # Shift API endpoints
│   └── auth.ts                # PIN verification endpoint
└── db/
    └── schema.ts              # Updated with shifts table

apps/api/drizzle/
└── 0007_shift_management.sql  # Migration file

packages/api/src/
└── apiClient.ts               # Updated with shift methods
```

## Estimated Effort

| Phase | Time |
|-------|------|
| Database & API | 4 hours |
| Frontend Store | 2 hours |
| UI Components | 8 hours |
| Offline Sync | 4 hours |
| Testing | 4 hours |
| **Total** | **~22 hours** |

## Dependencies

| Dependency | Description |
|------------|-------------|
| Authentication | Existing auth middleware |
| Scheduler | Existing sync scheduler |
| IndexedDB | Existing Dexie setup |
| Drizzle | Existing database setup |
| BroadcastChannel | Existing cross-tab sync |
