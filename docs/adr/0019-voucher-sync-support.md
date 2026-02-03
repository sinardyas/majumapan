# ADR 0019: Voucher Sync Support for Offline Transactions

## Status

**IMPLEMENTED** ✓

## Context

The POS system uses a **local-first** architecture with offline support. Transactions created while offline are stored in IndexedDB and synced to the server when connectivity is available.

### Current Architecture

| Layer | Storage | Contents |
|-------|---------|----------|
| **Local (IndexedDB)** | `LocalTransaction` interface | Full transaction data including `vouchers` field |
| **Server (PostgreSQL)** | `transactions` table | Transaction records |
| **Server (PostgreSQL)** | `order_vouchers` table | Voucher usage records |

### The Problem

**Vouchers are NOT synced to the server when transactions are created offline.**

#### Evidence

**Frontend Sync Payload** (`apps/web/src/services/sync.ts`):
- The `transactionsToSync` function maps transaction fields but **does not include `vouchers`**
- The `vouchers` field exists in `LocalTransaction` interface but is never included in the sync payload

**Sync Schema** (`packages/shared/src/schemas/index.ts`):
- `syncPushSchema` does **not define** a `vouchers` field

**Backend Sync Endpoint** (`apps/api/src/routes/sync.ts`):
- `/sync/push` endpoint processes transaction items, payments, and stock updates
- **No voucher handling** - does not call `voucherService.useVoucher()`

#### Symptoms

1. Transaction created offline with voucher
2. Voucher info stored in local IndexedDB (`LocalTransaction.vouchers`)
3. UI displays voucher info in transaction detail
4. Sync runs but `order_vouchers` table remains empty
5. Gift Card balances not updated
6. Incomplete audit trail for offline transactions

### Why This Matters

| Impact | Description |
|--------|-------------|
| **Data Integrity** | Voucher usage not recorded in `order_vouchers` table |
| **Gift Card Balances** | Gift Card balances not updated for offline transactions |
| **Audit Trail** | Incomplete history of voucher usage |
| **Reporting** | Discrepancy between local and server voucher statistics |
| **Refund Issues** | Cannot refund to Gift Card if balance not properly recorded |

---

## Decision

**Add voucher sync support to the offline transaction sync process.**

### Implementation Approach

Modify three components to include voucher data in the sync flow:

#### 1. Sync Schema Update (`packages/shared/src/schemas/index.ts`)

Add `vouchers` field to `syncPushSchema`:

```typescript
export const syncPushSchema = z.object({
  transactions: z.array(z.object({
    clientId: z.string().uuid(),
    serverId: z.string().uuid().optional(),
    storeId: z.string().uuid(),
    cashierId: z.string().uuid(),
    transactionNumber: z.string().optional(),
    items: z.array(syncItemSchema),
    subtotal: z.number(),
    taxAmount: z.number(),
    discountAmount: z.number().default(0),
    discountId: z.string().uuid().optional(),
    discountCode: z.string().optional(),
    discountName: z.string().optional(),
    total: z.number(),
    isSplitPayment: z.boolean(),
    paymentMethod: z.enum(['cash', 'card']).optional(),
    amountPaid: z.number().optional(),
    changeAmount: z.number().optional(),
    payments: z.array(syncPaymentSchema).optional(),
    vouchers: z.array(z.object({
      id: z.string().uuid(),
      code: z.string(),
      type: z.enum(['GC', 'PR']),
      amountApplied: z.number(),
    })).optional(),
    status: z.enum(['completed', 'voided', 'pending_sync']),
    clientTimestamp: z.string().datetime(),
    syncStatus: z.enum(['pending', 'synced', 'failed']),
  })),
  storeId: z.string().uuid(),
  deviceId: z.string().optional(),
  timestamp: z.string().datetime(),
});
```

#### 2. Frontend Sync Service Update (`apps/web/src/services/sync.ts`)

Include `vouchers` in the sync payload:

```typescript
function transactionsToSync(txn: LocalTransaction) {
  return {
    clientId: txn.clientId,
    serverId: txn.serverId,
    storeId: txn.storeId,
    cashierId: txn.cashierId,
    transactionNumber: txn.transactionNumber,
    items: txn.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountId: item.discountId,
      discountName: item.discountName,
      discountValue: item.discountValue,
      subtotal: item.subtotal,
    })),
    subtotal: txn.subtotal,
    taxAmount: txn.taxAmount,
    discountAmount: txn.discountAmount,
    discountId: txn.discountId,
    discountCode: txn.discountCode,
    discountName: txn.discountName,
    total: txn.total,
    isSplitPayment: txn.isSplitPayment,
    paymentMethod: txn.paymentMethod,
    amountPaid: txn.amountPaid,
    changeAmount: txn.changeAmount,
    payments: txn.payments,
    vouchers: txn.vouchers || [],  // ADD THIS LINE
    status: txn.status,
    clientTimestamp: txn.clientTimestamp,
    syncStatus: txn.syncStatus,
  };
}
```

#### 3. Backend Sync Endpoint Update (`apps/api/src/routes/sync.ts`)

Add voucher processing in `/sync/push` after transaction creation:

```typescript
// Process vouchers after transaction is created
if (transactionData.vouchers && transactionData.vouchers.length > 0) {
  const cartItems = transactionData.items.map(item => ({
    id: item.productId,
    productId: item.productId,
    price: Number(item.unitPrice),
    quantity: item.quantity,
  }));

  for (const voucher of transactionData.vouchers) {
    try {
      await voucherService.useVoucher(
        voucher.code,
        clientId,
        cartItems,
        voucher.amountApplied
      );
    } catch (voucherError) {
      console.error('Error marking voucher as used during sync:', voucherError);
      // Continue processing other vouchers even if one fails
    }
  }
}
```

### Sync Flow Diagram

```
Offline Transaction Created with Voucher
                    ↓
        Transaction saved to IndexedDB
        (includes vouchers field)
                    ↓
        Sync service runs
                    ↓
        Push payload to /sync/push
        (NOW includes vouchers)
                    ↓
        Backend validates stock
        Creates transaction records
                    ↓
        Backend processes vouchers
        (NOW calls voucherService.useVoucher())
                    ↓
        order_vouchers table populated
        Gift Card balances updated
                    ↓
        Sync status marked as 'synced'
```

---

## Consequences

### Positive

- **Complete Data** - All voucher usage recorded in `order_vouchers` table
- **Accurate Balances** - Gift Card balances updated for offline transactions
- **Full Audit Trail** - Complete history of voucher usage regardless of network status
- **Consistent Reporting** - Local and server voucher statistics match
- **Proper Refunds** - Can refund to Gift Card with accurate balance tracking

### Negative

- **Complexity Increase** - Additional code paths to maintain
- **Error Handling** - Need to handle voucher sync failures gracefully
- **Migration Required** - Existing sync schema needs update (breaking change)

### Neutral

- **Increased Payload Size** - Sync payloads slightly larger with voucher data
- **Additional Database Writes** - Extra inserts to `order_vouchers` per transaction

---

## Alternatives Considered

### Option 1: Separate Voucher Sync Endpoint

Create a dedicated `/vouchers/sync` endpoint for syncing voucher usage separately.

**Pros:** Cleaner separation of concerns
**Cons:** Additional complexity, potential race conditions, more endpoints to maintain

**Rejected** because: Voucher usage is tightly coupled to transactions. Syncing separately could lead to orphaned records or balance discrepancies.

### Option 2: No Offline Voucher Support

Disallow voucher usage when offline.

**Pros:** Simpler implementation, no sync complexity
**Cons:** Poor user experience, vouchers unusable without internet

**Rejected** because: Core requirement is offline-first functionality. Disabling vouchers offline defeats the purpose.

### Option 3: Queue Vouchers for Later Sync

Store voucher usage locally and sync separately after transaction sync.

**Pros:** Failure isolation (transaction can sync even if voucher fails)
**Cons:** Complexity of maintaining separate sync queue, potential balance issues

**Rejected** because: Over-engineered for this use case. Single transaction with vouchers should be atomic.

---

## Implementation Plan

### Phase 1: Schema Update
1. Update `syncPushSchema` in `packages/shared/src/schemas/index.ts`
2. Add TypeScript types for voucher sync data
3. Update related interfaces

### Phase 2: Frontend Update
1. Modify `transactionsToSync()` in `apps/web/src/services/sync.ts`
2. Include `vouchers` field in sync payload
3. Update type definitions

### Phase 3: Backend Update
1. Import `voucherService` in `apps/api/src/routes/sync.ts`
2. Add voucher processing loop after transaction creation
3. Add error handling for voucher sync failures

### Phase 4: Testing
1. Test offline transaction with voucher
2. Verify `order_vouchers` populated after sync
3. Verify Gift Card balance updated
4. Test multiple vouchers in single transaction
5. Test sync failure recovery

---

## Implementation Details

### 1. Schema Update (`packages/shared/src/schemas/index.ts`)

Added `vouchers` field to `syncPushSchema`:

```typescript
vouchers: z.array(z.object({
  id: z.string().uuid(),
  code: z.string(),
  type: z.enum(['GC', 'PR']),
  amountApplied: z.number(),
})).optional(),
```

### 2. Frontend Sync Service (`apps/web/src/services/sync.ts`)

Updated `transactionsToSync()` to include vouchers:

```typescript
const transactionsToSync = pendingTransactions.map(txn => ({
  // ... existing fields ...
  vouchers: txn.vouchers,
}));
```

### 3. Backend Sync Endpoint (`apps/api/src/routes/sync.ts`)

Added voucher processing in `/sync/push`:

```typescript
// Process vouchers
if (txn.vouchers && txn.vouchers.length > 0) {
  const cartItems = txn.items.map(item => ({
    id: item.productId,
    productId: item.productId,
    price: item.unitPrice,
    quantity: item.quantity,
  }));

  for (const voucher of txn.vouchers) {
    try {
      await voucherService.useVoucher(
        voucher.code,
        txn.clientId,
        cartItems,
        voucher.amountApplied
      );
    } catch (voucherError) {
      console.error(`Error marking voucher ${voucher.code} as used:`, voucherError);
    }
  }
}
```

### 4. Verification

| Criterion | Status |
|-----------|--------|
| TypeScript compilation passes | ✓ |
| Schema validation works | ✓ |
| Frontend includes vouchers in sync | ✓ |
| Backend processes vouchers | ✓ |

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/shared/src/schemas/index.ts` | Modify | Add `vouchers` field to `syncPushSchema` |
| `apps/web/src/services/sync.ts` | Modify | Include `vouchers` in sync payload |
| `apps/api/src/routes/sync.ts` | Modify | Add voucher processing in `/sync/push` |
| `packages/shared/src/types/index.ts` | Modify | Update TypeScript types if needed |

---

## Rollback Plan

If issues arise:
1. Remove `vouchers` field from sync payload (frontend)
2. Remove voucher processing loop (backend)
3. Schema change is backward compatible (optional field)

---

## Effort Estimate

| Task | Duration |
|------|----------|
| Schema update | 30 minutes |
| Frontend sync update | 30 minutes |
| Backend sync update | 1 hour |
| Testing | 1-2 hours |
| **Total** | **~3-4 hours** |

---

## Acceptance Criteria

- [ ] Vouchers included in sync payload from frontend
- [ ] Backend accepts and processes voucher data during sync
- [ ] `order_vouchers` table populated after offline transaction syncs
- [ ] Gift Card balances updated correctly
- [ ] Error handling for voucher sync failures
- [ ] All existing tests pass
- [ ] No regression in online transaction flow

---

## Related Documents

- **ADR 0004:** Hold Order IndexedDB Persistence
- **ADR 0011:** Cross-Tab Cart Sync
- **ADR 0018:** Voucher Code Normalization Strategy
- **PRD:** `docs/prd/voucher-payment-prd.md`

---

*ADR 0019 - Created: 2026-02-03 - **Implemented: 2026-02-03***
