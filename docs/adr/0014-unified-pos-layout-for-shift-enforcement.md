# ADR-0014: Unified POS Layout Structure for Consistent Shift Enforcement

## Status

Accepted

## Context

The POS application has two view modes that share similar layout patterns but have different rendered HTML structures:

1. **Grid/List View** (`viewMode === 'grid' | 'list'`)
   - Left: Search bar, Categories bar, Product grid
   - Right: `CartSidebar` (items list + order summary)

2. **Cart View** (`viewMode === 'cart'`)
   - Left: SKU search + Cart items list
   - Right: `CurrentOrder` (order summary only, no items list)

### Current Problems

| Issue | Grid View | Cart View | Impact |
|-------|-----------|-----------|--------|
| **Shift message handling** | Rendered by `POS.tsx` parent | Rendered internally by `CartView` | Duplicate logic, inconsistent state |
| **Container structure** | `flex-1 flex overflow-hidden` wrapper | `flex flex-1` wrapper | Different flex behavior |
| **Shift enforcement** | `isShiftRequired` prop passed to `CartSidebar` and `CurrentOrder` | `isShiftRequired` prop passed to `CartView`, then to `CurrentOrder` | Prop drilling, state scattered |
| **Search behavior** | `POSSearchBar` - filters products | Inline SKU input with popover - search-and-add | **Intentional difference** (see below) |

### Search Behavior is Intentional

Grid view and cart view have **different search purposes** that require different implementations:

| Aspect | Grid View Search | Cart View Search |
|--------|------------------|------------------|
| **Purpose** | Browse/filter products | Quick SKU/barcode lookup to add items |
| **UI Pattern** | Faceted search (filters displayed products) | Search-and-add (popover with clickable results) |
| **Component** | `POSSearchBar` - updates parent `searchQuery` state | Inline `<input>` with `SkuSearchPopover` |
| **Result** | Product grid updates in real-time | Popover shows matches, click to add to cart |

These are **not the same component** and should remain different. The refactoring should only unify layout structure, not search behavior.

## Decision

We will unify the **layout structure** across both view modes while keeping **search behavior** different (as they serve different purposes).

### New Unified Layout Structure

```
POS.tsx
├── POSHeader (always visible)
├── <div className="h-screen flex flex-col">           ← Fixed viewport height
│   ├── <POSHeader />                                 ← Fixed at top
│   └── <div className="flex-1 flex overflow-hidden">  ← Takes remaining space
│       ├── <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
│       │   ├── {viewMode !== 'cart' && <POSSearchBar />}
│       │   ├── {viewMode !== 'cart' && <CategoriesBar />}
│       │   └── <div className="flex-1 min-h-0">
│       │       ├── {showShiftMessage && <ShiftRequiredMessage overlay />}
│       │       ├── {viewMode === 'cart' ? <CartView /> : <ProductGrid />}
│       │   </div>
│       └── {viewMode !== 'cart' ? <CartSidebar /> : <CurrentOrder />}
```

### Key Principles

1. **Shift message at parent level** - `showShiftMessage` state controlled by `POS.tsx`, not inside components
2. **Consistent container classes** - Both views use `flex-1 flex overflow-hidden` wrapper
3. **Keep search behavior different** - Grid uses `POSSearchBar`, Cart uses SKU search (correct by design)
4. **No `isShiftRequired` prop** - Shift enforcement handled at layout level, not component level
5. **Fixed viewport height** - Use `h-screen` to enable proper scroll behavior

### Components After Refactoring

| Component | Role |
|-----------|------|
| `POS.tsx` | Controls layout, shift state, view mode switching |
| `POSSearchBar` | Grid view search (filters products) |
| `CategoriesBar` | Grid view categories filter |
| `CartView` | Cart items list + SKU search (cart-specific) |
| `CurrentOrder` | Order summary + action buttons (used by both views) |
| `CartSidebar` | Wrapper around `CurrentOrder` for grid view |

## Consequences

### Positive

1. **Single source of truth for shift state** - `POS.tsx` controls `showShiftMessage`, no scattered state
2. **Consistent layout structure** - Both views use same flexbox pattern
3. **Easier conditional rendering** - No more `isShiftRequired` prop drilling
4. **Clearer separation of concerns** - Layout vs. content vs. search behavior
5. **Maintainable** - Changes to layout only need to be made in one place

### Negative

1. Requires refactoring `CartView.tsx` to remove internal shift message
2. Requires updating `CurrentOrder.tsx` to remove `isShiftRequired` handling

### Neutral

- Search behavior intentionally different - this is expected and correct

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/pages/POS.tsx` | Modify | Unified layout structure, simplified conditional rendering, fixed viewport with `h-screen`, added `min-h-0` |
| `apps/web/src/components/pos/CartView.tsx` | Modify | Remove internal shift message, remove `isShiftRequired` prop, removed outer wrapper, added scroll max-height |
| `apps/web/src/components/pos/CurrentOrder.tsx` | Modify | Remove `isShiftRequired` prop, simplify action buttons, added scroll max-height |
| `apps/web/src/components/pos/POSSearchBar.tsx` | Modify | Updated styling to match cart view SKU input |
| `apps/web/src/components/pos/CartSidebar.tsx` | Modify | Added wrapper div with consistent width/border styling |
| `apps/web/src/components/shift/ShiftOverlay.tsx` | Delete | No longer needed, shift message now at parent level |
| `docs/adr/0014-unified-pos-layout-for-shift-enforcement.md` | Create | This ADR |

## Implementation Details

### Changes Made

#### 1. POS.tsx

- Removed `isShiftRequired` prop from `CartView` component
- Shift message is now rendered exclusively at parent level
- Button calls `setShowShiftModal(true)` directly to open shift modal
- **Added CurrentOrder to render at same level as CartSidebar** (consistent visibility)
- Shift message now uses `absolute inset-0` overlay to cover only left panel
- **Wrapped entire content in `h-screen flex flex-col`** for proper viewport height
- Added `min-h-0` to the flex column container (line 761) for scroll behavior

```tsx
// Wrap entire POS content for fixed viewport height
return (
  <div className="h-screen flex flex-col">
    <POSHeader ... />
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Content */}
      </div>
      {viewMode !== 'cart' ? <CartSidebar /> : <CurrentOrder />}
    </div>
  </div>
);
```

#### 2. CartView.tsx

- Removed `isShiftRequired` prop from interface and function parameters
- Removed internal shift message rendering block
- **Removed outer wrapper div** (was causing double-nested flex issue)
- Simplified conditional rendering: only shows empty state or cart items
- Kept SKU search/popover (cart-specific behavior retained)
- **Added `max-h-[calc(100vh-280px)]`** to scroll container for proper scrolling

```tsx
// Simplified structure
return (
  <div className="flex-1 flex flex-col bg-gray-50">  // Removed overflow-hidden
    <div className="p-4 ...">                        // SKU input (fixed)
    <div className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-280px)]">  // Scrollable
      {/* Cart items */}
    </div>
  </div>
);
```

#### 3. CurrentOrder.tsx

- Removed `isShiftRequired` prop from `CurrentOrderProps` interface
- Removed `isShiftRequired` prop from `ActionButtonsProps` interface
- Simplified `ActionButtons` - now only disabled when no items (`!hasItems`)
- Removed `isShiftRequired` from `ActionButtons` call site
- **Added `max-h-[calc(100vh-400px)]`** to CartItemsList scroll container

```tsx
// CartItemsList scroll container
<div className="flex-1 overflow-y-auto border-t border-gray-200 max-h-[calc(100vh-400px)]">
  {/* Items */}
</div>
```

#### 4. CartSidebar.tsx

- Added wrapper div with consistent styling matching cart view:
  - `w-96 max-w-md` (same width as CurrentOrder in cart view)
  - `bg-white border-l border-gray-200` (left border separator)
  - `flex flex-col h-full` (flex column layout)

#### 5. POSSearchBar.tsx

- Updated container styling from `px-6 py-3 bg-white border-b border-gray-100` to `p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0`
- Changed input from `className="input pl-10"` to `className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg shadow-sm"`
- Now matches cart view SKU input styling

### Build Status

Build completed successfully. No breaking changes to other files.

### Final Layout Structure

```
App.tsx
└── <AuthenticatedLayout>
    ├── <OfflineBanner />                      (outside h-screen)
    └── <main>
        └── POS.tsx
            └── <div className="h-screen flex flex-col">        ← Fixed viewport height
                ├── <POSHeader />                               ← Fixed at top
                └── <div className="flex-1 flex overflow-hidden">  ← Takes remaining space
                    ├── <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    │   ├── {viewMode !== 'cart' && <POSSearchBar />}    ← Fixed
                    │   ├── {viewMode !== 'cart' && <CategoriesBar />}   ← Fixed
                    │   └── <div className="flex-1 min-h-0">
                    │       ├── {showShiftMessage && <ShiftMessage overlay />}
                    │       ├── {viewMode === 'cart' ? <CartView /> : <ProductGrid />}
                    │           └── CartView: <div className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-280px)]">
                    │       └── ProductGrid: <div className="h-full overflow-y-auto p-6">
                    └── {viewMode !== 'cart' ? <CartSidebar /> : <CurrentOrder />}
                        └── CurrentOrder: <div className="flex-1 overflow-y-auto border-t border-gray-200 max-h-[calc(100vh-400px)]">
```

### Visual Behavior

| View Mode | No Shift | Shift Open |
|-----------|----------|------------|
| Grid View | Header + CartSidebar + Overlay message | Full POS |
| Cart View | Header + CurrentOrder + Overlay message | Full POS |

The key improvement: **CurrentOrder is now always visible** in cart view, matching grid view behavior.

## Scroll Behavior Debugging Journey

### Problem Statement

The initial implementation had the entire page scrolling instead of just the product grid and cart items lists. The header and sidebar/CurrentOrder should stay fixed while only the content areas scroll.

### Root Cause Analysis

**Initial Structure (Problematic):**
```tsx
// App.tsx
<main className="min-h-screen ...">
  <POS />
</main>

// POS.tsx
<>
  <POSHeader />
  <div className="flex-1 flex overflow-hidden">
    <div className="flex-1 flex flex-col overflow-hidden">
      <POSSearchBar />
      <CategoriesBar />
      <div className="flex-1 min-h-0 relative">
        <div className="flex-1 overflow-y-auto p-6">  // Product grid
```

**Issues Identified:**
1. `min-h-screen` on `<main>` allowed entire page to grow and scroll
2. `flex-1` on scroll containers conflicted with parent flex layout
3. Double-nested flex containers in CartView caused height calculation issues
4. `overflow-hidden` on parent containers prevented proper scroll behavior

### Debugging Steps

#### Step 1: Fixed Viewport Height

**Change in `POS.tsx`:**
```tsx
// Before
return (
  <>
    <POSHeader />
    <div className="flex-1 flex overflow-hidden">

// After
return (
  <div className="h-screen flex flex-col">
    <POSHeader />
    <div className="flex-1 flex overflow-hidden">
```

**Result:** Page no longer scrolls entirely, but product grid still doesn't scroll properly.

#### Step 2: Flexbox Height Calculations

**Changes:**
- Changed product grid container from `flex-1` to `h-full`
- Removed `relative` from container wrapper
- Added `min-h-0` to line 761 in POS.tsx

```tsx
// Line 761
<div className="flex-1 flex flex-col min-h-0 overflow-hidden">

// Line 824
<div className="h-full overflow-y-auto p-6">
```

**Result:** Product grid now scrolls. Cart items still don't scroll.

#### Step 3: CartView Nested Wrapper Issue

**Problem:** CartView had double-nested flex containers:
```tsx
return (
  <div className="flex flex-1">                    // Outer wrapper
    <div className="flex-1 flex flex-col ...">     // Inner wrapper
```

**Fix:** Removed outer wrapper:
```tsx
return (
  <div className="flex-1 flex flex-col bg-gray-50">
```

**Result:** Still doesn't scroll. `overflow-hidden` on wrapper was clipping content.

#### Step 4: Removing Parent Overflow-Hidden

**Change in CartView.tsx:**
```tsx
// Before
<div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">

// After
<div className="flex-1 flex flex-col bg-gray-50">
```

**Result:** Still doesn't scroll properly. The flexbox height calculations were too complex.

#### Step 5: Responsive Max-Height Solution

**Final Solution:** Use `max-h-` with viewport-based calculation:

**CartView.tsx (line 193):**
```tsx
<div className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-280px)]">
```

**CurrentOrder.tsx (line 40):**
```tsx
<div className="flex-1 overflow-y-auto border-t border-gray-200 max-h-[calc(100vh-400px)]">
```

**Result:** Both scroll properly!

### Why Max-Height Works

The `max-h-[calc(100vh-XXX)]` approach:
1. Creates a **hard height constraint** that flexbox can't override
2. Is **responsive** to viewport height changes
3. Is **predictable** - always leaves space for other UI elements
4. Is **simple** - no complex flex nesting to debug

### Key Learnings

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Whole page scrolled | `min-h-screen` on `<main>` allowed growth | Wrap in `h-screen flex flex-col` |
| `flex-1` not working for scroll | Nested flex containers without proper height constraint | Use `max-h-` for explicit height |
| Double-nested wrappers | CartView had unnecessary outer wrapper | Remove outer wrapper div |
| Parent `overflow-hidden` | Clipped all child content | Remove `overflow-hidden` from parent |
| `min-h-0` missing | Flex children couldn't shrink below content height | Add `min-h-0` to flex column container |

### Scroll Container Summary

| Component | File | Scroll Solution |
|-----------|------|-----------------|
| Product Grid | POS.tsx | `h-full overflow-y-auto p-6` (inside `min-h-0` container) |
| Cart Items | CartView.tsx | `max-h-[calc(100vh-280px)]` |
| CurrentOrder Items | CurrentOrder.tsx | `max-h-[calc(100vh-400px)]` |

## Backwards Compatibility

- No breaking changes to user-facing behavior
- Components simplified, props removed
- Build should succeed without modifications to other files

## Notes

### Why Remove isShiftRequired Prop?

The `isShiftRequired` prop was a workaround for having shift enforcement logic inside child components. With the unified layout approach:

1. When `showShiftMessage = true`: Parent renders shift message, blocks all POS functionality
2. When `showShiftMessage = false`: Parent renders full POS (grid or cart view)

This is cleaner because:
- Shift state controlled at a single level
- No conditional logic scattered across components
- Components focus on their specific purpose (display, search, etc.)

### Alternative Considered: Shared Layout Component

We could create a `POSLayout` component that both views use:

```tsx
function POSLayout({
  leftPanel,
  rightPanel,
  showShiftMessage,
  onOpenShift
}) {
  if (showShiftMessage) {
    return <ShiftRequiredMessage onOpenShift={onOpenShift} />;
  }
  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {leftPanel}
      </div>
      {rightPanel}
    </div>
  );
}
```

**Decision**: Not implementing this now. It adds complexity without clear benefit. The parent-level conditional rendering is simple enough for two view modes.

### Why Use Max-Height Instead of Pure Flexbox?

After extensive debugging, the `max-h-[calc(100vh-XXX)]` approach was chosen because:

1. **Predictable behavior**: Hard-coded height constraint works reliably
2. **No flexbox quirks**: Avoids complex `min-h-0`, `flex-1`, and nested container issues
3. **Responsive**: Adapts to different viewport heights
4. **Maintainable**: Easier to understand and modify

Pure flexbox scrolling requires:
- Proper height on all parent containers
- `min-h-0` on flex children
- No `overflow-hidden` on parents
- No double-nested flex containers

The max-height approach avoids all these complexities.

---

## Changelog

### 2025-01-11: Scroll Behavior Debugging Complete

**Issue**: Entire page scrolled instead of just product grid and cart items. Header and sidebar should stay fixed.

**Root Causes Identified:**
1. `min-h-screen` on `<main>` allowed entire page to grow
2. Double-nested flex containers in CartView
3. `overflow-hidden` on parent containers clipped content
4. Complex flexbox height calculations

**Debugging Steps:**
1. Wrapped POS in `h-screen flex flex-col` for fixed viewport
2. Added `min-h-0` to flex column container
3. Removed outer wrapper from CartView
4. Removed `overflow-hidden` from CartView's outer div
5. Applied `max-h-[calc(100vh-XXX)]` to scroll containers

**Final Solution:**
```tsx
// CartView.tsx - Cart items scroll
<div className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-280px)]">

// CurrentOrder.tsx - CurrentOrder items scroll
<div className="flex-1 overflow-y-auto border-t border-gray-200 max-h-[calc(100vh-400px)]">
```

**Files Modified:**
- `POS.tsx`: Added `h-screen flex flex-col` wrapper, `min-h-0` to flex column
- `CartView.tsx`: Removed outer wrapper, added `max-h-` to scroll container
- `CurrentOrder.tsx`: Added `max-h-` to CartItemsList scroll container
- `POSSearchBar.tsx`: Updated styling to match cart view

### 2025-01-11: CurrentOrder Visibility Enhancement

**Issue**: CurrentOrder was hidden in cart view when no shift active, inconsistent with grid view behavior.

**Changes**:
- **POS.tsx**: Added `CurrentOrder` import and render at same level as `CartSidebar`
- **POS.tsx**: Shift message now uses `absolute inset-0` overlay to cover only left panel
- **CartView.tsx**: Removed `CurrentOrder` wrapper, simplified to render only cart items
- **CartView.tsx**: Removed props no longer needed (subtotal, discountAmount, taxAmount, total, cartDiscount, onApplyDiscount, onRemoveDiscount, onClearCart, onHoldOrder, onPay, cashierName, heldOrdersCount, onOpenHeldOrders, discountError, setDiscountError)
- **CartSidebar.tsx**: Added wrapper with consistent `w-96 max-w-md bg-white border-l border-gray-200` styling

**Result**: CurrentOrder is now always visible in cart view, matching grid view behavior.

### 2025-01-11: Implementation Complete

- **Status**: Changed from "Proposed" to "Accepted"
- **POS.tsx**: Removed `isShiftRequired` prop from CartView, shift message now at parent level
- **CartView.tsx**: Removed internal shift message, removed `isShiftRequired` prop, simplified to show only empty state or cart items
- **CurrentOrder.tsx**: Removed `isShiftRequired` prop from interface and ActionButtons, simplified disabled logic
- **Build**: Verified successful build

### 2025-01-11: Initial Draft

- Created ADR for unified POS layout structure
- Analyzed differences between grid and cart view layouts
- Identified that search behavior should remain different (intentional)
- Proposed refactoring plan with phased implementation
