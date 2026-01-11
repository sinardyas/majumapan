# ADR-0015: Cart State Persistence

## Status

Accepted

## Context

The POS application experienced a critical issue where cart items were lost on page refresh. Users would add items to their cart, then lose all items upon refreshing or reopening the page.

### Root Cause Analysis

**The cart state was stored purely in memory with no persistence layer.**

| Store | Persistence Method | Survives Refresh |
|-------|-------------------|------------------|
| `authStore` | `persist` middleware + localStorage | Yes |
| `shiftStore` | IndexedDB on mount | Partially |
| `syncStore` | Memory only | No |
| **`cartStore`** | **None** | **No** |

When a user refreshed the page:
1. JavaScript state was destroyed
2. New Zustand store instance was created
3. Initial state: `items: []` (empty)
4. **All cart items were lost**

### Existing Persistence in Codebase

- **localStorage**: Used for UI preferences (`pos-view-mode`, `sidebar-collapsed`)
- **IndexedDB**: Used for products, categories, held orders
- **BroadcastChannel**: Already implemented for cross-tab sync (but only works while tabs are open)

### Why Other Stores Persist But Cart Didn't

The `authStore` was already using Zustand's `persist` middleware, which is the recommended pattern for client-side state persistence.

```typescript
// authStore.ts - already persisted
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({ ... }),
    { name: 'auth-storage', storage: createJSONStorage(() => localStorage) }
  )
);
```

The `cartStore` was created without this middleware, likely because:
- It was implemented before persistence was considered
- The "Hold Order" feature was meant to handle long-term storage
- In-memory storage was sufficient for single-session workflows

## Decision

Add Zustand `persist` middleware to `cartStore` for automatic localStorage persistence.

### Implementation

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Wrap store creation with persist middleware
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({ ... }),  // Original store implementation
    {
      name: 'pos-cart',                    // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        cartDiscount: state.cartDiscount,
      }),
    }
  )
);
```

### What Gets Persisted

| Field | Persisted | Reason |
|-------|-----------|--------|
| `items` | ✅ Yes | Core cart data |
| `cartDiscount` | ✅ Yes | Applied discount code |
| `subtotal` | ❌ No | Calculated from items |
| `discountAmount` | ❌ No | Calculated from items |
| `taxAmount` | ❌ No | Calculated from items |
| `total` | ❌ No | Calculated from items |
| `totalPromoDiscount` | ❌ No | Calculated from items |
| `resumedOrderInfo` | ❌ No | Session-specific |

Only `items` and `cartDiscount` are persisted because they are the **source of truth**. All other fields are computed values that are recalculated from items on store rehydration.

### Cross-Tab Sync

The existing `BroadcastChannel` implementation already handles cross-tab sync:

```typescript
const CART_SYNC_CHANNEL = 'pos-cart-sync';
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel(CART_SYNC_CHANNEL)
  : null;
```

This means:
1. Cart persists across refresh within the same tab
2. Cart syncs across multiple open tabs (while tabs are open)
3. If tab A persists cart, then tab B opens, tab B will receive the persisted state on mount

## Consequences

### Positive

1. **Cart survives page refresh** - Users don't lose items on refresh
2. **Cart survives browser crash** - State is in localStorage
3. **Cross-tab sync works properly** - State syncs between tabs
4. **Simple implementation** - Uses existing zustand persist pattern
5. **Minimal code changes** - No refactoring of store logic

### Negative

1. **Cart persists across sessions** - May need to clear cart after completed order
2. **Potential for stale data** - If products change while cart is persisted
3. **localStorage size limit** - ~5MB limit, but cart data is typically <5KB

### Mitigations

The `clearCart()` action is called after:
- Successful order completion
- Hold order creation

This ensures the cart is cleared at appropriate times, preventing stale data accumulation.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/stores/cartStore.ts` | Modify | Added persist middleware, imported `createJSONStorage` |
| `docs/adr/0015-cart-state-persistence.md` | Create | This ADR |

## Implementation Details

### Changes to cartStore.ts

1. **Import persist middleware**:
   ```typescript
   import { persist, createJSONStorage } from 'zustand/middleware';
   ```

2. **Wrap store creation**:
   ```typescript
   export const useCartStore = create<CartState>()(
     persist(
       (set, get) => ({ ... }),
       { name: 'pos-cart', ... }
     )
   );
   ```

3. **Partialize persisted state**:
   ```typescript
   partialize: (state) => ({
     items: state.items,
     cartDiscount: state.cartDiscount,
   }),
   ```

### Why Not IndexDB?

For cart persistence, localStorage is preferred over IndexedDB because:

| Factor | localStorage | IndexedDB |
|--------|--------------|-----------|
| Data size | Cart < 5KB | Overkill |
| API complexity | Simple (key-value) | Complex (async, transactions) |
| Sync behavior | Blocking (sync) | Async (needs await) |
| Existing usage | Already used by authStore | Products, held orders |

The cart is small, simple key-value data that doesn't need transactions or complex queries. localStorage is the right tool for this job.

### Rehydration Behavior

Zustand's persist middleware automatically rehydrates state from localStorage on store initialization:

```typescript
// When store is created:
// 1. Check localStorage for 'pos-cart'
// 2. If found, parse and set initial state
// 3. If not found, use default initial state
```

The rehydration happens synchronously before any component mounts, so cart items are available immediately.

## Backwards Compatibility

- ✅ Existing `clearCart()` action still works
- ✅ Existing `holdOrder()` still works
- ✅ Existing `resumeOrder()` still works
- ✅ No breaking changes to component usage
- ✅ Build should succeed without modifications

## Security Considerations

### localStorage XSS Risk

**Risk**: If malicious code executes in the context of the POS page, it could:
- Read cart data from localStorage
- Modify cart data in localStorage
- Delete cart data from localStorage

**Mitigation**:
1. XSS is already a critical vulnerability - cart persistence doesn't introduce new XSS vectors
2. Cart data is not sensitive (product IDs, quantities, prices)
3. No PII, payment data, or credentials in cart
4. Auth tokens are in a separate localStorage key with different sensitivity

**Alternative**: Use sessionStorage instead of localStorage for slightly less persistence (clears on tab close). However, this would mean:
- Cart survives refresh ✓
- Cart doesn't survive tab close ✗
- May lose cart on browser crash

**Decision**: Keep localStorage for better UX. The risk profile is acceptable for non-sensitive cart data.

## Future Enhancements

### Potential Improvements (Out of Scope)

1. **Cart expiration** - Clear cart after N hours of inactivity
2. **Cart merge on login** - Merge local cart with server cart
3. **Conflict resolution** - Handle product price changes since cart was created
4. **Cart cleanup** - Remove items for discontinued products
5. **Storage encryption** - Encrypt cart data in localStorage (low value, adds complexity)

## Notes

### Why Not sessionStorage?

sessionStorage would clear cart on tab close, which is a reasonable behavior. However:

- **User expectation**: Refresh should preserve cart
- **Browser crash**: localStorage survives, sessionStorage doesn't
- **Tab recovery**: Modern browsers restore tabs with sessionStorage intact

localStorage is the safer choice for preserving cart across unexpected interruptions.

### Comparison with Hold Order Feature

| Feature | Purpose | Storage | Lifetime |
|---------|---------|---------|----------|
| Cart persistence | Recover from refresh | localStorage | Until cleared or order complete |
| Hold order | Pause one order for another | IndexedDB | 24 hours, explicit resume |

These are complementary features:
- **Persistence** handles accidental data loss (refresh, crash)
- **Hold order** handles workflow interruption (customer needs time, serve another customer)

---

## Changelog

### 2025-01-11: Cart Totals Not Recalculated After Rehydration Fix

**Issue**: After page refresh, cart items were restored but subtotal and total showed 0. Pay button was disabled even with items in cart.

**Root Cause**: When Zustand persist middleware rehydrates the store:
1. `items` and `cartDiscount` are loaded from localStorage
2. But `subtotal`, `taxAmount`, `total` remain at initial values (0)
3. `calculateTotals()` was never called after rehydration

**Solution**: Added `onRehydrateStorage` callback to persist middleware:

```typescript
onRehydrateStorage: () => (state) => {
  if (state && state.items.length > 0) {
    state.calculateTotals();
  }
},
```

**Result**: Cart items and totals now display correctly after page refresh.

**Files Modified**:
- `cartStore.ts`: Added `onRehydrateStorage` callback to persist options

### 2025-01-11: Cart Persistence Implemented

**Issue**: Cart items lost on page refresh, critical UX problem.

**Root Cause**: Cart state stored in memory only, no persistence layer.

**Solution**: Added Zustand persist middleware to cartStore.

**Changes**:
- `cartStore.ts`: Wrapped with `persist` middleware, configured localStorage
- Imported `createJSONStorage` from zustand/middleware
- Configured `partialize` to persist only `items` and `cartDiscount`

**Result**: Cart now survives page refresh and browser crash.
