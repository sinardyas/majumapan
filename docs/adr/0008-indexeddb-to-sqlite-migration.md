# ADR-0008: IndexedDB to SQLite Wasm Migration

## Status

Accepted

## Date

2025-01-01

## Context

The POS web application currently uses IndexedDB via Dexie.js 4.x for offline-first data persistence. After 6 months of production use and the implementation of several features (Hold Orders, Sync Status Page), we are evaluating the database layer for potential improvements.

### Current Implementation

**Technology Stack:**
- **Database:** IndexedDB (browser native)
- **Wrapper:** Dexie.js 4.x
- **Schema Version:** 4
- **Tables:** 8 (categories, products, stock, discounts, transactions, syncMeta, store, heldOrders)
- **Total Files:** 1 core DB file + 1 sync service + 4 related pages

**Current Schema:**
```
┌─────────────────┬────────────────────────────────────┐
│ Table           │ Indexes                            │
├─────────────────┼────────────────────────────────────┤
│ categories      │ id, storeId, name                  │
│ products        │ id, storeId, categoryId, sku,      │
│                 │ barcode, name                      │
│ stock           │ id, storeId, productId,            │
│                 │ [storeId+productId] (compound)     │
│ discounts       │ id, storeId, code, discountScope   │
│ transactions    │ clientId, storeId, syncStatus,     │
│                 │ clientTimestamp, createdAt         │
│ syncMeta        │ key                                │
│ store           │ id                                 │
│ heldOrders      │ id, storeId, cashierId, heldAt,    │
│                 │ expiresAt                          │
└─────────────────┴────────────────────────────────────┘
```

### Problem Statement

1. **Query Limitations:** Dexie.js provides a NoSQL-like API that doesn't support:
   - Complex JOINs
   - Aggregation queries (COUNT, SUM, GROUP BY)
   - Full-text search
   - JSON operations

2. **Performance Concerns:**
   - No WAL (Write-Ahead Logging) mode for concurrent reads
   - Limited compound index support
   - In-memory filtering for boolean fields (ADR-0001)

3. **Future Requirements:**
   - Complex reporting queries (grouped by category, time periods)
   - Potential product search with fuzzy matching
   - Audit log queries with multiple filters

4. **Dexie.js Limitations:**
   - No reactive queries (liveQuery available but not used)
   - Schema versioning is cumbersome
   - Limited migration support

## Decision

We will migrate from IndexedDB (Dexie.js) to **SQLite Wasm** using the official `@sqlite.org/sqlite-wasm` package.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      POS Web Application                         │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐ │
│  │   React     │───▶│   SQLite     │───▶│  OPFS (Origin      │ │
│  │   Pages     │    │   Wasm       │    │  Private File      │ │
│  └─────────────┘    │   (WASM)     │    │  System)           │ │
│                     └──────────────┘    └────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│                     ┌──────────────┐                           │
│                     │  WAL Mode    │                           │
│                     │  + Indexes   │                           │
│                     └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### Storage Backend: OPFS (Origin Private File System)

OPFS provides:
- Persistent storage in browser
- File-based access (better than IndexedDB blob storage)
- Supports SQLite's native file operations
- Better performance for write-heavy workloads
- Works with SQLite WAL mode

### Implementation Strategy

**Phase 1: Foundation**
- Install `@sqlite.org/sqlite-wasm`
- Configure Vite with `vite-plugin-wasm`
- Implement SQLite connection with OPFS backend
- Create schema migration system

**Phase 2: Data Layer**
- Migrate all helper functions
- Create SQL queries for existing Dexie patterns
- Implement transaction support
- Add data migration script

**Phase 3: Service Integration**
- Update `syncService.ts`
- Refactor all write operations
- Update POS page queries
- Update all management pages

**Phase 4: Testing & Polish**
- Integration testing
- Performance benchmarking
- Remove Dexie.js dependency

## Technical Details

### Package Selection

**Chosen:** `@sqlite.org/sqlite-wasm`

**Alternatives Considered:**

| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| @sqlite.org/sqlite-wasm | Official, full features, OPFS, WAL | Larger bundle (~3MB) | ✅ Selected |
| sql.js | Lightweight, pure JS | No OPFS, slower | ❌ Rejected |
| wa-sqlite | Modern, well-maintained | Less documentation | ❌ Rejected |
| absurd-sql | IndexedDB backend | Unmaintained | ❌ Rejected |
| sqlocal | Simple API | Limited features | ❌ Rejected |

### Schema Migration

```sql
-- Categories table
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX idx_categories_storeId ON categories(storeId);
CREATE INDEX idx_categories_name ON categories(name);

-- Products table
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  categoryId TEXT,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  costPrice REAL,
  imageUrl TEXT,
  imageBase64 TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX idx_products_storeId ON products(storeId);
CREATE INDEX idx_products_categoryId ON products(categoryId);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products(name);

-- Stock table
CREATE TABLE stock (
  id TEXT PRIMARY KEY,
  storeId TEXT NOT NULL,
  productId TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  lowStockThreshold INTEGER DEFAULT 10,
  updatedAt TEXT NOT NULL,
  UNIQUE(storeId, productId)
);

CREATE INDEX idx_stock_storeId ON stock(storeId);
CREATE INDEX idx_stock_productId ON stock(productId);

-- Transactions table
CREATE TABLE transactions (
  clientId TEXT PRIMARY KEY,
  serverId TEXT,
  storeId TEXT NOT NULL,
  cashierId TEXT NOT NULL,
  transactionNumber TEXT,
  items TEXT NOT NULL, -- JSON array
  subtotal REAL NOT NULL,
  taxAmount REAL NOT NULL,
  discountAmount REAL NOT NULL,
  discountId TEXT,
  discountCode TEXT,
  discountName TEXT,
  total REAL NOT NULL,
  paymentMethod TEXT NOT NULL,
  amountPaid REAL NOT NULL,
  changeAmount REAL NOT NULL,
  status TEXT NOT NULL,
  syncStatus TEXT NOT NULL,
  rejectionReason TEXT,
  clientTimestamp TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX idx_transactions_storeId ON transactions(storeId);
CREATE INDEX idx_transactions_syncStatus ON transactions(syncStatus);
CREATE INDEX idx_transactions_clientTimestamp ON transactions(clientTimestamp);
CREATE INDEX idx_transactions_createdAt ON transactions(createdAt);

-- Similar tables for discounts, syncMeta, store, heldOrders...
```

### Performance Optimizations

1. **WAL Mode:**
   ```sql
   PRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;
   ```

2. **Indexes:** All foreign keys and query fields indexed

3. **Prepared Statements:** Reuse for frequent queries

4. **Batching:** Bulk inserts in transactions

### Query Pattern Migration

| Dexie Pattern | SQLite Equivalent |
|--------------|-------------------|
| `db.products.get(id)` | `stmt.prepare('SELECT * FROM products WHERE id = ?').get(id)` |
| `db.products.where('storeId').equals(sid).toArray()` | `stmt.prepare('SELECT * FROM products WHERE storeId = ?').all(sid)` |
| `db.stock.where('[storeId+productId]').equals([s, p])` | `stmt.prepare('SELECT * FROM stock WHERE storeId = ? AND productId = ?').get(s, p)` |
| `db.products.bulkPut(products)` | Transaction with `INSERT OR REPLACE` |
| `db.transactions.where('syncStatus').equals('pending')` | `stmt.prepare('SELECT * FROM transactions WHERE syncStatus = ?').all('pending')` |

## Files Impacted

### New Files to Create

```
apps/web/src/
├── db/
│   ├── sqlite.ts              # Main SQLite connection & helpers
│   ├── schema.ts              # Table definitions & migrations
│   ├── queries/
│   │   ├── products.ts        # Product queries
│   │   ├── categories.ts      # Category queries
│   │   ├── stock.ts           # Stock queries
│   │   ├── transactions.ts    # Transaction queries
│   │   ├── discounts.ts       # Discount queries
│   │   └── heldOrders.ts      # Held order queries
│   └── migrations/
│       └── v1_initial.ts      # Initial schema migration
```

### Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/db/index.ts` | Replace with SQLite implementation |
| `apps/web/src/services/sync.ts` | Refactor all DB calls |
| `apps/web/src/pages/POS.tsx` | Update product/stock queries |
| `apps/web/src/pages/Dashboard.tsx` | Update sales queries |
| `apps/web/src/pages/Transactions.tsx` | Update transaction queries |
| `apps/web/src/pages/Products.tsx` | Update product queries |
| `apps/web/src/pages/Categories.tsx` | Update category queries |
| `apps/web/src/pages/Discounts.tsx` | Update discount queries |
| `apps/web/src/stores/cartStore.ts` | Update held order calls |
| `apps/web/vite.config.ts` | Add WASM support |
| `apps/web/package.json` | Remove Dexie, add SQLite |

### Files to Delete (After Migration)

| File | Reason |
|------|--------|
| `apps/web/src/db/index.ts` | Replaced by `db/sqlite.ts` |

## Consequences

### Positive

1. **Full SQL Power:**
   - Complex JOINs for reporting
   - Aggregation queries (COUNT, SUM, AVG, GROUP BY)
   - Full-text search (FTS5)
   - JSON operations

2. **Better Performance:**
   - WAL mode for concurrent reads
   - Proper index support
   - Prepared statement caching
   - OPFS for fast file I/O

3. **Future-Proof:**
   - Well-maintained SQLite engine
   - Active community
   - Extensive documentation
   - Many optimization options

4. **Broader Compatibility:**
   - SQL skills are transferable
   - Easier to debug with SQL tools
   - Can export data easily

### Negative

1. **Migration Effort:**
   - ~4 weeks of development
   - All DB calls must be rewritten
   - Extensive testing required

2. **Bundle Size:**
   - SQLite WASM: ~2-3MB
   - Dexie.js: ~50KB
   - Net increase: ~2.5MB

3. **Learning Curve:**
   - Team must learn SQL
   - Different query patterns
   - Migration patterns

4. **Reactivity Lost:**
   - Dexie's liveQuery not available
   - Must implement manual reactivity
   - Current code already uses manual patterns

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Performance regression | Benchmark before/after, use WAL mode |
| Data loss during migration | Backup IndexedDB, gradual migration |
| Complex queries | Test all existing query patterns |
| WASM loading | Lazy load, show loading state |
| Browser compatibility | SQLite Wasm has broad support |

## Rollback Plan

1. Keep Dexie.js as optional dependency during migration
2. Feature flag to toggle between IndexedDB and SQLite
3. Data migration path can be reversed
4. If issues found, flip feature flag to revert

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Foundation | Week 1 | Install SQLite, configure Vite, create schema |
| Phase 2: Data Layer | Week 2 | Migrate helper functions, queries, transactions |
| Phase 3: Integration | Week 3 | Update sync service, update all pages |
| Phase 4: Testing | Week 4 | Integration tests, performance benchmarks |
| **Total** | **4 weeks** | |

## Alternatives Considered

### Alternative A: Stay with Dexie.js + Optimize

Keep current IndexedDB setup but add query optimizations.

**Rejected because:**
- SQL capabilities still missing
- No path to complex reporting queries
- Performance ceiling with IndexedDB

### Alternative B: RxDB with SQLite Storage

Use RxDB Premium with SQLite RxStorage.

**Rejected because:**
- RxDB Premium is a paid subscription
- RxDB states browser SQLite is slower than IndexedDB
- Additional abstraction layer overhead
- Most queries are simple CRUD, not needing reactivity

### Alternative C: Use sql.js (Pure JS SQLite)

Use sql.js without WASM.

**Rejected because:**
- No OPFS support
- Slower than WASM with OPFS
- Less features than official SQLite Wasm

### Alternative D: Wa-sqlite

Use wa-sqlite library directly.

**Rejected because:**
- Less documentation
- Fewer examples for browser use
- @sqlite.org/sqlite-wasm is the official build

## Related Documents

- **ADR-0001**: Dexie Compound Indexes for Offline Queries
- **ADR-0004**: Hold Order IndexedDB Persistence
- **docs/features/hold-order.md**: Hold Order feature spec
- **docs/features/sync-status-page.md**: Sync Status feature spec
- **PLAN.md**: Original system plan

## References

- [@sqlite.org/sqlite-wasm](https://www.sqlite.org/wasm/doc/trunk/index.md)
- [OPFS Storage](https://developer.mozilla.org/en-US/docs/Web/API/Origin_Private_File_System)
- [SQLite Wasm Performance](https://sqlite.org/wasm/doc/trunk/perf.md)
- [Vite WASM Plugin](https://github.com/Menci/vite-plugin-wasm)
