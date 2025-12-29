# Feature Specification: Hold Order

## Status

**Implemented** - Completed on 2024-12-29

## Overview

The Hold Order feature allows cashiers to temporarily save an in-progress order and serve other customers. This is useful when a customer needs to step away (e.g., forgot wallet, needs to get more items) but intends to return and complete their purchase.

## Use Case

**Scenario**: A customer is ordering at the cashier but needs to temporarily pause. The cashier should be able to:

1. **Hold** the current order (save it temporarily)
2. **Serve** the next customer with a fresh cart
3. **Resume** the held order later to complete the transaction

## Requirements

| Requirement | Decision |
|-------------|----------|
| Customer name/note | Optional |
| Auto-expiration | 24 hours |
| Maximum held orders | No limit |
| Resume with items in cart | Replace current cart (with confirmation) |
| Discount handling | Re-validate when resumed |
| Multi-cashier visibility | No (cashier sees only their own held orders) |
| Toast notifications | Use existing Toast component |
| Auto-hold naming | Timestamp (e.g., "Order at 2:45 PM") |

## Data Model

### HeldOrder Interface

```typescript
// apps/web/src/db/index.ts

interface HeldOrderItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountId?: string;
  discountName?: string;
  discountValue: number;
  subtotal: number;
}

interface HeldOrderDiscount {
  id: string;
  code: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  amount: number;
}

interface HeldOrder {
  id: string;                    // Unique ID (UUID)
  storeId: string;               // Store this order belongs to
  cashierId: string;             // Cashier who held the order
  customerName?: string;         // Optional customer name/reference
  note?: string;                 // Optional note (e.g., "Went to ATM")
  items: HeldOrderItem[];
  cartDiscount: HeldOrderDiscount | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  heldAt: string;                // ISO timestamp when held
  expiresAt: string;             // ISO timestamp for expiration (heldAt + 24 hours)
}
```

### Database Schema

New table added to IndexedDB (Dexie) in Version 4:

```typescript
this.version(4).stores({
  // ... existing tables unchanged
  heldOrders: 'id, storeId, cashierId, heldAt, expiresAt',
});
```

## User Flows

### Flow 1: Hold an Order

```
1. Cashier has items in cart
2. Customer says "I need to step out for a moment"
3. Cashier clicks [Hold Order] button
4. HoldOrderModal appears with optional fields:
   - Customer name input (placeholder: "Customer name or reference")
   - Note textarea (placeholder: "Add a note...")
5. Cashier enters "John - Table 5" and note "Went to ATM"
6. Clicks [Hold Order]
7. System:
   - Generates UUID for held order
   - Sets expiresAt = now + 24 hours
   - Saves to IndexedDB (heldOrders table)
   - Clears cart
8. Toast appears: "Order held successfully"
9. Held orders badge updates in header icon
10. Cashier can now serve next customer
```

### Flow 2: Resume an Order (Empty Cart)

```
1. Cashier clicks held orders icon button in cart header
2. HeldOrdersList modal opens
3. Shows list filtered to current cashier's orders only
4. Cashier sees "John - Table 5" order:
   - 3 items - $49.50
   - "5 minutes ago"
   - Note: Went to ATM
5. Clicks [Resume]
6. System:
   - Fetches held order from IndexedDB
   - Re-validates discount (if any was applied)
   - Loads items into cart
   - Deletes held order from IndexedDB
7. Modal closes
8. Cart header shows: "Resumed: John - Table 5"
9. Toast appears: "Order resumed"
10. Cashier completes payment as normal
```

### Flow 3: Resume an Order (Cart Has Items)

```
1. Cashier has items in current cart
2. Clicks held orders icon in cart header
3. HeldOrdersList modal opens
4. Clicks [Resume] on a held order
5. ResumeConfirmModal appears:
   "Your current cart has 3 items ($25.00). This will be cleared."
   [Cancel] [Replace Cart]
6a. If "Cancel":
    - Modal closes
    - No changes
6b. If "Replace Cart":
    - Current cart cleared (not held)
    - Held order loaded into cart
    - Held order deleted from IndexedDB
7. Toast appears: "Order resumed"
```

### Flow 4: Discount Re-validation Warning

```
1. Cashier resumes order that had "SUMMER15" discount applied
2. System checks discount validity:
   - Does discount still exist?
   - Is it still active?
   - Is it within valid date range?
   - Has usage limit been reached?
3. Discount has expired (endDate passed)
4. System:
   - Loads cart items WITHOUT the discount
   - Recalculates totals
5. Toast warning: "Discount 'SUMMER15' is no longer valid and was removed"
6. Cashier can apply a different discount if needed
```

### Flow 5: Delete a Held Order

```
1. Cashier opens HeldOrdersList modal
2. Clicks [Delete] on an order
3. Inline confirmation appears: "Delete this held order? This cannot be undone."
   [Cancel] [Delete]
4. Clicks [Delete]
5. System deletes order from IndexedDB
6. Toast appears: "Held order deleted"
7. List updates
```

### Flow 6: Auto-Expiration Cleanup

```
1. Cashier opens POS page
2. System runs cleanup on mount:
   - Queries heldOrders where expiresAt < now
   - Deletes all expired orders
3. Only valid (non-expired) orders shown in list
```

## UI Design

### Cart Section with Hold Feature

```
┌─────────────────────────────────────┐
│ Current Order              [📋 (2)]│  ← Icon button with badge in header
│ (Resumed: John - Table 5)          │  ← Shown only if resumed
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Wireless Earbuds            │    │
│  │ $49.99 each                 │    │
│  │ [-] 1 [+]           $49.99  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ USB-C Cable                 │    │
│  │ $12.99 each                 │    │
│  │ [-] 2 [+]           $25.98  │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│ [Discount code input] [Apply]       │
├─────────────────────────────────────┤
│ Subtotal                    $75.97  │
│ Tax (10%)                    $7.60  │
│ Total                       $83.57  │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │      Pay $83.57             │    │
│  └─────────────────────────────┘    │
│  ┌──────────────┐ ┌─────────────┐   │
│  │ Hold Order   │ │ Clear Cart  │   │
│  └──────────────┘ └─────────────┘   │
└─────────────────────────────────────┘
```

### Hold Order Modal

```
┌─────────────────────────────────────┐
│ Hold Order                       ✕  │
├─────────────────────────────────────┤
│                                     │
│ Save this order to serve other      │
│ customers. You can resume it later. │
│                                     │
│ Customer Name (optional)            │
│ ┌─────────────────────────────────┐ │
│ │ Customer name or reference      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Note (optional)                     │
│ ┌─────────────────────────────────┐ │
│ │ Add a note...                   │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│           [Cancel]  [Hold Order]    │
└─────────────────────────────────────┘
```

### Held Orders List Modal

```
┌─────────────────────────────────────┐
│ Held Orders                      ✕  │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ John - Table 5        5 min ago │ │
│ │ 3 items - $49.50                │ │
│ │ Note: Went to ATM               │ │
│ │                                 │ │
│ │        [Resume]  [Delete]       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Order at 2:45 PM     12 min ago │ │
│ │ 1 item - $12.99                 │ │
│ │                                 │ │
│ │        [Resume]  [Delete]       │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│  Orders automatically expire after  │
│  24 hours                           │
└─────────────────────────────────────┘
```

### Resume Confirm Modal

```
┌─────────────────────────────────────┐
│ Replace Current Cart?            ✕  │
├─────────────────────────────────────┤
│                                     │
│            ⚠️ (warning icon)        │
│                                     │
│  Your current cart has 3 items      │
│  ($25.00). This will be cleared.    │
│                                     │
├─────────────────────────────────────┤
│           [Cancel]  [Replace Cart]  │
└─────────────────────────────────────┘
```

### Delete Confirmation (Inline)

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │ John - Table 5        5 min ago │ │
│ │ 3 items - $49.50                │ │
│ │                                 │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ Delete this held order?     │ │ │
│ │ │ This cannot be undone.      │ │ │
│ │ │                             │ │ │
│ │ │    [Cancel]  [Delete]       │ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Empty Held Orders State

```
┌─────────────────────────────────────┐
│ Held Orders                      ✕  │
├─────────────────────────────────────┤
│                                     │
│         ┌───────────────┐           │
│         │   📋          │           │
│         └───────────────┘           │
│                                     │
│         No held orders              │
│                                     │
│    Hold an order to serve other     │
│    customers and resume later       │
│                                     │
├─────────────────────────────────────┤
│  Orders automatically expire after  │
│  24 hours                           │
└─────────────────────────────────────┘
```

## Implementation Summary

### Files Created/Modified

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `apps/web/src/db/index.ts` | Modified | Added `HeldOrder`, `HeldOrderItem`, `HeldOrderDiscount` interfaces; Version 4 schema with `heldOrders` table; 6 helper functions |
| 2 | `apps/web/src/stores/cartStore.ts` | Modified | Added `holdOrder`, `resumeOrder` actions; `resumedOrderInfo` state; `ResumedOrderInfo` and `ResumeOrderResult` interfaces |
| 3 | `apps/web/src/components/pos/HoldOrderModal.tsx` | Created | Modal for holding order with optional customer name and note |
| 4 | `apps/web/src/components/pos/HeldOrdersList.tsx` | Created | Modal listing held orders with resume/delete actions and inline delete confirmation |
| 5 | `apps/web/src/components/pos/ResumeConfirmModal.tsx` | Created | Confirmation modal for cart replacement with warning icon |
| 6 | `apps/web/src/pages/POS.tsx` | Modified | Integrated all components; added held orders icon button in cart header |
| 7 | `apps/web/package.json` | Modified | Added `date-fns` dependency for relative time formatting |

### Database Helper Functions

```typescript
// apps/web/src/db/index.ts

// Save a held order to IndexedDB
saveHeldOrder(order: HeldOrder): Promise<string>

// Get a specific held order by ID
getHeldOrder(id: string): Promise<HeldOrder | undefined>

// Get all held orders for a specific cashier (filtered by expiration)
getHeldOrdersForCashier(storeId: string, cashierId: string): Promise<HeldOrder[]>

// Get count of held orders for a specific cashier
getHeldOrdersCount(storeId: string, cashierId: string): Promise<number>

// Delete a specific held order
deleteHeldOrder(id: string): Promise<void>

// Delete all expired held orders (returns count deleted)
deleteExpiredHeldOrders(): Promise<number>
```

### Cart Store Actions

```typescript
// apps/web/src/stores/cartStore.ts

// Hold current cart and save to IndexedDB
holdOrder(
  storeId: string,
  cashierId: string,
  customerName?: string,
  note?: string
): Promise<string>

// Resume a held order with discount re-validation
resumeOrder(
  heldOrderId: string,
  revalidateDiscount: (discount: CartDiscount) => Promise<boolean>
): Promise<ResumeOrderResult>

// Clear resumed order info from state
clearResumedOrderInfo(): void
```

### POS Page Integration

Key additions to `apps/web/src/pages/POS.tsx`:

1. **State variables**: `showHoldModal`, `showHeldOrdersList`, `showResumeConfirm`, `heldOrdersCount`, `pendingResumeOrderId`, `isHolding`

2. **Effects**:
   - Initialize held orders on mount (cleanup expired + load count)

3. **Handler functions**:
   - `revalidateDiscount()` - Check if discount is still valid
   - `handleHoldOrder()` - Hold current cart
   - `executeResume()` - Execute the resume operation
   - `handleResumeOrder()` - Handle resume with cart check
   - `handleConfirmResume()` - Confirm cart replacement
   - `handleDeleteHeldOrder()` - Delete a held order

4. **UI elements**:
   - Icon button with badge in cart header
   - "Hold Order" and "Clear Cart" buttons side by side
   - Three modals: HoldOrderModal, HeldOrdersList, ResumeConfirmModal

### Dependencies Added

```json
{
  "date-fns": "^4.1.0"
}
```

Used for:
- `format()` - Format held order timestamp as "Order at 2:45 PM"
- `formatDistanceToNow()` - Display relative time like "5 minutes ago"

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Page refresh with held orders | Persisted in IndexedDB, survives refresh |
| Browser crash | Persisted in IndexedDB |
| Hold empty cart | "Hold Order" button disabled when cart is empty |
| Expired held orders | Cleaned up automatically on POS page mount |
| Discount expired between hold and resume | Re-validated on resume, warning toast shown if invalid |
| Resume order from different cashier | Not visible (filtered by cashier ID) |
| Resume with items in cart | Confirmation modal shown, cart replaced if confirmed |
| Delete held order | Inline confirmation before deletion |
| Network offline | Works fully offline (IndexedDB is local) |

## Testing Scenarios

1. **Basic hold and resume**: Hold order, resume it, verify items restored correctly
2. **Hold with customer name**: Verify name displayed in list and cart header
3. **Hold with note**: Verify note displayed in list
4. **Resume with empty cart**: Should resume without confirmation
5. **Resume with items in cart**: Should show confirmation dialog
6. **Discount preservation**: Hold order with discount, resume, verify discount applied
7. **Discount expiration**: Hold order with discount, expire discount, resume, verify warning
8. **Multiple held orders**: Hold several orders, verify all listed
9. **Delete held order**: Delete order, verify removed from list after confirmation
10. **Expiration cleanup**: Create expired order (mock), verify cleanup removes it
11. **Cashier isolation**: Login as different cashier, verify cannot see other's held orders
12. **Page refresh**: Hold order, refresh page, verify order still in list
13. **Empty state**: No held orders, verify empty state displayed
14. **Badge count**: Verify badge updates correctly after hold/resume/delete

## Related Documents

- **ADR-0004**: Hold Order IndexedDB Persistence (architectural decision)
