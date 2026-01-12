# Product Requirements Document: Split Payment

## Document Information

| Attribute | Value |
|-----------|-------|
| **Feature** | Split Payment |
| **Status** | Draft |
| **Version** | 1.0 |
| **Created** | 2026-01-12 |
| **Priority** | P1 (Nice to Have) |

---

## 1. Executive Summary

### Overview

The Split Payment feature enables customers to pay for a single transaction using multiple payment methods (Cash + Card) within the same checkout. This addresses common customer scenarios where they need to combine payment types due to:

- Insufficient cash for full amount
- Card limit constraints
- Customer preference for splitting payment
- Business policy requiring split payments for large amounts

### Key Outcomes

- **Enhanced flexibility**: Support for Cash + Card combinations
- **Clear transparency**: Receipts show full payment breakdown
- **Reporting visibility**: Admin reports track split payment metrics
- **Backward compatibility**: Existing single-payment workflows unchanged

### Quick Reference

| Aspect | Description |
|--------|-------------|
| **Max payments** | 2 per transaction (1 Cash, 1 Card) |
| **Amount entry** | Manual by cashier |
| **Change handling** | Cashier specifies tendered amount |
| **Offline support** | Full offline capability with sync |
| **Receipt format** | Shows all payment methods |

---

## 2. Problem Statement

### Current State

The current POS system only supports **single payment per transaction**:

| Scenario | Current Behavior |
|----------|------------------|
| Customer wants to pay $50 cash + $30 card | Not supported |
| Customer has limited card balance | Transaction blocked |
| Business requires split for large amounts | Workaround needed |
| Customer wants exact cash usage | Manual calculations required |

### Pain Points

| Pain Point | Impact |
|------------|--------|
| **Transaction blocking** | Lost sales when customers can't pay with single method |
| **Manual workarounds** | Cashiers split into multiple transactions (administrative burden) |
| **Poor customer experience** | Customers feel inconvenienced by policy limitations |
| **No transparency** | No audit trail for why transactions were split |
| **Reporting gaps** | Cannot distinguish split payments from regular transactions |

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | Cashier | Split a $80 transaction into $50 cash + $30 card | I can complete sales when customer has limited payment options |
| US-02 | Cashier | See remaining amount while adding payments | I know how much more payment is needed |
| US-03 | Customer | Pay part cash and part card | I can use both payment methods based on my needs |
| US-04 | Manager | See split payment breakdown in reports | I can track cash vs card revenue accurately |
| US-05 | Admin | Filter transactions by payment type | I can reconcile payments for accounting |

---

## 3. Goals & Success Metrics

### Primary Goals

| Goal | Success Metric | Target |
|------|----------------|--------|
| Enable split payments | % of transactions using split payment | 5-10% of transactions |
| Reduce transaction blocking | Blocked transaction rate | <1% of attempted sales |
| Improve reporting | Split payment visibility | 100% of split payments in reports |
| Maintain UX | Payment completion time | <30 seconds |

### Secondary Goals

- Zero regression in single-payment workflows
- Clear receipt documentation
- Accurate change calculation
- Seamless offline operation

---

## 4. Requirements

### Functional Requirements

#### FR-01: Split Payment Execution

**Priority:** P0 (Must Have)

As a cashier, I want to split a transaction between cash and card so that customers can use multiple payment methods.

**Acceptance Criteria:**

| Criteria | Description |
|----------|-------------|
| FC-01.01 | Single transaction can have at most 1 cash and 1 card payment |
| FC-01.02 | Cashier can enter cash amount manually |
| FC-01.03 | Card amount auto-fills to remaining balance (editable) |
| FC-01.04 | "Complete Payment" button enabled only when fully paid |
| FC-01.05 | Toggle between single and split payment modes |
| FC-01.06 | Cashier can remove individual payments before completing |

#### FR-02: Change Calculation

**Priority:** P0 (Must Have)

As a cashier, I want accurate change calculation for cash portions so that customers receive correct change.

**Acceptance Criteria:**

| Criteria | Description |
|----------|-------------|
| FC-02.01 | Change calculated only from cash payment |
| FC-02.02 | Quick buttons: Exact Amount, Total Amount, Round Amount |
| FC-02.03 | Change display updates in real-time as amounts are entered |
| FC-02.04 | Change cannot exceed cash tendered amount |

#### FR-03: Receipt Generation

**Priority:** P0 (Must Have)

As a customer, I want a receipt showing all payment methods so that I have a record of my payment.

**Acceptance Criteria:**

| Criteria | Description |
|----------|-------------|
| FC-03.01 | Receipt shows each payment method and amount |
| FC-03.02 | Receipt shows change amount (if applicable) |
| FC-03.03 | Receipt format compatible with 80mm thermal printers |
| FC-03.04 | Offline receipts include sync status |

#### FR-04: Offline Support

**Priority:** P0 (Must Have)

As a cashier, I want to process split payments while offline so that I can continue sales during network outages.

**Acceptance Criteria:**

| Criteria | Description |
|----------|-------------|
| FC-04.01 | Split payment transactions can be created offline |
| FC-04.02 | Transaction saved to IndexedDB with sync status 'pending' |
| FC-04.03 | Sync scheduler uploads pending split transactions when online |
| FC-04.04 | Payment breakdown preserved during sync |
| FC-04.05 | Rejected split transactions shown in pending transactions list |

#### FR-05: Admin Reporting

**Priority:** P1 (Should Have)

As a manager, I want to see split payment breakdown in reports so that I can analyze payment method distribution.

**Acceptance Criteria:**

| Criteria | Description |
|----------|-------------|
| FC-05.01 | Transaction details show payment method breakdown |
| FC-05.02 | Daily sales report groups by payment type (Cash/Card/Split) |
| FC-05.03 | Filter transactions by payment type |
| FC-05.04 | Export reports include payment breakdown columns |

#### FR-06: Void Transactions

**Priority:** P1 (Should Have)

As a manager, I want to void transactions with split payments so that I can reverse incorrect transactions.

**Acceptance Criteria:**

| Criteria | Description |
|----------|-------------|
| FC-06.01 | Split payment transactions can be voided |
| FC-06.02 | Stock levels restored correctly |
| FC-06.03 | Void reason recorded in audit trail |

### Non-Functional Requirements

#### Performance

| Requirement | Target |
|-------------|--------|
| Payment modal open time | <500ms |
| Payment calculation | <100ms |
| Transaction save (local) | <200ms |
| Receipt render | <300ms |

#### Scalability

- Support 100+ concurrent split payment transactions
- Handle 50+ split payment transactions per store per day
- Efficient database queries with proper indexes

#### Security

- Payment data validated server-side
- No sensitive card data stored locally
- Audit log for all payment-related operations
- Role-based access for viewing payment details

#### Offline Behavior

- Full offline capability for split payments
- Automatic sync when connection restored
- Conflict resolution for conflicting offline changes
- Offline transactions clearly marked

---

## 5. User Experience

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPLIT PAYMENT WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CASHIER INITIATES PAYMENT                                   │
│     ├─ Cart total: $80.00                                       │
│     ├─ Clicks [Pay] button                                      │
│     └─ PaymentModal opens                                       │
│                                                                 │
│  2. SINGLE PAYMENT MODE (Default)                               │
│     ├─ Toggle: [☐ Split Payment]                               │
│     └─ Clicks toggle to enable split                            │
│                                                                 │
│  3. SPLIT PAYMENT MODE                                          │
│     ├─ Shows: "Remaining: $80.00"                               │
│     ├─ Cashier enters Cash amount: $50                          │
│     │  └─ Remaining updates to: $30                             │
│     ├─ Card button shows: $30 (auto-filled)                     │
│     ├─ Cashier can edit Card amount if needed                   │
│     └─ Click [Complete Payment] when remaining = 0              │
│                                                                 │
│  4. CONFIRMATION                                                │
│     ├─ Transaction saved to IndexedDB                           │
│     ├─ Receipt displayed                                        │
│     ├─ Stock levels decremented                                 │
│     └─ Cart cleared                                             │
│                                                                 │
│  5. OFFLINE HANDLING                                            │
│     ├─ If offline: syncStatus = 'pending'                       │
│     ├─ When online: sync scheduler uploads                      │
│     └─ User notified of sync status                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### UI Mockups

#### Payment Modal - Split Payment View

```
┌─────────────────────────────────────────────────────────────┐
│  [☐ Split Payment]                               Total: $80│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💰 CASH                               [✕]                  │
│  ┌─────────────────────────────────────────┐                │
│  │ $50.00                                  │                │
│  └─────────────────────────────────────────┘                │
│                                                             │
│  Quick: [Exact] [$60] [$80]                                  │
│  Change: $0.00                                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💳 CARD                               [✕]                  │
│  ┌─────────────────────────────────────────┐                │
│  │ $30.00  (auto-filled)                   │                │
│  └─────────────────────────────────────────┘                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💰 Cash $50 + 💳 Card $30 = $80 ✓                          │
│                                                             │
│  [ Cancel ]                 [ Complete Payment $80.00 ]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Receipt - Split Payment

```
┌────────────────────────────────────┐
│         RECEIPT #12345             │
│         Jan 12, 2026 10:30         │
├────────────────────────────────────┤
│ Item 1                    $50.00   │
│ Item 2                    $30.00   │
├────────────────────────────────────┤
│ Subtotal:                 $80.00   │
│ Tax (10%):                 $7.27   │
│ TOTAL:                    $87.27   │
├────────────────────────────────────┤
│ PAYMENT BREAKDOWN                 │
│ ──────────────────                 │
│ 💰 Cash:                 $50.00   │
│ 💳 Card:                 $37.27   │
│ ──────────────────                 │
│ Total Paid:              $87.27   │
├────────────────────────────────────┤
│ Thank you for your purchase!       │
└────────────────────────────────────┘
```

---

## 6. Data Model

### Database Schema

#### transactions Table (Modified)

```sql
ALTER TABLE transactions ADD COLUMN is_split_payment BOOLEAN DEFAULT FALSE;
```

#### transaction_payments Table (New)

```sql
CREATE TABLE transaction_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card')),
  amount DECIMAL(12, 2) NOT NULL,
  change_amount DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transaction_payments_transaction ON transaction_payments(transaction_id);
```

### TypeScript Interfaces

```typescript
// packages/shared/src/types/models.ts

export interface TransactionPayment {
  id: string;
  transactionId: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}

export interface Transaction {
  id: string;
  clientId: string;
  storeId: string;
  cashierId: string;
  transactionNumber: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountId?: string;
  discountCode?: string;
  discountName?: string;
  total: number;
  isSplitPayment: boolean;  // NEW
  paymentMethod?: 'cash' | 'card';  // NULL for split payments
  amountPaid?: number;  // NULL for split payments
  changeAmount?: number;  // NULL for split payments
  status: TransactionStatus;
  syncStatus: SyncStatus;
  rejectionReason?: string;
  rejectedAt?: Date;
  clientTimestamp: Date;
  createdAt: Date;
  payments?: TransactionPayment[];  // NEW - populated via join
}

// apps/web/src/db/index.ts

export interface LocalTransaction {
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
  isSplitPayment: boolean;  // NEW
  paymentMethod?: 'cash' | 'card';
  amountPaid?: number;
  changeAmount?: number;
  payments?: LocalPayment[];  // NEW
  status: 'completed' | 'voided' | 'pending_sync';
  syncStatus: 'pending' | 'synced' | 'failed' | 'rejected';
  rejectionReason?: string;
  clientTimestamp: string;
  createdAt: string;
}

export interface LocalPayment {
  id: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}
```

---

## 7. API Endpoints

### Create Transaction (Updated)

**Endpoint:** `POST /api/transactions`

**Request Body:**

```json
{
  "items": [...],
  "subtotal": 80.00,
  "taxAmount": 7.27,
  "discountAmount": 0,
  "total": 87.27,
  "isSplitPayment": true,
  "payments": [
    {
      "paymentMethod": "cash",
      "amount": 50.00,
      "changeAmount": 0
    },
    {
      "paymentMethod": "card",
      "amount": 37.27,
      "changeAmount": 0
    }
  ]
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "transactionNumber": "TXN-20250112-0001",
    "isSplitPayment": true,
    "payments": [
      {
        "id": "payment-uuid",
        "paymentMethod": "cash",
        "amount": 50.00,
        "changeAmount": 0
      },
      {
        "id": "payment-uuid",
        "paymentMethod": "card",
        "amount": 37.27,
        "changeAmount": 0
      }
    ],
    "items": [...]
  }
}
```

### Get Transaction (Updated)

**Endpoint:** `GET /api/transactions/:id`

**Response:**

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

### Get Receipt (Updated)

**Endpoint:** `GET /api/transactions/:id/receipt`

**Response:**

```json
{
  "success": true,
  "data": {
    "transaction": {...},
    "payment": {
      "isSplitPayment": true,
      "payments": [
        { "method": "cash", "amount": 50.00, "change": 0 },
        { "method": "card", "amount": 37.27 }
      ]
    },
    ...
  }
}
```

### Sync Push (Updated)

**Endpoint:** `POST /api/sync/push`

**Request includes split payment transactions with `payments` array.**

---

## 8. Authorization Matrix

| Action | Cashier | Manager | Admin |
|--------|---------|---------|-------|
| Create split payment | ✅ | ✅ | ✅ |
| View own split payments | ✅ | ✅ | ✅ |
| View store split payments | ❌ | ✅ | ✅ |
| View all split payments | ❌ | ❌ | ✅ |
| Void split payment | ❌ | ✅ | ✅ |
| Export split payment reports | ❌ | ✅ | ✅ |

---

## 9. Offline Behavior

### When Offline

| Action | Behavior |
|--------|----------|
| Create split payment | Save to IndexedDB with `syncStatus: 'pending'` |
| View pending split payments | Load from IndexedDB |
| Sync pending split payments | Scheduler syncs when online |
| Rejected split payment | Shown in pending transactions list with reason |

### Sync Strategy

| Priority | HIGH |
|----------|------|
| Retry logic | 3 attempts, then flag for manual review |
| Idempotency | By `clientId` |

---

## 10. Testing Strategy

### Test Cases

| ID | Test Case | Description |
|----|-----------|-------------|
| TC-01 | Single payment flow | Existing single payment still works |
| TC-02 | Split payment - cash + card | Complete split transaction |
| TC-03 | Change calculation | Cash with change |
| TC-04 | Overpayment handling | Prevent exceeding total |
| TC-05 | Payment removal | Remove cash, add again |
| TC-06 | Offline split payment | Create offline, sync when online |
| TC-07 | Receipt generation | Receipt shows all payments |
| TC-08 | Void split payment | Manager voids transaction |
| TC-09 | Admin reports | Reports show split breakdown |
| TC-10 | Data consistency | Sync preserves payment data |

---

## 11. Dependencies

### External Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| PostgreSQL | Database for transaction storage | Existing |
| IndexedDB | Client-side storage for offline | Existing |
| Drizzle ORM | Database schema | Existing |

### Internal Dependencies

| Dependency | Status |
|------------|--------|
| Transaction creation | Complete |
| Receipt generation | Complete |
| Offline sync | Complete |
| Authentication | Complete |
| Authorization (RBAC) | Complete |

---

## 12. Future Enhancements (Out of Scope)

- Multiple cash payments (e.g., $30 + $20 cash)
- Multiple card payments (e.g., split across cards)
- Split by item (pay for specific items with different methods)
- Installment payments / payment plans
- Refund to different payment methods
- Payment scheduling / deposits
- Integration with external payment gateways

---

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | - | Initial version |

---

## 14. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Split Payment | Transaction paid with multiple payment methods |
| Single Payment | Traditional transaction with one payment method |
| Remaining Amount | Amount still owed after current payments |
| Payment Breakdown | Detailed view of payment methods in a transaction |

### References

- **FSD**: [Split Payment FSD](../features/split-payment.md) - Technical implementation details
- **Transaction Schema**: `apps/api/src/db/schema.ts`
- **Shared Types**: `packages/shared/src/types/models.ts`
