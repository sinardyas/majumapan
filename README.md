# Majumapan - Offline-First POS System

Majumapan is a web-based Point of Sale (POS) system designed with offline-first architecture, featuring automatic synchronization when internet connectivity is restored. The system includes a dedicated Admin Panel for system administrators.

## Architecture Overview

```
                    +-------------------+
                    |      nginx        |
                    |  (reverse proxy)  |
                    +---------+---------+
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
+---------------+     +---------------+     +---------------+
|   POS Web     |     | Admin Panel   |     |     API       |
|  (port 5173)  |     |  (port 5174)  |     |  (port 3000)  |
|               |     |               |     |               |
| pos.example   |     | admin.example |     | api.example   |
+---------------+     +---------------+     +---------------+
```

## Features

### POS Web (for Managers & Cashiers)

- **Offline-First**: Full functionality without internet using IndexedDB
- **Auto-Sync**: Background sync when connection restored
- **Multi-Store**: Support for multiple stores with isolated data
- **Role-Based Access**: Manager/Cashier with granular permissions
- **Product Management**: Categories, SKU, barcode scanning, images
- **Stock Management**: Real-time tracking, low-stock alerts
- **Discounts**: Product-level and cart-level coupons
- **Transactions**: Full POS checkout flow with cash/card
- **Receipt Printing**: Browser print dialog, 80mm thermal format
- **Hold Orders**: Temporarily save and resume in-progress orders
- **Customer Display**: Secondary window showing cart contents to customers in real-time
- **Split Payments**: Pay with multiple payment methods (documentation only, pending implementation)
- **Dashboard**: Daily sales summary, transaction history
- **PWA**: Installable app with offline support

### Admin Panel (for Administrators)

- **Dashboard**: System-wide KPIs, store comparison, audit activity
- **Store Management**: CRUD operations for all stores
- **User Management**: Cross-store user administration
- **Reports**: Cross-store analytics, sales trends, top performers
- **Audit Logs**: Track all system activities with filters
- **Data Management**: CSV import/export for products, categories, users
- **Settings**: App-wide configuration (tax rate, currency, etc.)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo |
| Runtime | Bun |
| Backend | Hono |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | React + Vite |
| Styling | TailwindCSS |
| Local DB | Dexie.js (IndexedDB) |
| State | Zustand |
| Validation | Zod |
| PWA | vite-plugin-pwa |
| Container | Docker |

### Shared Packages

| Package | Purpose |
|---------|---------|
| `@pos/shared` | Shared types, Zod schemas, constants |
| `@pos/ui` | Reusable UI components (Button, Input, Modal, Card, etc.) |
| `@pos/api-client` | HTTP client with auth integration |

## Project Structure

```
majumapan/
├── apps/
│   ├── api/                  # Hono API server
│   │   └── src/
│   │       ├── db/           # Database schema, migrations, seed
│   │       ├── routes/       # API endpoints
│   │       ├── middleware/   # Auth, RBAC, error handling
│   │       └── utils/        # JWT, password, audit utilities
│   ├── web/                  # POS web app (offline-first PWA)
│   │   └── src/
│   │       ├── components/   # React components
│   │       ├── pages/        # Page components
│   │       ├── hooks/        # Custom React hooks
│   │       ├── stores/       # Zustand stores
│   │       ├── services/     # API and sync services
│   │       ├── db/           # IndexedDB schema (Dexie.js)
│   │       └── lib/          # Utilities
│   └── admin/                # Admin panel (online-only)
│       └── src/
│           ├── components/   # React components
│           ├── pages/        # Page components
│           ├── stores/       # Zustand stores
│           ├── services/     # API services
│           └── lib/          # Utilities
├── packages/
│   ├── shared/               # Shared types, schemas, constants
│   ├── ui/                   # Reusable UI components
│   └── api-client/           # HTTP client library
├── docker-compose.yml        # Development Docker setup
├── docker-compose.prod.yml   # Production Docker setup
└── PLAN.md                   # Detailed implementation plan
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Docker](https://docker.com/) & Docker Compose
- Node.js 18+ (optional, for npm compatibility)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd majumapan
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start PostgreSQL**
   ```bash
   docker-compose up postgres -d
   ```

5. **Run database migrations**
   ```bash
   cd apps/api
   bun run db:migrate
   ```

6. **Seed the database**
   ```bash
   bun run db:seed
   ```

7. **Start development servers**
   ```bash
   # From root directory
   bun run dev
   ```

   This starts:
   - API: http://localhost:3000
   - POS Web: http://localhost:5173
   - Admin Panel: http://localhost:5174

### Test Accounts

| Role | Email | Password | PIN | Access |
|------|-------|----------|-----|--------|
| Admin | admin@pos.local | admin123 | 000000 | Admin Panel only |
| Manager | manager@downtown.pos.local | manager123 | 111111 | POS Web |
| Cashier | cashier1@downtown.pos.local | cashier123 | 123456 | POS Web |

### Discount Codes

| Code | Description |
|------|-------------|
| WELCOME10 | $10 off (min $50 purchase) |
| SAVE20 | 20% off (min $100, max $50 discount) |
| SUMMER15 | 15% off (limited to 100 uses) |

## Production Deployment

### Using Docker Compose

1. **Create production environment file**
   ```bash
   cp .env.example .env.production
   ```

2. **Update production settings**
   ```env
   POSTGRES_PASSWORD=secure_password_here
   JWT_SECRET=generate_secure_random_string
   ```

3. **Build and start services**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

4. **Run migrations and seed**
   ```bash
   docker-compose -f docker-compose.prod.yml exec api bun run db:migrate
   docker-compose -f docker-compose.prod.yml exec api bun run db:seed
   ```

The apps will be available at:
- POS Web: http://localhost (port 80)
- Admin Panel: http://localhost/admin (via nginx)
- API: proxied through nginx at /api

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `POSTGRES_USER` | Database user | pos_user |
| `POSTGRES_PASSWORD` | Database password | **Required** |
| `POSTGRES_DB` | Database name | pos |
| `JWT_SECRET` | JWT signing key | **Required** |
| `JWT_EXPIRES_IN` | Access token expiry | 15m |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiry | 7d |
| `VITE_API_URL` | API URL for POS web | /api/v1 |
| `VITE_ADMIN_API_URL` | API URL for admin panel | /api/v1 |

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/pin-login` - Quick login with PIN
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

### Stores
- `GET /api/v1/stores` - List stores
- `POST /api/v1/stores` - Create store
- `GET /api/v1/stores/:id` - Get store
- `PUT /api/v1/stores/:id` - Update store
- `DELETE /api/v1/stores/:id` - Soft delete store

### Users
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/:id` - Get user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Soft delete user
- `PUT /api/v1/users/:id/password` - Change password
- `PUT /api/v1/users/:id/pin` - Set PIN

### Categories
- `GET /api/v1/categories` - List categories
- `POST /api/v1/categories` - Create category
- `GET /api/v1/categories/:id` - Get category
- `PUT /api/v1/categories/:id` - Update category
- `DELETE /api/v1/categories/:id` - Soft delete category

### Products
- `GET /api/v1/products` - List products (paginated)
- `POST /api/v1/products` - Create product
- `GET /api/v1/products/:id` - Get product
- `GET /api/v1/products/barcode/:code` - Get by barcode
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Soft delete product
- `POST /api/v1/products/:id/image` - Upload image

### Stock
- `GET /api/v1/stock` - List stock levels
- `PUT /api/v1/stock/:productId` - Update stock
- `POST /api/v1/stock/adjust` - Bulk adjustment

### Discounts
- `GET /api/v1/discounts` - List discounts
- `POST /api/v1/discounts` - Create discount
- `GET /api/v1/discounts/:id` - Get discount
- `PUT /api/v1/discounts/:id` - Update discount
- `DELETE /api/v1/discounts/:id` - Deactivate discount
- `POST /api/v1/discounts/validate` - Validate coupon

### Transactions
- `GET /api/v1/transactions` - List transactions
- `POST /api/v1/transactions` - Create transaction
- `GET /api/v1/transactions/:id` - Get transaction
- `POST /api/v1/transactions/:id/void` - Void transaction
- `GET /api/v1/transactions/:id/receipt` - Get receipt

### Sync (POS Web only)
- `GET /api/v1/sync/full` - Full data sync
- `GET /api/v1/sync/pull?since=<timestamp>` - Incremental pull
- `POST /api/v1/sync/push` - Push offline transactions
- `GET /api/v1/sync/status` - Sync status

### Admin Panel
- `GET /api/v1/audit-logs` - List audit logs with filters
- `GET /api/v1/reports/system-overview` - System-wide metrics
- `GET /api/v1/reports/stores-comparison` - Store comparison
- `GET /api/v1/reports/sales-by-store` - Sales trend
- `GET /api/v1/reports/top-stores` - Top performing stores
- `GET /api/v1/data/export/:type` - Export data to CSV
- `POST /api/v1/data/import/:type` - Import data from CSV
- `GET /api/v1/settings` - Get settings
- `PUT /api/v1/settings` - Update settings

### Reports
- `GET /api/v1/reports/daily` - Daily sales summary
- `GET /api/v1/reports/products` - Product sales report
- `GET /api/v1/reports/cashiers` - Cashier performance
- `GET /api/v1/reports/export` - Export report (CSV)

## Offline Workflow (POS Web)

1. **Initial Login**: Full sync downloads all store data to IndexedDB
2. **While Online**: Auto-sync every 5 minutes
3. **While Offline**: Transactions saved locally in queue
4. **Coming Online**: Pending transactions pushed, changes pulled
5. **Rejected Transactions**: UI to view, retry, or delete

## Configuration

### Tax Rate
Default: 10% (configurable in admin panel or app_settings table)

### Transaction Number Format
`TXN-{YYYYMMDD}-{sequence}`

### Local Data Retention
30 days for synced transactions

## Development Commands

```bash
# Install dependencies
bun install

# Start all development servers
bun run dev

# Start individual apps
bun run dev:api      # API only
bun run dev:web      # POS web only
bun run dev:admin    # Admin panel only

# Build all apps
bun run build

# Build individual apps
bun run build:api
bun run build:web
bun run build:admin

# Database commands
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:seed      # Seed database
bun run db:reset     # Reset and reseed
bun run db:studio    # Open Drizzle Studio

# Type checking
bun run typecheck

# Linting
bun run lint

# Testing
bun run test
bun run test:run     # Run tests once
```

## Documentation

- [PLAN.md](PLAN.md) - Detailed implementation plan
- [docs/adr/](docs/adr/) - Architecture Decision Records
- [docs/features/](docs/features/) - Feature specifications

## License

MIT
