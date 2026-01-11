# ADR-0013: Unified CurrentOrder Component for UI Consistency

## Status

Accepted

## Context

The POS application has two view modes:
1. **Cart View** (`CartView`): Left panel with SKU search + items list, right panel with order summary
2. **Grid/List View** (`CartSidebar`): Products area + sidebar with items list + order summary

Previously, these had inconsistent implementations:
- `OrderSummary` component existed but didn't include the items list
- `CartSidebar` duplicated items list code from `CartView`
- No unified component for displaying the full current order

This led to:
- Code duplication between `CartSidebar` and the items list in `CartView`
- Inconsistent UX where grid view didn't show items in the sidebar summary
- Difficulty maintaining cart-related UI components

## Decision

We will create a unified `CurrentOrder` component that encapsulates the complete order display (header, items, discount, totals, actions) with a configurable `showItemsList` prop.

### Component Structure

```
CurrentOrder
├── CurrentOrderHeader (cashier info, time, held orders count)
├── CartItemsList (compact items list - optional)
├── DiscountSection (input or applied discount)
├── TotalsSection (subtotal, discount, tax, total)
└── ActionButtons (Pay, Hold, Clear)
```

### Props Interface

```typescript
export interface CurrentOrderProps {
  // Summary data
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cartDiscount: CartDiscount | null;

  // Actions
  onApplyDiscount: (code: string) => void;
  onRemoveDiscount: () => void;
  onClearCart: () => void;
  onHoldOrder: () => void;
  onPay: () => void;

  // Header data
  cashierName?: string;
  heldOrdersCount: number;
  onOpenHeldOrders: () => void;

  // Discount state
  discountError: string;
  setDiscountError: (error: string) => void;
  isApplyingDiscount?: boolean;

  // Optional: Items list (for grid view)
  showItemsList?: boolean;  // default: true
  items?: CartItem[];
  onUpdateQuantity?: (productId: string, quantity: number) => void;
  onRemoveItem?: (productId: string) => void;

  // Optional: Hide discount/totals
  showDiscountAndTotals?: boolean;  // default: true
}
```

### Usage Pattern

| View Mode | Component | showItemsList | Reasoning |
|-----------|-----------|---------------|-----------|
| Cart View | `CartView` → `CurrentOrder` | `false` | Left panel already shows items |
| Grid/List | `CartSidebar` → `CurrentOrder` | `true` (default) | Sidebar needs full order view |

### Backwards Compatibility

- `CartSidebar` re-exports as `OrderSummary` alias
- `CurrentOrder` re-exports as `OrderSummary` alias
- Existing imports continue to work without changes

## Consequences

### Positive

1. **Single Source of Truth**: One component handles all order display logic
2. **Consistent UX**: Grid view now shows items in sidebar, matching CartView's pattern
3. **Reduced Duplication**: Removed ~100 lines of duplicate items list code
4. **Better Maintainability**: Changes to order display only need to be made in one place
5. **Clearer Naming**: `CurrentOrder` better describes the component's purpose

### Negative

1. Component is larger (~350 lines) but this is acceptable for a reusable UI component
2. Props interface is more complex but well-documented

### Neutral

- `showItemsList` prop adds slight complexity but provides necessary flexibility

## Implementation

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/components/pos/CurrentOrder.tsx` | Created | New unified component (renamed from OrderSummary) |
| `apps/web/src/components/pos/CartSidebar.tsx` | Simplified | Uses CurrentOrder, removes duplicate items list |
| `apps/web/src/components/pos/CartView.tsx` | Updated | Uses CurrentOrder with showItemsList={false} |

### CartItemsList Sub-component

Compact items list with:
- Max height: 192px (48 * 4) with overflow-y-auto
- Shows: product name, promo badge, subtotal, quantity controls, remove button
- Same styling as other order elements

### Width Consistency

Both `CartSidebar` and `CartView`'s order panel use `w-96 max-w-md` for consistent width.

## Notes

- The `showItemsList` prop is set to `true` by default, which is the common case for the sidebar
- In CartView, we explicitly pass `showItemsList={false}` since items are in the left panel
- For backwards compatibility, both old and new component names work as exports

## Updates

### 2024-01-10: Cashier Name Fix & Sticky Footer

**Issue**: Cashier name displayed as "Unknown" in grid view.

**Fix**: Added `cashierName={user?.name}` prop to CartSidebar in `POS.tsx`.

**Layout Enhancement**: Discount section, totals section, and action buttons are now wrapped in a sticky footer container:

```tsx
<div className="sticky bottom-0 bg-white border-t border-gray-200">
  {showDiscountAndTotals && <DiscountSection />}
  {showDiscountAndTotals && <TotalsSection />}
  <ActionButtons />
</div>
```

This ensures:
- Header stays fixed at the top
- Items list scrolls independently
- Discount, totals, and action buttons are always visible at the bottom

### Updated Layout Structure

```
┌─────────────────────────────────┐
│  Header (fixed)                 │ ← Always visible
├─────────────────────────────────┤
│                                 │
│    Items List (scrollable)      │ ← Scrolls if many items
│                                 │
├─────────────────────────────────┤
│  Discount Section               │ │
│  Totals Section                 │ │ ← STICKY TOGETHER
│  Action Buttons                 │ │   Always visible at bottom
└─────────────────────────────────┘
```

### 2024-01-10: Empty Cart State Enhancement

**Issue**: When cart is empty, the items list area shows nothing, creating an awkward gap.

**Fix**: Always render the items list container with `flex-1` to fill available space. Show a centered message when cart is empty:

```tsx
{showItemsList && (
  <div className="flex-1 overflow-hidden">
    {items.length > 0 ? (
      <CartItemsList
        items={items}
        onUpdateQuantity={onUpdateQuantity || (() => {})}
        onRemoveItem={onRemoveItem || (() => {})}
      />
    ) : (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">No items currently in the cart</p>
      </div>
    )}
  </div>
)}
```

**Behavior by View Mode**:
| View | Empty State |
|------|-------------|
| Grid View (CartSidebar) | Shows "No items currently in the cart" message, fills available space |
| Cart View (CartView) | Unaffected (showItemsList={false}, left panel handles empty state) |

### 2024-01-10: Items List Fills Available Space

**Issue**: Items list was limited to `max-h-48` (192px), leaving awkward gaps when few items in cart.

**Fix**: Removed `max-h-48` constraint from `CartItemsList`. Changed to `flex-1 overflow-y-auto` to:
- Fill all available vertical space when few items
- Scroll when items exceed available viewport height

```tsx
// Before
<div className="max-h-48 overflow-y-auto border-t border-gray-200">

// After
<div className="flex-1 overflow-y-auto border-t border-gray-200">
```

### 2024-01-10: Sticky Footer Scroll Fix

**Issue**: Using `sticky bottom-0` on the footer caused scroll issues when items exceeded viewport height. The `sticky` positioning removes the element from the normal flex flow calculation, breaking the `flex-1` container's height calculation.

**Root Cause**:
```
CurrentOrder (flex flex-col h-full)
├── Header (flex-shrink-0)
├── Items Container (flex-1 overflow-hidden)
│   └── CartItemsList (flex-1 overflow-y-auto)
└── Sticky Footer (sticky bottom-0)  ← PROBLEM: removed from flex flow
```

**Fix**: Use `margin-top: auto` instead of `sticky` to push the footer to the bottom while keeping it in the flex layout:

```tsx
// Before
<div className="sticky bottom-0 bg-white border-t border-gray-200">

// After
<div className="mt-auto bg-white border-t border-gray-200">
```

**Why This Works**:
- `mt-auto` pushes the footer to the bottom using standard flexbox behavior
- The footer remains in the normal document flow
- `flex-1` on the items container correctly calculates remaining height
- Items list scrolls properly when items exceed available space

**Final Layout Structure**:
```
┌─────────────────────────────────┐
│  Header (fixed, flex-shrink-0)  │
├─────────────────────────────────┤
│                                 │
│    Items Container (flex-1)     │
│    └── CartItemsList            │ ← flex-1 + overflow-y-auto
│         (scrolls when needed)   │   fills space & scrolls
│                                 │
├─────────────────────────────────┤
│  Discount Section               │
│  Totals Section                 │ ← mt-auto pushes to bottom
│  Action Buttons                 │
└─────────────────────────────────┘
```

### 2024-01-10: Items Container Overflow Fix

**Issue**: Even after removing `sticky`, the items list still wouldn't scroll when items exceeded viewport height. The issue was `overflow-hidden` on the parent container blocking child scroll.

**Root Cause**:
```
CurrentOrder (flex flex-col h-full)
├── Header (flex-shrink-0)
├── Items Container (flex-1 overflow-hidden)  ← PROBLEM: blocks child scroll
│   └── CartItemsList (flex-1 overflow-y-auto)  ← can't scroll!
└── Footer (mt-auto)
```

**Fix**: Remove `overflow-hidden` from items container and add `h-full` to CartItemsList:

```tsx
// Before (items container)
<div className="flex-1 overflow-hidden">
  <CartItemsList items={items} ... />

// After (items container)
<div className="flex-1">
  <CartItemsList className="h-full" items={items} ... />
```

**Additional Changes**:
- Added `className` prop to `CartItemsListProps` interface
- CartItemsList accepts and applies `className` to its root div

**Why This Works**:
- `overflow-hidden` on parent prevents any child overflow from being scrollable
- Removing it allows CartItemsList's `overflow-y-auto` to work
- The container's `flex-1` already provides proper height calculation
- Items now scroll when they reach the discount section

### 2024-01-10: Remove h-full Fix

**Issue**: Adding `h-full` to CartItemsList caused it to grow beyond container constraints, pushing the footer down instead of scrolling within the available space.

**Root Cause**:
```
CurrentOrder (flex flex-col h-full)
├── Header (flex-shrink-0)
├── Items Container (flex-1)          ← flex-1 fills space
│   └── CartItemsList (h-full)        ← PROBLEM: grows beyond container!
└── Footer (mt-auto)                  ← Gets pushed down
```

**Fix**: Remove `h-full` from CartItemsList. The container's `flex-1` already provides correct height
// Before (problematic)
 sizing:

```tsx<CartItemsList className="h-full" items={items} ... />

// After (fixed)
<CartItemsList items={items} ... />
```

**Why This Works**:
- `flex-1` on the container already allocates available space correctly
- `h-full` on CartItemsList makes it ignore container constraints and grow to fit ALL content
- Without `h-full`, CartItemsList respects container boundaries and scrolls properly
- Footer stays fixed at bottom while items scroll within their allocated space```
