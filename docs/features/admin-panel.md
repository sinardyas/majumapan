# Feature Specification: Admin Panel

## Status

**Implemented** - Completed on 2024-12-31

> **Business Context**: See [Admin Panel PRD](../prd/admin-panel-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

## Overview

The Admin Panel is a dedicated web application for system administrators to manage the POS system. It provides centralized control over stores, users, system settings, and cross-store reporting. This separation of concerns keeps the POS web app focused on point-of-sale operations for cashiers and managers.

## Motivation

Previously, admin functionality was mixed into the POS web application. This created several issues:

1. **Role confusion**: Admins without a store assignment couldn't use store-scoped features
2. **UI complexity**: Single app tried to serve different user personas (cashiers vs admins)
3. **Security surface**: Admin features exposed in the same app as POS operations
4. **Offline complexity**: PWA/offline-first features unnecessary for admin tasks

## Architecture

### Deployment Structure

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

### URL Structure (Subdomain Approach)

| Service | URL |
|---------|-----|
| POS Web | `https://pos.example.com/` |
| Admin Panel | `https://admin.example.com/` |
| API | `https://api.example.com/` |

### Shared Packages

The Admin Panel leverages the monorepo architecture with shared packages:

| Package | Purpose |
|---------|---------|
| `@pos/shared` | Shared types, Zod schemas, constants |
| `@pos/ui` | Reusable UI components (Button, Input, Modal, Card, etc.) |
| `@pos/api-client` | HTTP client with auth integration |

## Features

### Core Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Admin-only authentication (rejects non-admin users) |
| Dashboard | `/` | System-wide overview with KPIs and charts |
| Stores | `/stores` | Store CRUD management |
| Users | `/users` | All users management (cross-store) |
| Reports | `/reports` | Cross-store reporting and analytics |
| Audit Logs | `/audit-logs` | System activity tracking |
| Data Management | `/data` | CSV import/export functionality |
| Settings | `/settings` | App-wide configuration |

### Dashboard Metrics

**Primary KPIs (Top Row Cards):**

| Metric | Description |
|--------|-------------|
| Total Revenue Today | Combined sales across all stores |
| Total Transactions Today | Transaction count across all stores |
| Active Stores | Number of active (non-deactivated) stores |
| Pending Syncs | Transactions awaiting sync (indicates connectivity issues) |

**Secondary Metrics:**

| Metric | Description |
|--------|-------------|
| Low Stock Alerts | Products below threshold across all stores |
| Active Users Today | Users who logged in today |
| New Users This Week | Recently created accounts |

**Charts/Tables:**

- Sales by Store (Today) - Bar chart comparing store performance
- Recent Activity - Last 10 audit log entries
- Top Performing Stores (This Month) - Ranked table by revenue

### Store Management

Full CRUD operations for stores:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Store display name |
| address | string | No | Physical address |
| phone | string | No | Contact phone number |
| isActive | boolean | Yes | Active/inactive status |

**Store List View:**
- Search by name
- Filter by active/inactive status
- Show user count, product count, today's sales per store
- Quick actions: Edit, Deactivate

### User Management

Centralized user management (moved from POS web):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Unique email address |
| name | string | Yes | Display name |
| password | string | Yes (create) | Account password |
| role | enum | Yes | admin, manager, cashier |
| storeId | uuid | Conditional | Required for manager/cashier |
| pin | string | No | Quick login PIN (6 digits) |
| isActive | boolean | Yes | Active/inactive status |

**User List View:**
- Search by name/email
- Filter by role (admin/manager/cashier)
- Filter by store
- Show last login time
- Quick actions: Edit, Reset Password, Deactivate

**Role Constraints:**
- Only admins can create admin users
- Managers and cashiers must have a storeId
- Admins have storeId = null (access all stores)

### Reports

Cross-store reporting capabilities:

| Report | Description | Filters |
|--------|-------------|---------|
| System Overview | Aggregate metrics across all stores | Date range |
| Store Comparison | Side-by-side performance comparison | Date range, store selection |
| Sales by Store | Detailed breakdown per store | Date range, store |
| Top Performing Stores | Ranked by revenue or transaction count | Date range, metric type |
| User Activity | Login frequency, transactions per user | Date range, store, role |
| Product Performance | Top/bottom selling products | Date range, store, category |
| Low Stock Summary | Items below threshold | Store filter |

**Export:** All reports exportable to CSV

### Audit Logs

Track system activities for compliance and debugging:

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Unique log entry ID |
| userId | uuid | User who performed action |
| userEmail | string | User email (denormalized) |
| action | enum | create, update, delete, login, logout |
| entityType | string | store, user, product, category, discount, transaction, settings |
| entityId | uuid | ID of affected entity |
| entityName | string | Name of affected entity (for display) |
| changes | jsonb | For updates: `{ field: { old, new } }` |
| ipAddress | string | Client IP address |
| userAgent | string | Browser/client info |
| createdAt | timestamp | When action occurred |

**Audit Log Viewer:**
- Filter by user
- Filter by action type
- Filter by entity type
- Filter by date range
- Search by entity name
- Pagination (50 per page)

**Retention:** 90 days (configurable in settings)

### Data Management (Import/Export)

Bulk data operations via CSV:

**Export:**

| Entity | Fields Exported |
|--------|-----------------|
| Products | id, storeId, storeName, categoryId, categoryName, sku, barcode, name, description, price, costPrice, isActive |
| Categories | id, storeId, storeName, name, description, isActive |
| Users | id, email, name, role, storeId, storeName, isActive, createdAt |

**Import:**

| Entity | Required Fields | Optional Fields |
|--------|-----------------|-----------------|
| Products | storeId, sku, name, price | categoryId, barcode, description, costPrice, isActive |
| Categories | storeId, name | description, isActive |
| Users | email, name, role, password | storeId, pin, isActive |

**Import Behavior:**
- Validates all rows before importing
- Reports validation errors with row numbers
- Creates new records (no updates via import)
- Duplicate detection by unique fields (email, sku per store)

### Settings

App-wide configuration:

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Tax Rate | `tax_rate` | 0.10 | Global tax rate (decimal) |
| Currency | `currency` | USD | Currency code |
| Currency Symbol | `currency_symbol` | $ | Display symbol |
| Transaction Prefix | `transaction_prefix` | TXN | Receipt number prefix |
| Local Retention Days | `local_retention_days` | 30 | Days to keep synced data locally |
| Audit Log Retention Days | `audit_log_retention_days` | 90 | Days to keep audit logs |

## Technical Stack

Same stack as POS web for consistency:

| Layer | Technology |
|-------|------------|
| Frontend Framework | React 18.x |
| Build Tool | Vite 5.x |
| Styling | TailwindCSS 3.x |
| State Management | Zustand 5.x |
| Routing | React Router 7.x |
| HTTP Client | @pos/api-client (Fetch API wrapper) |
| Form Validation | Zod 4.x |
| Charts | Recharts |
| Icons | Lucide React |
| Date Handling | date-fns |

**Differences from POS Web:**
- No PWA/Service Worker (not offline-first)
- No IndexedDB/Dexie (no local storage needed)
- No sync logic
- Uses shared `@pos/ui` package for UI components
- Uses shared `@pos/api-client` package for HTTP client

## Project Structure

```
apps/admin/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── ui/
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Textarea.tsx
│   │   │   └── index.ts
│   │   ├── ErrorBoundary.tsx
│   │   └── ErrorBoundary.test.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Stores.tsx
│   │   ├── Users.tsx
│   │   ├── Reports.tsx
│   │   ├── AuditLogs.tsx
│   │   ├── DataManagement.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   └── api.ts          # dashboardApi convenience methods
│   ├── stores/
│   │   └── authStore.ts
│   ├── lib/
│   │   ├── utils.ts
│   │   └── utils.test.ts
│   ├── styles/
│   │   └── globals.css
│   ├── test/
│   │   └── setup.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
└── vitest.config.ts
```

## API Endpoints

### Admin Dashboard API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/audit-logs` | GET | List audit logs with filters |
| `/api/v1/reports/system-overview` | GET | System-wide metrics |
| `/api/v1/reports/stores-comparison` | GET | Cross-store comparison |
| `/api/v1/reports/sales-by-store` | GET | Sales trend by store |
| `/api/v1/reports/top-stores` | GET | Top performing stores |
| `/api/v1/data/export/:type` | GET | Export data to CSV |
| `/api/v1/data/import/:type` | POST | Import data from CSV |
| `/api/v1/settings` | GET | Get all settings |
| `/api/v1/settings` | PUT | Update settings |

### Existing Endpoints Used

- `/api/v1/auth/login` - Authentication
- `/api/v1/auth/me` - Current user profile
- `/api/v1/auth/logout` - Logout
- `/api/v1/stores` - Store CRUD
- `/api/v1/users` - User CRUD

## Database Changes

### New Table: audit_logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_name VARCHAR(255),
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);
```

## Changes to POS Web

### Removed Features

| Feature | Reason |
|---------|--------|
| Users page | Moved to Admin Panel |
| Users route | No longer needed |
| Users sidebar link | No longer needed |

### Modified Features

| Feature | Change |
|---------|--------|
| Login page | Reject admin users with message directing to admin panel |
| Sidebar | Remove Users navigation item |

## Implementation Summary

### Phase 1: Foundation - COMPLETED
1. Create `apps/admin` with Vite + React + TailwindCSS
2. Set up routing, layout components, auth store
3. Implement admin-only login page
4. Create shared UI components (via @pos/ui package)

### Phase 2: Core Admin Features - COMPLETED
5. Implement Stores management page
6. Implement Users management page
7. Implement Settings page

### Phase 3: Database & API Updates - COMPLETED
8. Add audit_logs table and migration
9. Create audit logging utility
10. Integrate audit logging into existing routes
11. Implement audit logs API endpoint
12. Implement CSV import/export endpoints
13. Implement settings endpoints
14. Implement cross-store report endpoints

### Phase 4: Reports & Advanced Features - COMPLETED
15. Implement Admin Dashboard
16. Implement Reports page
17. Implement Audit Logs viewer
18. Implement Data Management page

### Phase 5: POS Web Cleanup - COMPLETED
19. Remove Users page from POS web
20. Update login to reject admin users
21. Update sidebar navigation

### Phase 6: Docker & Deployment - COMPLETED
22. Create Dockerfile for admin
23. Update docker-compose files
24. Configure nginx for subdomain routing
25. Update documentation

## Security Considerations

1. **Admin-only access**: Login rejects non-admin users
2. **Session management**: Same JWT-based auth as POS web
3. **Audit trail**: All admin actions logged
4. **RBAC enforcement**: API validates admin role on all admin endpoints
5. **CORS configuration**: Admin panel added to allowed origins

## Dependencies

```json
{
  "@pos/api-client": "*",
  "@pos/shared": "*",
  "@pos/ui": "*",
  "@radix-ui/react-slot": "^1.2.4",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "date-fns": "^4.1.0",
  "lucide-react": "^0.562.0",
  "react": "^18.3.1",
  "react-router-dom": "^7.1.1",
  "recharts": "^3.6.0",
  "tailwind-merge": "^3.4.0",
  "zod": "^4.2.1",
  "zustand": "^5.0.2"
}
```

## Related Documents

- **PRD**: [Admin Panel PRD](../prd/admin-panel-prd.md) - Product requirements, user personas, goals, success metrics
- **ADR-0005**: Admin Panel Separation (architectural decision)
- **ADR-0006**: UI Component Sharing Strategy
- **ADR-0007**: Shared API Client Package
- **PLAN.md**: Original system plan with role permissions
