# ADR-0011: Cross-Tab Cart Synchronization using BroadcastChannel

## Status

Accepted

## Date

2026-01-02

## Context

The POS system supports a **Customer Display** feature where a secondary browser window/tab shows a read-only view of the current cart. This enables:

- Cashier processes orders on the main POS interface
- Customer sees their order items and totals in real-time on a customer-facing display

### The Problem

Each browser tab maintains its own **in-memory Zustand store instance**. When the cart changes in the POS tab:

1. Only that tab's Zustand store is updated
2. The Customer Display tab has a separate, independent store
3. Changes in POS are **not reflected** in Customer Display

This creates a poor customer experience where the display shows stale or empty data.

### Requirements

- Cart changes in POS should immediately appear in Customer Display
- Customer Display should be **read-only** (no cart modifications)
- Solution should work across browser tabs in the same browser session
- Solution should not require server communication (offline-compatible)
- Changes should be reflected in real-time (sub-second latency)

## Decision

We will use the **BroadcastChannel API** to synchronize cart state between browser tabs.

### Implementation Overview

```typescript
// In cartStore.ts
const channel = new BroadcastChannel('pos-cart-sync');

// Broadcast cart changes to other tabs
function broadcastCartUpdate() {
  channel.postMessage({
    type: 'CART_SYNC',
    items: get().items,
    cartDiscount: get().cartDiscount,
    subtotal: get().subtotal,
    discountAmount: get().discountAmount,
    taxAmount: get().taxAmount,
    total: get().total,
  });
}

// Listen for cart changes from other tabs
channel.onmessage = (event) => {
  if (event.data.type === 'CART_SYNC') {
    set({
      items: event.data.items,
      cartDiscount: event.data.cartDiscount,
      subtotal: event.data.subtotal,
      discountAmount: event.data.discountAmount,
      taxAmount: event.data.taxAmount,
      total: event.data.total,
    });
  }
};
```

### Channel Name

```typescript
const CART_SYNC_CHANNEL = 'pos-cart-sync';
```

Using a namespaced channel name prevents conflicts with other potential applications.

### State Sync Strategy

**Full State Sync** (not delta/incremental) because:

- Cart state is small (typically < 50 items)
- Simpler implementation (no complex merge logic)
- Prevents race conditions between tabs
- Ensures consistency across all tabs

### Sync Trigger Points

Broadcast after each cart mutation:

- `addItem()`
- `updateItemQuantity()`
- `removeItem()`
- `applyDiscount()`
- `removeDiscount()`
- `clearCart()`
- `resumeOrder()` (also loads held order state)

## Consequences

### Positive

- **Real-time sync**: Changes appear instantly in other tabs
- **No server dependency**: Works completely offline
- **Simple API**: BroadcastChannel has a straightforward interface
- **Low latency**: Native browser API, no serialization overhead
- **No dependencies**: No external libraries required
- **Read-only subscriber**: Customer Display naturally stays in sync

### Negative

- **Same browser only**: Doesn't sync across different browsers/devices
- **Same-origin only**: BroadcastChannel is same-origin by default
- **Safari limitations**: Full support requires macOS 10.13+ / iOS 11+
- **No persistence**: State lost on tab close (use IndexedDB for persistence)
- **Memory per tab**: Each tab has its own store copy

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Safari compatibility | Fallback to localStorage events for older Safari |
| Race conditions | Full state sync prevents partial updates |
| Large cart payloads | Cart size is typically small; if needed, compress state |
| Tab close during sync | Loss is acceptable; cashier can reopen display |

## Alternatives Considered

### Alternative A: BroadcastChannel (Selected)

Native browser API for cross-tab communication.

**Pros:**
- Simple, clean API
- No serialization overhead
- Native browser support (with polyfill for older browsers)

**Cons:**
- Safari support varies by version
- No persistence
- Same-browser only

**Decision:** Selected for simplicity and real-time performance.

### Alternative B: localStorage Events

Use `window.addEventListener('storage', ...)` to detect changes.

```typescript
// Set item in localStorage
localStorage.setItem('cartState', JSON.stringify(state));

// Listen for changes
window.addEventListener('storage', (e) => {
  if (e.key === 'cartState') {
    const state = JSON.parse(e.newValue);
    set(state);
  }
});
```

**Pros:**
- Universal browser support (even IE8+)
- Same-origin tab communication

**Cons:**
- String serialization overhead
- `storage` event doesn't fire on the tab that made the change
- More verbose implementation

**Decision:** Rejected in favor of BroadcastChannel for cleaner API.

### Alternative C: IndexedDB + Polling

Store cart in IndexedDB and poll for changes.

```typescript
// Save to IndexedDB
await db.cartState.put({ id: 'current', ...state });

// Poll every 100ms
setInterval(async () => {
  const current = await db.cartState.get('current');
  if (current && current.timestamp > lastSync) {
    set(current.state);
  }
}, 100);
```

**Pros:**
- Persistent across sessions
- Works across browser restarts

**Cons:**
- Polling adds latency (100ms minimum)
- Wastes CPU cycles
- Complex cleanup logic needed

**Decision:** Rejected due to polling overhead and complexity.

### Alternative D: Server/WebSocket

Use server as relay for cart state.

```typescript
// WebSocket to server
socket.emit('cart-update', state);
socket.on('cart-update', (state) => set(state));
```

**Pros:**
- Works across devices
- Persistent

**Cons:**
- Requires server infrastructure
- Adds network latency
- Breaks offline-first architecture
- Over-engineering for local display

**Decision:** Rejected - server not needed for customer display use case.

### Alternative E: BroadcastChannel + IndexedDB Persistence

Combine BroadcastChannel for real-time sync with IndexedDB for persistence.

```typescript
// Real-time sync via BroadcastChannel
// Persistence via IndexedDB save/load
```

**Pros:**
- Real-time sync + persistence
- Survives tab close

**Cons:**
- More complex implementation
- Migration complexity for existing IndexedDB

**Decision:** Documented for future enhancement. See "Future Enhancements" below.

## Implementation

### cartStore.ts Modifications

```typescript
// BroadcastChannel setup
const CART_SYNC_CHANNEL = 'pos-cart-sync';
const channel = new BroadcastChannel(CART_SYNC_CHANNEL);

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  cartDiscount: null,
  subtotal: 0,
  discountAmount: 0,
  taxAmount: 0,
  total: 0,
  resumedOrderInfo: null,

  // Helper to broadcast cart state
  broadcastState: () => {
    const state = get();
    channel.postMessage({
      type: 'CART_SYNC',
      payload: {
        items: state.items,
        cartDiscount: state.cartDiscount,
        subtotal: state.subtotal,
        discountAmount: state.discountAmount,
        taxAmount: state.taxAmount,
        total: state.total,
      },
    });
  },

  // Listen for incoming cart state
  // Note: This is handled via channel.onmessage in module scope
}));

// Module-level listener
channel.onmessage = (event) => {
  if (event.data.type === 'CART_SYNC') {
    const { payload } = event.data;
    useCartStore.setState({
      items: payload.items,
      cartDiscount: payload.cartDiscount,
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      taxAmount: payload.taxAmount,
      total: payload.total,
    });
  }
};

// Broadcast after each mutation in action functions
addItem: (newItem) => {
  // ... existing logic
  get().calculateTotals();
  get().broadcastState();  // NEW
},
```

### Type Definition

```typescript
interface CartSyncMessage {
  type: 'CART_SYNC';
  payload: {
    items: CartItem[];
    cartDiscount: CartDiscount | null;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
  };
}
```

### Customer Display Component

The Customer Display component doesn't need any changes - it simply uses `useCartStore()` and automatically receives updates via the BroadcastChannel listener.

## Future Enhancements

### IndexedDB Persistence (Recommended)

Add IndexedDB persistence for cart state so that:

1. Reopening Customer Display restores the current cart
2. Tab refresh maintains cart state
3. Browser crash recovery

**Implementation approach:**

```typescript
// Save cart to IndexedDB on each change
async function persistCart() {
  const state = get();
  await db.cartState.put({
    id: 'current',
    ...state,
    updatedAt: new Date().toISOString(),
  });
}

// Load cart on initialization
async function loadPersistedCart() {
  const persisted = await db.cartState.get('current');
  if (persisted) {
    set({
      items: persisted.items,
      // ... other fields
    });
  }
}
```

**Schema addition:**

```typescript
// In Dexie schema
this.version(5).stores({
  // ... existing tables
  cartState: 'id',  // Single-row state storage
});
```

### localStorage Fallback

For browsers without BroadcastChannel support:

```typescript
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel(CART_SYNC_CHANNEL)
  : {
      postMessage(msg: any) {
        localStorage.setItem(CART_SYNC_CHANNEL, JSON.stringify(msg));
      },
      onmessage: null,
    };

// localStorage listener for fallback
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CART_SYNC_CHANNEL && e.newValue) {
      const msg = JSON.parse(e.newValue);
      // Handle message
    }
  });
}
```

### Optimistic Updates with Debounce

For high-frequency updates (e.g., barcode scanner rapid input):

```typescript
let broadcastTimeout: ReturnType<typeof setTimeout> | null = null;

function broadcastStateDebounced() {
  if (broadcastTimeout) clearTimeout(broadcastTimeout);
  broadcastTimeout = setTimeout(() => {
    broadcastState();
  }, 50); // 50ms debounce
}
```

## Related Documents

- **Feature**: Customer Display (`docs/features/customer-display.md`)
- **ADR-0004**: Hold Order IndexedDB Persistence
- **ADR-0001**: Dexie Query Pattern for Offline Data Access

## References

- [BroadcastChannel API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Cross-Tab Communication Patterns](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)
