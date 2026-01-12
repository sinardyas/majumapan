# Feature Specification: Split Payment

## Status

**Planned** - Not yet implemented

> **Business Context**: See [Split Payment PRD](../prd/split-payment-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

## Overview

Enable split payments in a single transaction using Cash + Card combinations. Supports manual amount entry, automatic remaining balance calculation, receipt generation with payment breakdown, and full offline capability.

## Use Case

**Scenario**: A customer wants to pay for a $80 purchase but only has $50 in cash and wants to use their card for the rest.

1. Cashier rings up items (total: $80)
2. Cashier clicks "Pay" and toggles "Split Payment"
3. Cashier enters $50 cash amount
4. System auto-fills card with $30 (remaining)
5. Cashier confirms payment
6. Transaction saved with both payment records
7. Receipt printed showing both payment methods

---

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Max payments per transaction | 2 (1 Cash, 1 Card) |
| Amount entry | Manual by cashier |
| Card amount | Auto-fills to remaining (editable) |
| Change handling | Cashier enters tendered amount, system calculates change |
| Offline support | Full offline capability with sync |
| Receipt format | Shows payment breakdown |

---

## Data Model

### IndexedDB (Dexie) - Version 8

```typescript
// apps/web/src/db/index.ts

interface LocalPayment {
  id: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}

interface LocalTransaction {
  clientId: string;
  serverId?: string;
  storeId: string;
  cashierId: string;
  transactionNumber?: string;
  items: LocalTransactionItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountId?: string;
  discountCode?: string;
  discountName?: string;
  total: number;
  isSplitPayment: boolean;
  paymentMethod?: 'cash' | 'card';
  amountPaid?: number;
  changeAmount?: number;
  payments?: LocalPayment[];
  status: 'completed' | 'voided' | 'pending_sync';
  syncStatus: 'pending' | 'synced' | 'failed' | 'rejected';
  rejectionReason?: string;
  clientTimestamp: string;
  createdAt: string;
}

class PosDatabase extends Dexie {
  transactions!: Dexie.Table<LocalTransaction, string>;
  transactionPayments!: Dexie.Table<LocalPayment & { transactionId: string }, string>;

  constructor() {
    super('pos-database');

    this.version(8).stores({
      transactions: 'clientId, storeId, cashierId, status, syncStatus, clientTimestamp',
      transactionPayments: 'id, transactionId, paymentMethod',
    });
  }
}
```

### PostgreSQL (Drizzle)

```typescript
// apps/api/src/db/schema.ts

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id', { length: 100 }).notNull().unique(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  cashierId: uuid('cashier_id').references(() => users.id).notNull(),
  transactionNumber: varchar('transaction_number', { length: 50 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  discountId: uuid('discount_id').references(() => discounts.id),
  discountCode: varchar('discount_code', { length: 50 }),
  discountName: varchar('discount_name', { length: 255 }),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  isSplitPayment: boolean('is_split_payment').default(false).notNull(),
  paymentMethod: paymentMethodEnum('payment_method'),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }),
  changeAmount: decimal('change_amount', { precision: 12, scale: 2 }),
  status: transactionStatusEnum('status').default('completed').notNull(),
  syncStatus: syncStatusEnum('sync_status').default('synced').notNull(),
  rejectionReason: text('rejection_reason'),
  rejectedAt: timestamp('rejected_at'),
  clientTimestamp: timestamp('client_timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_transactions_store').on(table.storeId),
  index('idx_transactions_cashier').on(table.cashierId),
  index('idx_transactions_date').on(table.createdAt),
  index('idx_transactions_client_id').on(table.clientId),
  index('idx_transactions_is_split').on(table.isSplitPayment),
]);

export const transactionPayments = pgTable('transaction_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id')
    .references(() => transactions.id, { onDelete: 'cascade' })
    .notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  changeAmount: decimal('change_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_transaction_payments_transaction').on(table.transactionId),
]);
```

### API Types

```typescript
// packages/api/src/types.ts

export interface Payment {
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount?: number;
}

export interface TransactionApi {
  createTransaction(data: {
    items: TransactionItem[];
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    discountId?: string;
    discountCode?: string;
    discountName?: string;
    total: number;
    isSplitPayment: boolean;
    payments?: Payment[];
  }): Promise<ApiResponse<{ transaction: Transaction }>>;

  getTransaction(id: string): Promise<ApiResponse<{ transaction: Transaction }>>;
}

export interface SyncApi {
  pushTransactions(transactions: LocalTransaction[]): Promise<ApiResponse<{
    synced: Array<{ clientId: string; serverId: string; transactionNumber: string }>;
    rejected: Array<{ clientId: string; reason: string }>;
  }>>;
}
```

---

## User Flows

### Flow 1: Split Payment with Cash + Card

```
1. Cashier clicks [Pay] button on CurrentOrder
2. PaymentModal opens (single payment mode by default)
3. Cashier toggles "Split Payment" switch
4. System displays split payment view:
   - Remaining: $80.00
   - Cash payment section (empty)
   - Card payment section (empty)
5. Cashier enters cash amount: $50
6. System calculates remaining: $30
7. Card amount auto-fills to $30
8. Cashier can optionally edit card amount
9. Cashier clicks [Complete Payment]
10. System validates: paid >= total
11. Transaction created with both payments
12. Receipt displayed with payment breakdown
```

### Flow 2: Split Payment - Remove Payment

```
1. Cashier adds cash payment: $50 (Remaining: $30)
2. Card auto-filled: $30 (Remaining: $0)
3. Cashier realizes wrong amount
4. Cashier clicks [✕] on cash payment
5. Cash payment removed
6. Remaining updates to: $50
7. Card amount clears
8. Cashier re-enters correct cash amount
```

### Flow 3: Offline Split Payment

```
1. Network goes offline
2. Cashier creates split payment transaction
3. Transaction saved to IndexedDB:
   - syncStatus: 'pending'
   - payments stored locally
4. Transaction appears in pending list
5. Network restored
6. Sync scheduler picks up pending transaction
7. Transaction synced to server
8. syncStatus updates to 'synced'
```

---

## User Interface

### PaymentModal Component

```
Props:
- isOpen: boolean
- onClose: () => void
- onConfirm: (payments: Payment[], isSplitPayment: boolean) => void
- total: number

State:
- isSplitPayment: boolean
- cashAmount: string
- cardAmount: string
- cashChange: number
- isProcessing: boolean
- error: string | null

Calculated:
- remaining = total - cashAmount - cardAmount
- isFullyPaid = remaining <= 0
```

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                       │
│ [☐ Split Payment]                               Total: $80 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Remaining: $30                                [✕ Clear]   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💰 CASH PAYMENT                                [✕]        │
│  ┌─────────────────────────────────────────┐                │
│  │ $50.00                                  │                │
│  └─────────────────────────────────────────┘                │
│                                                             │
│  Quick: [Exact] [$60] [$80]                                  │
│  Change: $0.00                                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💳 CARD PAYMENT                                [✕]        │
│  ┌─────────────────────────────────────────┐                │
│  │ $30.00  (auto-filled to remaining)      │                │
│  └─────────────────────────────────────────┘                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Summary                                                    │
│  💰 Cash $50 + 💳 Card $30 = $80 ✓                          │
│                                                             │
│  [ Cancel ]                 [ Complete Payment ]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### PaymentItem Component

```
Props:
- paymentMethod: 'cash' | 'card'
- amount: number
- changeAmount: number
- onRemove: () => void

Render:
┌─────────────────────────────────────────────────────────┐
│  [icon] Method Name                          [✕] $50.00 │
└─────────────────────────────────────────────────────────┘
```

### QuickAmountButtons Component

```
Props:
- total: number
- onSelect: (amount: number) => void

Buttons:
- Exact: Math.ceil(total) or exact total if decimal
- Round Up 5: Math.ceil(total / 5) * 5
- Round Up 10: Math.ceil(total / 10) * 10
- Total: total
```

---

## API Endpoints

### POST /api/transactions

Request:
```json
{
  "items": [...],
  "subtotal": 80.00,
  "taxAmount": 7.27,
  "discountAmount": 0,
  "total": 87.27,
  "isSplitPayment": true,
  "payments": [
    { "paymentMethod": "cash", "amount": 50.00, "changeAmount": 0 },
    { "paymentMethod": "card", "amount": 37.27 }
  ]
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "transactionNumber": "TXN-20250112-0001",
    "isSplitPayment": true,
    "payments": [
      { "id": "payment-uuid", "paymentMethod": "cash", "amount": 50.00, "changeAmount": 0 },
      { "id": "payment-uuid", "paymentMethod": "card", "amount": 37.27, "changeAmount": 0 }
    ],
    "items": [...]
  }
}
```

Error (400):
```json
{
  "success": false,
  "error": "Payments do not match total"
}
```

### GET /api/transactions/:id

Response (200):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "transactionNumber": "TXN-20250112-0001",
    "isSplitPayment": true,
    "payments": [...],
    ...
  }
}
```

### GET /api/transactions/:id/receipt

Response (200):
```json
{
  "success": true,
  "data": {
    "store": { "name": "Main Store", "address": "123 Main St" },
    "transaction": {
      "number": "TXN-20250112-0001",
      "date": "2026-01-12",
      "time": "10:30:00"
    },
    "items": [...],
    "summary": {
      "subtotal": 80.00,
      "taxAmount": 7.27,
      "total": 87.27
    },
    "payment": {
      "isSplitPayment": true,
      "payments": [
        { "method": "cash", "amountTendered": 50.00, "change": 0 },
        { "method": "card", "amountTendered": 37.27 }
      ],
      "totalPaid": 87.27
    }
  }
}
```

### POST /api/sync/push

Request includes transactions with `isSplitPayment: true` and `payments` array.

---

## Offline Behavior

### Creating Split Payment Offline

```typescript
// apps/web/src/services/sync.ts

async function createSplitPaymentOffline(
  transaction: LocalTransaction,
  payments: LocalPayment[]
): Promise<void> {
  // Save transaction
  await db.transactions.add(transaction);

  // Save payments with transaction reference
  for (const payment of payments) {
    await db.transactionPayments.add({
      ...payment,
      transactionId: transaction.clientId,
    });
  }

  // Mark for sync
  await syncScheduler.add('transaction', transaction.clientId);
}
```

### Sync Scheduler

```typescript
// apps/web/src/services/sync.ts

class SyncService {
  async syncSplitPayments(): Promise<void> {
    const pendingTransactions = await db.transactions
      .where('syncStatus')
      .equals('pending')
      .toArray();

    for (const transaction of pendingTransactions) {
      const payments = await db.transactionPayments
        .where('transactionId')
        .equals(transaction.clientId)
        .toArray();

      try {
        const response = await apiClient.pushTransactions([{
          ...transaction,
          isSplitPayment: true,
          payments,
        }]);

        if (response.success) {
          await db.transactions.update(transaction.clientId, {
            syncStatus: 'synced',
            serverId: response.data.synced[0].serverId,
          });
        }
      } catch (error) {
        await db.transactions.update(transaction.clientId, {
          syncStatus: 'failed',
        });
      }
    }
  }
}
```

---

## Implementation Tasks

| ID | Description | Files | Priority |
|----|-------------|-------|----------|
| T-01 | Add `isSplitPayment` column to transactions table | `schema.ts` | P0 |
| T-02 | Create `transaction_payments` table | `schema.ts` | P0 |
| T-03 | Create database migration | `drizzle/*.sql` | P0 |
| T-04 | Add `TransactionPayment` type | `packages/shared/src/types/models.ts` | P0 |
| T-05 | Update `createTransactionSchema` | `packages/shared/src/schemas/index.ts` | P0 |
| T-06 | Update `LocalTransaction` interface | `apps/web/src/db/index.ts` | P0 |
| T-07 | Add `transactionPayments` table to Dexie | `apps/web/src/db/index.ts` | P0 |
| T-08 | Update POST /transactions endpoint | `apps/api/src/routes/transactions.ts` | P0 |
| T-09 | Update GET /transactions/:id endpoint | `apps/api/src/routes/transactions.ts` | P0 |
| T-10 | Update receipt endpoint | `apps/api/src/routes/transactions.ts` | P0 |
| T-11 | Update sync push for split payments | `apps/api/src/routes/sync.ts` | P0 |
| T-12 | Redesign PaymentModal | `apps/web/src/components/pos/PaymentModal.tsx` | P0 |
| T-13 | Add PaymentItem component | `apps/web/src/components/pos/PaymentItem.tsx` | P1 |
| T-14 | Add QuickAmountButtons component | `apps/web/src/components/pos/QuickAmountButtons.tsx` | P1 |
| T-15 | Update handlePaymentConfirm | `apps/web/src/pages/POS.tsx` | P0 |
| T-16 | Update Receipt for split payments | `apps/web/src/components/pos/Receipt.tsx` | P0 |
| T-17 | Update offline sync for split payments | `apps/web/src/services/sync.ts` | P0 |
| T-18 | Add admin report filter by payment type | `apps/admin/src/pages/Reports.tsx` | P1 |
| T-19 | Add payment breakdown to admin API | `apps/api/src/routes/reports.ts` | P1 |
| T-20 | Unit tests for payment calculation | `apps/web/src/__tests__/payment.test.ts` | P1 |
| T-21 | Integration tests for API | `apps/api/src/__tests__/transactions.test.ts` | P1 |

---

## Testing Strategy

| Test Case | Description |
|-----------|-------------|
| TC-01 | Single payment flow still works |
| TC-02 | Split payment - cash + card |
| TC-03 | Change calculation (cash > total) |
| TC-04 | Change calculation (cash = total) |
| TC-05 | Overpayment warning |
| TC-06 | Remove cash payment |
| TC-07 | Remove card payment |
| TC-08 | Remove all payments |
| TC-09 | Edit cash amount |
| TC-10 | Edit card amount |
| TC-11 | Offline split payment creation |
| TC-12 | Offline split payment sync |
| TC-13 | Receipt shows all payments |
| TC-14 | Void split payment |
| TC-15 | Admin reports show split breakdown |

---

## Files to Create

```
apps/web/src/
├── components/
│   └── pos/
│       ├── PaymentItem.tsx           # Individual payment display
│       └── QuickAmountButtons.tsx    # Quick cash amount buttons

apps/api/drizzle/
└── XXXX_split_payments.sql           # Database migration
```

## Files to Modify

```
apps/api/src/
├── db/
│   └── schema.ts                     # Add columns + new table
└── routes/
    ├── transactions.ts               # Update endpoints
    └── sync.ts                       # Update sync push

apps/web/src/
├── db/
│   └── index.ts                      # Update types + IndexedDB
├── components/
│   └── pos/
│       ├── PaymentModal.tsx          # Complete redesign
│       └── Receipt.tsx               # Update for split payments
├── pages/
│   └── POS.tsx                       # Update payment handling
└── services/
    └── sync.ts                       # Update offline sync

packages/shared/src/
├── types/
│   └── models.ts                     # Add TransactionPayment type
├── schemas/
│   └── index.ts                      # Update schemas
└── constants/
    └── index.ts                      # Add constants

apps/admin/src/
├── pages/
│   └── Reports.tsx                   # Add payment breakdown
└── services/
    └── api.ts                        # Update API calls
```

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Database & Schema | 4 hours |
| API Endpoints | 6 hours |
| Frontend Types & Storage | 4 hours |
| Payment Modal UI | 12 hours |
| Integration | 4 hours |
| Admin Reports | 6 hours |
| Testing | 6 hours |
| **Total** | **42 hours (~1 week)** |

---

## Dependencies

| Dependency | Description |
|------------|-------------|
| Transaction CRUD | Existing endpoint |
| Receipt generation | Existing component |
| Offline sync | Existing scheduler |
| IndexedDB | Existing Dexie setup |
| Drizzle | Existing database setup |
| BroadcastChannel | Existing cross-tab sync |

---

## Backwards Compatibility

- Single payment transactions: `isSplitPayment = false`, no `payments` array
- API accepts both old and new formats
- PaymentModal defaults to single payment mode
- Existing receipts unchanged
- Offline sync works for both formats

---

## Security Considerations

- Validate payment amounts server-side
- Ensure total of payments equals transaction total
- No sensitive card data stored
- Audit log for all payment operations
- Role-based access for payment details
