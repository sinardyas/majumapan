# Functional Specifications Document (FSD)

## View Transaction Details in Day Close History

| Document Info | |
|---------------|--|
| **Project** | Majumapan POS |
| **Feature** | Day Close Transaction Details |
| **Version** | 1.0 |
| **Status** | Draft |
| **Parent PRD** | `../prd/prd-day-close-transactions.md` |
| **Created** | 2026-01-26 |

---

## 1. Architecture Overview

### 1.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Day Close Detail Page                          │
├─────────────────────────────────────────────────────────────┤
│  [Summary Cards]  [Download CSV]  [Email Report]            │
├──────────────┬──────────┬──────────┬──────────┬────────────┤
│  Sales Tab   │ Cash Tab │Inventory │ Audit Tab│ (existing) │
└──────────────┴──────────┴──────────┴──────────┴────────────┘
```

### 1.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Day Close Detail Page                          │
├─────────────────────────────────────────────────────────────┤
│  [Summary Cards]  [Download CSV]  [Email Report]            │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│  Sales   │ Cash     │Inventory │ Audit    │ Transactions   │ ← NEW TAB
│  Tab     │ Tab      │ Tab      │ Tab      │ Tab            │
│          │          │          │          │                │
│          │          │          │          │ - List         │
│          │          │          │          │ - Expandable   │
│          │          │          │          │ - Pagination   │
│          │          │          │          │ - Filtering    │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
├─────────────────────────────────────────────────────────────┤
│  GET /day-close/:id/transactions    ← NEW                   │
│  GET /day-close/:id/transactions/:txId ← NEW                │
│  GET /day-close/:id/transactions/:txId/items ← NEW          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database                                 │
├───────────────────────────┬─────────────────────────────────┤
│  transactions             │  transaction_items              │
│  - id                     │  - id                           │
│  - transaction_number     │  - transaction_id               │
│  - store_id               │  - product_name                 │
│  - cashier_id             │  - product_sku                  │
│  - created_at             │  - quantity                     │
│  - subtotal               │  - unit_price                   │
│  - tax_amount             │  - subtotal                     │
│  - discount_amount        │  - discount_value               │
│  - total                  │                                 │
│  - payment_method         │                                 │
│  - status                 │                                 │
└───────────────────────────┴─────────────────────────────────┘
```

---

## 2. API Changes

### 2.1 New Endpoints

#### 2.1.1 GET /day-close/:id/transactions

**Purpose:** Get paginated list of transactions for a day close

**Authentication:** `authMiddleware`, `requireRole('manager', 'admin')`

**Query Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number (1-indexed) |
| pageSize | integer | No | 25 | Transactions per page |
| status | string | No | - | Filter by status ('completed', 'voided', 'pending_sync') |
| paymentMethod | string | No | - | Filter by payment ('cash', 'card') |
| search | string | No | - | Search by transaction number or cashier name |

**Response:**
```typescript
{
  success: true,
  data: {
    transactions: TransactionSummary[],
    summary: {
      total: number,
      completed: number,
      voided: number,
      totalAmount: number,
      totalRefunds: number
    },
    pagination: {
      page: number,
      pageSize: number,
      total: number,
      totalPages: number
    }
  }
}
```

**TransactionSummary Type:**
```typescript
interface TransactionSummary {
  id: string;
  transactionNumber: string;
  createdAt: string; // ISO 8601
  cashierName: string;
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  status: 'completed' | 'voided' | 'pending_sync';
}
```

**Implementation Logic:**
```typescript
// 1. Get day close record to find store_id, period_start, period_end
const dayClose = await db.query.dayCloses.findFirst({
  where: eq(dayCloses.id, dayCloseId),
  with: { store: true }
});

// 2. Build query conditions
const conditions = [
  eq(transactions.storeId, dayClose.storeId),
  gte(transactions.createdAt, dayClose.periodStart),
  lte(transactions.createdAt, dayClose.periodEnd)
];

// 3. Apply filters (status, paymentMethod, search)

// 4. Query with pagination
const transactions = await db.query.transactions.findMany({
  where: and(...conditions),
  limit: pageSize,
  offset: (page - 1) * pageSize,
  orderBy: [desc(transactions.createdAt)]
});

// 5. Get counts for summary (separate queries or WITH ROLLUP)
const [counts] = await db.select({
  total: sql<number>`COUNT(*)`,
  completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
  voided: sql<number>`SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END)`,
  totalAmount: sql<number>`COALESCE(SUM(total), 0)`,
  totalRefunds: sql<number>`COALESCE(SUM(CASE WHEN status = 'voided' THEN total ELSE 0 END), 0)`
}).from(transactions).where(and(...conditions));
```

#### 2.1.2 GET /day-close/:id/transactions/:txId

**Purpose:** Get full transaction details including payment info

**Response:**
```typescript
{
  success: true,
  data: {
    transaction: TransactionDetail,
    items: TransactionItem[],
    payment: TransactionPayment
  }
}
```

**TransactionDetail Type:**
```typescript
interface TransactionDetail {
  id: string;
  transactionNumber: string;
  createdAt: string;
  cashierId: string;
  cashierName: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  amountPaid: number;
  changeAmount: number;
  status: 'completed' | 'voided' | 'pending_sync';
  voidReason?: string;
}
```

**TransactionItem Type:**
```typescript
interface TransactionItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  subtotal: number;
}
```

**TransactionPayment Type:**
```typescript
interface TransactionPayment {
  id: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}
```

#### 2.1.3 GET /day-close/:id/transactions/:txId/items

**Purpose:** Get paginated line items for a transaction (for transactions with many items)

**Query Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number |
| pageSize | integer | No | 20 | Items per page |

**Response:**
```typescript
{
  success: true,
  data: {
    items: TransactionItem[],
    pagination: {
      page: number,
      pageSize: number,
      total: number,
      totalPages: number
    }
  }
}
```

---

## 3. Frontend Components

### 3.1 File Structure

```
apps/admin/src/
├── pages/
│   └── DayCloseDetail.tsx  ← Modify: Add Transactions tab
└── components/
    └── day-close/
        ├── TransactionsTab.tsx        ← NEW
        ├── TransactionRow.tsx         ← NEW
        └── TransactionLineItems.tsx   ← NEW
```

### 3.2 TransactionsTab Component

**File:** `apps/admin/src/components/day-close/TransactionsTab.tsx`

**Props:**
```typescript
interface TransactionsTabProps {
  dayCloseId: string;
  storeId: string;
  periodStart: string;
  periodEnd: string;
}
```

**State:**
```typescript
const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
const [summary, setSummary] = useState<TransactionSummary>();
const [pagination, setPagination] = useState<PaginationState>();
const [filters, setFilters] = useState({
  status: 'all',
  paymentMethod: 'all',
  search: ''
});
const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
```

**UI Structure:**
```tsx
return (
  <div className="space-y-4">
    {/* Summary Cards */}
    <div className="grid grid-cols-5 gap-4">
      <SummaryCard title="Total" value={summary?.total} />
      <SummaryCard title="Completed" value={summary?.completed} highlight="green" />
      <SummaryCard title="Voided" value={summary?.voided} highlight="red" />
      <SummaryCard title="Total Sales" value={formatCurrency(summary?.totalAmount)} />
      <SummaryCard title="Refunds" value={formatCurrency(summary?.totalRefunds)} />
    </div>

    {/* Filters */}
    <div className="flex gap-4">
      <Select value={filters.status} onChange={...}>
        <option value="all">All Status</option>
        <option value="completed">Completed</option>
        <option value="voided">Voided</option>
        <option value="pending_sync">Pending Sync</option>
      </Select>
      <Select value={filters.paymentMethod} onChange={...}>
        <option value="all">All Payments</option>
        <option value="cash">Cash</option>
        <option value="card">Card</option>
      </Select>
      <Input
        placeholder="Search transaction or cashier..."
        value={filters.search}
        onChange={...}
      />
    </div>

    {/* Transaction List */}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Transaction</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Cashier</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(tx => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            isExpanded={expandedTxId === tx.id}
            onToggle={() => setExpandedTxId(
              expandedTxId === tx.id ? null : tx.id
            )}
          />
        ))}
      </TableBody>
    </Table>

    {/* Pagination */}
    <Pagination
      currentPage={pagination?.page}
      totalPages={pagination?.totalPages}
      onPageChange={...}
    />
  </div>
);
```

### 3.3 TransactionRow Component

**File:** `apps/admin/src/components/day-close/TransactionRow.tsx`

**Props:**
```typescript
interface TransactionRowProps {
  transaction: TransactionSummary;
  isExpanded: boolean;
  onToggle: () => void;
}
```

**UI Design:**
```tsx
return (
  <>
    <TableRow
      className={cn(
        "cursor-pointer hover:bg-gray-50",
        transaction.status === 'voided' && "bg-red-50 hover:bg-red-100"
      )}
      onClick={onToggle}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">
            #{transaction.transactionNumber}
          </span>
          {transaction.status === 'voided' && (
            <Badge variant="destructive">VOIDED</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {formatTime(transaction.createdAt)}
      </TableCell>
      <TableCell>{transaction.cashierName}</TableCell>
      <TableCell>{transaction.itemCount}</TableCell>
      <TableCell className="font-medium">
        {formatCurrency(transaction.total)}
      </TableCell>
      <TableCell>
        <Badge variant={transaction.paymentMethod === 'cash' ? 'outline' : 'secondary'}>
          {transaction.paymentMethod}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={transaction.status === 'completed' ? 'success' : 'secondary'}>
          {transaction.status}
        </Badge>
      </TableCell>
      <TableCell>
        {isExpanded ? <ChevronUp /> : <ChevronDown />}
      </TableCell>
    </TableRow>

    {isExpanded && (
      <TableRow className="bg-gray-50">
        <TableCell colSpan={8}>
          <TransactionLineItems
            dayCloseId={dayCloseId}
            transactionId={transaction.id}
          />
        </TableCell>
      </TableRow>
    )}
  </>
);
```

### 3.4 TransactionLineItems Component

**File:** `apps/admin/src/components/day-close/TransactionLineItems.tsx`

**Props:**
```typescript
interface TransactionLineItemsProps {
  dayCloseId: string;
  transactionId: string;
}
```

**State:**
```typescript
const [items, setItems] = useState<TransactionItem[]>([]);
const [pagination, setPagination] = useState<PaginationState>();
const [loading, setLoading] = useState(true);
```

**UI Structure:**
```tsx
return (
  <div className="p-4">
    {/* Transaction Details */}
    <div className="mb-4 text-sm">
      <p><strong>Subtotal:</strong> {formatCurrency(transaction.subtotal)}</p>
      <p><strong>Tax:</strong> {formatCurrency(transaction.taxAmount)}</p>
      <p><strong>Discount:</strong> {formatCurrency(transaction.discountAmount)}</p>
      <p className="font-bold"><strong>Total:</strong> {formatCurrency(transaction.total)}</p>
    </div>

    {/* Line Items Table */}
    <Table size="sm">
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Unit Price</TableHead>
          <TableHead className="text-right">Discount</TableHead>
          <TableHead className="text-right">Subtotal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => (
          <TableRow key={item.id}>
            <TableCell>{item.productName}</TableCell>
            <TableCell className="font-mono text-xs">{item.productSku}</TableCell>
            <TableCell className="text-right">{item.quantity}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
            <TableCell className="text-right text-red-500">
              -{formatCurrency(item.discountValue)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(item.subtotal)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    {/* Line Items Pagination */}
    <div className="mt-2 flex justify-between items-center text-sm text-gray-500">
      <span>Items {startItem}-{endItem} of {pagination?.total}</span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={pagination?.page === 1}
          onClick={() => loadItems(pagination?.page - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pagination?.page === pagination?.totalPages}
          onClick={() => loadItems(pagination?.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  </div>
);
```

### 3.5 Update DayCloseDetail Page

**File:** `apps/admin/src/pages/DayCloseDetail.tsx`

**Changes:**
1. Import new tab icons and components
2. Add Transactions tab to tab navigation
3. Render TransactionsTab when tab === 'transactions'

```tsx
// Add to imports
import { Transactions, Receipt } from 'lucide-react';
import TransactionsTab from '@/components/day-close/TransactionsTab';

// Add to tab definitions
const tabs = [
  { id: 'sales', label: 'Sales', icon: DollarSign },
  { id: 'cash', label: 'Cash', icon: CreditCard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'audit', label: 'Audit', icon: FileText },
  { id: 'transactions', label: 'Transactions', icon: Receipt }, // NEW
];

// Add tab content
{tabs.map(tab => (
  <TabsContent key={tab.id} value={tab.id}>
    {tab.id === 'transactions' ? (
      <TransactionsTab
        dayCloseId={dayClose.id}
        storeId={dayClose.storeId}
        periodStart={dayClose.periodStart}
        periodEnd={dayClose.periodEnd}
      />
    ) : (
      // Existing tab content...
    )}
  </TabsContent>
))}
```

---

## 4. Shared Types

### 4.1 Add to models.ts

**File:** `packages/shared/src/types/models.ts`

```typescript
export interface TransactionSummary {
  id: string;
  transactionNumber: string;
  createdAt: string;
  cashierName: string;
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  status: 'completed' | 'voided' | 'pending_sync';
}

export interface TransactionDetail extends TransactionSummary {
  cashierId: string;
  amountPaid: number;
  changeAmount: number;
  voidReason?: string;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  subtotal: number;
}

export interface TransactionPayment {
  id: string;
  transactionId: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}

export interface TransactionListResponse {
  transactions: TransactionSummary[];
  summary: {
    total: number;
    completed: number;
    voided: number;
    totalAmount: number;
    totalRefunds: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface TransactionDetailResponse {
  transaction: TransactionDetail;
  items: TransactionItem[];
  payment: TransactionPayment;
}

export interface TransactionItemsResponse {
  items: TransactionItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

---

## 5. Data Flow

### 5.1 Transaction List Flow

```
1. User clicks "Transactions" tab
2. Component mounts, calls GET /day-close/:id/transactions
3. API queries transactions by store_id + period_start/period_end
4. API returns paginated list with summary
5. Component renders table
6. User clicks expand → State updates, TransactionLineItems renders
7. User clicks filter → State updates, API called with new params
```

### 5.2 Expand Transaction Flow

```
1. User clicks transaction row
2. onToggle() called, expandedTxId state updated
3. TransactionRow renders expanded section
4. TransactionLineItems component mounts
5. Line items loaded via GET /day-close/:id/transactions/:txId/items
6. User can paginate through line items
```

---

## 6. Error Handling

### 6.1 API Errors

| Error | Response | User Message |
|-------|----------|--------------|
| 401 Unauthorized | 401 | Please log in again |
| 403 Forbidden | 403 | You don't have permission to view this data |
| 404 Not Found | 404 | Day close not found |
| 500 Server Error | 500 | Failed to load transactions |

### 6.2 Frontend Errors

- Show error toast on API failure
- Retry button for failed loads
- Empty state for no transactions found

---

## 7. Testing Requirements

### 7.1 Unit Tests

| Component | Test Cases |
|-----------|------------|
| API - GET /transactions | Returns correct data, applies filters, handles pagination |
| API - GET /transactions/:txId | Returns full transaction details |
| API - GET /transactions/:txId/items | Returns paginated line items |
| TransactionsTab | Renders summary, filters, pagination |
| TransactionRow | Expands/collapses, shows voided styling |
| TransactionLineItems | Loads items, paginates |

### 7.2 Integration Tests

| Scenario | Expected Result |
|----------|-----------------|
| Load transactions for a day close | All transactions for the period shown |
| Filter by voided status | Only voided transactions shown |
| Search by transaction number | Matching transaction(s) shown |
| Expand a transaction | Line items loaded and displayed |
| Paginate transactions | Correct page of transactions shown |
| Voided transaction styling | Red background, "VOIDED" badge |

### 7.3 Manual Testing

- Test with day close having 0 transactions
- Test with day close having 500+ transactions
- Test with transaction having 50+ line items
- Test all filter combinations
- Test keyboard navigation

---

## 8. Security Considerations

### 8.1 Access Control

- All endpoints require authentication
- All endpoints require 'admin' or 'manager' role
- Managers can only access their own store's data (enforced by existing logic)

### 8.2 Data Protection

- No sensitive data in transaction items (no customer info)
- Transaction totals visible but payment details limited
- Audit logging already exists for day close access

---

## 9. Deployment Checklist

### 9.1 Pre-Deployment

- [ ] API endpoints implemented and tested
- [ ] Frontend components implemented and tested
- [ ] TypeScript types added
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Linting passing

### 9.2 Deployment Steps

1. Deploy API changes
2. Deploy Admin UI changes
3. Verify day close detail page loads
4. Verify transactions tab works

### 9.3 Post-Deployment Verification

- [ ] Can view transactions for a day close
- [ ] Voided transactions shown prominently
- [ ] Filtering works correctly
- [ ] Pagination works correctly
- [ ] Expandable rows show line items
- [ ] Line items pagination works

---

## 10. Rollback Plan

### 10.1 API Rollback

- Revert API code changes
- Deploy previous version
- Transactions tab will show error but other tabs work

### 10.2 Frontend Rollback

- Deploy previous Admin UI
- Transactions tab removed, other tabs unaffected

---

## 11. File Reference Summary

### New Files

| File | Purpose |
|------|---------|
| `apps/admin/src/components/day-close/TransactionsTab.tsx` | Main transactions tab component |
| `apps/admin/src/components/day-close/TransactionRow.tsx` | Expandable transaction row |
| `apps/admin/src/components/day-close/TransactionLineItems.tsx` | Paginated line items |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/routes/day-close.ts` | Add transaction endpoints |
| `apps/api/src/services/day-close-service.ts` | Add query functions |
| `packages/shared/src/types/models.ts` | Add transaction types |
| `apps/admin/src/pages/DayCloseDetail.tsx` | Add Transactions tab |

### Documentation Files

| File | Purpose |
|------|---------|
| `docs/prd/prd-day-close-transactions.md` | Product requirements |
| `docs/features/fsd-day-close-transactions.md` | This document |

---

## 12. Implementation Tasks

### Phase 1: Backend API

| Task | Description | File | Status |
|------|-------------|------|--------|
| 1.1 | Add GET /day-close/:id/transactions endpoint | `apps/api/src/routes/day-close.ts` | ☐ |
| 1.2 | Add query params handling (filters, pagination) | `apps/api/src/routes/day-close.ts` | ☐ |
| 1.3 | Add getDayCloseTransactions service function | `apps/api/src/services/day-close-service.ts` | ☐ |
| 1.4 | Add GET /day-close/:id/transactions/:txId endpoint | `apps/api/src/routes/day-close.ts` | ☐ |
| 1.5 | Add GET /day-close/:id/transactions/:txId/items endpoint | `apps/api/src/routes/day-close.ts` | ☐ |
| 1.6 | Add Transaction types to shared models | `packages/shared/src/types/models.ts` | ☐ |

### Phase 2: Frontend Components

| Task | Description | File | Status |
|------|-------------|------|--------|
| 2.1 | Create TransactionsTab component | `apps/admin/src/components/day-close/TransactionsTab.tsx` | ☐ |
| 2.2 | Create TransactionRow component | `apps/admin/src/components/day-close/TransactionRow.tsx` | ☐ |
| 2.3 | Create TransactionLineItems component | `apps/admin/src/components/day-close/TransactionLineItems.tsx` | ☐ |
| 2.4 | Add Transactions tab to DayCloseDetail | `apps/admin/src/pages/DayCloseDetail.tsx` | ☐ |

### Phase 3: Testing

| Task | Description | Status |
|------|-------------|--------|
| 3.1 | Unit tests for API endpoints | ☐ |
| 3.2 | Integration tests for components | ☐ |
| 3.3 | Manual testing | ☐ |

### Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1 | 6 tasks | ☐ Pending |
| 2 | 4 tasks | ☐ Pending |
| 3 | 3 tasks | ☐ Pending |
| **Total** | **13 tasks** | |

---

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Platform Team | Initial draft |
