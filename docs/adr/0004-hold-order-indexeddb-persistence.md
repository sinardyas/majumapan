# ADR-0004: Hold Order IndexedDB Persistence

## Status

Accepted

## Date

2024-12-29

## Context

The POS system needs a "Hold Order" feature that allows cashiers to temporarily save an in-progress order while serving other customers. The held order should be resumable later to complete the transaction.

### Use Case

A customer is ordering at the cashier but needs to temporarily pause (e.g., forgot wallet, needs to get more items, waiting for someone). The cashier should be able to:

1. **Hold** the current order
2. **Serve** other customers with a fresh cart
3. **Resume** the held order later

### Requirements

- Held orders must survive page refresh and browser crashes
- Held orders should automatically expire after 24 hours
- Each cashier should only see their own held orders
- Applied discounts should be re-validated when resuming (may have expired)
- Feature must work offline (consistent with offline-first architecture)

### Key Question

Where should held orders be stored?

## Decision

We will store held orders in **IndexedDB** (via Dexie.js) as a new `heldOrders` table, consistent with the existing offline-first architecture.

### Schema Design

```typescript
interface HeldOrder {
  id: string;              // Primary key (UUID)
  storeId: string;         // Indexed - for store filtering
  cashierId: string;       // Indexed - for cashier filtering
  customerName?: string;   // Optional reference
  note?: string;           // Optional note
  items: CartItem[];       // Snapshot of cart items
  cartDiscount: CartDiscount | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  heldAt: string;          // Indexed - ISO timestamp
  expiresAt: string;       // Indexed - for expiration queries
}
```

### Database Version

```typescript
// Version 4: Add heldOrders table
this.version(4).stores({
  categories: 'id, storeId, name',
  products: 'id, storeId, categoryId, sku, barcode, name',
  stock: 'id, storeId, productId, [storeId+productId]',
  discounts: 'id, storeId, code, discountScope',
  transactions: 'clientId, storeId, syncStatus, clientTimestamp, createdAt',
  syncMeta: 'key',
  store: 'id',
  heldOrders: 'id, storeId, cashierId, heldAt, expiresAt',  // NEW
});
```

### Key Design Decisions

#### 1. Local-Only Storage (No Server Sync)

Held orders are stored locally and **not synced to the server** because:

- Held orders are temporary (max 24 hours)
- They are cashier-specific workflow state, not business data
- Syncing would add complexity without clear benefit
- Server doesn't need to know about in-progress orders

#### 2. Cashier-Scoped Visibility

Each cashier only sees their own held orders, filtered by `cashierId`. This:

- Prevents confusion in multi-cashier environments
- Ensures accountability (cashier manages their own workflow)
- Simplifies the UI (no need to show who held which order)

#### 3. 24-Hour Expiration

Held orders expire after 24 hours because:

- Prevents stale orders accumulating indefinitely
- 24 hours covers typical shift patterns
- Customer unlikely to return after 24 hours
- Cleanup happens automatically on POS page load

#### 4. Discount Re-validation on Resume

When resuming a held order with a discount:

- System checks if discount still exists and is active
- Validates date range (startDate/endDate)
- Checks usage limits
- If invalid, order loads without discount and user is warned

This prevents applying expired or over-used discounts.

#### 5. Cart Snapshot (Not References)

Held orders store a **snapshot** of cart items, not references to products. This:

- Preserves exact prices at time of hold
- Works even if product is deleted or price changes
- Ensures consistency when resuming

## Consequences

### Positive

- **Survives refresh/crash**: IndexedDB persists data across browser sessions
- **Works offline**: Consistent with existing offline-first architecture
- **Fast access**: Local database queries are instant
- **No server dependency**: Feature works entirely client-side
- **Familiar pattern**: Uses same Dexie.js patterns as existing code
- **Type-safe**: Full TypeScript interface for held orders

### Negative

- **Not shared across devices**: Cashier must use same device to resume
- **Storage limits**: IndexedDB has browser-specific limits (typically 50MB+)
- **No server backup**: If IndexedDB is cleared, held orders are lost
- **Migration required**: New database version requires Dexie migration

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| IndexedDB cleared by user | 24h expiration means minimal data loss |
| Storage quota exceeded | Held orders are small; auto-cleanup prevents accumulation |
| Dexie migration fails | Version history maintained; test migration thoroughly |

## Alternatives Considered

### Alternative A: Memory-Only Storage (Zustand)

Store held orders only in Zustand state (memory).

```typescript
interface CartState {
  heldOrders: HeldOrder[];
  // ...
}
```

**Rejected because:**
- Lost on page refresh - unacceptable for POS reliability
- Lost on browser crash
- Not persistent across sessions
- Violates user expectation that held orders are "saved"

### Alternative B: Zustand with Persist Middleware

Use Zustand's persist middleware with IndexedDB storage.

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      heldOrders: [],
      // ...
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
);
```

**Rejected because:**
- Adds dependency on zustand persist middleware
- Mixes concerns (cart state vs. persisted orders)
- Less control over database schema and queries
- Harder to query (e.g., filter by cashier, expire old orders)
- Existing app uses Dexie directly; this would introduce inconsistency

### Alternative C: Server-Side Storage

Store held orders in PostgreSQL via API.

```typescript
// API endpoint
POST /api/held-orders
GET /api/held-orders
DELETE /api/held-orders/:id
```

**Rejected because:**
- Requires network connection (breaks offline-first principle)
- Adds server complexity for temporary data
- Latency for simple operations
- Server doesn't need to know about workflow state
- Would need sync logic for offline scenarios anyway

### Alternative D: LocalStorage

Store held orders in browser LocalStorage.

```typescript
localStorage.setItem('heldOrders', JSON.stringify(orders));
```

**Rejected because:**
- 5MB size limit (may be insufficient)
- Synchronous API (blocks main thread)
- No indexing (can't efficiently query by cashier)
- Less structured than IndexedDB
- Inconsistent with existing Dexie-based architecture

## Implementation Notes

### Database Helper Functions

```typescript
// Save a held order
export async function saveHeldOrder(order: HeldOrder): Promise<string> {
  await db.heldOrders.put(order);
  return order.id;
}

// Get held orders for a specific cashier
export async function getHeldOrdersForCashier(
  storeId: string, 
  cashierId: string
): Promise<HeldOrder[]> {
  return db.heldOrders
    .where({ storeId, cashierId })
    .filter(order => order.expiresAt > new Date().toISOString())
    .reverse()
    .sortBy('heldAt');
}

// Delete expired held orders
export async function deleteExpiredHeldOrders(): Promise<number> {
  const now = new Date().toISOString();
  const expired = await db.heldOrders
    .where('expiresAt')
    .below(now)
    .toArray();
  
  await db.heldOrders.bulkDelete(expired.map(o => o.id));
  return expired.length;
}
```

### Expiration Strategy

- `expiresAt` is calculated as `heldAt + 24 hours` when order is held
- Expired orders are cleaned up on POS page mount
- Query filters out expired orders even before cleanup runs
- No background cleanup process needed (cleanup on access pattern)

### Discount Re-validation

When resuming an order with a discount:

```typescript
async function revalidateDiscount(discount: CartDiscount): Promise<boolean> {
  const dbDiscount = await db.discounts
    .where('id')
    .equals(discount.id)
    .first();
  
  if (!dbDiscount || !dbDiscount.isActive) return false;
  
  const now = new Date();
  if (dbDiscount.startDate && new Date(dbDiscount.startDate) > now) return false;
  if (dbDiscount.endDate && new Date(dbDiscount.endDate) < now) return false;
  if (dbDiscount.usageLimit && dbDiscount.usageCount >= dbDiscount.usageLimit) return false;
  
  return true;
}
```

## Related Documents

- **Feature Specification**: `docs/features/hold-order.md`
- **ADR-0001**: Dexie Query Pattern for Offline Data Access
- **ADR-0002**: Decimal String to Number Conversion

## References

- [Dexie.js Documentation](https://dexie.org/docs/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Zustand Persist Middleware](https://github.com/pmndrs/zustand#persist-middleware)
