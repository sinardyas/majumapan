# Feature Specification: POS Layout Restructure

## Status

**Planned**

> **Business Context**: User identified layout inconsistency between grid/list view and cart view in POS page. The inline cart section fills full height without proper header separation, while cart view has a full-width Order Summary. This document covers the restructure plan to achieve consistent layout across all view modes.

## Overview

Restructure POS layout to have consistent header placement, proper content separation, and unified cart sidebar across all view modes.

## Requirements

| Requirement | Decision |
|-------------|----------|
| Header full width | Required - screen to screen |
| Categories bar position | Below header (not in header) |
| Cart sidebar | Always visible, consistent across views |
| Cart view layout | Full width Order Summary with cart operations |
| Content area layout | Flex row (left: categories/products, right: cart) |

## Current Problems

### Grid/List View Issues
- Inline cart section fills entire sidebar height without proper header separation
- Content area is flex-col (vertical) causing overlap
- Categories bar mixed in same section as products
- Cart view has different layout structure entirely

### Cart View Issues
- Full-width layout conflicts with sidebar cart approach
- Inconsistent with grid/list view experience

## Proposed Layout

### Final Layout Mockup

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  HEADER (POSHeader - FULL WIDTH, SCREEN TO SCREEN)              │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  [View] [Search Bar]        [Online] [Display] [Shift] │  │
│  │  └────────────────────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────┬──────────────────────────────────┐ │
│  │                                    │                                  │
│  │  LEFT AREA (flex-1)                 │  RIGHT AREA (CartSidebar)    │
│  │  ┌─────────────────────────────┐      │  ┌──────────────────────────────┐    │
│  │  │  Categories Bar          │      │  │  "Current Order"           │    │
│  │  │  [All][Cat1][Cat2]... │      │  ├──────────────────────────────┤    │
│  │  └─────────────────────────────┘      │  │  │  • Item 1    $12.99      │    │
│  │                                    │      │  │  • Item 2    $5.50      │    │
│  │  ┌─────────────────────────────┐      │  │  • Item 3    $8.75      │    │
│  │  │  GRID/LIST VIEW:         │      │  ├──────────────────────────────┤    │
│  │  │  ┌─────────────────────┐│      │  │  Discount: [____] [Apply] │    │
│  │  │  │ Product Grid/List  ││      │  ├──────────────────────────────┤    │
│  │  │  └─────────────────────┘│      │  │  Subtotal: $26.24        │    │
│  │  │                          │      │  │  Tax:       $2.62         │    │
│  │  │                          │      │  │  Total:     $28.86         │    │
│  │  │                          │      │  ├──────────────────────────────┤    │
│  │  │                          │      │  │  [Hold] [Clear] [Pay]     │    │
│  │  │                          │      │  └──────────────────────────────┘    │
│  │  │                          │      │                                  │    │
│  │  │  OR CART VIEW:          │      │  │                                  │    │
│  │  ┌─────────────────────────────┐      │  │                                  │    │
│  │  │  CartView - FULL          │      │  │                                  │    │
│  │  │  ORDER SUMMARY           │      │  │                                  │    │
│  │  └─────────────────────────────┘      │  │                                  │    │
│  └─────────────────────────────────────┘      │  │                                  │    │
└─────────────────────────────────────────────┴──────────────────────────────────────────┘
```

## Implementation Plan

### Component Structure

```
apps/web/src/components/pos/
├── CartSidebar.tsx       (NEW) - Unified cart sidebar for all views
└── CartView.tsx           (MODIFY) - Simplified for cart view only
```

### New Component: `CartSidebar.tsx`

**Purpose:** Unified cart sidebar component used in grid/list/cart views

**Props:**
```typescript
interface CartSidebarProps {
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cartDiscount: CartDiscount | null;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyDiscount: (code: string) => void;
  onRemoveDiscount: () => void;
  onClearCart: () => void;
  onHoldOrder: () => void;
  onPay: () => void;
  cashierName?: string;
  heldOrdersCount: number;
  onOpenHeldOrders: () => void;
  discountError: string;
  setDiscountError: (error: string) => void;
}
```

**Layout Structure:**
```jsx
<div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
  {/* Cart Header */}
  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
    <h2 className="text-lg font-semibold">Current Order</h2>
    <button title="Held Orders">
      <ClipboardList />
      {heldOrdersCount > 0 && <span>{heldOrdersCount}</span>}
    </button>
  </div>

  {/* Cart Items */}
  <div className="flex-1 overflow-y-auto p-4">
    <ul className="space-y-3">items...</ul>
  </div>

  {/* Discount Code Section */}
  <div className="px-4 py-3 border-t border-gray-200">
    discount input + apply button
  </div>

  {/* Cart Summary */}
  <div className="p-4 border-t border-gray-200">
    Subtotal, Tax, Total
  </div>

  {/* Action Buttons */}
  <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
    Hold, Clear, Pay buttons
  </div>
</div>
```

### Modified Component: `CartView.tsx`

**Changes:**
1. Add `showFullWidth?: boolean` prop
2. When `showFullWidth === true`: Use current full layout (Order Summary, user/clock info)
3. When `showFullWidth === false`: Simplified layout (items only handled by CartSidebar)

**New Props:**
```typescript
interface CartViewProps {
  showFullWidth?: boolean;  // NEW - true = cart view (full width layout)
  // ... existing props for items, discounts, actions
}
```

### Modified Component: `POS.tsx`

**Layout Structure Change:**

**Before:**
```jsx
<div className="flex-1 flex flex-col overflow-hidden">
  <POSHeader ... />
  {viewMode !== 'cart' && <POSSearchBar ... />}
  {viewMode !== 'cart' && <CategoriesBar ... />}
  <div className="flex-1 overflow-hidden">
    {viewMode === 'cart' ? <CartView ... /> : <div>Products...</div>}
  </div>
  {viewMode !== 'cart' && <InlineCart ... />}
</div>
```

**After:**
```jsx
<div className="flex-1 flex flex-col overflow-hidden">
  {/* Header */}
  <POSHeader ... />

  {/* Search Bar */}
  {viewMode !== 'cart' && <POSSearchBar ... />}

  {/* Categories Bar - BELOW HEADER, IN CONTENT AREA */}
  {viewMode !== 'cart' && <CategoriesBar ... />}

  {/* Content Area - FLEX ROW */}
  <div className="flex-1 overflow-hidden flex">
    
    {/* LEFT AREA (flex-1) */}
    <div className="flex-1 flex flex-col overflow-hidden">
      {viewMode === 'cart' ? (
        <CartView
          showFullWidth={true}
          // ... cart-specific props
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {filteredProducts.length === 0 ? <No products /> : <ProductGrid />}
        </div>
      )}
    </div>

    {/* RIGHT AREA - Cart Sidebar (ALWAYS VISIBLE) */}
    <CartSidebar
      items={items}
      subtotal={subtotal}
      discountAmount={discountAmount}
      taxAmount={taxAmount}
      total={total}
      cartDiscount={cartDiscount}
      onUpdateQuantity={updateItemQuantity}
      onRemoveItem={removeItem}
      onApplyDiscount={handleApplyDiscount}
      onRemoveDiscount={removeDiscount}
      onClearCart={clearCart}
      onHoldOrder={() => setShowHoldModal(true)}
      onPay={() => setShowPaymentModal(true)}
      cashierName={user?.name}
      heldOrdersCount={heldOrdersCount}
      onOpenHeldOrders={() => setShowHeldOrdersList(true)}
      discountError={discountError}
      setDiscountError={setDiscountError}
    />
  </div>
</div>
```

## View Modes After Changes

| View Mode | Left Area | Right Area |
|------------|------------|--------------|
| **Grid/List** | Categories + Products Grid/List | CartSidebar (full with discount section) |
| **Cart** | CartView (full width with Order Summary) | CartSidebar (same as grid/list) |

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/components/pos/CartSidebar.tsx` | CREATE | Unified cart sidebar component |
| `apps/web/src/components/pos/CartView.tsx` | MODIFY | Add `showFullWidth` prop, simplify for inline use |
| `apps/web/src/pages/POS.tsx` | MODIFY | Restructure to flex row layout, import CartSidebar |

## Expected Behavior After Changes

1. **Header**: Always full width, screen to screen
2. **Categories Bar**: Positioned below header in left content area
3. **Grid/List View**: Left side shows categories + products, right side shows CartSidebar with discount section
4. **Cart View**: Left side shows full-width CartView with Order Summary, right side shows CartSidebar
5. **Consistent Layout**: All views use same cart sidebar component

## Testing Strategy

| Test Case | Expected Result |
|------------|-----------------|
| Grid view with items | Header full width, categories below, products left, cart right |
| List view with items | Header full width, categories below, products left, cart right |
| Cart view | Header full width, CartView full width left, cart right |
| Add item to cart (grid) | CartSidebar updates correctly |
| Add item to cart (cart) | CartSidebar updates correctly |
| Discount code application | Works in both grid/list and cart views |

## Dependencies

| Dependency | Description |
|------------|-------------|
| CartStore | Existing cart state management |
| POS UI components | Existing POS layout components |
| POSHeader | Existing header component |

## Implementation Tasks

| ID | Description | Files |
|----|-------------|-------|
| POS-LAYOUT-01 | Create CartSidebar component | `apps/web/src/components/pos/CartSidebar.tsx` |
| POS-LAYOUT-02 | Modify CartView to support showFullWidth prop | `apps/web/src/components/pos/CartView.tsx` |
| POS-LAYOUT-03 | Modify POS.tsx layout to flex row | `apps/web/src/pages/POS.tsx` |
| POS-LAYOUT-04 | Test all view modes | All components |
| POS-LAYOUT-05 | Run typecheck and build | - |

## Estimated Effort

| Phase | Time |
|--------|------|
| Component creation | 1 hour |
| POS.tsx restructure | 1 hour |
| Testing | 0.5 hour |
| **Total** | **~2.5 hours** |
