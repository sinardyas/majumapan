# End of Day PRD

## 1. Overview

### 1.1 Purpose
Consolidate all transactions for an operational day into permanent records, generate comprehensive daily reports, and close the business day to ensure data integrity and accurate daily accounting.

### 1.2 Scope
- Configurable operational day boundaries per store
- Store-wide daily summary aggregating all shifts
- Transaction cutoff and data locking
- Multi-terminal sync enforcement via master terminal
- Comprehensive daily reporting (sales, cash, inventory, audit, shifts)
- Incomplete cart handling for next day
- Email notifications and report export

---

## 2. Key Concepts

### 2.1 Operational Day
A configurable time period that defines "one business day" per store.

| Store Type | Default Hours | EOD Time |
|------------|---------------|----------|
| Standard Retail | 6:00 AM - 5:59 AM next day | 6:00 AM |
| Night Operations | 2:00 PM - 2:00 AM next day | 2:00 AM |
| 24-Hour Store | Configurable per store | Configurable |

**Behavior**:
- Transactions at 2:00 AM → belong to previous operational day
- Transactions at 6:00 AM → belong to current operational day
- EOD at 6:00 AM marks all transactions from 6:00 AM (yesterday) to 5:59 AM (today) as closed

### 2.2 Master Terminal

A designated POS terminal authorized to trigger End of Day.

- Only terminals marked as `isMasterTerminal = true` can initiate EOD
- Ensures centralized control and prevents conflicts
- Configured in Admin Panel under **Store Detail > Devices tab**
- Typically: Manager's station or back-office computer

> **Note (2026-02-15):** Master Terminal configuration has been moved from the sidebar to **Store Detail > Devices tab**. This allows store managers to configure the master terminal in the same location where device bindings are managed.

### 2.3 Day Close Record
A permanent audit record created when EOD is executed.

```typescript
interface DayClose {
  id: string;
  storeId: string;
  operationalDate: string;  // YYYY-MM-DD (business day)
  periodStart: string;      // ISO timestamp
  periodEnd: string;        // ISO timestamp
  
  // Summary Data
  totalSales: number;
  totalTransactions: number;
  completedTransactions: number;
  voidedTransactions: number;
  cashRevenue: number;
  cardRevenue: number;
  totalRefunds: number;
  totalDiscounts: number;
  totalVariance: number;
  
  // Shift Aggregation
  shiftCount: number;
  shifts: {
    shiftId: string;
    cashierId: string;
    cashierName: string;
    openingFloat: number;
    closingCash: number;
    variance: number;
  }[];
  
  // Sync Status
  pendingTransactionsAtClose: number;
  syncStatus: 'clean' | 'warning';
  
  // Audit
  closedByUserId: string;
  closedByUserName: string;
  closedAt: string;
  dayCloseNumber: string;  // DC-YYYYMMDD-001
}
```

### 2.4 Transaction Day Assignment
```
Transaction created at: 2026-01-16 02:30 AM
Store operational day: 6:00 AM - 5:59 AM

Result: Transaction belongs to "2026-01-15" operational day
(because 2:30 AM is before 6:00 AM cutoff)
```

---

## 3. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | Store Manager | Configure operational day hours per store | The system aligns with my business hours |
| US-02 | Store Manager | Designate a terminal as master terminal | Only authorized devices can trigger EOD |
| US-03 | Store Manager | View pre-EOD summary before committing | I can verify all data is correct before closing |
| US-04 | Store Manager | Execute End of Day for the store | Today's transactions are finalized and reported |
| US-05 | Store Manager | Receive notification after EOD completion | I'm aware the day has been closed |
| US-06 | Store Manager | View historical EOD reports | I can review past days' performance |
| US-07 | Store Manager | Export EOD reports (PDF, CSV) | I can share reports with stakeholders |
| US-08 | Store Manager | Have incomplete carts auto-saved for next day | No cart data is lost during EOD |
| US-09 | Cashier | See that day is closed and cannot start new transactions | I know to await next operational day |
| US-10 | System | Block void/editing after EOD | Data integrity is maintained |
| US-11 | System | Ensure all terminals synced before EOD | No data is lost or omitted |

---

## 4. Functional Requirements

### 4.1 Store Configuration

#### 4.1.1 Operational Day Settings
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| operationalDayStartHour | number (0-23) | Yes | 6 | Hour when new operational day begins |
| allowAutoDayTransition | boolean | Yes | true | Auto-switch to next day after EOD |
| eodNotificationEmails | string[] | No | [] | Email addresses for EOD alerts |

#### 4.1.2 Master Terminal Settings

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| isMasterTerminal | boolean | Yes | Terminal can trigger EOD |
| masterTerminalName | string | No | Human-readable name (e.g., "Manager Station") |

> **Location:** Admin Panel → Stores → [Select Store] → **Devices** tab → Toggle master status inline |

### 4.2 Pre-EOD Validation

Before EOD can be triggered, system validates:

```
┌─────────────────────────────────────────────┐
│           PRE-EOD VALIDATION CHECKS          │
├─────────────────────────────────────────────┤
│ ✓ All transactions synced to server         │
│ ✓ No pending offline transactions           │
│ ✓ No incomplete/pending carts (auto-saved)  │
│ ✓ All shifts are CLOSED                     │
│ ✓ Store has active operational day          │
│ ✓ User has manager role                     │
│ ✓ User is on master terminal                │
└─────────────────────────────────────────────┘
```

**Error Handling**:
- If any check fails: Display clear error message with manual resolution steps
- Block EOD button until issues are resolved

### 4.3 Pre-EOD Summary Screen

When manager clicks "Prepare EOD", display:

```
┌─────────────────────────────────────────────┐
│         END OF DAY - PREVIEW                 │
├─────────────────────────────────────────────┤
│ Store: Downtown Branch                      │
│ Operational Day: Jan 15, 2026                │
│ Period: Jan 15 6:00 AM → Jan 16 5:59 AM     │
├─────────────────────────────────────────────┤
│ TRANSACTIONS                                 │
│   Total: 127                                 │
│   Completed: 124                             │
│   Voided: 3                                  │
├─────────────────────────────────────────────┤
│ REVENUE                                      │
│   Total Sales: $4,892.50                     │
│   Cash: $1,456.00                            │
│   Card: $3,436.50                            │
│   Refunds: $45.00                            │
│   Discounts: $128.75                         │
├─────────────────────────────────────────────┤
│ SHIFTS SUMMARY                               │
│   Active Shifts: 0 (All closed ✓)            │
│   Total Variance: -$2.30                     │
├─────────────────────────────────────────────┤
│ SYNC STATUS                                  │
│   Pending: 0 (All synced ✓)                  │
├─────────────────────────────────────────────┤
│ INCOMPLETE CARTS                             │
│   Auto-saved to Next Day Queue: 3 carts      │
├─────────────────────────────────────────────┤
│ [ CONFIRM END OF DAY ]   [ CANCEL ]          │
│  Day will be closed. Cannot be undone.       │
└─────────────────────────────────────────────┘
```

### 4.4 EOD Execution Workflow

```
1. Manager clicks "Confirm End of Day"
2. System performs final validation
3. System creates Day Close Record
4. System generates all daily reports
5. System marks operational day as CLOSED
6. System auto-saves incomplete carts to queue
7. System sends notifications
8. All users see: "Operational day is closed. Please wait for next day."
9. System transitions to next operational day
```

### 4.5 Post-EOD Behavior

#### For Cashiers:
```
┌─────────────────────────────────────────────┐
│              DAY CLOSED                      │
├─────────────────────────────────────────────┤
│  Operational day Jan 15, 2026 is complete.  │
│                                             │
│  Please await instructions for next day.    │
│                                             │
│  Current Time: 6:15 AM Jan 16, 2026         │
│  Next operational day begins: 6:00 AM       │
│                                             │
│  [ View My Shift Report (Read-Only) ]       │
└─────────────────────────────────────────────┘

Actions BLOCKED:
- Cannot add items to cart
- Cannot process transactions
- Cannot start new orders
- Cannot void transactions

Actions ALLOWED:
- View past receipts (read-only)
- View shift summary
- Access read-only reports
```

#### For Managers:
```
Same screen, plus:
┌─────────────────────────────────────────────┐
│ [ VIEW DAY CLOSE REPORT ]  [ PRINT RECEIPT ]│
│ [ DOWNLOAD PDF ]            [ DOWNLOAD CSV ]│
│ [ EMAIL REPORTS ]          [ BACK TO HOME ]│
└─────────────────────────────────────────────┘
```

### 4.6 Transaction Protection

After EOD:
| Action | Allowed? | Condition |
|--------|----------|-----------|
| View completed transaction | Yes | Read-only |
| Reprint receipt | Yes | Reprint only |
| Void transaction | No | Blocked entirely |
| Edit transaction | No | Blocked entirely |
| Refund transaction | No | Blocked entirely |

**Exception Handling**: If a critical error is found after EOD, create a separate "Adjustment" record rather than modifying closed data.

### 4.7 Incomplete Cart Handling

When EOD is triggered with incomplete carts:

```
┌─────────────────────────────────────────────┐
│           INCOMPLETE CARTS DETECTED          │
├─────────────────────────────────────────────┤
│ Found 3 incomplete carts.                   │
│                                             │
│ Action taken: Auto-saved to Next Day Queue  │
│ These carts will be available when          │
│ the next operational day begins.            │
│                                             │
│ Cart IDs: CART-001, CART-002, CART-003      │
│ Oldest cart: 2 hours 15 minutes ago         │
└─────────────────────────────────────────────┘
```

**Next Day Behavior**:
- When new day begins, carts appear in "Held Orders" section
- Cashiers can resume or void them
- Cart items remain reserved (stock not released)
- Carts older than 7 days auto-void

---

## 5. Reports Generated at EOD

### 5.1 Daily Sales Summary

```
┌─────────────────────────────────────────────┐
│         DAILY SALES SUMMARY                  │
│         Jan 15, 2026                         │
├─────────────────────────────────────────────┤
│ OPERATIONAL DAY                              │
│   Period: 6:00 AM Jan 15 - 5:59 AM Jan 16   │
│   Status: CLOSED                             │
│   Day Close #: DC-20260115-001               │
├─────────────────────────────────────────────┤
│ OVERVIEW                                     │
│   Total Transactions: 127                    │
│   Completed: 124                             │
│   Voided: 3                                  │
│   Net Transactions: 121                      │
├─────────────────────────────────────────────┤
│ REVENUE                                      │
│   Gross Sales: $4,892.50                     │
│   Refunds: -$45.00                           │
│   Discounts: -$128.75                        │
│   ───────────────────────────                │
│   Net Revenue: $4,718.75                     │
├─────────────────────────────────────────────┤
│ PAYMENT METHODS                              │
│   Cash: $1,456.00 (30.9%)                    │
│   Card: $3,436.50 (69.1%)                    │
├─────────────────────────────────────────────┤
│ SALES BY HOUR                                │
│   6AM-10AM:  $892.50   ████████             │
│   10AM-2PM:  $1,245.00  ████████████        │
│   2PM-6PM:   $892.50   ████████             │
│   6PM-10PM:  $1,127.75  ███████████         │
│   10PM-2AM:  $734.75   ██████               │
│   2AM-6AM:   $0.00     (no sales)           │
├─────────────────────────────────────────────┤
│ TOP PRODUCTS                                 │
│   1. Coffee Latte (Large) - 89 sold         │
│   2. Croissant Butter - 67 sold              │
│   3. Espresso Shot - 54 sold                 │
└─────────────────────────────────────────────┘
```

### 5.2 Cash Reconciliation Report

```
┌─────────────────────────────────────────────┐
│       CASH RECONCILIATION REPORT             │
│       Jan 15, 2026                           │
├─────────────────────────────────────────────┤
│ TOTAL CASH HANDLING                          │
│   Opening Float: $500.00                     │
│   Cash Sales: $1,456.00                      │
│   Cash Refunds: -$45.00                      │
│   Paid Outs: -$120.00                        │
│   Expected Cash: $1,791.00                   │
├─────────────────────────────────────────────┤
│ SHIFT BREAKDOWN                              │
│                                             │
│ Shift 1: John Doe                            │
│   Opened: 6:00 AM  | Closed: 2:00 PM        │
│   Sales: $1,892.50 | Transactions: 48        │
│   Variance: -$1.20                           │
│   Status: Forgiven                           │
│                                             │
│ Shift 2: Jane Smith                          │
│   Opened: 2:00 PM  | Closed: 10:00 PM       │
│   Sales: $2,245.75 | Transactions: 56        │
│   Variance: +$1.25                           │
│   Status: Forgiven                           │
│                                             │
│ Shift 3: Bob Wilson                          │
│   Opened: 10:00 PM | Closed: 5:59 AM        │
│   Sales: $754.25  | Transactions: 20        │
│   Variance: -$0.50                           │
│   Status: Forgiven                           │
├─────────────────────────────────────────────┤
│ SUMMARY                                      │
│   Total Expected: $1,791.00                  │
│   Total Actual: $1,788.80                    │
│   Total Variance: -$2.20                     │
│   Status: Within tolerance                   │
└─────────────────────────────────────────────┘
```

### 5.3 Inventory Movement Summary

```
┌─────────────────────────────────────────────┐
│      INVENTORY MOVEMENT SUMMARY              │
│      Jan 15, 2026                           │
├─────────────────────────────────────────────┤
│ ITEMS SOLD (Top 10)                         │
│   1. Coffee Latte (Large): 89 units         │
│   2. Croissant Butter: 67 units             │
│   3. Espresso Shot: 54 units                │
│   4. Muffin Blueberry: 45 units             │
│   5. Tea Earl Grey: 38 units                │
│   6. Sandwich Turkey: 32 units              │
│   7. Cookie Choc Chip: 29 units              │
│   8. Soda Can: 27 units                     │
│   9. Water Bottle: 24 units                 │
│   10. Fruit Cup: 21 units                   │
├─────────────────────────────────────────────┤
│ LOW STOCK ALERTS (End of Day)               │
│   ⚠️ Oat Milk: 3 units remaining            │
│   ⚠️ Syrup Vanilla: 5 units remaining       │
│   ⚠️ Cups Large: 12 units remaining         │
├─────────────────────────────────────────────┤
│ REORDER RECOMMENDATIONS                      │
│   📦 Order 10 more Oat Milk                 │
│   📦 Order 15 more Syrup Vanilla            │
│   📦 Order 50 more Cups Large               │
└─────────────────────────────────────────────┘
```

### 5.4 Transaction Audit Log

```
┌─────────────────────────────────────────────┐
│       TRANSACTION AUDIT LOG                  │
│       Jan 15, 2026                           │
├─────────────────────────────────────────────┤
│ TXN-20260115-001 | 6:15 AM | $45.50 | CASH  │ John Doe
│ TXN-20260115-002 | 6:22 AM | $12.00 | CARD  │ Jane Smith
│ TXN-20260115-003 | 6:35 AM | $89.99 | CARD  │ John Doe
│ TXN-20260115-004 | 6:45 AM | $23.50 | CASH  │ Bob Wilson
│ TXN-20260115-005 | 7:02 AM | $15.75 | CARD  │ John Doe
│ ...                                          │
│ TXN-20260115-124 | 5:45 AM | $23.50 | CASH  │ Jane Smith
├─────────────────────────────────────────────┤
│ Total Transactions: 124                      │
│ Total Volume: $4,892.50                      │
│ Voids: 3 (TXN-017, TXN-089, TXN-112)        │
└─────────────────────────────────────────────┘
```

### 5.5 Shift Aggregation Report

```
┌─────────────────────────────────────────────┐
│       SHIFT AGGREGATION REPORT               │
│       Jan 15, 2026                           │
├─────────────────────────────────────────────┤
│ SHIFT 1: John Doe                            │
│   Opened: 6:00 AM  | Closed: 2:00 PM        │
│   Sales: $1,892.50 | Transactions: 48        │
│   Opening Float: $100.00                     │
│   Closing Cash: $178.50                      │
│   Variance: -$1.20                           │
│   Status: Forgiven                           │
│                                             │
│ SHIFT 2: Jane Smith                          │
│   Opened: 2:00 PM  | Closed: 10:00 PM       │
│   Sales: $2,245.75 | Transactions: 56        │
│   Opening Float: $200.00                     │
│   Closing Cash: $398.75                      │
│   Variance: +$1.25                           │
│   Status: Forgiven                           │
│                                             │
│ SHIFT 3: Bob Wilson                          │
│   Opened: 10:00 PM | Closed: 5:59 AM        │
│   Sales: $754.25  | Transactions: 20        │
│   Opening Float: $200.00                     │
│   Closing Cash: $199.50                      │
│   Variance: -$0.50                           │
│   Status: Forgiven                           │
├─────────────────────────────────────────────┤
│ DAILY TOTALS                                 │
│   Total Sales: $4,892.50                     │
│   Total Transactions: 124                    │
│   Total Opening Float: $500.00               │
│   Total Closing Cash: $776.75                │
│   Combined Variance: -$0.45                  │
│   Status: Within tolerance                   │
└─────────────────────────────────────────────┘
```

### 5.6 Export Options
- **PDF**: Download complete report package
- **CSV**: Export raw data for Excel/accounting
- **Email**: Send to configured recipients

---

## 6. Notification System

### 6.1 Notification Triggers
| Event | Recipients | Channel |
|-------|------------|---------|
| Pre-EOD warning (30 min before cutoff) | All logged-in users | In-app banner |
| EOD completed | Store manager + configured emails | In-app + Email |
| EOD blocked (sync issues) | Attempting manager | In-app toast |
| Next operational day started | All logged-in users | In-app banner |

### 6.2 Email Notification Format
```
Subject: [POS Alert] Day Closed - Downtown Branch - Jan 15, 2026

End of Day Summary
==================
Store: Downtown Branch
Operational Day: Jan 15, 2026
Closed By: John Doe (Manager)
Closed At: Jan 16, 2026 6:00 AM
Day Close #: DC-20260115-001

Summary:
- Total Transactions: 127
- Completed: 124
- Voided: 3
- Net Revenue: $4,718.75
- Cash: $1,456.00
- Card: $3,436.50
- Refunds: $45.00
- Total Variance: -$2.30

View full report in POS Admin Panel:
https://pos.yourstore.com/admin/reports/day-close/DC-20260115-001
```

---

## 7. Multi-Terminal Sync Protocol

When EOD is triggered from master terminal:

```
MASTER TERMINAL                          SLAVE TERMINALS
     │                                        │
     │  1. Check sync status                  │
     │◄───────────────────────────────────────│
     │  (Query: pending_transactions count)   │
     │                                        │
     │  2. All synced? ──────────────────────►│
     │     If NO: Block EOD, show error       │
     │                                        │
     │  3. Execute EOD                        │
     │◄───────────────────────────────────────│
     │  (Broadcast: DAY_CLOSED event)         │
     │                                        │
     │  4. Show "Day Closed" screen           │◄─ Show same screen
     │                                        │
     │  5. Send notifications                 │◄─ Send same notifications
```

---

## 8. Database Schema

### 8.1 New Tables

#### 8.1.1 Operational Days Table
```typescript
interface OperationalDay {
  id: string;
  storeId: string;
  operationalDate: string;  // YYYY-MM-DD
  periodStart: string;      // ISO timestamp
  periodEnd: string;        // ISO timestamp
  status: 'OPEN' | 'CLOSED';
  closedByUserId?: string;
  closedByUserName?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 8.1.2 Day Closes Table
```typescript
interface DayClose {
  id: string;
  storeId: string;
  operationalDayId: string;
  operationalDate: string;
  dayCloseNumber: string;  // DC-YYYYMMDD-001
  periodStart: string;
  periodEnd: string;
  
  // Summary Data
  totalTransactions: number;
  completedTransactions: number;
  voidedTransactions: number;
  totalSales: number;
  cashRevenue: number;
  cardRevenue: number;
  totalRefunds: number;
  totalDiscounts: number;
  totalVariance: number;
  
  // Sync Status
  pendingTransactionsAtClose: number;
  syncStatus: 'clean' | 'warning';
  
  // Audit
  closedByUserId: string;
  closedByUserName: string;
  closedAt: string;
  
  createdAt: string;
}
```

#### 8.1.3 Day Close Shifts Table
```typescript
interface DayCloseShift {
  id: string;
  dayCloseId: string;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  openingFloat: number;
  closingCash: number;
  variance: number;
}
```

#### 8.1.4 Pending Carts Queue Table
```typescript
interface PendingCartQueue {
  id: string;
  storeId: string;
  cartId: string;
  cartData: string;  // JSON serialized cart
  operationalDate: string;  // Target day for restoration
  createdAt: string;
  expiresAt: string;
}
```

### 8.2 Modified Tables

#### 8.2.1 Stores Table
| Column | Type | Description |
|--------|------|-------------|
| operationalDayStartHour | integer | Hour when new operational day begins (0-23) |
| eodNotificationEmails | text[] | Email addresses for EOD alerts |

#### 8.2.2 Devices Table (or new)
| Column | Type | Description |
|--------|------|-------------|
| isMasterTerminal | boolean | Terminal can trigger EOD |
| masterTerminalName | string | Human-readable name |

#### 8.2.3 Transactions Table
| Column | Type | Description |
|--------|------|-------------|
| operationalDate | date | Date assigned for reporting |

### 8.3 Indexes Required
```
operational_days: (storeId, operationalDate) UNIQUE
day_closes: (storeId, operationalDate)
day_closes: (storeId, operationalDate, dayCloseNumber)
day_close_shifts: (dayCloseId)
transactions: (storeId, operationalDate, status)
pending_carts_queue: (storeId, operationalDate)
```

---

## 9. API Endpoints

### 9.1 Configuration Endpoints
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/stores/:id/eod-settings` | Get EOD configuration | Manager |
| PUT | `/api/v1/stores/:id/eod-settings` | Update EOD settings | Manager |
| GET | `/api/v1/devices/:id/master-status` | Check if device is master | Authenticated |
| PUT | `/api/v1/devices/:id/master-status` | Set device as master terminal | Manager |

### 9.2 EOD Operation Endpoints
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/day-close/preview` | Get pre-EOD summary data | Manager |
| POST | `/api/v1/day-close/execute` | Execute End of Day | Manager (Master Terminal) |
| GET | `/api/v1/day-close/:id` | Get day close record | Manager |
| GET | `/api/v1/day-close/:id/report/sales` | Get sales summary report | Manager |
| GET | `/api/v1/day-close/:id/report/cash` | Get cash reconciliation | Manager |
| GET | `/api/v1/day-close/:id/report/inventory` | Get inventory movement | Manager |
| GET | `/api/v1/day-close/:id/report/audit` | Get transaction audit log | Manager |
| GET | `/api/v1/day-close/:id/report/shifts` | Get shift aggregation | Manager |
| GET | `/api/v1/day-close/:id/export/pdf` | Export full report as PDF | Manager |
| GET | `/api/v1/day-close/:id/export/csv` | Export data as CSV | Manager |

### 9.3 History & Status Endpoints
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/day-close/history` | List historical day closes | Manager |
| GET | `/api/v1/day-close/sync-status` | Check pending sync count | Authenticated |
| POST | `/api/v1/day-close/:id/email` | Send reports via email | Manager |

### 9.4 Pending Carts Endpoints
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/pending-carts` | Get pending carts for next day | Authenticated |
| POST | `/api/v1/pending-carts/:id/restore` | Restore cart to active | Cashier |
| DELETE | `/api/v1/pending-carts/:id` | Void pending cart | Cashier |

---

## 10. Authorization Matrix

| Action | Cashier | Manager | Admin |
|--------|---------|---------|-------|
| View pre-EOD summary | ❌ | ✅ | ✅ |
| Execute EOD | ❌ | ✅ (Master Terminal only) | ✅ |
| View day close history | ❌ | ✅ (own store) | ✅ (all stores) |
| View day close details | ❌ | ✅ (own store) | ✅ (all stores) |
| Export EOD reports | ❌ | ✅ | ✅ |
| Email EOD reports | ❌ | ✅ | ✅ |
| Configure EOD settings | ❌ | ❌ | ✅ |
| Configure master terminals | ❌ | ❌ | ✅ |
| Restore pending carts | ✅ | ✅ | ✅ |
| Void pending carts | ✅ | ✅ | ✅ |

---

## 11. Offline Behavior

### 11.1 General Rule
**EOD can only be executed when ONLINE**

### 11.2 Pre-EOD Sync Check
- System must verify all offline transactions are synced
- Block EOD if pending transactions exist
- Error message: "X transactions pending sync. Please wait for sync to complete."

### 11.3 Post-EOD Offline
- Offline terminals receive "Day Closed" broadcast when they come online
- All terminals enter "Day Closed" mode
- Cashiers cannot process transactions until day reopens

---

## 12. Non-Functional Requirements

### 12.1 Performance
- EOD processing: <10 seconds for typical store (up to 500 transactions/day)
- Report generation: <5 seconds
- Report export (PDF): <10 seconds

### 12.2 Data Integrity
- All EOD operations must be atomic (all-or-nothing)
- Day Close Record cannot be deleted or modified
- Audit log captures all EOD-related actions
- Transaction records immutable after EOD

### 12.3 Security
- Only MANAGER role can trigger EOD
- Only on devices marked as master terminal
- All EOD actions logged to audit trail
- Email notifications sent from secure service

### 12.4 Reliability
- 99.9% uptime for EOD operations
- BroadcastChannel for multi-terminal sync
- Automatic retry for failed notifications

---

## 13. Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| User attempts EOD on non-master terminal | Show error: "Only master terminal can perform End of Day" |
| Pending offline transactions exist | Show error: "X transactions pending sync. Please wait." |
| Active shifts exist | Show error: "All shifts must be closed before EOD" |
| Incomplete carts exist | Auto-save to Pending Carts Queue, show confirmation |
| Network fails during EOD | Rollback entire EOD process, show error |
| User refreshes during EOD | Show "EOD in progress" state, prevent duplicate |
| EOD run at wrong time (before cutoff) | Allow, but show warning: "This is X hours before normal EOD time" |
| No transactions for the day | Allow EOD with zero values |
| EOD for store with 24-hour operations | Use configurable day boundary |

---

## 14. UI Mockups

### 14.1 EOD Trigger Button (Manager Dashboard)
```
┌─────────────────────────────────────────────┐
│  POS Dashboard                      [User: John Doe] │
├─────────────────────────────────────────────┤
│                                             │
│   Today's Sales: $4,892.50                  │
│   Transactions: 127                         │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │                                     │   │
│   │      [ 🏁 END OF DAY ]              │   │
│   │                                     │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Master Terminal: Manager Station          │
│                                             │
└─────────────────────────────────────────────┘
```

### 14.2 Pre-EOD Summary Screen
```
┌─────────────────────────────────────────────┐
│         END OF DAY - PREVIEW                 │
├─────────────────────────────────────────────┤
│ Store: Downtown Branch                      │
│ Operational Day: Jan 15, 2026                │
│ Period: Jan 15 6:00 AM → Jan 16 5:59 AM     │
├─────────────────────────────────────────────┤
│ TRANSACTIONS                                 │
│   Total: 127    Completed: 124    Voided: 3 │
├─────────────────────────────────────────────┤
│ REVENUE                                      │
│   Total Sales: $4,892.50                     │
│   Cash: $1,456.00    Card: $3,436.50         │
│   Refunds: $45.00    Discounts: $128.75      │
├─────────────────────────────────────────────┤
│ SHIFTS SUMMARY                               │
│   Active Shifts: 0 (All closed ✓)            │
│   Total Variance: -$2.30                     │
├─────────────────────────────────────────────┤
│ SYNC STATUS                                  │
│   Pending: 0 (All synced ✓)                  │
├─────────────────────────────────────────────┤
│ INCOMPLETE CARTS                             │
│   Auto-saved to Next Day Queue: 3 carts      │
├─────────────────────────────────────────────┤
│ [     CONFIRM END OF DAY     ]   [ CANCEL ]  │
│  Day will be closed. Cannot be undone.       │
└─────────────────────────────────────────────┘
```

### 14.3 Day Closed Screen (All Users)
```
┌─────────────────────────────────────────────┐
│              DAY CLOSED                      │
├─────────────────────────────────────────────┤
│                                             │
│     🛑 Operational day is closed.           │
│                                             │
│     Jan 15, 2026 is complete.               │
│                                             │
│     Please await instructions for           │
│     the next operational day.               │
│                                             │
│     Current Time: 6:15 AM Jan 16, 2026      │
│     Next day begins: 6:00 AM                │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Manager Options:                            │
│  [ VIEW DAY CLOSE REPORT ]                   │
│  [ DOWNLOAD PDF ]   [ DOWNLOAD CSV ]         │
│  [ EMAIL REPORTS ]                          │
│                                             │
└─────────────────────────────────────────────┘
```

### 14.4 EOD Configuration (Admin Panel)
```
┌─────────────────────────────────────────────┐
│      END OF DAY CONFIGURATION                │
│      Store: Downtown Branch                 │
├─────────────────────────────────────────────┤
│                                             │
│  OPERATIONAL DAY SETTINGS                    │
│                                             │
│  Day Start Hour:                            │
│  ┌────────────────────────────────┐         │
│  │ 6                              │         │
│  └────────────────────────────────┘         │
│  (Hour when new operational day begins)     │
│                                             │
│  Auto Day Transition:                       │
│  ☑ Enabled                                 │  Notification Emails:                       │
│ │
│                                             │
  ┌────────────────────────────────┐         │
│  │ manager@store.com              │         │
│  │ owner@company.com              │         │
│  └────────────────────────────────┘         │
│  (One email per line)                       │
│                                             │
│  [ SAVE SETTINGS ]                          │
│                                             │
├─────────────────────────────────────────────┤
│  MASTER TERMINALS                           │
│                                             │
│  Device ID        Name              Master  │
│  ─────────────────────────────────────────  │
│  TERM-001    Manager Station         ☑      │
│  TERM-002    POS Terminal 1          ☐      │
│  TERM-003    POS Terminal 2          ☐      │
│  TERM-004    POS Terminal 3          ☐      │
│                                             │
│  [ ADD MASTER TERMINAL ]                    │
│                                             │
└─────────────────────────────────────────────┘
```

### 14.5 Day Close History (Admin Panel)
```
┌─────────────────────────────────────────────┐
│      DAY CLOSE HISTORY                       │
│      Store: Downtown Branch                 │
├─────────────────────────────────────────────┤
│                                             │
│  [ 🔍 Filter by Date ]  [ 📅 This Month ]   │
│                                             │
│  Day Close #    Date          Closed By    │
│  ─────────────────────────────────────────  │
│  DC-20260115-001  Jan 15, 2026  John Doe    │
│  DC-20260114-001  Jan 14, 2026  Jane Smith  │
│  DC-20260113-001  Jan 13, 2026  John Doe    │
│  DC-20260112-001  Jan 12, 2026  Bob Wilson  │
│  DC-20260111-001  Jan 11, 2026  (Weekend)   │
│  DC-20260110-001  Jan 10, 2026  John Doe    │
│  DC-20260109-001  Jan 9, 2026   Jane Smith  │
│  DC-20260108-001  Jan 8, 2026   John Doe    │
│                                             │
│  [ VIEW ]  [ DOWNLOAD PDF ]  [ DOWNLOAD CSV ]│
│                                             │
└─────────────────────────────────────────────┘
```

---

## 15. Testing Strategy

| Test Case | Description |
|-----------|-------------|
| TC-01 | Manager triggers EOD with all synced data - Success |
| TC-02 | Manager triggers EOD with pending transactions - Blocked |
| TC-03 | Manager triggers EOD with active shifts - Blocked |
| TC-04 | Non-master terminal triggers EOD - Blocked |
| TC-05 | Cashier triggers EOD - Blocked |
| TC-06 | EOD generates all 5 reports correctly |
| TC-07 | PDF export works correctly |
| TC-08 | CSV export works correctly |
| TC-09 | Email notification sent after EOD |
| TC-10 | Incomplete carts auto-saved to queue |
| TC-11 | Pending carts restored at next day |
| TC-12 | Cashier cannot void transaction after EOD |
| TC-13 | Manager views historical day close records |
| TC-14 | Pre-EOD summary displays correct data |
| TC-15 | Multi-terminal sync broadcasts work |
| TC-16 | EOD at configured time works |
| TC-17 | EOD before configured time shows warning |

---

## 16. Future Enhancements (Out of Scope)

- **Auto-EOD**: Schedule EOD to run automatically at configured time
- **Multi-level approval**: Require two managers to approve EOD
- **EOD adjustment**: Allow creating "EOD adjustment" records for post-close corrections
- **Cloud backup**: Auto-upload day close data to cloud storage
- **Integration**: Sync with external accounting software (QuickBooks, Xero)
- **Cash drawer audit**: Photo capture of cash drawer at EOD
- **Timezone support**: Handle stores in different timezones
- **Partial day close**: Close day for specific terminals only
- **EOD report scheduling**: Auto-email reports to stakeholders

---

## 17. Dependencies

| Dependency | Description |
|------------|-------------|
| Authentication System | Existing auth middleware |
| Audit Logging | Existing audit trail feature |
| Scheduler | Existing offline sync scheduler |
| Shift Management | Existing shift system |
| Transaction System | Existing transaction processing |
| BroadcastChannel | Existing cross-tab sync |
| Email Service | Existing email infrastructure |
| PDF Generation | Library for PDF export |

---

## 18. Estimated Effort

| Phase | Effort | Deliverables | Status |
|-------|--------|--------------|--------|
| Phase 1: Core Infrastructure | 1 week | Database schema, API endpoints, EOD execution | ✅ Complete |
| Phase 2: Incomplete Cart Queue | 1 week | Pending carts table, auto-save logic, restoration | ✅ Complete |
| Phase 3: Reports Engine | 1 week | All 5 report types | ✅ Complete |
| Phase 4: Export & Notifications | 1 week | CSV export, email notifications | ✅ Complete |
| Phase 5: UI Integration | 1-2 weeks | Admin Panel pages, POS screens | ✅ Complete |
| Phase 6: Testing & Polish | 1 week | Testing, bug fixes, documentation | ⏳ Pending |
| **Total** | **5-6 weeks** | | **Phase 1-5 Complete** |

---

## 19. Implementation Status

### ✅ Phase 1: Core Infrastructure (COMPLETED)
- Database schema for operational_days, day_closes, day_close_shifts, pending_carts_queue, devices
- API endpoints for day-close operations, pending-carts management, devices
- EOD store for state management
- Types and interfaces in shared package

### ✅ Phase 2: Incomplete Cart Queue (COMPLETED)
- Cart serialization to JSON for pending carts queue
- Cart restoration from pending carts
- PendingCarts page UI for managing incomplete carts
- Integration with EOD flow to auto-save incomplete carts

### ✅ Phase 3: Reports Engine (COMPLETED)
- Daily Sales Summary report
- Cash Reconciliation report
- Inventory Movement report
- Transaction Audit Log report
- Shift Aggregation report
- DayCloseService with all report methods

### ✅ Phase 4: Export & Notifications (COMPLETED)
- CSV export for all 5 reports + combined export
- Email notification service with HTML/text templates
- API endpoints for export and email

### ✅ Phase 5: UI Integration (COMPLETED)
- EndOfDay page with pre-EOD summary ✅
- PreEODSummary component ✅
- EODConfirmationModal component ✅
- DayClosedOverlay component ✅
- EOD button on Dashboard ✅
- EOD Settings page (Admin) ✅
- Master Terminal configuration (Admin - now in Store Detail > Devices) ✅
- Day Close History (Admin - now in Store Detail > End of Day tab) ✅
- Day Close Detail page with reports ✅
- Unit tests
- Integration tests
- Bug fixes

> **Note (2026-02-15):** Navigation updated - Master Terminal and Day Close History are now accessed via **Store Detail page** tabs (Devices and End of Day respectively) instead of separate sidebar items.

---

## 20. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 16, 2026 | - | Initial version |
| 1.1 | Jan 16, 2026 | - | Updated with Phase 1 & 2 complete status |
| 1.2 | Jan 16, 2026 | - | Phase 3 Reports Engine complete |
| 1.3 | Jan 16, 2026 | - | Phase 4 Export & Notifications complete |
| 1.4 | Jan 16, 2026 | - | Phase 5 UI Integration complete |
| 1.5 | Feb 15, 2026 | - | Updated Master Terminal navigation - now under Store Detail > Devices tab with inline toggle |
