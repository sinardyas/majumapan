# Offline-First POS System

A web-based Point of Sale (POS) system designed with offline-first architecture, featuring automatic synchronization when internet connectivity is restored.

## Features

- **Offline-First**: Full functionality without internet using IndexedDB
- **Auto-Sync**: Background sync when connection restored
- **Multi-Store**: Support for multiple stores with isolated data
- **Role-Based Access**: Admin/Manager/Cashier with granular permissions
- **Product Management**: Categories, SKU, barcode scanning, images
- **Stock Management**: Real-time tracking, low-stock alerts
- **Discounts**: Product-level and cart-level coupons
- **Transactions**: Full POS checkout flow with cash/card
- **Receipt Printing**: Browser print dialog, 80mm thermal format
- **Dashboard**: Daily sales summary, reports with CSV export
- **PWA**: Installable app with offline support

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

## Project Structure

```
pos-system/
├── apps/
│   ├── api/              # Hono API server
│   │   └── src/
│   │       ├── db/       # Database schema, migrations, seed
│   │       ├── routes/   # API endpoints
│   │       ├── middleware/
│   │       └── utils/
│   └── web/              # React frontend
│       └── src/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           ├── stores/
│           ├── services/
│           └── db/       # IndexedDB schema
├── packages/
│   └── shared/           # Shared types, schemas, constants
├── docker-compose.yml    # Development Docker setup
├── docker-compose.prod.yml # Production Docker setup
└── PLAN.md               # Detailed implementation plan
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
   cd pos-system
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
   - Web: http://localhost:5173

### Test Accounts

| Role | Email | Password | PIN |
|------|-------|----------|-----|
| Admin | admin@pos.local | admin123 | 000000 |
| Manager | manager@downtown.pos.local | manager123 | 111111 |
| Cashier | cashier1@downtown.pos.local | cashier123 | 123456 |

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

The app will be available at:
- Web: http://localhost (port 80)
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
| `VITE_API_URL` | API URL for frontend | /api/v1 |

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

### Users
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `PUT /api/v1/users/:id/password` - Change password
- `PUT /api/v1/users/:id/pin` - Set PIN

### Products, Categories, Stock, Discounts
Full CRUD operations available. See `PLAN.md` for details.

### Transactions
- `GET /api/v1/transactions` - List transactions
- `POST /api/v1/transactions` - Create transaction
- `POST /api/v1/transactions/:id/void` - Void transaction

### Sync
- `GET /api/v1/sync/full` - Full data sync
- `GET /api/v1/sync/pull?since=<timestamp>` - Incremental pull
- `POST /api/v1/sync/push` - Push offline transactions
- `GET /api/v1/sync/status` - Sync status

## Offline Workflow

1. **Initial Login**: Full sync downloads all store data
2. **While Online**: Auto-sync every 5 minutes
3. **While Offline**: Transactions saved locally
4. **Coming Online**: Pending transactions pushed, changes pulled
5. **Rejected Transactions**: UI to view, retry, or delete

## Configuration

### Tax Rate
Default: 10% (configurable in app_settings table)

### Transaction Number Format
`TXN-{YYYYMMDD}-{sequence}`

### Local Data Retention
30 days for synced transactions

## Development Commands

```bash
# Install dependencies
bun install

# Start development
bun run dev

# Build all apps
bun run build

# Database commands
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:seed      # Seed database
bun run db:reset     # Reset and reseed
bun run db:studio    # Open Drizzle Studio

# Type checking
bun run typecheck
```

## License

MIT
