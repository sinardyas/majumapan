# Feature Specification: POS View Enhancement

## Status

**Planned** - Implementation not started

> **Business Context**: See [POS View Enhancement PRD](../prd/pos-view-enhancement-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

## Overview

The POS View Enhancement adds a toggleable List View with dedicated SKU search functionality to the existing POS interface. Users can switch between Grid View (default, visual browsing) and List View (SKU-focused, keyboard-driven). The List View includes a dedicated SKU input field with a popover for search results, and full keyboard navigation support.

## Use Case

**Scenario**: An experienced cashier wants to quickly add products by SKU without visual browsing:

1. **Switch to List View**: Cashier presses F2 or clicks the "List" toggle
2. **SKU Input**: Dedicated input field auto-focuses
3. **Type SKU**: Cashier types product SKU (e.g., "ABC123")
4. **Popover Search**: Matching products appear in a grid popover
5. **Add to Cart**: Cashier presses Enter or clicks to add product
6. **Continue**: Cashier can rapidly enter multiple SKUs

**Alternative**: Cashier uses keyboard navigation in List View:
1. Press ↑/↓ to navigate products
2. Press Enter to add selected product
3. Repeat for next product

## Requirements

| Requirement | Decision |
|-------------|----------|
| View toggle | Segmented control (Grid \| List \| Cart) |
| Toggle persistence | localStorage (viewMode key) |
| SKU input | Dedicated field in List View and Cart View |
| Popover | Grid layout (2 cols x 5 rows default, max 10 results) |
| Keyboard nav | Full support (↑/↓/Enter/Escape/Home/End) |
| F2 shortcut | Cycles through: Grid → List → Cart → Grid |
| Category filter | Visible in Grid and List Views only |
| Search scope | SKU, barcode, product name (same as current) |
| Cart View | Full-width cart section with SKU input at top |
| Barcode scanner | Works in all views, including Cart View |

## List View Maintains Grid View Behavior

The List View is a **presentation layer change only**. All business logic remains unchanged:

```typescript
// Both views use the same cart integration
const handleProductClick = (product: ProductWithStock) => {
  if (product.stockQuantity <= 0) return;
  addItem({...product, quantity: 1});  // Same function used by Grid View
};

// Both views use the same filtering logic
const filteredProducts = products.filter(product => {
  const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
  const matchesSearch = !searchQuery ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.name.toLowerCase().includes(searchQuery.toLowerCase());
  return matchesCategory && matchesSearch;
});
```

### Behavior Preservation Checklist

| Behavior | Grid View | List View | Status |
|----------|-----------|-----------|--------|
| Category filtering | Yes | Yes | Identical |
| Product search | Yes | Yes | Identical |
| Stock checking | Yes | Yes | Identical |
| Cart add/update | Yes | Yes | Same `addItem()` call |
| Toast notifications | Yes | Yes | Same system |
| Discount application | Yes | Yes | Same system |
| Hold order | Yes | Yes | Same system |

## Customer Display Compatibility

The Customer Display uses `BroadcastChannel` to sync cart state from `cartStore`:

```
POS (any view) → cartStore.addItem() → BroadcastChannel → Customer Display
```

**No changes required** to Customer Display because:

1. Cart actions (`addItem`, `updateItemQuantity`, etc.) broadcast automatically
2. Customer Display subscribes to `cartStore`, not view state
3. Both Grid and List views use identical cart actions

### Sync Architecture

```typescript
// cartStore.ts - BroadcastChannel setup (existing, unchanged)
const CART_SYNC_CHANNEL = 'pos-cart-sync';
const channel = new BroadcastChannel(CART_SYNC_CHANNEL);

// Any cart action triggers broadcast
addItem: (item) => {
  // ... add item to state
  channel.postMessage({ type: 'CART_SYNC', payload: getState() });
}
```

### Customer Display Independence

| Customer Display Feature | Implementation | View Dependency |
|--------------------------|----------------|-----------------|
| Cart items | From `cartStore` state | None |
| Promotions | From IndexedDB | None |
| Totals | Calculated from cart | None |
| Updates | BroadcastChannel | None |
| View mode display | Not applicable | None |

The Customer Display is completely view-agnostic. Whether the POS is in Grid, List, or Cart mode, the Customer Display shows the same cart content in real-time.

## Cart View Implementation

Cart View provides a split-layout, focused cart management experience:
- Left Panel (65%): SKU input + Cart items with infinite scroll
- Right Panel (35%): Order summary + Action buttons

### Cart View Layout (Split)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Grid] | [List] | [Cart]                                          [F2] │
├─────────────────────────────────┬───────────────────────────────────────┤
│                                 │                                       │
│  SKU: [__________________]      │  Order Summary                        │
│  (auto-focuses)                 │  ─────────────────────────────────    │
│                                 │                                       │
│  ┌───────────────────────┐      │  Cashier: John Smith                 │
│  │ Wireless Earbuds      │      │  2026-01-05 14:32:15                 │
│  │ $49.99 each           │      │                                       │
│  │ [-] 1 [+]   $49.99    │      │  ─────────────────────────────────    │
│  └───────────────────────┘      │                                       │
│                                 │  Subtotal:                      $75.97│
│  ┌───────────────────────┐      │  Discount (SUMMER10):           -$7.60│
│  │ USB-C Cable           │      │  Tax (10%):                      $7.60│
│  │ $12.99 each           │      │                                       │
│  │ [-] 2 [+]   $25.98    │      │  ─────────────────────────────────    │
│  └───────────────────────┘      │                                       │
│                                 │  Total:                          $83.57│
│  ... (infinite scroll)          │                                       │
│                                 │  ┌─────────────────────────────────┐  │
│                                 │  │ [Hold]  [Clear]          [Pay] │  │
│                                 │  └─────────────────────────────────┘  │
├─────────────────────────────────┴───────────────────────────────────────┤
│                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
      Left Panel (65%)                       Right Panel (35%)
```

### Cart View Component

```typescript
// apps/web/src/components/pos/CartView.tsx

interface CartViewProps {
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
  skuSearchQuery: string;
  setSkuSearchQuery: (query: string) => void;
  skuSearchOpen: boolean;
  setSkuSearchOpen: (open: boolean) => void;
  skuSearchResults: ProductWithStock[];
  popoverSelectedIndex: number;
  setPopoverSelectedIndex: (index: number) => void;
  onProductSelect: (product: ProductWithStock) => void;
  skuInputRef: React.RefObject<HTMLInputElement>;
  cashierName: string;
}

export function CartView({
  items,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  cartDiscount,
  onUpdateQuantity,
  onRemoveItem,
  onApplyDiscount,
  onRemoveDiscount,
  onClearCart,
  onHoldOrder,
  onPay,
  skuSearchQuery,
  setSkuSearchQuery,
  skuSearchOpen,
  setSkuSearchOpen,
  skuSearchResults,
  popoverSelectedIndex,
  setPopoverSelectedIndex,
  onProductSelect,
  skuInputRef,
  cashierName,
}: CartViewProps) {
  return (
    <div className="flex h-full">
      {/* Left Panel - Cart Items (65%) */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* SKU Search Input */}
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <div className="relative max-w-xl">
            <input
              ref={skuInputRef}
              type="text"
              placeholder="Enter SKU or barcode to add items..."
              value={skuSearchQuery}
              onChange={(e) => setSkuSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg"
              autoFocus
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            {skuSearchQuery && (
              <button
                onClick={() => {
                  setSkuSearchQuery('');
                  setSkuSearchOpen(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <SkuSearchPopover
              query={skuSearchQuery}
              isOpen={skuSearchOpen}
              onClose={() => {
                setSkuSearchOpen(false);
                skuInputRef.current?.focus();
              }}
              products={skuSearchResults}
              selectedIndex={popoverSelectedIndex}
              onSelect={onProductSelect}
              onSelectIndex={setPopoverSelectedIndex}
              anchorRef={skuInputRef}
            />
          </div>
        </div>

        {/* Cart Items List (Infinite Scroll) */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg">Cart is empty</p>
              <p className="text-sm mt-1">Enter a SKU above to add items</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl mx-auto">
              {items.map((item) => (
                <CartItemCard
                  key={item.productId}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemoveItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Order Summary (35%) */}
      <div className="w-[35%] min-w-[300px] max-w-[400px] h-full flex-shrink-0">
        <OrderSummary
          subtotal={subtotal}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          total={total}
          cartDiscount={cartDiscount}
          cashierName={cashierName}
          onRemoveDiscount={onRemoveDiscount}
          onApplyDiscount={onApplyDiscount}
          onHoldOrder={onHoldOrder}
          onClearCart={onClearCart}
          onPay={onPay}
          items={items}
        />
      </div>
    </div>
  );
}

// OrderSummary Component (Right Panel)
function OrderSummary({
  subtotal,
  discountAmount,
  taxAmount,
  total,
  cartDiscount,
  cashierName,
  onRemoveDiscount,
  onApplyDiscount,
  onHoldOrder,
  onClearCart,
  onPay,
  items,
}: OrderSummaryProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Summary Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="h-4 w-4" />
          <span>{cashierName || 'Unknown Cashier'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
          <Clock className="h-4 w-4" />
          <span>{formatDateTime(currentTime)}</span>
        </div>
      </div>

      {/* Discount Section */}
      <div className="p-4 border-b border-gray-200">
        {!cartDiscount ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Discount code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <Button variant="outline" size="sm">Apply</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
            <span className="text-green-800 text-sm font-medium">
              {cartDiscount.code}: -{formatCurrency(discountAmount)}
            </span>
            <button onClick={onRemoveDiscount}>
              <X className="h-4 w-4 text-green-600" />
            </button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex-1 p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Tax (10%)</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex gap-2">
          <div className="flex gap-2 flex-1">
            <Button variant="outline" size="sm" onClick={onHoldOrder} disabled={items.length === 0} className="flex-1">
              Hold
            </Button>
            <Button variant="outline" size="sm" onClick={onClearCart} disabled={items.length === 0} className="flex-1">
              Clear
            </Button>
          </div>
          <Button variant="success" size="sm" onClick={onPay} disabled={items.length === 0} className="flex-1 font-semibold">
            Pay {formatCurrency(total)}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Cart Item Card Component

```typescript
function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="font-medium text-gray-900 truncate">{item.productName}</h4>
          <p className="text-sm text-gray-500">{formatCurrency(item.unitPrice)} each</p>
        </div>
        <button onClick={() => onRemove(item.productId)} className="text-red-500 hover:text-red-700 p-1">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <button onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-medium">{item.quantity}</span>
          <button onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <span className="font-bold text-gray-900">{formatCurrency(item.subtotal)}</span>
      </div>
    </div>
  );
}
```
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button variant="outline">Apply</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-4 max-w-md bg-green-50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-800">
                {cartDiscount.code}: -{formatCurrency(discountAmount)}
              </span>
            </div>
            <button
              onClick={onRemoveDiscount}
              className="text-green-600 hover:text-green-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Totals */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="flex justify-between text-gray-600 mb-1">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600 mb-1">
              <span>Discount</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600 mb-1">
            <span>Tax (10%)</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 border-t border-gray-200 mt-2">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={onHoldOrder}
            disabled={items.length === 0}
          >
            Hold Order
          </Button>
          <Button
            variant="outline"
            onClick={onClearCart}
            disabled={items.length === 0}
          >
            Clear Cart
          </Button>
          <Button
            variant="success"
            onClick={onPay}
            disabled={items.length === 0}
            className="text-lg"
          >
            Pay {formatCurrency(total)}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### View Mode Cycling Logic

```typescript
// F2 shortcut cycles through all three views
const cycleViewMode = () => {
  setViewMode(prev => {
    switch (prev) {
      case 'grid': return 'list';
      case 'list': return 'cart';
      case 'cart': return 'grid';
    }
  });
};
```

### Data Model

### View Mode State (Updated)

```typescript
// In POS.tsx state
interface POSState {
  viewMode: 'grid' | 'list' | 'cart';
  skuSearchQuery: string;
  skuSearchOpen: boolean;
  listSelectedIndex: number;
  popoverSelectedIndex: number;
}

// localStorage key: 'pos-view-mode'
type ViewMode = 'grid' | 'list' | 'cart';
```

### Product with Stock (Existing)

```typescript
// apps/web/src/db/index.ts
interface LocalProduct {
  id: string;
  storeId: string;
  categoryId: string | null;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  price: number;
  costPrice: number | null;
  imageUrl: string | null;
  imageBase64: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Extended with stock for UI
interface ProductWithStock extends LocalProduct {
  stockQuantity: number;
}
```

### Search Result Product

```typescript
interface SearchResultProduct {
  product: LocalProduct;
  stockQuantity: number;
  isOutOfStock: boolean;
}
```

## User Flows

### Flow 1: Toggle to List View

```
1. User clicks "List" toggle (or presses F2)
2. State updates: viewMode = 'list'
3. SKU input renders at top of product area
4. SKU input receives auto-focus
5. Product list renders in table layout
6. listSelectedIndex = 0
```

### Flow 2: SKU Search with Popover

```
1. User types in SKU input
2. Debounced search (300ms) triggers
3. Filter products by: sku, barcode, name
4. Search results limited to 10 max
5. Popover opens with results grid
6. popoverSelectedIndex = 0
7. User can:
   - Press Enter to select (adds product, closes popover)
   - Press Escape to close popover
   - Press ↑/↓ to navigate results
   - Click outside to dismiss
8. On product select:
   - addItem() called with product
   - Toast notification shown
   - Popover closes
   - SKU input cleared
   - Focus remains in SKU input
```

### Flow 3: List View Keyboard Navigation

```
1. User is in List View
2. Press ↑: listSelectedIndex decrements (wraps at 0)
3. Press ↓: listSelectedIndex increments (wraps at max)
4. Press Enter:
   - addItem() called with selected product
   - Toast shown
   - listSelectedIndex unchanged (for rapid entry)
5. Press Home: listSelectedIndex = 0
6. Press End: listSelectedIndex = max
```

### Flow 4: Toggle Back to Grid View

```
1. User clicks "Grid" toggle (or presses F2)
2. State updates: viewMode = 'grid'
3. SKU input unmounts/hides
4. Product grid renders
5. Focus moves to general search input
```

## UI Design

### View Toggle

```
┌─────────────────────────────────────────────────────────────┐
│ [📱 Grid] | [📋 List]                               [F2]   │
├─────────────────────────────────────────────────────────────┤
```

**Implementation:**
- Segmented control component
- Icons: Grid (grid-3x3), List (list)
- Tooltip: "Toggle view (F2)"

### List View Layout

```
┌─────────────────────────────────────────────────────────────┐
│ SKU: [________________________________]  (auto-focuses)     │
├─────────────────────────────────────────────────────────────┤
│ ┌──────┬──────────────┬──────────┬────────┬────────────────┐ │
│ │ SKU  │ Product      │ Price    │ Stock  │                │ │
│ ├──────┼──────────────┼──────────┼────────┼────────────────┤ │
│ │ ABC1 │ Product A    │ $10.00   │ 50  🟢 │      [+]       │ │ ← Selected
│ │ ABC2 │ Product B    │ $15.00   │ 12  🟢 │      [+]       │ │
│ │ ABC3 │ Product C    │ $8.50    │ 0   🔴 │      [-]       │ │
│ │ ABC4 │ Product D    │ $22.00   │ 8   🟡 │      [+]       │ │
│ │ ABC5 │ Product E    │ $5.00    │ 100 🟢 │      [+]       │ │
│ │ ...  │ ...          │ ...      │ ...    │      ...       │ │
│ └──────┴──────────────┴──────────┴────────┴────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Table Structure:**
```tsx
<table className="w-full">
  <thead>
    <tr className="text-left text-sm text-gray-500 border-b">
      <th className="pb-2 font-medium">SKU</th>
      <th className="pb-2 font-medium">Product</th>
      <th className="pb-2 font-medium text-right">Price</th>
      <th className="pb-2 font-medium text-right">Stock</th>
      <th className="pb-2 font-medium w-20"></th>
    </tr>
  </thead>
  <tbody>
    {filteredProducts.map((product, index) => (
      <tr
        key={product.id}
        className={cn(
          "border-b border-gray-100",
          index === listSelectedIndex && "bg-primary-50"
        )}
        onClick={() => handleProductSelect(product)}
      >
        <td className="py-3 font-mono text-sm">{product.sku}</td>
        <td className="py-3">{product.name}</td>
        <td className="py-3 text-right">${product.price.toFixed(2)}</td>
        <td className="py-3 text-right">
          <StockIndicator quantity={product.stockQuantity} />
        </td>
        <td className="py-3 text-center">
          <Button size="sm" variant="ghost">+</Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### SKU Search Popover

```
                    ┌────────────────────────────┐
SKU: [ABC123]  ────►│  ┌────────┐  ┌────────┐   │
                    │  │ Prod 1 │  │ Prod 2 │   │  ← 2 columns
                    │  │ $10.00 │  │ $15.00 │   │
                    │  └────────┘  └────────┘   │
                    │  ┌────────┐  ┌────────┐   │
                    │  │ Prod 3 │  │ Prod 4 │   │
                    │  │ $8.50  │  │ $12.00 │   │
                    │  └────────┘  └────────┘   │
                    │                            │
                    │  Showing 4 of 10 results   │
                    └────────────────────────────┘
```

**Popover Component:**
```tsx
interface SkuSearchPopoverProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  products: SearchResultProduct[];
  selectedIndex: number;
  onSelect: (product: SearchResultProduct) => void;
  onSelectIndex: (index: number) => void;
}

function SkuSearchPopover({
  query,
  isOpen,
  onClose,
  products,
  selectedIndex,
  onSelect,
  onSelectIndex,
}: SkuSearchPopoverProps) {
  if (!isOpen || !query) return null;

  return (
    <Popover>
      <Popover.Content className="w-80 p-2">
        {products.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No products found for "{query}"
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {products.map((item, index) => (
                <button
                  key={item.product.id}
                  className={cn(
                    "p-2 rounded-lg text-left",
                    index === selectedIndex && "bg-primary-100"
                  )}
                  onClick={() => onSelect(item)}
                >
                  <div className="font-medium text-sm truncate">
                    {item.product.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${item.product.price.toFixed(2)}
                  </div>
                  <StockBadge quantity={item.stockQuantity} />
                </button>
              ))}
            </div>
            {products.length >= 10 && (
              <div className="text-center text-xs text-gray-400 mt-2">
                Showing 10 of {products.length} results
              </div>
            )}
          </>
        )}
      </Popover.Content>
    </Popover>
  );
}
```

### Stock Indicator Component

```tsx
function StockIndicator({ quantity }: { quantity: number }) {
  if (quantity <= 0) {
    return <span className="text-red-500">0 🔴</span>;
  }
  if (quantity < 10) {
    return <span className="text-yellow-600">{quantity} 🟡</span>;
  }
  return <span className="text-green-600">{quantity} 🟢</span>;
}
```

## Implementation Summary

### Files to Create/Modify

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `apps/web/src/components/pos/SkuSearchPopover.tsx` | Created | Popover component for SKU search results |
| 2 | `apps/web/src/components/pos/ProductList.tsx` | Created | Table component for List View |
| 3 | `apps/web/src/components/pos/ViewToggle.tsx` | Created | Toggle control component |
| 4 | `apps/web/src/pages/POS.tsx` | Modified | Add view toggle state, render logic for both views, keyboard handlers |
| 5 | `packages/ui/src/Table.tsx` | Modified | Add Table components if needed |

### Component: ViewToggle

```tsx
interface ViewToggleProps {
  value: 'grid' | 'list';
  onChange: (value: 'grid' | 'list') => void;
}

function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex rounded-lg border border-gray-200 p-1">
      <button
        className={cn(
          "px-3 py-1 rounded-md text-sm font-medium transition-colors",
          value === 'grid' && "bg-primary-600 text-white"
        )}
        onClick={() => onChange('grid')}
      >
        Grid
      </button>
      <button
        className={cn(
          "px-3 py-1 rounded-md text-sm font-medium transition-colors",
          value === 'list' && "bg-primary-600 text-white"
        )}
        onClick={() => onChange('list')}
      >
        List
      </button>
    </div>
  );
}
```

### Component: ProductList

```tsx
interface ProductListProps {
  products: ProductWithStock[];
  selectedIndex: number;
  onSelect: (product: ProductWithStock) => void;
  onSelectIndex: (index: number) => void;
}

function ProductList({
  products,
  selectedIndex,
  onSelect,
  onSelectIndex,
}: ProductListProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        onSelectIndex(Math.max(0, selectedIndex - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        onSelectIndex(Math.min(products.length - 1, selectedIndex + 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (products[selectedIndex]) {
          onSelect(products[selectedIndex]);
        }
        break;
      case 'Home':
        e.preventDefault();
        onSelectIndex(0);
        break;
      case 'End':
        e.preventDefault();
        onSelectIndex(products.length - 1);
        break;
    }
  };

  return (
    <table
      className="w-full"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* ... table implementation ... */}
    </table>
  );
}
```

### POS.tsx Modifications

**State Additions:**
```typescript
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
const [skuSearchQuery, setSkuSearchQuery] = useState('');
const [skuSearchOpen, setSkuSearchOpen] = useState(false);
const [listSelectedIndex, setListSelectedIndex] = useState(0);
const [popoverSelectedIndex, setPopoverSelectedIndex] = useState(0);
```

**Effect: Load saved view mode:**
```typescript
useEffect(() => {
  const saved = localStorage.getItem('pos-view-mode') as 'grid' | 'list';
  if (saved) {
    setViewMode(saved);
  }
}, []);
```

**Effect: Save view mode:**
```typescript
useEffect(() => {
  localStorage.setItem('pos-view-mode', viewMode);
}, [viewMode]);
```

**Effect: Handle F2 shortcut:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'F2') {
      e.preventDefault();
      setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Effect: Auto-focus SKU input:**
```typescript
useEffect(() => {
  if (viewMode === 'list') {
    skuInputRef.current?.focus();
  }
}, [viewMode]);
```

**Effect: SKU search debounce:**
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (skuSearchQuery.trim()) {
      setSkuSearchOpen(true);
    } else {
      setSkuSearchOpen(false);
    }
  }, 300);
  return () => clearTimeout(timer);
}, [skuSearchQuery]);
```

**Keyboard handler for popover:**
```typescript
const handlePopoverKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      setPopoverSelectedIndex(prev => Math.max(0, prev - 1));
      break;
    case 'ArrowDown':
      e.preventDefault();
      setPopoverSelectedIndex(prev =>
        Math.min(skuSearchResults.length - 1, prev + 1)
      );
      break;
    case 'Enter':
      e.preventDefault();
      if (skuSearchResults[popoverSelectedIndex]) {
        handleProductClick(skuSearchResults[popoverSelectedIndex]);
        setSkuSearchOpen(false);
        setSkuSearchQuery('');
      }
      break;
    case 'Escape':
      e.preventDefault();
      setSkuSearchOpen(false);
      break;
  }
};
```

**Render Logic:**
```tsx
return (
  <div className="flex-1 flex flex-col">
    {/* View Toggle */}
    <div className="p-4 pb-2">
      <ViewToggle value={viewMode} onChange={setViewMode} />
    </div>

    {/* Search/Filter Bar */}
    <div className="px-4 pb-4">
      {viewMode === 'list' ? (
        <div className="relative">
          <Input
            ref={skuInputRef}
            placeholder="Enter SKU or barcode..."
            value={skuSearchQuery}
            onChange={(e) => setSkuSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <SkuSearchPopover
            query={skuSearchQuery}
            isOpen={skuSearchOpen}
            onClose={() => setSkuSearchOpen(false)}
            products={skuSearchResults}
            selectedIndex={popoverSelectedIndex}
            onSelect={handleProductClick}
            onSelectIndex={setPopoverSelectedIndex}
          />
        </div>
      ) : (
        <div className="flex gap-4">
          <Input
            placeholder="Search products or scan barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {/* Category filter dropdown */}
        </div>
      )}
    </div>

    {/* Product Area */}
    <div className="flex-1 overflow-auto px-4 pb-4">
      {viewMode === 'list' ? (
        <ProductList
          products={filteredProducts}
          selectedIndex={listSelectedIndex}
          onSelect={handleProductClick}
          onSelectIndex={setListSelectedIndex}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => handleProductClick(product)}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);
```

### Search Logic

```typescript
const skuSearchResults = useMemo(() => {
  if (!skuSearchQuery.trim()) return [];

  const query = skuSearchQuery.toLowerCase();
  return products
    .filter(product => {
      return (
        product.sku.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query)
      );
    })
    .slice(0, 10); // Limit to 10 results
}, [skuSearchQuery, products]);
```

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| No search results | Show "No products found" message in popover |
| Out of stock product | Disable [+], show 0 stock, red indicator |
| Empty SKU input | Popover hidden |
| Rapid typing | 300ms debounce prevents excessive filtering |
| Popover at screen edge | Use floating-ui or auto-flip |
| Lost focus | Close popover on blur (delay 150ms for clicks) |
| Scroll position | Maintain scroll when toggling views |
| Screen readers | Add `aria-live="polite"` to popover |

## Testing Scenarios

1. **View toggle**: Switch Grid → List → Cart → Grid, verify UI updates correctly
2. **SKU input focus (List)**: Switch to List View, verify input auto-focuses
3. **SKU input focus (Cart)**: Switch to Cart View, verify SKU input auto-focuses
4. **SKU search (List View)**: Type SKU, verify popover appears with correct results
5. **SKU search (Cart View)**: Type SKU in Cart View, verify popover appears
6. **Popover keyboard nav**: Navigate results with ↑/↓, select with Enter
7. **List keyboard nav**: Navigate products with ↑/↓, add with Enter
8. **F2 shortcut**: Press F2 multiple times, verify cycling: Grid → List → Cart → Grid
9. **No results**: Search for non-existent SKU, verify empty state in popover
10. **Out of stock**: Search/add product with 0 stock, verify disabled
11. **Clear input**: Click X, verify input cleared and popover closed
12. **Escape key**: Press Escape in popover, verify closes
13. **Category filter**: Filter by category in Grid and List Views
14. **Performance**: 100+ products, verify rendering performance
15. **Persistence**: Refresh page, verify view mode persists
16. **Customer Display (Grid View)**: Open Customer Display, use Grid View, add product, verify Customer Display updates (baseline test)
17. **Customer Display (List View)**: Open Customer Display, switch to List View, add product via SKU, verify Customer Display updates in real-time
18. **Customer Display (Cart View)**: Open Customer Display, switch to Cart View, add product via SKU, verify Customer Display updates
19. **Cart View cart actions**: In Cart View, test [+]/[-] quantity, remove item, verify updates
20. **Cart View discount**: In Cart View, apply discount code, verify total updates
21. **Cart View hold**: In Cart View, click Hold Order, verify modal appears and works
22. **Cart View clear**: In Cart View, click Clear Cart, verify cart empties
23. **Cart View empty state**: Switch to Cart View with empty cart, verify empty state message
24. **Cart View barcode scanner**: Use barcode scanner in Cart View, verify product adds to cart

## Related Documents

- **PRD**: [POS View Enhancement PRD](../prd/pos-view-enhancement-prd.md) - Product requirements, user personas, goals, success metrics
- **POS Page**: [apps/web/src/pages/POS.tsx](../apps/web/src/pages/POS.tsx) - Main component
- **Cart Store**: [apps/web/src/stores/cartStore.ts](../apps/web/src/stores/cartStore.ts) - Cart state management (includes BroadcastChannel sync)
- **Database**: [apps/web/src/db/index.ts](../apps/web/src/db/index.ts) - IndexedDB schema
- **Customer Display**: [apps/web/src/pages/CustomerDisplay.tsx](../apps/web/src/pages/CustomerDisplay.tsx) - Customer-facing display (no changes required)
- **Cart View Component**: [apps/web/src/components/pos/CartView.tsx](../apps/web/src/components/pos/CartView.tsx) - Full-width cart view (to be created)
