# Feature Specification: Customer Display

## Status

**Implemented** - Completed on 2026-01-02

> **Business Context**: See [Customer Display PRD](../prd/customer-display-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

## Overview

The Customer Display feature provides a read-only, customer-facing view of the current order. It mirrors the cart in real-time and displays promotional banners, allowing customers to verify their order items and see running totals during the checkout process.

## Use Case

**Scenario**: A customer is at the checkout counter. The cashier processes items on the main POS interface while the customer watches their order appear on a secondary display. This enables:

- **Transparency**: Customers see exactly what's being rung up
- **Verification**: Customers can catch errors before payment
- **Engagement**: Promotional banners attract attention while waiting
- **Professionalism**: Modern checkout experience

## Requirements

| Requirement | Decision |
|-------------|----------|
| Display mode | Full-screen, read-only |
| Real-time sync | BroadcastChannel API (cross-tab) |
| Promotion source | Active discounts from IndexedDB |
| Layout | Vertical split (66.6% promotions / 33.4% cart) |
| Cart mirroring | Zustand store subscription |
| Cashier identification | From auth store |
| Offline support | Yes (no server dependency) |
| Multiple promotions | Auto-rotates every 4 seconds |
| Exit mechanism | Close browser tab / window |

## Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          │                                                   │
│     PROMOTION AREA       │           CART ITEMS AREA                         │
│     (Width: 66.6%)       │           (Width: 33.4%)                          │
│     Full-height banner   │                                                   │
│                          │  ┌─────────────────────────────────────────────┐  │
│  ┌────────────────────┐  │  │  Cashier: John Doe                          │  │
│  │                    │  │  │                                             │  │
│  │   Sliding Banner   │  │  │  Coffee x2              $8.00               │  │
│  │   with active      │  │  │  Sandwich             $12.00               │  │
│  │   promotions       │  │  │  Latte x1               $5.00               │  │
│  │                    │  │  │  Cake x1                $4.50               │  │
│  │                    │  │  │  ...                                          │  │
│  │                    │  │  │                                             │  │
│  └────────────────────┘  │  │  ─────────────────────────────────────────  │  │
│                          │  │                                             │  │
│                          │  │  Subtotal              $29.50               │  │
│                          │  │  Discount              -$2.00               │  │
│                          │  │  Tax (10%)              $2.75               │  │
│                          │  │  ─────────────────────────────────────────  │  │
│                          │  │                                             │  │
│                          │  │  TOTAL                $30.25                │  │
│                          │  │                                             │  │
│                          │  └─────────────────────────────────────────────┘  │
│                          │                                                   │
└──────────────────────────┴───────────────────────────────────────────────────┘
```

### Component Details

**Promotion Banner (Left, 66.6%)**
- Full-height left panel
- Gradient background (amber to red for visibility)
- Sliding marquee animation showing all active promotions
- Current promotion highlighted in center with description
- Discount value displayed prominently
- Auto-rotates every 4 seconds if multiple promotions
- Dots indicator for navigation when multiple promotions exist
- Fallback: "Welcome! Start adding items to your order" when no promotions

**Cart Area (Right, 33.4%)**
- White background, clean design
- **Header**: Cashier name (from auth store, right-aligned, small text)
- **Item List**: Scrollable area showing each product
  - Quantity badge (circle with number)
  - Product name (truncated if long)
  - Applied discount indicator (green, if any)
  - Line item subtotal
- **Order Summary**: Fixed at bottom with all totals
  - Subtotal
  - Discount (if any)
  - Tax
  - TOTAL (large, green, prominent)

## Technical Quick Reference

| Category | Details |
|----------|---------|
| Architecture | BroadcastChannel API for cross-tab sync |
| State Management | Zustand with full cart state |
| Local Storage | IndexedDB (Dexie.js) for promotions |
| Route | `/customer-display` (protected) |
| Sync Triggers | 8 cart mutation events |
| File Changes | 4 files (see Section 4) |

## Data Model

### Cart Items (from existing cartStore)

```typescript
// apps/web/src/stores/cartStore.ts

interface CartItem {
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

interface CartDiscount {
  id: string;
  code: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  amount: number;
}
```

### Promotion (derived from discounts table)

```typescript
interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  value: number;
  priority?: 'high' | 'normal';
}
```

**Promotion Filter Criteria:**
- `isActive === true`
- `startDate <= now` (or null)
- `endDate >= now` (or null)

## User Flows

### Flow 1: Open Customer Display

```
1. Cashier is on POS page with items in cart
2. Clicks [Customer Display] button in header
3. System opens new browser window/tab at /customer-display
4. Customer Display shows:
   - Left: Promotion banner (or welcome message)
   - Right: Current cart items and totals
5. Customer can now see their order in real-time
```

### Flow 2: Real-Time Cart Updates

```
1. Cashier adds item to cart on POS
2. Customer Display instantly updates:
   - New item appears in list
   - Totals recalculate
3. Cashier updates quantity or removes item
4. Customer Display updates immediately
5. Customer sees accurate, up-to-date order
```

### Flow 3: Promotion Display

```
1. Customer Display shows promotion banner
2. If single promotion:
   - Shows full details (name, description, discount)
   - No auto-rotation
3. If multiple promotions:
   - Promotions scroll horizontally (marquee)
   - Current promotion highlighted in center
   - Dots indicator shows position
   - Auto-rotates every 4 seconds
4. Promotions refresh from database every 30 seconds
5. New promotions appear automatically
```

### Flow 4: Close Customer Display

```
1. Cashier or customer closes browser tab/window
2. No data loss (cart remains in POS)
3. Cashier can reopen Customer Display anytime
```

## Implementation Details

### Files Created/Modified

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `apps/web/src/pages/CustomerDisplay.tsx` | Created | Main customer display component with vertical split layout |
| 2 | `apps/web/src/App.tsx` | Modified | Added `/customer-display` route (protected) |
| 3 | `apps/web/src/pages/POS.tsx` | Modified | Added "Customer Display" button in header |
| 4 | `apps/web/src/stores/cartStore.ts` | Modified | Added BroadcastChannel for cross-tab sync |

### Cross-Tab Synchronization

The Customer Display uses the **BroadcastChannel API** to sync cart state between browser tabs:

```typescript
// apps/web/src/stores/cartStore.ts

const CART_SYNC_CHANNEL = 'pos-cart-sync';
const channel = typeof BroadcastChannel !== 'undefined' 
  ? new BroadcastChannel(CART_SYNC_CHANNEL) 
  : null;

// Broadcast cart state after any mutation
function broadcastCartState(state: CartState) {
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
}

// Listen for cart state from other tabs
channel.onmessage = (event) => {
  if (event.data.type === 'CART_SYNC') {
    useCartStore.setState(event.data.payload);
  }
};
```

**Sync Trigger Points:**
- `addItem()` - When item added/quantity increased
- `updateItemQuantity()` - When quantity changed
- `removeItem()` - When item removed
- `applyDiscount()` - When cart discount applied
- `removeDiscount()` - When cart discount removed
- `clearCart()` - When cart cleared
- `resumeOrder()` - When held order resumed
- `clearResumedOrderInfo()` - When resumed info cleared

### Route Configuration

```typescript
// apps/web/src/App.tsx

<Route
  path="/customer-display"
  element={
    <ProtectedRoute>
      <CustomerDisplay />
    </ProtectedRoute>
  }
/>
```

### POS Header Button

```typescript
// apps/web/src/pages/POS.tsx

<Button
  variant="outline"
  size="sm"
  onClick={() => window.open('/customer-display', '_blank', 'width=1024,height=768')}
  className="flex items-center gap-2"
>
  <Monitor className="h-4 w-4" />
  Customer Display
</Button>
```

### Promotion Loading

```typescript
// apps/web/src/pages/CustomerDisplay.tsx

useEffect(() => {
  const loadPromotions = async () => {
    const now = new Date();
    const activePromotions = await db.discounts
      .filter((d) => d.isActive === true)
      .filter((d) => {
        const afterStart = !d.startDate || new Date(d.startDate) <= now;
        const beforeEnd = !d.endDate || new Date(d.endDate) >= now;
        return afterStart && beforeEnd;
      })
      .toArray();

    setPromotions(formatted);
  };

  loadPromotions();
  const interval = setInterval(loadPromotions, 30000);
  return () => clearInterval(interval);
}, []);
```

## UI Design

### CSS Animations

```css
@keyframes marquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

.animate-marquee {
  animation: marquee 20s linear infinite;
}

.animate-marquee:hover {
  animation-play-state: paused;
}
```

### Color Scheme

| Element | Color |
|---------|-------|
| Promotion banner gradient | `from-amber-400 via-orange-500 to-red-500` |
| Total amount | `text-green-600` |
| Discount | `text-green-600` |
| Tax label | `text-gray-600` |
| Quantity badge | `bg-primary-100 text-primary-700` |
| Cart area background | `bg-white` |
| Summary background | `bg-gray-50` |

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| No promotions in database | Shows "Welcome! Start adding items to your order" |
| No items in cart | Shows "Your cart is empty" message |
| Large number of items | Item list scrolls vertically |
| Long product names | Truncated with ellipsis |
| Safari with no BroadcastChannel | Feature silently disabled (use POS tab directly) |
| Different browser instances | Not supported (same browser only) |
| Tab closed and reopened | Cart state synced from POS tab (if still open) |
| Network offline | Works fully offline (local IndexedDB) |
| Browser window resized | Responsive flex layout adapts |
| Promotions expire while displaying | Refreshes every 30 seconds |

## Future Enhancements

See **ADR-0011** for additional implementation notes:

1. **IndexedDB Persistence** - Save cart state to persist across tab refresh/close
2. **localStorage Fallback** - For browsers without BroadcastChannel support
3. **Debounced Updates** - For high-frequency barcode scanner input
4. **Custom Banner Messages** - Admin-configurable promotion text
5. **Product Images** - Show product thumbnails in item list
6. **Multi-Promotion Display** - Grid view of multiple promotions at once

## Testing Scenarios

1. **Open display**: Click button, verify new tab opens with correct route
2. **Empty cart**: Open display with empty cart, verify empty state
3. **Single item**: Add one item, verify displayed correctly
4. **Multiple items**: Add multiple items, verify all displayed
5. **Quantity changes**: Update quantity, verify display updates
6. **Item removal**: Remove item, verify removed from display
7. **Discount application**: Apply discount, verify discount shown
8. **Total calculation**: Verify subtotal, discount, tax, total are correct
9. **Promotion rotation**: Multiple promotions, verify auto-rotation
10. **Cashier name**: Verify correct name from auth store
11. **Cross-tab sync**: Open POS and display in separate tabs, verify sync
12. **Tab close/reopen**: Close display, reopen, verify sync resumes
13. **Offline**: Verify display works without network
14. **Promotions refresh**: Add new promotion, verify appears within 30 seconds

## Related Documents

- **PRD**: [Customer Display PRD](../prd/customer-display-prd.md) - Product requirements, user personas, goals, success metrics
- **ADR-0011**: Cross-Tab Cart Synchronization using BroadcastChannel
- **docs/features/hold-order.md**: Hold Order feature (similar architecture)
