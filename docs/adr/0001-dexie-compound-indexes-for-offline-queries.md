# ADR-0001: Dexie Query Pattern for Offline Data Access

## Status

Accepted (Revised)

## Date

2024-12-28

## Context

The POS system uses Dexie.js (IndexedDB wrapper) for offline-first data storage. After user login, product and category data is synced from the server and stored in IndexedDB for offline access.

### Problem Discovered

When loading the POS page, products and categories were not displaying even though:
1. The sync operation completed successfully
2. Store data was correctly retrieved from IndexedDB
3. The `user.storeId` was correctly populated

Debug logging revealed that queries like the following returned empty arrays:

```typescript
const localProducts = await db.products
  .where({ storeId: user.storeId, isActive: true })
  .toArray();
```

### Root Cause Analysis

#### Initial Hypothesis (Incorrect)
We initially believed the issue was due to missing compound indexes. We attempted to add compound indexes like `[storeId+isActive]` to the Dexie schema.

#### Actual Root Cause
**IndexedDB does not support boolean values as index keys.**

When we defined a compound index `[storeId+isActive]` where `isActive` is a boolean field, IndexedDB threw the error:

```
Failed to execute 'bound' on 'IDBKeyRange': The parameter is not a valid key.
DataError: Failed to execute 'bound' on 'IDBKeyRange': The parameter is not a valid key.
```

According to the IndexedDB specification, valid key types are:
- Numbers
- Strings  
- Dates
- Arrays (containing valid keys)
- Binary data

**Booleans are NOT valid index keys.**

Additionally, Dexie's `.where({ key1: val1, key2: val2 })` compound query syntax requires either:
1. A compound index for efficient lookup, OR
2. All keys to be indexed individually (with some limitations)

## Decision

We will use a **filter-based query pattern** instead of compound indexes for queries involving boolean fields.

### Query Pattern

Instead of:
```typescript
// Does NOT work - compound query with boolean
await db.products
  .where({ storeId: user.storeId, isActive: true })
  .toArray();
```

Use:
```typescript
// Works - single index + filter
await db.products
  .where('storeId')
  .equals(user.storeId)
  .filter(p => p.isActive === true)
  .toArray();
```

### Schema Design (Version 3)

```javascript
this.version(3).stores({
  categories: 'id, storeId, name',
  products: 'id, storeId, categoryId, sku, barcode, name',
  stock: 'id, storeId, productId, [storeId+productId]',
  discounts: 'id, storeId, code, discountScope',
  transactions: 'clientId, storeId, syncStatus, clientTimestamp, createdAt',
  syncMeta: 'key',
  store: 'id',
});
```

Key decisions:
1. **Removed `isActive` from all indexes** - Boolean fields cannot be indexed
2. **Kept `[storeId+productId]` compound index on stock table** - Both fields are strings (UUIDs), which are valid index keys
3. **Use filter-based queries** for boolean conditions

### Compound Index Usage

The `[storeId+productId]` compound index on the `stock` table is valid and efficient because both fields are UUIDs (strings). Usage:

```typescript
// Efficient lookup using compound index
await db.stock
  .where('[storeId+productId]')
  .equals([storeId, productId])
  .first();
```

## Consequences

### Positive

- **Fixes the IndexedDB error**: Boolean fields are no longer indexed
- **Queries work correctly**: Products and categories now load in POS
- **Maintains data model**: No need to convert booleans to numbers
- **Simple implementation**: Filter-based queries are easy to understand
- **Stock queries remain optimized**: Compound index on non-boolean fields

### Negative

- **Slightly less performant for filtered queries**: The filter runs in memory after the index lookup
- **All records matching the index are loaded first**: Then filtered in JavaScript

### Performance Considerations

For this application, the performance impact is negligible because:
1. Typical store has <10,000 products
2. Filter operations on this scale are fast (<10ms)
3. The primary index (`storeId`) significantly reduces the dataset before filtering

## Alternatives Considered

### Alternative A: Convert booleans to numbers (0/1)

Store `isActive` as `0` or `1` instead of `true`/`false`.

**Rejected because:**
- Requires changes to TypeScript interfaces
- Requires data transformation in sync service
- Adds complexity to the codebase
- Type safety is reduced

### Alternative B: Use string values ('true'/'false')

Store `isActive` as string `'true'` or `'false'`.

**Rejected because:**
- Same issues as Alternative A
- Even less type-safe
- Confusing for developers

### Alternative C: Remove isActive from queries entirely

Always load all records and filter in the component.

**Rejected because:**
- Would load inactive products unnecessarily
- Less efficient than filter-based approach

## Version History

| Version | Changes |
|---------|---------|
| 1 | Initial schema |
| 2 | Attempted compound indexes with booleans (failed) |
| 3 | Removed boolean indexes, use filter pattern |

## Files Changed

- `apps/web/src/db/index.ts` - Schema v3, updated helper functions
- `apps/web/src/pages/POS.tsx` - Updated queries to filter pattern
- `apps/web/src/pages/Products.tsx` - Updated queries to filter pattern

## References

- [IndexedDB Key Types](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology#key)
- [Dexie.js Compound Index Documentation](https://dexie.org/docs/Compound-Index)
- [Dexie.js WhereClause.filter()](https://dexie.org/docs/WhereClause/WhereClause.filter())

## Lessons Learned

1. **IndexedDB has strict key type requirements** - Always verify that index key types are valid (number, string, date, array)
2. **Test schema changes with actual data** - Boolean index issues only manifest at runtime
3. **Filter-based queries are acceptable** - For typical dataset sizes, the performance difference is negligible
4. **Keep compound indexes for valid key types** - UUID compound indexes like `[storeId+productId]` work well
