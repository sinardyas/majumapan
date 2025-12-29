# ADR-0002: Decimal String to Number Conversion in Sync Service

## Status

Accepted

## Date

2024-12-29

## Context

The POS system uses a PostgreSQL database with Drizzle ORM on the backend and IndexedDB (via Dexie.js) on the frontend for offline-first storage. Data is synchronized from the server to the client via the sync service.

### Problem Discovered

When applying a discount code in the POS page, the following error occurred:

```
Error applying discount: TypeError: discount.minPurchaseAmount.toFixed is not a function
    at handleApplyDiscount
```

The error occurred at this line in `POS.tsx`:

```typescript
setDiscountError(`Minimum purchase of $${discount.minPurchaseAmount.toFixed(2)} required`);
```

### Root Cause Analysis

#### Database Schema
In PostgreSQL, monetary values are stored as `decimal` type for precision:

```typescript
// apps/api/src/db/schema.ts
minPurchaseAmount: decimal('min_purchase_amount', { precision: 12, scale: 2 }),
maxDiscountAmount: decimal('max_discount_amount', { precision: 12, scale: 2 }),
value: decimal('value', { precision: 12, scale: 2 }),
price: decimal('price', { precision: 12, scale: 2 }),
costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
```

#### Drizzle ORM Behavior
**Drizzle ORM returns PostgreSQL `decimal` fields as strings**, not JavaScript numbers. This is intentional to preserve precision, as JavaScript's `Number` type uses IEEE 754 floating-point which can lose precision with large decimal values.

Example API response:
```json
{
  "id": "uuid-here",
  "value": "10.00",           // String, not number!
  "minPurchaseAmount": "50.00", // String, not number!
  "maxDiscountAmount": "25.00"  // String, not number!
}
```

#### Frontend Type Definitions
The frontend TypeScript interfaces define these fields as `number`:

```typescript
// apps/web/src/db/index.ts
export interface LocalDiscount {
  value: number;
  minPurchaseAmount: number | null;
  maxDiscountAmount: number | null;
  // ...
}

export interface LocalProduct {
  price: number;
  costPrice: number | null;
  // ...
}
```

#### The Mismatch
When sync saved API data directly to IndexedDB without conversion, string values were stored where numbers were expected. JavaScript's duck typing allowed comparisons to work (string coercion), but method calls like `.toFixed()` failed because strings don't have this method.

## Decision

We will **convert decimal string fields to JavaScript numbers during the sync process**. This ensures that data stored in IndexedDB matches the TypeScript type definitions.

### Implementation

#### Helper Functions

Added to `apps/web/src/services/sync.ts`:

```typescript
/**
 * Safely converts a decimal string (or number) to a JavaScript number.
 * Returns null if the input is null/undefined.
 */
function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Safely converts a decimal string (or number) to a JavaScript number.
 * Returns 0 if the input is null/undefined.
 */
function toNumberOrZero(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}
```

#### Transform Functions

```typescript
/**
 * Transforms a product from API response to local storage format.
 */
function transformProduct(p: Record<string, unknown>): LocalProduct {
  return {
    // ... other fields
    price: toNumberOrZero(p.price),
    costPrice: toNumber(p.costPrice),
    // ...
  };
}

/**
 * Transforms a discount from API response to local storage format.
 */
function transformDiscount(d: Record<string, unknown>): LocalDiscount {
  return {
    // ... other fields
    value: toNumberOrZero(d.value),
    minPurchaseAmount: toNumber(d.minPurchaseAmount),
    maxDiscountAmount: toNumber(d.maxDiscountAmount),
    // ...
  };
}
```

#### Usage in Sync Operations

Applied in both `fullSync()` and `pullChanges()`:

```typescript
// Full sync
await db.products.bulkPut(
  products.map(p => transformProduct(p))
);
await db.discounts.bulkPut(
  discounts.map(d => transformDiscount(d))
);

// Pull changes
await db.products.bulkPut(
  changes.products.created.map(p => transformProduct(p))
);
```

### Defensive Measures

Additionally, defensive `Number()` conversions were added in `POS.tsx` to handle edge cases where data might not have been synced properly:

```typescript
// Check minimum purchase
const minPurchase = Number(discount.minPurchaseAmount);
if (minPurchase && subtotal < minPurchase) {
  setDiscountError(`Minimum purchase of $${minPurchase.toFixed(2)} required`);
  return;
}

// Apply max discount cap
const maxDiscount = Number(discount.maxDiscountAmount);
if (maxDiscount && discountValue > maxDiscount) {
  discountValue = maxDiscount;
}
```

## Consequences

### Positive

- **Fixes the runtime error**: `.toFixed()` now works correctly on number values
- **Type safety honored**: Data in IndexedDB now matches TypeScript interfaces
- **Single source of truth**: Conversion happens at data entry point (sync), not scattered across usage sites
- **Prevents future bugs**: All code that uses these fields can rely on them being numbers
- **Defensive programming**: Additional guards in POS.tsx handle edge cases

### Negative

- **Potential precision loss**: Very large decimal values (>15 significant digits) may lose precision
- **Additional transformation step**: Slight overhead during sync operations

### Precision Considerations

For this POS application, precision loss is not a concern because:
1. Currency values are typically limited to 2 decimal places
2. The maximum precision needed is `decimal(12, 2)` which is well within JavaScript's safe integer range
3. Product prices and discount values are unlikely to exceed millions of dollars

## Alternatives Considered

### Alternative A: Fix only at usage sites

Add `Number()` conversion wherever decimal fields are used.

**Rejected because:**
- Requires changes in multiple locations
- Easy to miss some usages
- Increases cognitive load for developers
- Type definitions would be misleading (says `number` but might be `string`)

### Alternative B: Change TypeScript interfaces to `string | number`

Update `LocalProduct` and `LocalDiscount` interfaces to accept both types.

**Rejected because:**
- Reduces type safety
- Still requires conversion at usage sites
- Makes the codebase more complex
- Doesn't solve the `.toFixed()` problem

### Alternative C: Configure Drizzle to return numbers

Some ORMs allow configuring decimal handling behavior.

**Rejected because:**
- Drizzle's behavior is intentional for precision preservation
- Would affect all decimal fields globally
- May cause issues with very large values
- Less explicit than handling conversion in sync service

## Files Changed

- `apps/web/src/services/sync.ts` - Added transform functions, applied to fullSync and pullChanges
- `apps/web/src/pages/POS.tsx` - Added defensive Number() conversions

## Affected Entities

| Entity | Fields Converted |
|--------|------------------|
| Product | `price`, `costPrice` |
| Discount | `value`, `minPurchaseAmount`, `maxDiscountAmount` |

## Testing Recommendations

1. **Clear IndexedDB** before testing to ensure fresh data with correct types
2. **Test discount application** with various discount types (percentage, fixed)
3. **Verify product prices** display correctly in POS grid
4. **Check cart calculations** for correct totals

## References

- [Drizzle ORM Decimal Type](https://orm.drizzle.team/docs/column-types/pg#decimal)
- [JavaScript Number Precision](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
- [IEEE 754 Floating Point](https://en.wikipedia.org/wiki/IEEE_754)

## Lessons Learned

1. **Always verify data types at integration boundaries** - API responses may have different types than expected
2. **Drizzle ORM returns decimals as strings** - This is documented but easy to overlook
3. **Transform data at entry points** - Converting at sync time is cleaner than at usage sites
4. **TypeScript types don't guarantee runtime types** - JavaScript's dynamic typing means data can violate interfaces
5. **Add defensive measures for critical paths** - Redundant checks in POS prevent transaction failures
