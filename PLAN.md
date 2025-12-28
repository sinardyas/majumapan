# Offline-First POS System - Implementation Plan

## Overview

A web-based Point of Sale (POS) system designed with offline-first architecture, featuring automatic synchronization when internet connectivity is restored.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Offline-First** | Full functionality without internet using IndexedDB |
| **Auto-Sync** | Background sync when connection restored |
| **Multi-Store** | Support for multiple stores with isolated data |
| **Auth & RBAC** | Admin/Manager/Cashier with granular permissions |
| **Products** | Categories, SKU, barcode, images (stored locally) |
| **Stock Management** | Real-time tracking, low-stock alerts |
| **Discounts** | Product-level + cart-level coupons |
| **Transactions** | Full POS checkout flow with cash/card |
| **Receipt Printing** | Browser print dialog, 80mm thermal format |
| **Barcode Scanner** | Input field captures scanner output |
| **Dashboard** | Daily sales summary, transaction list |
| **Stock Validation** | Block transactions when stock insufficient |
| **Docker Deployment** | Self-hosted with docker-compose |

---

## Configuration Settings

| Setting | Value |
|---------|-------|
| Tax Rate | 10% (global, all stores) |
| Transaction Number Format | `TXN-{YYYYMMDD}-{sequence}` |
| PWA Install Prompt | Yes, on first visit |
| Local Data Retention | 30 days for synced transactions |

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Monorepo** | Turborepo | ^2.x |
| **Runtime** | Bun | Latest |
| **Backend Framework** | Hono | ^4.x |
| **Database** | PostgreSQL | 16 |
| **ORM** | Drizzle ORM | ^0.30.x |
| **Frontend** | React | ^18.x |
| **Build Tool** | Vite | ^5.x |
| **Styling** | TailwindCSS | ^3.x |
| **Local DB** | Dexie.js | ^4.x |
| **State Management** | Zustand | ^4.x |
| **Validation** | Zod | ^3.x |
| **PWA** | vite-plugin-pwa | ^0.19.x |
| **Container** | Docker | Latest |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   POS UI     │  │  Dashboard   │  │  Transaction History   │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                              │                                   │
│  ┌───────────────────────────▼────────────────────────────────┐ │
│  │              IndexedDB (Dexie.js)                          │ │
│  │  - Products, Categories, Stock                             │ │
│  │  - Pending Transactions (offline queue)                    │ │
│  │  - Auth tokens                                             │ │
│  └───────────────────────────┬────────────────────────────────┘ │
│                              │                                   │
│  ┌───────────────────────────▼────────────────────────────────┐ │
│  │              Service Worker (Sync Manager)                 │ │
│  │  - Background sync when online                             │ │
│  │  - Cache static assets                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Hono + Bun)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Auth API   │  │   Sync API   │  │   Products/Stock API │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────▼────────────────────────────────┐ │
│  │                    PostgreSQL                               │ │
│  │  - users, products, categories, stock                       │ │
│  │  - transactions, transaction_items                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Enums

```sql
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier');
CREATE TYPE payment_method AS ENUM ('cash', 'card');
CREATE TYPE transaction_status AS ENUM ('completed', 'voided', 'pending_sync');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed', 'rejected');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE discount_scope AS ENUM ('product', 'cart');
```

### Tables

```sql
-- APP SETTINGS (Global config)
CREATE TABLE app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- STORES (Multi-store support)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- USERS (Admin/Manager/Cashier)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'cashier',
    pin VARCHAR(6),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    category_id UUID REFERENCES categories(id),
    sku VARCHAR(100) NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2),
    image_url TEXT,
    image_base64 TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id, sku),
    UNIQUE(store_id, barcode)
);

-- STOCK
CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id, product_id)
);

-- DISCOUNTS / COUPONS
CREATE TABLE discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type discount_type NOT NULL,
    discount_scope discount_scope NOT NULL,
    value DECIMAL(12, 2) NOT NULL,
    min_purchase_amount DECIMAL(12, 2),
    max_discount_amount DECIMAL(12, 2),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id, code)
);

-- PRODUCT DISCOUNTS
CREATE TABLE product_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_id UUID REFERENCES discounts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(discount_id, product_id)
);

-- TRANSACTIONS
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) NOT NULL,
    store_id UUID REFERENCES stores(id),
    cashier_id UUID REFERENCES users(id),
    transaction_number VARCHAR(50) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    discount_id UUID REFERENCES discounts(id),
    discount_code VARCHAR(50),
    discount_name VARCHAR(255),
    total DECIMAL(12, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    amount_paid DECIMAL(12, 2) NOT NULL,
    change_amount DECIMAL(12, 2) DEFAULT 0,
    status transaction_status DEFAULT 'completed',
    sync_status sync_status DEFAULT 'synced',
    rejection_reason TEXT,
    rejected_at TIMESTAMP,
    client_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id)
);

-- TRANSACTION ITEMS
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    discount_id UUID REFERENCES discounts(id),
    discount_name VARCHAR(255),
    discount_value DECIMAL(12, 2) DEFAULT 0,
    subtotal DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SYNC LOG
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- REFRESH TOKENS
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_transactions_store ON transactions(store_id);
CREATE INDEX idx_transactions_date ON transactions(created_at);
CREATE INDEX idx_transactions_client_id ON transactions(client_id);
CREATE INDEX idx_sync_log_store ON sync_log(store_id, timestamp);
```

### Default Settings

```sql
INSERT INTO app_settings (key, value) VALUES
    ('tax_rate', '0.10'),
    ('currency', 'USD'),
    ('currency_symbol', '$'),
    ('transaction_prefix', 'TXN'),
    ('local_retention_days', '30');
```

---

## API Endpoints

### Authentication

```
POST   /api/v1/auth/login              Login with email/password
POST   /api/v1/auth/pin-login          Quick login with PIN
POST   /api/v1/auth/refresh            Refresh access token
POST   /api/v1/auth/logout             Logout and invalidate refresh token
GET    /api/v1/auth/me                 Get current user profile
```

### Stores (Admin only)

```
GET    /api/v1/stores                  List all stores
POST   /api/v1/stores                  Create store
GET    /api/v1/stores/:id              Get store details
PUT    /api/v1/stores/:id              Update store
DELETE /api/v1/stores/:id              Soft delete store
```

### Users (Admin/Manager)

```
GET    /api/v1/users                   List users (filtered by store)
POST   /api/v1/users                   Create user
GET    /api/v1/users/:id               Get user details
PUT    /api/v1/users/:id               Update user
DELETE /api/v1/users/:id               Soft delete user
PUT    /api/v1/users/:id/password      Change password
PUT    /api/v1/users/:id/pin           Set/update PIN
```

### Categories (Admin/Manager)

```
GET    /api/v1/categories              List categories
POST   /api/v1/categories              Create category
GET    /api/v1/categories/:id          Get category
PUT    /api/v1/categories/:id          Update category
DELETE /api/v1/categories/:id          Soft delete category
```

### Products (Admin/Manager for write, all for read)

```
GET    /api/v1/products                List products (paginated)
POST   /api/v1/products                Create product
GET    /api/v1/products/:id            Get product
GET    /api/v1/products/barcode/:code  Get product by barcode
PUT    /api/v1/products/:id            Update product
DELETE /api/v1/products/:id            Soft delete product
POST   /api/v1/products/:id/image      Upload product image
```

### Stock (Admin/Manager)

```
GET    /api/v1/stock                   List stock levels
PUT    /api/v1/stock/:productId        Update stock
POST   /api/v1/stock/adjust            Bulk stock adjustment
```

### Discounts (Admin/Manager)

```
GET    /api/v1/discounts               List all discounts
POST   /api/v1/discounts               Create discount
GET    /api/v1/discounts/:id           Get discount details
PUT    /api/v1/discounts/:id           Update discount
DELETE /api/v1/discounts/:id           Deactivate discount
POST   /api/v1/discounts/validate      Validate coupon code at checkout
GET    /api/v1/products/:id/discounts  Get active discounts for a product
```

### Transactions (All roles)

```
GET    /api/v1/transactions            List transactions (filtered)
POST   /api/v1/transactions            Create transaction
GET    /api/v1/transactions/:id        Get transaction details
POST   /api/v1/transactions/:id/void   Void transaction (Manager/Admin)
GET    /api/v1/transactions/:id/receipt Get receipt data
```

### Sync (Critical for offline-first)

```
GET    /api/v1/sync/pull               Pull changes since last sync
POST   /api/v1/sync/push               Push offline transactions
GET    /api/v1/sync/full               Full data sync (initial load)
GET    /api/v1/sync/status             Check sync status
```

### Reports (Manager/Admin)

```
GET    /api/v1/reports/daily           Daily sales summary
GET    /api/v1/reports/products        Product sales report
GET    /api/v1/reports/cashiers        Cashier performance
GET    /api/v1/reports/export          Export report (CSV)
```

---

## Folder Structure

```
pos-system/
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
├── package.json
├── turbo.json
├── .env.example
│
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── schemas/
│           │   ├── auth.ts
│           │   ├── product.ts
│           │   ├── transaction.ts
│           │   └── index.ts
│           ├── types/
│           │   ├── api.ts
│           │   ├── models.ts
│           │   └── index.ts
│           └── constants/
│               ├── permissions.ts
│               └── index.ts
│
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── app.ts
│   │       ├── db/
│   │       │   ├── index.ts
│   │       │   ├── schema.ts
│   │       │   └── migrations/
│   │       ├── routes/
│   │       │   ├── auth.ts
│   │       │   ├── stores.ts
│   │       │   ├── users.ts
│   │       │   ├── categories.ts
│   │       │   ├── products.ts
│   │       │   ├── stock.ts
│   │       │   ├── discounts.ts
│   │       │   ├── transactions.ts
│   │       │   ├── sync.ts
│   │       │   ├── reports.ts
│   │       │   └── index.ts
│   │       ├── middleware/
│   │       │   ├── auth.ts
│   │       │   ├── rbac.ts
│   │       │   ├── store.ts
│   │       │   └── error.ts
│   │       ├── services/
│   │       │   ├── auth.service.ts
│   │       │   ├── sync.service.ts
│   │       │   ├── transaction.service.ts
│   │       │   └── report.service.ts
│   │       └── utils/
│   │           ├── jwt.ts
│   │           ├── password.ts
│   │           └── receipt.ts
│   │
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── vite-env.d.ts
│           │
│           ├── components/
│           │   ├── ui/
│           │   │   ├── Button.tsx
│           │   │   ├── Input.tsx
│           │   │   ├── Modal.tsx
│           │   │   ├── Table.tsx
│           │   │   └── ...
│           │   ├── pos/
│           │   │   ├── ProductGrid.tsx
│           │   │   ├── Cart.tsx
│           │   │   ├── PaymentModal.tsx
│           │   │   ├── BarcodeInput.tsx
│           │   │   └── Receipt.tsx
│           │   ├── layout/
│           │   │   ├── MainLayout.tsx
│           │   │   ├── Sidebar.tsx
│           │   │   └── Header.tsx
│           │   └── shared/
│           │       ├── SyncStatus.tsx
│           │       ├── OfflineBanner.tsx
│           │       └── LoadingSpinner.tsx
│           │
│           ├── pages/
│           │   ├── Login.tsx
│           │   ├── POS.tsx
│           │   ├── Transactions.tsx
│           │   ├── Dashboard.tsx
│           │   ├── Products.tsx
│           │   ├── Categories.tsx
│           │   ├── Users.tsx
│           │   ├── Discounts.tsx
│           │   ├── Settings.tsx
│           │   └── NotFound.tsx
│           │
│           ├── hooks/
│           │   ├── useAuth.ts
│           │   ├── useOnlineStatus.ts
│           │   ├── useSync.ts
│           │   ├── useBarcode.ts
│           │   ├── useCart.ts
│           │   └── usePrint.ts
│           │
│           ├── stores/
│           │   ├── authStore.ts
│           │   ├── cartStore.ts
│           │   ├── syncStore.ts
│           │   └── uiStore.ts
│           │
│           ├── db/
│           │   ├── index.ts
│           │   ├── products.ts
│           │   ├── categories.ts
│           │   ├── transactions.ts
│           │   └── sync.ts
│           │
│           ├── services/
│           │   ├── api.ts
│           │   ├── auth.ts
│           │   ├── sync.ts
│           │   └── receipt.ts
│           │
│           ├── lib/
│           │   ├── utils.ts
│           │   └── formatters.ts
│           │
│           └── styles/
│               └── globals.css
```

---

## User Roles and Permissions

| Permission | Admin | Manager | Cashier |
|------------|:-----:|:-------:|:-------:|
| **Stores** |
| Create/Edit/Delete stores | Yes | No | No |
| View store details | Yes | Yes | No |
| **Users** |
| Create Admin | Yes | No | No |
| Create Manager/Cashier | Yes | Yes | No |
| Edit/Deactivate users | Yes | Yes (own store) | No |
| **Products & Categories** |
| Create/Edit/Delete | Yes | Yes | No |
| View | Yes | Yes | Yes |
| **Stock** |
| Adjust stock | Yes | Yes | No |
| View stock | Yes | Yes | Yes |
| **Discounts** |
| Create/Edit/Delete | Yes | Yes | No |
| View/Apply | Yes | Yes | Yes |
| **Transactions** |
| Create transaction | Yes | Yes | Yes |
| View own transactions | Yes | Yes | Yes |
| View all transactions | Yes | Yes | No |
| Void transaction | Yes | Yes | No |
| **Reports** |
| View daily dashboard | Yes | Yes | Yes (own only) |
| View full reports | Yes | Yes | No |
| Export reports | Yes | Yes | No |
| **Settings** |
| Store settings | Yes | Yes | No |
| Own profile | Yes | Yes | Yes |

---

## Sync Strategy

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                            │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  POS UI     │───▶│ Zustand      │───▶│  IndexedDB       │   │
│  │             │    │ (App State)  │    │  (Dexie.js)      │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│                                                │                │
│                                                ▼                │
│                     ┌──────────────────────────────────────┐   │
│                     │         SYNC MANAGER                 │   │
│                     │  ┌────────────────────────────────┐  │   │
│                     │  │  Pending Queue (offline txns)  │  │   │
│                     │  └────────────────────────────────┘  │   │
│                     │  ┌────────────────────────────────┐  │   │
│                     │  │  Last Sync Timestamp           │  │   │
│                     │  └────────────────────────────────┘  │   │
│                     └──────────────────────────────────────┘   │
│                                    │                            │
└────────────────────────────────────│────────────────────────────┘
                                     │
                    Online? ─────────┼─────── Offline?
                       │             │              │
                       ▼             │              ▼
              ┌────────────┐         │      Queue locally
              │  Sync API  │         │      (IndexedDB)
              └────────────┘         │
                     │               │
                     ▼               │
┌────────────────────────────────────│────────────────────────────┐
│                     SERVER                                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SYNC SERVICE                          │  │
│  │                                                          │  │
│  │  1. Pull: Get changes since lastSyncTimestamp            │  │
│  │  2. Push: Receive offline transactions                   │  │
│  │  3. Conflict: Last-write-wins based on client_timestamp  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│                     ┌────────────────┐                          │
│                     │   PostgreSQL   │                          │
│                     └────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Operations

**1. Initial Sync (First Login)**
```typescript
// GET /api/v1/sync/full
{
  categories: Category[],
  products: Product[],
  stock: Stock[],
  discounts: Discount[],
  lastSyncTimestamp: string
}
```

**2. Incremental Pull**
```typescript
// GET /api/v1/sync/pull?since=2024-01-15T10:30:00Z
{
  changes: {
    categories: { created: [], updated: [], deleted: [] },
    products: { created: [], updated: [], deleted: [] },
    stock: { updated: [] },
    discounts: { created: [], updated: [], deleted: [] }
  },
  lastSyncTimestamp: string
}
```

**3. Push Offline Transactions**
```typescript
// POST /api/v1/sync/push
{
  transactions: [
    {
      clientId: "uuid-generated-on-client",
      clientTimestamp: "2024-01-15T10:30:00Z",
      items: [...],
      paymentMethod: "cash",
      total: 150.00
    }
  ]
}

// Response
{
  synced: [{ clientId, serverId, transactionNumber }],
  rejected: [{ clientId, reason, stockIssues }],
  stockUpdates: [{ productId, newQuantity }]
}
```

### Stock Validation (Block Transaction)

When syncing offline transactions:
1. Sort by `client_timestamp` (oldest first)
2. For each transaction, check current server stock
3. If sufficient: commit and decrement stock
4. If insufficient: REJECT and add to rejected list
5. Return results with updated stock levels

---

## Receipt Template

```
================================================
              STORE NAME HERE
           123 Main Street, City
            Phone: (123) 456-7890
================================================

Date: 2024-01-15          Time: 10:30:45 AM
Receipt #: TXN-20240115-0001
Cashier: John Doe
------------------------------------------------

Qty   Item                     Price    Amount
------------------------------------------------
  2   Widget Pro               $25.00   $50.00
      - 10% Product Discount            -$5.00
  1   Gadget Basic             $15.99   $15.99
  3   Accessory Pack           $9.99    $29.97
------------------------------------------------
                        Subtotal:       $90.96

      Coupon (SAVE10):                  -$10.00
------------------------------------------------
                        Tax (10%):       $8.10
                        ══════════════════════
                        TOTAL:          $89.06
                        ══════════════════════

Payment Method: CASH
Amount Tendered:                       $100.00
Change:                                 $10.94

------------------------------------------------
        Thank you for your purchase!
           Please come again.

        [BARCODE: TXN-20240115-0001]
================================================
```

---

## Seed Data

### Default Test Accounts

| Role | Email | Password | PIN |
|------|-------|----------|-----|
| Admin | admin@pos.local | admin123 | 000000 |
| Manager | manager@downtown.pos.local | manager123 | 111111 |
| Cashier | cashier1@downtown.pos.local | cashier123 | 123456 |
| Cashier | cashier2@mall.pos.local | cashier123 | 654321 |

### Sample Stores

- Downtown Store (123 Main Street)
- Mall Branch (456 Shopping Center, Level 2)

### Sample Categories

- Electronics
- Beverages
- Snacks
- Household
- Personal Care

### Sample Products (13 items)

- Electronics: Wireless Earbuds, USB-C Cable, Phone Case
- Beverages: Cola 500ml, Orange Juice 1L, Mineral Water 500ml
- Snacks: Potato Chips, Chocolate Bar, Mixed Nuts 200g
- Household: Paper Towels, Dish Soap
- Personal Care: Hand Sanitizer, Toothpaste

### Sample Discounts

- Earbuds Sale: 10% off Wireless Earbuds (product discount)
- WELCOME10: $10 off cart (min purchase $50)
- SAVE20: 20% off cart (max $50, min purchase $100)

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

- [x] Project scaffolding (Turborepo monorepo)
- [x] Docker setup (PostgreSQL, Bun containers)
- [x] Database schema + Drizzle migrations
- [x] Shared package (types, Zod schemas, constants)
- [x] Hono API structure
- [x] Authentication (JWT, refresh tokens, PIN login)
- [x] RBAC middleware

### Phase 2: Core Backend (Week 2-3)

- [x] Stores CRUD
- [x] Users CRUD
- [x] Categories CRUD
- [x] Products CRUD + image handling
- [x] Stock management
- [x] Discounts CRUD
- [x] Transactions API
- [x] Sync API (pull/push/full)

### Phase 3: Frontend Foundation (Week 3-4)

- [x] Vite + React + TailwindCSS setup
- [x] PWA configuration + install prompt
- [x] IndexedDB setup (Dexie.js)
- [x] Auth pages + token management
- [x] Zustand stores
- [x] Layout components
- [x] Online/offline detection

### Phase 4: POS Interface (Week 4-5)

- [x] Product grid with categories
- [x] Barcode scanner input
- [x] Cart component
- [x] Discount application (product + coupon)
- [x] Payment modal (cash/card)
- [x] Receipt generation
- [x] Print functionality

### Phase 5: Sync Implementation (Week 5-6)

- [x] Initial full sync on login
- [x] Incremental pull (changes since last sync)
- [x] Offline transaction queue
- [x] Push sync with stock validation
- [x] Rejected transaction UI
- [x] 30-day data cleanup job
- [x] Service worker background sync

### Phase 6: Dashboard & Management (Week 6-7)

- [x] Daily sales dashboard
- [x] Transaction list + details
- [x] Product management UI
- [x] Category management UI
- [x] User management UI
- [x] Discount management UI
- [x] Reports with export

### Phase 7: Polish & Deploy (Week 7-8)

- [x] Docker Compose production config
- [x] Environment variables setup
- [x] Seed data script
- [x] Error handling + logging
- [x] Loading states + optimistic UI
- [x] Documentation
- [x] Final testing

---

## Commands

```bash
# Install dependencies
bun install

# Development
bun run dev          # Start all apps in development
bun run dev:api      # Start API only
bun run dev:web      # Start web only

# Database
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:seed      # Seed database
bun run db:reset     # Reset and reseed

# Build
bun run build        # Build all apps
bun run build:api    # Build API only
bun run build:web    # Build web only

# Docker
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f api    # View API logs
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# API
API_PORT=3000
API_HOST=0.0.0.0

# Web
VITE_API_URL=http://localhost:3000/api/v1

# App Settings (defaults)
TAX_RATE=0.10
CURRENCY=USD
CURRENCY_SYMBOL=$
```

---

## Estimated Timeline

| Phase | Focus | Duration |
|-------|-------|----------|
| 1 | Foundation (monorepo, DB, auth) | Week 1-2 |
| 2 | Core Backend (CRUD, sync API) | Week 2-3 |
| 3 | Frontend Foundation (PWA, IndexedDB) | Week 3-4 |
| 4 | POS Interface (cart, payment, receipt) | Week 4-5 |
| 5 | Sync + Stock Validation | Week 5-6 |
| 6 | Discounts + Dashboard | Week 6-7 |
| 7 | Polish + Docker + Seed Data | Week 7-8 |

**Total: 7-8 weeks**
