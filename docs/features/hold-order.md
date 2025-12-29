# Feature Specification: Hold Order

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
interface HeldOrder {
  id: string;                    // Unique ID (UUID)
  storeId: string;               // Store this order belongs to
  cashierId: string;             // Cashier who held the order
  customerName?: string;         // Optional customer name/reference
  note?: string;                 // Optional note (e.g., "Went to ATM")
  items: Array<{
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    discountId?: string;
    discountName?: string;
    discountValue: number;
    subtotal: number;
  }>;
  cartDiscount: {
    id: string;
    code: string;
    name: string;
    discountType: 'percentage' | 'fixed';
    value: number;
    amount: number;
  } | null;
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
6. Clicks [Hold]
7. System:
   - Generates UUID for held order
   - Sets expiresAt = now + 24 hours
   - Saves to IndexedDB (heldOrders table)
   - Clears cart
8. Toast appears: "Order held successfully"
9. Held orders badge updates: [Held Orders (1)]
10. Cashier can now serve next customer
```

### Flow 2: Resume an Order (Empty Cart)

```
1. Cashier clicks [Held Orders (1)] button
2. HeldOrdersList modal opens
3. Shows list filtered to current cashier's orders only
4. Cashier sees "John - Table 5" order:
   - 3 items - $49.50
   - "5 mins ago"
   - Note: "Went to ATM"
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
2. Clicks [Held Orders (2)] button
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
3. Confirmation dialog: "Delete this held order? This cannot be undone."
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
│ Current Order                       │
│ (Resumed: John - Table 5)           │  ← Shown only if resumed
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
│  ┌─────────────────────────────┐    │
│  │    Held Orders (2)          │    │  ← Badge shows count
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
│ │ John - Table 5                  │ │
│ │ 3 items - $49.50                │ │
│ │ 5 mins ago                      │ │
│ │ Note: Went to ATM               │ │
│ │                                 │ │
│ │        [Resume]  [Delete]       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Order at 2:45 PM                │ │
│ │ 1 item - $12.99                 │ │
│ │ 12 mins ago                     │ │
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
│  Your current cart has 3 items      │
│  ($25.00). This will be cleared.    │
│                                     │
├─────────────────────────────────────┤
│           [Cancel]  [Replace Cart]  │
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
└─────────────────────────────────────┘
```

## Implementation Tasks

### Task 1: Update Database Schema

**File:** `apps/web/src/db/index.ts`

**Changes:**
1. Add `HeldOrder` interface (exported)
2. Add `heldOrders` table to `PosDatabase` class
3. Add Version 4 schema with new table
4. Add helper functions:
   - `saveHeldOrder(order: HeldOrder): Promise<string>`
   - `getHeldOrdersForCashier(storeId: string, cashierId: string): Promise<HeldOrder[]>`
   - `getHeldOrder(id: string): Promise<HeldOrder | undefined>`
   - `deleteHeldOrder(id: string): Promise<void>`
   - `deleteExpiredHeldOrders(): Promise<number>`
   - `getHeldOrdersCount(storeId: string, cashierId: string): Promise<number>`

---

### Task 2: Update Cart Store

**File:** `apps/web/src/stores/cartStore.ts`

**Changes:**
1. Add state:
   - `resumedOrderInfo: { id: string; customerName?: string } | null`

2. Add actions:
   - `holdOrder(storeId: string, cashierId: string, customerName?: string, note?: string): Promise<string>`
   - `resumeOrder(heldOrderId: string, revalidateDiscount: (discount: CartDiscount) => Promise<boolean>): Promise<{ success: boolean; discountRemoved?: boolean; discountName?: string }>`
   - `clearResumedOrderInfo(): void`

---

### Task 3: Create HoldOrderModal Component

**File:** `apps/web/src/components/pos/HoldOrderModal.tsx`

**Props:**
```typescript
interface HoldOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHold: (customerName?: string, note?: string) => void;
  isLoading?: boolean;
}
```

**Features:**
- Customer name input (optional)
- Note textarea (optional)
- Cancel and Hold buttons
- Loading state while saving

---

### Task 4: Create HeldOrdersList Component

**File:** `apps/web/src/components/pos/HeldOrdersList.tsx`

**Props:**
```typescript
interface HeldOrdersListProps {
  isOpen: boolean;
  onClose: () => void;
  onResume: (heldOrderId: string) => void;
  onDelete: (heldOrderId: string) => void;
  storeId: string;
  cashierId: string;
}
```

**Features:**
- Fetch and display held orders for current cashier
- Show customer name or auto-generated timestamp name
- Show item count, total, relative time, note
- Resume and Delete buttons per order
- Empty state
- Expiration notice footer
- Delete confirmation

---

### Task 5: Create ResumeConfirmModal Component

**File:** `apps/web/src/components/pos/ResumeConfirmModal.tsx`

**Props:**
```typescript
interface ResumeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentCartItemCount: number;
  currentCartTotal: number;
}
```

**Features:**
- Warning message about cart replacement
- Cancel and Replace Cart buttons

---

### Task 6: Update POS Page

**File:** `apps/web/src/pages/POS.tsx`

**Changes:**

1. **Add state:**
   ```typescript
   const [showHoldModal, setShowHoldModal] = useState(false);
   const [showHeldOrdersList, setShowHeldOrdersList] = useState(false);
   const [showResumeConfirm, setShowResumeConfirm] = useState(false);
   const [heldOrdersCount, setHeldOrdersCount] = useState(0);
   const [pendingResumeOrderId, setPendingResumeOrderId] = useState<string | null>(null);
   ```

2. **Add effects:**
   - Load held orders count on mount
   - Update count after hold/resume/delete
   - Clean up expired orders on mount

3. **Add discount re-validation function:**
   ```typescript
   const revalidateDiscount = async (discount: CartDiscount): Promise<boolean> => {
     // Check if discount exists and is valid
     // Return true if valid, false if not
   };
   ```

4. **Update Cart Header:**
   - Show resumed order info when applicable

5. **Add UI elements:**
   - "Held Orders (X)" button with badge
   - "Hold Order" button (disabled when cart empty)

6. **Add modals:**
   - HoldOrderModal
   - HeldOrdersList  
   - ResumeConfirmModal

7. **Add toast notifications:**
   - Success: "Order held successfully"
   - Success: "Order resumed"
   - Success: "Held order deleted"
   - Warning: "Discount '[name]' is no longer valid and was removed"

## File Summary

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `apps/web/src/db/index.ts` | Modify | Add HeldOrder interface, Version 4 schema, helper functions |
| 2 | `apps/web/src/stores/cartStore.ts` | Modify | Add holdOrder, resumeOrder actions, resumedOrderInfo state |
| 3 | `apps/web/src/components/pos/HoldOrderModal.tsx` | Create | Modal for holding order with optional name/note |
| 4 | `apps/web/src/components/pos/HeldOrdersList.tsx` | Create | Modal listing held orders with resume/delete actions |
| 5 | `apps/web/src/components/pos/ResumeConfirmModal.tsx` | Create | Confirmation modal for cart replacement |
| 6 | `apps/web/src/pages/POS.tsx` | Modify | Integrate all components and functionality |

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Page refresh with held orders | Persisted in IndexedDB, survives refresh |
| Browser crash | Persisted in IndexedDB |
| Hold empty cart | "Hold Order" button disabled when cart is empty |
| Expired held orders | Cleaned up automatically on POS page mount |
| Discount expired between hold and resume | Re-validated on resume, warning shown if invalid |
| Resume order from different cashier | Not visible (filtered by cashier ID) |
| Resume with items in cart | Confirmation modal shown, cart replaced if confirmed |
| Delete held order | Confirmation dialog before deletion |
| Network offline | Works fully offline (IndexedDB is local) |

## Testing Scenarios

1. **Basic hold and resume**: Hold order, resume it, verify items restored correctly
2. **Hold with customer name**: Verify name displayed in list
3. **Hold with note**: Verify note displayed in list
4. **Resume with empty cart**: Should resume without confirmation
5. **Resume with items in cart**: Should show confirmation dialog
6. **Discount preservation**: Hold order with discount, resume, verify discount applied
7. **Discount expiration**: Hold order with discount, expire discount, resume, verify warning
8. **Multiple held orders**: Hold several orders, verify all listed
9. **Delete held order**: Delete order, verify removed from list
10. **Expiration cleanup**: Create expired order (mock), verify cleanup removes it
11. **Cashier isolation**: Login as different cashier, verify cannot see other's held orders
12. **Page refresh**: Hold order, refresh page, verify order still in list
13. **Empty state**: No held orders, verify empty state displayed

## Related Documents

- **ADR-0004**: Hold Order IndexedDB Persistence (architectural decision)
