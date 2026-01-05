# Feature Specification: Product Bundle Promo

## Status

**In Progress - P0 Complete** - 2026-01-05

> **Business Context**: See [Product Bundle Promo PRD](../prd/product-bundle-promo-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

## Implementation Summary

**Completed (P0):**
- Backend schema with promo fields on products
- Frontend IndexedDB schema and sync
- Cart store with promo calculation logic
- POS UI with promo badges and savings display
- CartView with promo savings in order summary

**Remaining:**
- Admin Panel product form promo fields
- ProductList promo indicator
- Promo reporting

## Overview

Product Bundle Promo allows retailers to create product-specific promotional pricing that applies automatically when customers add eligible products to cart. Unlike cart-level discount codes that require manual entry, product promos are tied directly to product SKUs and apply automatically based on quantity thresholds and date ranges.

## Use Cases

1. **Quantity-Based Discounts**: "Buy 2, Get 30% Off" on specific products
2. **Bundle Pricing**: "Buy 3 for $10" fixed-price bundles
3. **Time-Limited Offers**: "Holiday Sale - 20% Off All Electronics" (date-restricted)
4. **Clearance/Promotional Pricing**: Mark down slow-moving inventory with automatic discounts

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Promo tied to product SKU | Yes - stored on product record |
| Discount types | Percentage or Fixed Amount |
| Minimum quantity trigger | Yes (e.g., "Buy 2") |
| Fixed discount scope | Per order total (not per item) |
| Date range validity | Yes - optional start/end dates |
| Stacking with cart discounts | Yes - both apply |
| Offline promo creation | No - admin-only, syncs to client |
| Promo reporting | Yes - track usage in admin reports |

## Data Model

### Database Schema Changes

#### Backend - PostgreSQL (`apps/api/src/db/schema.ts`)

```typescript
// Add to products table:
hasPromo: boolean('has_promo').default(false).notNull(),
promoType: discountTypeEnum('promo_type'),
promoValue: decimal('promo_value', { precision: 12, scale: 2 }),
promoMinQty: integer('promo_min_qty').default(1),
promoStartDate: timestamp('promo_start_date'),
promoEndDate: timestamp('promo_end_date'),
```

#### Frontend - IndexedDB (`apps/web/src/db/index.ts`)

```typescript
export interface LocalProduct {
  // ... existing fields ...
  hasPromo: boolean;
  promoType: 'percentage' | 'fixed' | null;
  promoValue: number | null;
  promoMinQty: number;
  promoStartDate: string | null;
  promoEndDate: string | null;
}
```

#### Cart Store (`apps/web/src/stores/cartStore.ts`)

```typescript
export interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountId?: string;           // Cart-level discount
  discountName?: string;
  discountValue: number;         // Cart-level discount amount
  promoType?: 'percentage' | 'fixed' | null;  // Product promo
  promoValue?: number;           // Product promo value
  promoMinQty?: number;          // Min qty for promo
  promoDiscount?: number;        // Calculated promo discount
  subtotal: number;
}
```

### Dexie Schema Update

```typescript
this.version(X).stores({
  // ... existing tables ...
  products: 'id, storeId, sku, barcode, hasPromo, promoEndDate',
});
```

## Technical Implementation

### Promo Eligibility Check

```typescript
function isPromoActive(product: LocalProduct): boolean {
  if (!product.hasPromo) return false;
  
  const now = new Date();
  
  if (product.promoStartDate && new Date(product.promoStartDate) > now) {
    return false;
  }
  
  if (product.promoEndDate && new Date(product.promoEndDate) < now) {
    return false;
  }
  
  return true;
}
```

### Discount Calculation Logic

```typescript
function calculatePromoDiscount(
  quantity: number,
  unitPrice: number,
  promoType: 'percentage' | 'fixed',
  promoValue: number,
  promoMinQty: number
): number {
  // Check if quantity meets minimum
  if (quantity < promoMinQty) {
    return 0;
  }
  
  const basePrice = unitPrice * quantity;
  
  if (promoType === 'percentage') {
    // Percentage: e.g., 30% off the total
    return Math.round((basePrice * promoValue) / 100 * 100) / 100;
  } else {
    // Fixed: $5 off TOTAL (not per item)
    return promoValue;
  }
}

function calculateItemSubtotal(item: Omit<CartItem, 'subtotal'>): number {
  const basePrice = item.unitPrice * item.quantity;
  
  // Calculate product promo discount
  let promoDiscount = 0;
  if (item.promoType && item.promoValue && item.promoMinQty) {
    promoDiscount = calculatePromoDiscount(
      item.quantity,
      item.unitPrice,
      item.promoType,
      item.promoValue,
      item.promoMinQty
    );
  }
  
  // Cart-level discount (existing functionality)
  const cartDiscount = item.discountValue || 0;
  
  // Total discount = promo + cart-level
  const totalDiscount = promoDiscount + cartDiscount;
  
  return Math.round((basePrice - totalDiscount) 100) / 100;
}
```

### Cart Store Updates

#### addItem Action

```typescript
addItem: (newItem, productPromo?: PromoInfo) => {
  const items = get().items;
  const existingIndex = items.findIndex(item => item.productId === newItem.productId);

  if (existingIndex >= 0) {
    // Merge with existing item - recalculate promo
    const existingItem = items[existingIndex];
    const updatedQuantity = existingItem.quantity + newItem.quantity;
    
    let promoDiscount = 0;
    if (existingItem.promoType && existingItem.promoValue && existingItem.promoMinQty) {
      promoDiscount = calculatePromoDiscount(
        updatedQuantity,
        existingItem.unitPrice,
        existingItem.promoType,
        existingItem.promoValue,
        existingItem.promoMinQty
      );
    }
    
    const updatedItem = {
      ...existingItem,
      quantity: updatedQuantity,
      promoDiscount,
      subtotal: calculateItemSubtotal({
        ...existingItem,
        quantity: updatedQuantity,
        promoDiscount,
      }),
    };
    
    // ... update state ...
  } else {
    // New item with promo
    const promoDiscount = productPromo 
      ? calculatePromoDiscount(
          newItem.quantity,
          newItem.unitPrice,
          productPromo.type,
          productPromo.value,
          productPromo.minQty
        )
      : 0;
    
    const item = {
      ...newItem,
      promoType: productPromo?.type,
      promoValue: productPromo?.value,
      promoMinQty: productPromo?.minQty,
      promoDiscount,
      subtotal: calculateItemSubtotal({ ...newItem, promoDiscount }),
    };
    
    // ... update state ...
  }
}
```

#### updateItemQuantity Action

```typescript
updateItemQuantity: (productId, quantity) => {
  if (quantity <= 0) {
    get().removeItem(productId);
    return;
  }

  const items = get().items.map(item => {
    if (item.productId === productId) {
      // Recalculate promo discount based on new quantity
      let promoDiscount = 0;
      if (item.promoType && item.promoValue && item.promoMinQty) {
        promoDiscount = calculatePromoDiscount(
          quantity,
          item.unitPrice,
          item.promoType,
          item.promoValue,
          item.promoMinQty
        );
      }

      return {
        ...item,
        quantity,
        promoDiscount,
        subtotal: calculateItemSubtotal({
          ...item,
          quantity,
          promoDiscount,
        }),
      };
    }
    return item;
  });

  set({ items });
  get().calculateTotals();
  broadcastCartState(get());
}
```

### Order Summary Calculation

Update `calculateTotals` to track promo savings:

```typescript
calculateTotals: () => {
  const { items, cartDiscount } = get();
  
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.unitPrice * item.quantity);
  }, 0);
  
  // Calculate promo savings (for display)
  const totalPromoDiscount = items.reduce((sum, item) => {
    return sum + (item.promoDiscount || 0);
  }, 0);
  
  // Cart-level discount
  const cartDiscountAmount = cartDiscount?.amount ?? 0;
  
  // Total discount = promo + cart-level
  const discountAmount = totalPromoDiscount + cartDiscountAmount;
  
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * TAX_RATE * 100) / 100;
  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

  set({
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount,
    totalPromoDiscount,  // Track for reporting
    taxAmount,
    total,
  });
}
```

## User Flows

### Flow 1: Automatic Promo Application (Quantity Threshold)

```
1. Cashier scans "Wireless Earbuds" (SKU: WE-001, Price: $49.99, Promo: 30% off, Min Qty: 2)
2. Cart shows 1 x $49.99 = $49.99 (no promo yet)
3. Cashier scans another "Wireless Earbuds"
4. System detects qty=2 meets min threshold
5. Cart auto-applies 30% off
6. Item shows: $99.98 → $69.98
7. Savings badge: "You save $30.00"
```

### Flow 2: Promo Loss When Quantity Reduced

```
1. Cart has 2 x Wireless Earbuds at $69.98 (30% off applied)
2. Cashier reduces quantity to 1
3. System detects qty=1 < min threshold of 2
4. Promo removed, price recalculated
5. Cart shows: 1 x $49.99 = $49.99
```

### Flow 3: Stacking Product Promo + Cart Discount

```
1. Cart has 2 x Wireless Earbuds with 30% promo = $69.98
2. Cashier applies cart-level discount code "SAVE10" (10% off cart)
3. Both discounts apply:
   - Subtotal: $99.98
   - Promo discount: -$30.00
   - Cart discount (10% of $69.98): -$7.00
   - Total: $62.98
```

## UI Design

### Product Grid - Promo Badge

```
┌─────────────────────────────────────┐
│  [Product Image]                    │
│                                     │
│  Wireless Earbuds                   │
│  SKU: WE-001                        │
│  ★★★ NEW                           │
│  $49.99  →  $34.99                  │
│  [30% OFF (Min 2)] ← Promo badge    │
│  Stock: 45                          │
└─────────────────────────────────────┘
```

### Cart Item - Promo Display

```
┌─────────────────────────────────────────────────────┐
│  Wireless Earbuds                       $34.99 x2  │
│  $49.99 each (30% OFF)                                │
│  [-] 2 [+]                                     $69.98 │
│  ✓ You save $30.00                                  │
└─────────────────────────────────────────────────────┘
```

### Order Summary - Promo Savings

```
Order Summary
─────────────────────────────────────────────────
Subtotal                    $99.98
Promo Savings              -$30.00
SAVE10 (10%)               -$7.00
Tax (10%)                   $6.30
─────────────────────────────────────────────────
Total                      $69.28
Pay $69.28
─────────────────────────────────────────────────
[Hold] [Clear]             [Pay $69.28]
```

### Product List View - Promo Indicator

| SKU | Product | Price | Stock | Promo | Action |
|-----|---------|-------|-------|-------|--------|
| WE-001 | Wireless Earbuds | $49.99 | 45 | 🔴 30% OFF (Min 2) | [+](button) |
| USB-C1 | USB-C Cable | $12.99 | 120 | - | [+](button) |

### Admin Panel - Product Form

```
Product Details
─────────────────────────────────────────────────
SKU: WE-001
Name: Wireless Earbuds
Price: $49.99
─────────────────────────────────────────────────

Promo Settings
─────────────────────────────────────────────────
[✓] Enable Promo

Promo Type:  (•) Percentage  ( ) Fixed Amount
Value:       [__________] 30
Min Quantity: [____] 2

Valid Period:
Start Date:  [____________] (optional)
End Date:    [____________] (optional)

Preview: "30% OFF (Min 2)"
─────────────────────────────────────────────────
[Cancel] [Save Product]
```

## API Endpoints

### GET /products/:id

Returns product with promo fields:

```json
{
  "id": "uuid",
  "sku": "WE-001",
  "name": "Wireless Earbuds",
  "price": "49.99",
  "hasPromo": true,
  "promoType": "percentage",
  "promoValue": "30.00",
  "promoMinQty": 2,
  "promoStartDate": null,
  "promoEndDate": "2026-01-31T23:59:59Z"
}
```

### Sync Response

Products sync includes promo fields:

```json
{
  "products": [
    {
      "id": "uuid",
      "storeId": "uuid",
      "sku": "WE-001",
      "name": "Wireless Earbuds",
      "price": "49.99",
      "hasPromo": true,
      "promoType": "percentage",
      "promoValue": "30.00",
      "promoMinQty": 2,
      "promoStartDate": null,
      "promoEndDate": "2026-01-31T23:59:59Z"
    }
  ]
}
```

## Admin Panel Integration

### Product Form Updates

Add promo fields to product create/edit form:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Enable Promo | Checkbox | No | - |
| Promo Type | Radio (percentage/fixed) | If promo enabled | - |
| Promo Value | Number | If promo enabled | > 0 |
| Min Quantity | Number | If promo enabled | >= 1, default 1 |
| Start Date | Date picker | No | < End Date if set |
| End Date | Date picker | No | > Start Date if set |

### Promo Reports

Add promo usage tracking to admin reports:

**Promo Performance Report:**

| Promo | Products | Uses | Revenue | Savings |
|-------|----------|------|---------|---------|
| 30% OFF (Min 2) | Wireless Earbuds | 156 | $4,892 | $2,098 |
| Buy 3 for $10 | USB-C Cable | 89 | $890 | $178 |
| 20% Clearance | Various | 234 | $3,456 | $864 |

**Report Fields:**
- Promo name/description
- Product(s) included
- Total uses (transaction count)
- Total revenue during promo period
- Total customer savings

## Implementation Phases

### Phase 1: Backend Schema & Admin UI

**Status:** Complete (Backend) | Pending (Admin UI)

1. ✅ Add promo columns to PostgreSQL `products` table
2. ✅ Create migration script (via drizzle generate)
3. ✅ Update Drizzle schema
4. ⏳ Add promo fields to Admin Panel product form
5. ⏳ Test promo creation/editing in admin

### Phase 2: Frontend Data Layer

**Status:** Complete

1. ✅ Update `LocalProduct` interface in IndexedDB
2. ✅ Update Dexie schema version to 5
3. ✅ Test product sync includes promo fields
4. ✅ Verify offline storage of promo data

### Phase 3: Cart Logic

**Status:** Complete

1. ✅ Update `CartItem` interface with promo fields
2. ✅ Implement `calculatePromoDiscount` function
3. ✅ Update `addItem` action for promo calculation
4. ✅ Update `updateItemQuantity` to recalculate promo
5. ✅ Update `calculateTotals` to track promo savings
6. ✅ Test promo application/removal scenarios

### Phase 4: POS UI Updates

**Status:** Partial (Grid & Cart View) | Pending (List View)

1. ✅ Add promo badges to product grid
2. ⏳ Add promo indicator to product list view
3. ✅ Update cart item display with promo savings
4. ✅ Update order summary with promo discount line
5. ✅ Test all view modes (grid, cart)

### Phase 5: Admin Reports

**Status:** Pending

1. ⏳ Add promo usage tracking
2. ⏳ Create promo performance report
3. ⏳ Add promo filters to existing reports
4. ⏳ Test reporting accuracy

## Files to Create/Modify

### New Files

None (feature builds on existing structures)

### Modified Files

| File | Status | Description |
|------|--------|-------------|
| `apps/api/src/db/schema.ts` | ✅ Complete | Add promo columns to products table |
| `apps/web/src/db/index.ts` | ✅ Complete | Add promo fields to LocalProduct, update schema to v5 |
| `apps/web/src/stores/cartStore.ts` | ✅ Complete | Add promo to CartItem, implement promo calculation |
| `apps/web/src/pages/POS.tsx` | ✅ Complete | Pass promo info on add item, show badges |
| `apps/web/src/components/pos/CartView.tsx` | ✅ Complete | Display promo savings in summary |
| `apps/web/src/services/sync.ts` | ✅ Complete | Update transformProduct to include promo fields |
| `apps/web/src/components/pos/ViewToggle.tsx` | ✅ Complete | Remove unused List import |
| `apps/web/src/components/pos/ProductList.tsx` | ⏳ Pending | Show promo indicator in list |
| `apps/admin/src/pages/Products.tsx` | ⏳ Pending | Add promo fields to product form |
| `apps/admin/src/pages/Reports.tsx` | ⏳ Pending | Add promo usage reports |

## Technical Verification

### Build Status
- ✅ TypeScript: Pass
- ✅ ESLint: Pass

### Modified Files Summary

1. **Backend Schema** (`apps/api/src/db/schema.ts`)
   - Added: `hasPromo`, `promoType`, `promoValue`, `promoMinQty`, `promoStartDate`, `promoEndDate`

2. **IndexedDB Schema** (`apps/web/src/db/index.ts`)
   - Updated `LocalProduct` interface with promo fields
   - Bumped version to 5, added `hasPromo` index

3. **Cart Store** (`apps/web/src/stores/cartStore.ts`)
   - Added promo fields to `CartItem` interface
   - Implemented `calculatePromoDiscount()` function
   - Updated `calculateItemSubtotal()` with promo calculation
   - Added `totalPromoDiscount` state

4. **Sync Service** (`apps/web/src/services/sync.ts`)
   - Updated `transformProduct()` to include promo fields from API response

5. **POS Page** (`apps/web/src/pages/POS.tsx`)
   - Added `isPromoActive()` and `getPromoLabel()` helpers
   - Updated barcode scan and product click handlers
   - Added promo badge to product grid cards

6. **CartView** (`apps/web/src/components/pos/CartView.tsx`)
   - Updated to show promo label and savings on cart items
   - Added promo savings line item to order summary

## Testing Scenarios

### Unit Tests

1. ✅ Promo eligibility check (date range, min quantity)
2. ✅ Percentage discount calculation
3. ✅ Fixed discount calculation ($5 off total, not per item)
4. ✅ Promo stacking with cart discount
5. ✅ Promo removal when quantity drops below threshold
6. ⏳ Promo removal when date expires

### Integration Tests

1. ⏳ Admin creates promo, syncs to POS (needs Admin Panel update)
2. ✅ POS applies promo when adding qualifying product
3. ✅ Cart recalculates when quantity changes
4. ⏳ Transaction saved with promo discount captured
5. ⏳ Reports show accurate promo usage

### Edge Cases

| Edge Case | Expected Behavior | Status |
|-----------|-------------------|--------|
| Product has promo but quantity < min | No promo applied | ✅ Verified |
| Quantity increases to meet min | Promo auto-applies | ✅ Verified |
| Quantity decreases below min | Promo removed, price recalculated | ✅ Verified |
| Promo expires while in cart | Promo removed, price recalculated | ⏳ Partial |
| Mixed products with/without promos | Each handled independently | ✅ Verified |
| Cart discount + product promo | Both apply (sum discounts) | ✅ Verified |
| Two different product promos in cart | Each applies independently | ✅ Verified |

## Related Documents

- **PRD**: [Product Bundle Promo PRD](../prd/product-bundle-promo-prd.md) - Product requirements, user personas, goals, success metrics
- **Database Schema**: `apps/api/src/db/schema.ts`
- **Cart Store**: `apps/web/src/stores/cartStore.ts`
- **POS Page**: `apps/web/src/pages/POS.tsx`
- **CartView**: `apps/web/src/components/pos/CartView.tsx`
- **Sync Service**: `apps/web/src/services/sync.ts`
