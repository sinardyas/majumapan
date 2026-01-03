# Product Requirements Document: Admin Panel

**Document Version:** 1.0  
**Last Updated:** 2024-12-31  
**Status:** Implemented  
**Prepared By:** Product & Engineering Team  
**Related Document:** [Feature Specification (FSD)](features/admin-panel.md) - For technical implementation details

---

## 1. Executive Summary

The Admin Panel is a dedicated web application for system administrators to manage the POS system. It provides centralized control over stores, users, system settings, and cross-store reporting. By separating admin functionality from the POS web application, we achieve better role separation, improved security, and a cleaner user experience for each persona.

### Key Outcomes

- **Decoupled admin operations** from cashier-facing POS workflows
- **Centralized management** of all stores, users, and system configurations
- **Enhanced security** through isolated admin access and comprehensive audit logging
- **Cross-store visibility** with unified reporting and analytics dashboards

### Quick Reference

| Aspect | Description |
|--------|-------------|
| Target Users | System Administrators, Business Managers |
| Access Method | Separate subdomain (admin.example.com) |
| Authentication | Admin-only (rejects non-admin users) |
| Core Features | Stores, Users, Reports, Audit Logs, Settings, Data Management |
| Deployment | Separate application from POS web |

> **Technical Details**: See [Feature Specification](features/admin-panel.md) for architecture, technology stack, API endpoints, database schema, and code references.

---

## 2. Problem Statement

### Current Challenges

Before the Admin Panel was implemented, admin functionality was mixed into the POS web application, creating several issues:

| Challenge | Impact |
|-----------|--------|
| **Role Confusion** | Admins without a store assignment couldn't use store-scoped features, causing confusion and blocked workflows |
| **UI Complexity** | A single application tried to serve different user personas (cashiers, managers, admins), resulting in cluttered interfaces |
| **Security Surface** | Admin features were exposed in the same application as POS operations, increasing attack vectors |
| **Offline Complexity** | PWA/offline-first features (designed for cashiers working offline) were unnecessary for admin tasks |

### User Pain Points

1. Admins couldn't efficiently manage multiple stores from a single interface
2. Cross-store reporting required manual data aggregation
3. User management was scattered across different areas
4. System-wide settings were hard to locate and modify
5. No comprehensive audit trail for compliance and debugging

---

## 3. Goals & Objectives

### Primary Goals

| Goal | Success Metric |
|------|----------------|
| Provide centralized system administration | All admin tasks completed in Admin Panel within 30 days of launch |
| Improve security posture | Zero unauthorized admin access attempts; 100% audit coverage |
| Enable cross-store visibility | Dashboard reflects real-time data across all stores |
| Reduce POS complexity | POS web app focused on checkout workflows only |

### Secondary Objectives

- Simplify user onboarding for new admins through intuitive UI
- Reduce time spent on administrative tasks by 50%
- Improve compliance with audit logging
- Enable data-driven decisions through cross-store reporting

---

## 4. User Personas

### Persona 1: System Administrator

**Profile:** Technical user responsible for overall system health  
**Goals:**
- Manage all stores and users
- Configure system-wide settings
- Monitor system activity and performance
- Generate reports for stakeholders

**Behaviors:**
- Accesses Admin Panel daily
- Uses desktop browser exclusively
- Expects detailed data and controls
- Needs comprehensive audit trail

**Frustrations:**
- Slow data loading
- Incomplete audit logs
- Difficulty tracking changes

### Persona 2: Business Manager

**Profile:** Business user responsible for store operations  
**Goals:**
- Monitor store performance
- Review sales reports
- Manage store-level users
- Track inventory levels

**Behaviors:**
- Accesses Admin Panel weekly
- Uses both desktop and tablet
- Prefers visual reports and charts
- Needs exportable data

**Frustrations:**
- Manual data consolidation
- Lack of cross-store comparison
- Complex navigation

---

## 5. Functional Requirements

### 5.1 Core Pages

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

### 5.2 Dashboard Requirements

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

### 5.3 Store Management Requirements

**CRUD Operations:**

| Operation | Fields | Validation |
|-----------|--------|------------|
| Create | name (required), address (optional), phone (optional), isActive (default: true) | Unique name per deployment |
| Read | List with search, filter by active/inactive, show metrics | - |
| Update | All fields | Cannot deactivate store with pending transactions |
| Delete | Soft delete only (isActive = false) | - |

**List View Columns:**
- Store Name
- User Count
- Product Count
- Today's Sales
- Status (Active/Inactive)
- Actions (Edit, Deactivate/Activate)

### 5.4 User Management Requirements

**User Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | Yes | Unique, valid email format |
| name | string | Yes | Min 2 chars, max 255 chars |
| password | string | Yes (create) | Min 8 chars |
| role | enum | Yes | admin, manager, cashier |
| storeId | uuid | Conditional | Required for manager/cashier |
| pin | string | No | 6 digits, numeric |
| isActive | boolean | Yes | Default: true |

**Role Constraints:**
- Only admins can create admin users
- Managers and cashiers must have a storeId
- Admins have storeId = null (access all stores)

**List View Features:**
- Search by name/email
- Filter by role (admin/manager/cashier)
- Filter by store
- Show last login time
- Quick actions: Edit, Reset Password, Deactivate

### 5.5 Reports Requirements

**Report Types:**

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

### 5.6 Audit Logs Requirements

**Log Fields:**

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

**Viewer Features:**
- Filter by user
- Filter by action type
- Filter by entity type
- Filter by date range
- Search by entity name
- Pagination (50 per page)

**Retention:** 90 days (configurable in settings)

### 5.7 Data Management Requirements

**Export Options:**

| Entity | Fields Exported |
|--------|-----------------|
| Products | id, storeId, storeName, categoryId, categoryName, sku, barcode, name, description, price, costPrice, isActive |
| Categories | id, storeId, storeName, name, description, isActive |
| Users | id, email, name, role, storeId, storeName, isActive, createdAt |

**Import Requirements:**

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

### 5.8 Settings Requirements

| Setting | Key | Type | Default | Description |
|---------|-----|------|---------|-------------|
| Tax Rate | `tax_rate` | decimal | 0.10 | Global tax rate (decimal) |
| Currency | `currency` | string | USD | Currency code |
| Currency Symbol | `currency_symbol` | string | $ | Display symbol |
| Transaction Prefix | `transaction_prefix` | string | TXN | Receipt number prefix |
| Local Retention Days | `local_retention_days` | integer | 30 | Days to keep synced data locally |
| Audit Log Retention Days | `audit_log_retention_days` | integer | 90 | Days to keep audit logs |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|-------------|--------|
| Page load time (Dashboard) | < 2 seconds |
| API response time (p95) | < 500ms |
| Report generation (1000+ records) | < 10 seconds |
| Concurrent users | 100+ |

### 6.2 Availability

| Requirement | Target |
|-------------|--------|
| Uptime | 99.5% |
| Planned maintenance window | Off-hours only |
| Error rate | < 0.1% |

### 6.3 Scalability

| Requirement | Description |
|-------------|-------------|
| Store scaling | Support 100+ stores |
| User scaling | Support 1000+ users |
| Transaction history | Support 1M+ transactions |

### 6.4 Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

### 6.5 Accessibility

| Standard | Compliance |
|----------|------------|
| WCAG 2.1 | AA |
| Keyboard navigation | Full support |
| Screen reader | Compatible |

---

## 7. User Flows

### Flow 1: Admin Login

```
1. User navigates to admin.example.com
2. System redirects to /login
3. User enters email and password
4. System validates credentials
5a. If admin user: Redirect to dashboard
5b. If non-admin user: Show error "Admin access required. Please use the POS application."
```

### Flow 2: View System Overview

```
1. Admin logs in
2. Dashboard displays automatically
3. Admin sees KPIs:
   - Total Revenue Today: $12,450.00
   - Total Transactions: 156
   - Active Stores: 5
   - Pending Syncs: 3
4. Admin scrolls to see charts
5. Sales by Store bar chart shows each store's performance
6. Recent Activity shows last 10 audit log entries
```

### Flow 3: Create New Store

```
1. Admin navigates to Stores page
2. Clicks [Add Store] button
3. Modal appears with form fields
4. Enters:
   - Name: "Downtown Location"
   - Address: "123 Main St"
   - Phone: "555-0123"
5. Clicks [Create]
6. System validates and creates store
7. Toast notification: "Store created successfully"
8. Store appears in list
```

### Flow 4: Create New User

```
1. Admin navigates to Users page
2. Clicks [Add User] button
3. Modal appears with form fields
4. Enters:
   - Email: "john@store.com"
   - Name: "John Smith"
   - Password: "secure123"
   - Role: Manager
   - Store: Downtown Location
   - PIN: 123456
5. Clicks [Create]
6. System validates and creates user
7. Toast notification: "User created successfully"
8. User appears in list
```

### Flow 5: Generate Sales Report

```
1. Admin navigates to Reports page
2. Selects "Sales by Store" report
3. Sets date range: Last 30 days
4. Clicks [Generate]
5. System fetches and aggregates data
6. Table displays sales breakdown by store
7. Admin clicks [Export CSV]
8. CSV file downloads with all data
```

### Flow 6: Review Audit Logs

```
1. Admin navigates to Audit Logs page
2. Default view shows recent logs
3. Filters by:
   - User: "john@store.com"
   - Action: "update"
   - Entity: "stores"
4. Clicks [Apply Filters]
5. Filtered results display
6. Admin clicks on a log entry
7. Modal shows full details including changes
```

### Flow 7: Bulk Import Products

```
1. Admin navigates to Data Management page
2. Selects "Import Products" tab
3. Downloads CSV template
4. Fills template with product data
5. Uploads filled CSV
6. System validates all rows
7a. If validation passes:
   - Shows success with row count
   - Data is imported
7b. If validation fails:
   - Shows error with row numbers and reasons
   - Admin corrects and re-uploads
```

---

## 8. UI/UX Requirements

### 8.1 Design Principles

1. **Clarity**: Information organized logically, easy to scan
2. **Efficiency**: Common tasks require minimal clicks
3. **Consistency**: Follow established patterns within the app
4. **Feedback**: Clear feedback for all user actions

### 8.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar    │  Header                                           │
│  ───────────│──────────────────────────────────────────────────│
│              │                                                  │
│  Dashboard  │  Main Content Area                               │
│  Stores     │                                                  │
│  Users      │  ┌────────────────────────────────────────────┐  │
│  Reports    │  │                                            │  │
│  Audit Logs │  │         Page Content                       │  │
│  Data Mgmt  │  │                                            │  │
│  Settings   │  └────────────────────────────────────────────┘  │
│              │                                                  │
│              │  Footer                                          │
└──────────────┴──────────────────────────────────────────────────┘
```

### 8.3 Component Library

Using shared UI components:
- Button (with variants: default, outline, ghost, destructive)
- Input (with label and error support)
- Select (dropdown with search)
- Modal (centered with backdrop)
- Card (with header, footer, content variants)
- Table (with columns and data arrays)
- Badge (status indicators)
- Skeleton (loading states)
- Toast (notifications)

### 8.4 Responsive Design

| Breakpoint | Layout |
|------------|--------|
| Desktop (1200px+) | Full sidebar, multi-column content |
| Tablet (768-1199px) | Collapsed sidebar, single column |
| Mobile (<768px) | Not supported (admin use only) |

---

## 9. Security Requirements

### 9.1 Authentication & Authorization

| Requirement | Description |
|-------------|-------------|
| Admin-only access | Login rejects non-admin users with clear message |
| Session management | JWT-based auth (same as POS web) |
| Role-based access | API validates admin role on all admin endpoints |
| Session timeout | 24 hours of inactivity |

### 9.2 Audit Logging

| Requirement | Description |
|-------------|-------------|
| Comprehensive logging | All admin actions logged with details |
| Change tracking | For updates, log `{ field: { old, new } }` |
| IP tracking | Log client IP address |
| User agent tracking | Log browser/client info |

### 9.3 Data Protection

| Requirement | Description |
|-------------|-------------|
| Password requirements | Min 8 characters |
| Sensitive data | Passwords never logged or exposed |
| CSV exports | No sensitive data in exports |

### 9.4 Network Security

| Requirement | Description |
|-------------|-------------|
| CORS | Admin panel added to allowed origins |
| HTTPS | All traffic encrypted |
| Subdomain isolation | Separate domain for admin panel |

---

## 10. Success Metrics

### 10.1 KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Admin adoption | 100% of admins using panel within 30 days | Login tracking |
| Task completion rate | >95% of tasks completed without errors | Error rate monitoring |
| Page load time | <2 seconds for all pages | Real user monitoring |
| User satisfaction | >4.5/5 rating in user feedback | Periodic surveys |

### 10.2 Adoption Tracking

- Track login frequency per admin user
- Monitor feature usage patterns
- Identify unused features for deprecation
- Gather feedback for improvements

---

## 11. Dependencies

### 11.1 Related Features

| Feature | Relationship |
|---------|--------------|
| POS Web | Separate application with shared authentication |
| Discount Management | Shared data source for promotions |
| User Management | Centralized user administration |

### 11.2 Integration Points

- Separate subdomain for admin access
- Shared authentication with POS web
- API access for all management operations

> **Technical Implementation**: See [Feature Specification](features/admin-panel.md) for technology stack, package dependencies, and integration details.

---

## 12. Timeline & Milestones

### Phase 1: Foundation
- [x] Create `apps/admin` with Vite + React + TailwindCSS
- [x] Set up routing, layout components, auth store
- [x] Implement admin-only login page
- [x] Create shared UI components (via @pos/ui package)

### Phase 2: Core Admin Features
- [x] Implement Stores management page
- [x] Implement Users management page
- [x] Implement Settings page

### Phase 3: Database & API Updates
- [x] Add audit_logs table and migration
- [x] Create audit logging utility
- [x] Integrate audit logging into existing routes
- [x] Implement audit logs API endpoint
- [x] Implement CSV import/export endpoints
- [x] Implement settings endpoints
- [x] Implement cross-store report endpoints

### Phase 4: Reports & Advanced Features
- [x] Implement Admin Dashboard
- [x] Implement Reports page
- [x] Implement Audit Logs viewer
- [x] Implement Data Management page

### Phase 5: POS Web Cleanup
- [x] Remove Users page from POS web
- [x] Update login to reject admin users
- [x] Update sidebar navigation

### Phase 6: Docker & Deployment
- [x] Create Dockerfile for admin
- [x] Update docker-compose files
- [x] Configure nginx for subdomain routing
- [x] Update documentation

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Admin Panel | Dedicated web application for system administration |
| POS Web | Point-of-sale application for cashiers |
| Audit Log | Record of system activities for compliance |
| CRUD | Create, Read, Update, Delete operations |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token for authentication |
| CORS | Cross-Origin Resource Sharing |

---

## 14. Related Documents

| Document | Description |
|----------|-------------|
| [Feature Specification](features/admin-panel.md) | Technical implementation details, architecture, code references |
| [ADR-0005](adr/ADR-0005-admin-panel-separation.md) | Admin Panel Separation (architectural decision) |
| [ADR-0006](adr/ADR-0006-ui-component-sharing-strategy.md) | UI Component Sharing Strategy |
| [ADR-0007](adr/ADR-0007-shared-api-client.md) | Shared API Client Package |
| [PLAN.md](../PLAN.md) | Original system plan with role permissions |

---

## 15. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-31 | Initial release |

---

**Document End**

*For technical implementation details, see [Feature Specification](features/admin-panel.md).*

*For questions or updates, contact the Product Engineering team.*
