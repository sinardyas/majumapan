# Feature Specification Document: End of Day

## Status

**Planned** - Ready for implementation

> **Context**: See [End of Day PRD](../prd/end-of-day-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

---

## 1. Overview

Enable store managers to consolidate all transactions for an operational day into permanent records, generate comprehensive reports, and close the business day to ensure data integrity.

---

## 2. Data Models

### 2.1 Database Schema

**New Tables:**

1. **operational_days** - Track open/closed state per store per day
2. **day_closes** - Permanent EOD records
3. **day_close_shifts** - Link shifts to day close records
4. **pending_carts_queue** - Hold incomplete carts for next day
5. **devices** - Master terminal management

**Modified Tables:**

1. **stores** - Add `operationalDayStartHour`, `eodNotificationEmails`
2. **transactions** - Add `operationalDate` for faster queries

### 2.2 Key Types

```typescript
// Day Close Record
interface DayClose {
  id: string;
  storeId: string;
  operationalDate: string;
  dayCloseNumber: string; // DC-YYYYMMDD-001
  periodStart: string;
  periodEnd: string;
  
  // Summary Data
  totalTransactions: number;
  totalSales: number;
  cashRevenue: number;
  cardRevenue: number;
  totalRefunds: number;
  totalDiscounts: number;
  totalVariance: number;
  
  // Shift Aggregation
  shifts: {
    shiftId: string;
    cashierId: string;
    cashierName: string;
    openingFloat: number;
    closingCash: number;
    variance: number;
  }[];
  
  // Sync Status
  syncStatus: 'clean' | 'warning';
  
  // Audit
  closedByUserId: string;
  closedByUserName: string;
  closedAt: string;
}

// Pre-EOD Summary
interface PreEODSummary {
  storeId: string;
  operationalDate: string;
  transactions: { total: number; completed: number; voided: number };
  revenue: { totalSales: number; cashRevenue: number; cardRevenue: number };
  shifts: { activeCount: number; totalVariance: number };
  syncStatus: { pendingTransactions: number; pendingCarts: number };
}
```

---

## 3. API Endpoints

### 3.1 Day Close Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/day-close/preview` | Get pre-EOD summary | Manager |
| POST | `/api/v1/day-close/execute` | Execute End of Day | Manager (Master Terminal) |
| GET | `/api/v1/day-close/:id` | Get day close record | Manager |
| GET | `/api/v1/day-close/history` | List historical day closes | Manager |
| GET | `/api/v1/day-close/:id/report/sales` | Daily Sales Report | Manager |
| GET | `/api/v1/day-close/:id/report/cash` | Cash Reconciliation Report | Manager |
| GET | `/api/v1/day-close/:id/report/inventory` | Inventory Movement Report | Manager |
| GET | `/api/v1/day-close/:id/report/audit` | Transaction Audit Log | Manager |
| GET | `/api/v1/day-close/:id/report/shifts` | Shift Aggregation Report | Manager |
| GET | `/api/v1/day-close/:id/export/pdf` | Export PDF | Manager |
| GET | `/api/v1/day-close/:id/export/csv` | Export CSV | Manager |
| POST | `/api/v1/day-close/:id/email` | Email reports | Manager |

### 3.2 Pending Carts Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/pending-carts` | Get pending carts | Authenticated |
| POST | `/api/v1/pending-carts/:cartId/restore` | Restore cart | Cashier |
| DELETE | `/api/v1/pending-carts/:cartId` | Void cart | Cashier |

### 3.3 Devices Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/devices/:id/master-status` | Check if master terminal | Authenticated |
| PUT | `/api/v1/devices/:id/master-status` | Set master terminal | Admin |

### 3.4 Stores Routes (Updated)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/stores/:id/eod-settings` | Get EOD settings | Manager |
| PUT | `/api/v1/stores/:id/eod-settings` | Update EOD settings | Admin |

---

## 4. State Management

```typescript
// apps/web/src/stores/eodStore.ts

interface EODState {
  isLoading: boolean;
  error: string | null;
  preEODSummary: PreEODSummary | null;
  currentDayClose: DayClose | null;
  dayCloseHistory: DayCloseHistoryItem[];
  pendingCarts: PendingCartQueueItem[];
  
  fetchPreEODSummary: (storeId: string) => Promise<PreEODSummary | null>;
  executeEOD: (storeId: string, operationalDate: string) => Promise<DayClose | null>;
  fetchDayCloseHistory: (storeId: string, page?: number) => Promise<void>;
  fetchPendingCarts: (storeId: string, operationalDate: string) => Promise<void>;
  restorePendingCart: (cartId: string) => Promise<boolean>;
  voidPendingCart: (cartId: string) => Promise<boolean>;
}
```

---

## 5. Services

### 5.1 Day Close Service

```typescript
// apps/api/src/services/day-close-service.ts

export const dayCloseService = {
  // Get pre-EOD summary with all validation data
  async getPreEODSummary(storeId: string): Promise<PreEODSummary>,
  
  // Execute End of Day - creates all records atomically
  async executeEOD(storeId: string, operationalDate: string, user: User): Promise<EODResult>,
  
  // Report generation
  async generateSalesReport(dayCloseId: string): Promise<DailySalesReport>,
  async generateCashReconReport(dayCloseId: string): Promise<CashReconReport>,
  async generateInventoryReport(dayCloseId: string): Promise<InventoryMovementReport>,
  async generateAuditLogReport(dayCloseId: string): Promise<TransactionAuditLogReport>,
  async generateShiftAggregationReport(dayCloseId: string): Promise<ShiftAggregationReport>,
  
  // Export
  async generatePDF(dayCloseId: string): Promise<Buffer>,
  async generateCSV(dayCloseId: string, format: string): Promise<Buffer>,
  
  // Notifications
  async sendEmailReports(dayCloseId: string, reportTypes: string[], recipients: string[]): Promise<void>,
};
```

---

## 6. Component Structure

### 6.1 POS Components

```
apps/web/src/
├── components/eod/
│   ├── PreEDSummary.tsx
│   ├── EODConfirmationModal.tsx
│   └── DayClosedOverlay.tsx
├── pages/
│   ├── EndOfDay.tsx
│   └── PendingCarts.tsx
└── stores/eodStore.ts
```

### 6.2 Admin Components

```
apps/admin/src/
├── pages/
│   ├── EODSettings.tsx
│   ├── MasterTerminals.tsx
│   ├── DayCloseHistory.tsx
│   ├── DayCloseDetail.tsx
│   └── DayCloseReports.tsx
└── components/eod/
    ├── EODConfigForm.tsx
    ├── MasterTerminalList.tsx
    └── DayCloseHistoryTable.tsx
```

---

## 7. Implementation Tasks

### Phase 1: Core Infrastructure (Week 1)

| ID | Task | Description | Files |
|----|------|-------------|-------|
| T1.1.1 | Create operational_days table | Database migration | `apps/api/drizzle/0004_operational_days.sql` |
| T1.1.2 | Create day_closes table | Database migration | `apps/api/drizzle/0005_day_closes.sql` |
| T1.1.3 | Create day_close_shifts table | Database migration | `apps/api/drizzle/0006_day_close_shifts.sql` |
| T1.1.4 | Create pending_carts_queue table | Database migration | `apps/api/drizzle/0007_pending_carts_queue.sql` |
| T1.1.5 | Create devices table | Database migration | `apps/api/drizzle/0008_devices.sql` |
| T1.1.6 | Add stores columns | Database migration | `apps/api/drizzle/0008_devices.sql` |
| T1.1.7 | Add transactions column | Database migration | `apps/api/drizzle/0008_devices.sql` |
| T1.2.1 | Add shared types | Add interfaces | `packages/shared/src/types/models.ts` |
| T1.2.2 | Add API client types | Add interfaces | `packages/api/src/types.ts` |
| T1.3.1 | Create day-close routes | API endpoints | `apps/api/src/routes/day-close.ts` |
| T1.3.2 | Create pending-carts routes | API endpoints | `apps/api/src/routes/pending-carts.ts` |
| T1.3.3 | Create devices routes | API endpoints | `apps/api/src/routes/devices.ts` |
| T1.4.1 | Create day-close service | Business logic | `apps/api/src/services/day-close-service.ts` |
| T1.5.1 | Create eodStore | State management | `apps/web/src/stores/eodStore.ts` |

### Phase 2: Incomplete Cart Queue (Week 1-2)

| ID | Task | Description | Files |
|----|------|-------------|-------|
| T2.1.1 | Update cart serialization | JSON support | `apps/web/src/stores/cartStore.ts` |
| T2.1.2 | Create cart restore function | Restore cart | `apps/web/src/services/cart-service.ts` |
| T2.2.1 | Create PendingCarts page | UI | `apps/web/src/pages/PendingCarts.tsx` |
| T2.2.4 | Create PendingCartsList | UI | `apps/web/src/components/eod/PendingCartsList.tsx` |

### Phase 3: Reports Engine (Week 2)

| ID | Task | Description | Files |
|----|------|-------------|-------|
| T3.1.1-5 | Implement all 5 reports | Sales, Cash, Inventory, Audit, Shifts | `apps/api/src/services/day-close-service.ts` |

### Phase 4: Export & Notifications (Week 3)

| ID | Task | Description | Files |
|----|------|-------------|-------|
| T4.1.1 | Implement PDF export | Generate PDF | `apps/api/src/services/day-close-service.ts` |
| T4.1.2 | Implement CSV export | Generate CSV | `apps/api/src/services/day-close-service.ts` |
| T4.2.1 | Create email service | Send emails | `apps/api/src/services/email-service.ts` |

### Phase 5: UI Integration (Week 3-4)

| ID | Task | Description | Files |
|----|------|-------------|-------|
| T5.1.1 | Create PreEODSummary | POS UI | `apps/web/src/components/eod/PreEDSummary.tsx` |
| T5.1.2 | Create EODConfirmationModal | POS UI | `apps/web/src/components/eod/EODConfirmationModal.tsx` |
| T5.1.3 | Create EndOfDay page | POS UI | `apps/web/src/pages/EndOfDay.tsx` |
| T5.1.4 | Create DayClosedOverlay | POS UI | `apps/web/src/components/eod/DayClosedOverlay.tsx` |
| T5.1.5 | Add EOD button to dashboard | POS UI | `apps/web/src/pages/Dashboard.tsx` |
| T5.2.1 | Create EODSettings page | Admin UI | `apps/admin/src/pages/EODSettings.tsx` |
| T5.2.2 | Create MasterTerminals page | Admin UI | `apps/admin/src/pages/MasterTerminals.tsx` |
| T5.3.1 | Create DayCloseHistory page | Admin UI | `apps/admin/src/pages/DayCloseHistory.tsx` |
| T5.3.2 | Create DayCloseDetail page | Admin UI | `apps/admin/src/pages/DayCloseDetail.tsx` |
| T5.4.1-5 | Create report components | Admin UI | `apps/admin/src/components/reports/*.tsx` |

### Phase 6: Testing & Polish (Week 4)

| ID | Task | Description |
|----|------|-------------|
| T6.1.1 | Test day-close service | Unit tests |
| T6.1.2 | Test eodStore | Unit tests |
| T6.2.1 | Test EOD workflow | Integration tests |
| T6.3.1-4 | Edge case testing | Sync blocking, master terminal, etc. |
| T6.4.1-4 | Bug fixes & polish | UI, performance, docs |

---

## 8. Database Migrations Summary

### 0004: operational_days

```sql
CREATE TABLE operational_days (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  operational_date DATE NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'OPEN',
  closed_by_user_id UUID,
  closed_by_user_name VARCHAR(255),
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (store_id, operational_date)
);
```

### 0005: day_closes

```sql
CREATE TABLE day_closes (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  operational_day_id UUID REFERENCES operational_days(id),
  operational_date DATE NOT NULL,
  day_close_number VARCHAR(50) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  cash_revenue DECIMAL(10,2) DEFAULT 0,
  card_revenue DECIMAL(10,2) DEFAULT 0,
  total_refunds DECIMAL(10,2) DEFAULT 0,
  total_discounts DECIMAL(10,2) DEFAULT 0,
  total_variance DECIMAL(10,2) DEFAULT 0,
  sync_status VARCHAR(20) DEFAULT 'clean',
  closed_by_user_id UUID NOT NULL,
  closed_by_user_name VARCHAR(255) NOT NULL,
  closed_at TIMESTAMP NOT NULL,
  UNIQUE (store_id, operational_date),
  UNIQUE (day_close_number)
);
```

### 0006: day_close_shifts

```sql
CREATE TABLE day_close_shifts (
  id UUID PRIMARY KEY,
  day_close_id UUID REFERENCES day_closes(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id),
  cashier_id UUID NOT NULL,
  cashier_name VARCHAR(255) NOT NULL,
  opening_float DECIMAL(10,2) NOT NULL,
  closing_cash DECIMAL(10,2) NOT NULL,
  variance DECIMAL(10,2) NOT NULL
);
```

### 0007: pending_carts_queue

```sql
CREATE TABLE pending_carts_queue (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  cart_id VARCHAR(100) NOT NULL,
  cart_data TEXT NOT NULL,
  operational_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
```

### 0008: devices and extensions

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  device_name VARCHAR(255),
  device_identifier VARCHAR(255) UNIQUE,
  is_master_terminal BOOLEAN DEFAULT FALSE,
  master_terminal_name VARCHAR(100)
);

ALTER TABLE stores ADD COLUMN operational_day_start_hour INTEGER DEFAULT 6;
ALTER TABLE stores ADD COLUMN eod_notification_emails TEXT[];
ALTER TABLE transactions ADD COLUMN operational_date DATE;
```

---

## 9. Reports Generated at EOD

### 9.1 Daily Sales Summary
- Transaction counts and revenue breakdown
- Sales by hour chart
- Top products

### 9.2 Cash Reconciliation Report
- Opening float total
- Cash sales, refunds, paid outs
- Expected vs actual cash
- Shift-by-shift breakdown

### 9.3 Inventory Movement Summary
- Items sold (quantity)
- Low stock alerts
- Reorder recommendations

### 9.4 Transaction Audit Log
- Complete list of all transactions
- Timestamps, amounts, payment methods
- Voided transactions marked

### 9.5 Shift Aggregation Report
- All shifts for the day
- Per-shift performance
- Combined daily totals

---

## 10. Key Workflows

### 10.1 Pre-EOD Validation

```
1. Manager clicks "Prepare EOD"
2. System checks:
   ✓ All transactions synced to server
   ✓ No pending offline transactions
   ✓ No incomplete/pending carts
   ✓ All shifts are CLOSED
   ✓ User has manager role
   ✓ User is on master terminal
3. Display summary screen
4. Manager confirms or cancels
```

### 10.2 EOD Execution

```
1. Manager confirms EOD
2. System performs final validation
3. Create Day Close Record (atomic)
4. Generate all reports
5. Mark operational day as CLOSED
6. Auto-save incomplete carts
7. Send notifications
8. Broadcast "Day Closed" to all terminals
9. Transition to next operational day
```

### 10.3 Post-EOD Behavior

- Cashiers: See "Day Closed" overlay, read-only mode
- Managers: Can view/print/export reports
- All transactions: View-only, void/editing blocked

---

## 11. Authorization Matrix

| Action | Cashier | Manager | Admin |
|--------|---------|---------|-------|
| View pre-EOD summary | ❌ | ✅ | ✅ |
| Execute EOD | ❌ | ✅ (Master) | ✅ |
| View day close history | ❌ | ✅ (own store) | ✅ (all) |
| Export EOD reports | ❌ | ✅ | ✅ |
| Configure EOD settings | ❌ | ❌ | ✅ |
| Configure master terminals | ❌ | ❌ | ✅ |

---

## 12. Estimated Effort

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Core Infrastructure | 1 week | DB, API, services |
| Phase 2: Incomplete Cart Queue | 1 week | Cart handling |
| Phase 3: Reports Engine | 1 week | 5 report types |
| Phase 4: Export & Notifications | 1 week | PDF/CSV/Email |
| Phase 5: UI Integration | 1-2 weeks | Full UI |
| Phase 6: Testing & Polish | 1 week | Testing |
| **Total** | **5-6 weeks** | |

---

FSD document complete. Ready for implementation.
