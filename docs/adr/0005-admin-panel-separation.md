# ADR-0005: Admin Panel Separation

## Status

Accepted

## Date

2024-12-30

## Context

The POS system currently has a single web application (`apps/web`) that serves all user roles: admin, manager, and cashier. This monolithic frontend approach has created several challenges:

### Current Problems

1. **Role-Feature Mismatch**: Admin users have `storeId: null` by design (they manage all stores), but most pages in the POS web are store-scoped. This created a need for a complex "store selector" feature for admins.

2. **UI Complexity**: The single app tries to serve different user personas:
   - Cashiers need a fast, focused POS interface
   - Managers need store management tools
   - Admins need system-wide configuration and reporting

3. **Unnecessary Offline Complexity**: The POS web is built as an offline-first PWA with IndexedDB, service workers, and sync logic. Admins typically work online and don't need these features.

4. **Security Surface**: Admin features (user management, store management) are exposed in the same app as POS operations, increasing the attack surface.

5. **Missing Admin UI**: Several admin-only features have API support but no UI:
   - Store management (CRUD)
   - App settings
   - Cross-store reporting
   - Audit logging

### Key Question

Should we continue with a single web app and add complexity (store selector, role-based UI switching), or separate into dedicated applications?

## Decision

We will create a **dedicated Admin Panel** as a separate web application (`apps/admin`), distinct from the POS web application.

### Architecture

```
apps/
├── api/       # Shared backend API
├── web/       # POS + Store Management (managers, cashiers)
└── admin/     # Admin Panel (admins only)
```

### URL Structure

Using subdomain approach for clear separation:

| Application | URL | Users |
|-------------|-----|-------|
| POS Web | `pos.example.com` | Managers, Cashiers |
| Admin Panel | `admin.example.com` | Admins only |
| API | `api.example.com` | All applications |

### Feature Allocation

| Feature | POS Web | Admin Panel |
|---------|---------|-------------|
| POS Interface | Yes | No |
| Product Management | Yes (store-scoped) | No |
| Category Management | Yes (store-scoped) | No |
| Discount Management | Yes (store-scoped) | No |
| Stock Management | Yes (store-scoped) | No |
| Store Dashboard | Yes (store-scoped) | No |
| Transaction History | Yes (store-scoped) | No |
| **Store CRUD** | No | Yes |
| **User Management** | No | Yes (all users) |
| **App Settings** | No | Yes |
| **Cross-store Reports** | No | Yes |
| **Audit Logs** | No | Yes |
| **Data Import/Export** | No | Yes |

### Technical Differences

| Aspect | POS Web | Admin Panel |
|--------|---------|-------------|
| Offline Support | Yes (PWA, IndexedDB) | No |
| Service Worker | Yes | No |
| Local Database | Yes (Dexie.js) | No |
| Sync Logic | Yes | No |
| Target Users | Managers, Cashiers | Admins only |
| Login Validation | Reject admins | Reject non-admins |

## Consequences

### Positive

1. **Clean Separation of Concerns**: Each app focuses on its target user persona
   - POS web: Fast, offline-capable for store operations
   - Admin panel: Feature-rich for system administration

2. **Simplified Codebases**: 
   - POS web doesn't need store selector or admin-specific UI
   - Admin panel doesn't need offline/sync complexity

3. **Independent Deployment**: Apps can be deployed and scaled independently

4. **Better Security**:
   - Admin features isolated to dedicated app
   - Smaller attack surface per application
   - Clear authentication boundaries

5. **Performance**:
   - POS web stays lightweight (no admin code)
   - Admin panel can include heavier reporting features without affecting POS

6. **Future Flexibility**:
   - Admin panel can adopt different UI frameworks if needed
   - Easier to add admin-specific features without POS regression

### Negative

1. **Code Duplication**: Some UI components duplicated across apps (Button, Input, Modal, etc.)
   - Mitigation: Could create shared `packages/ui` in future if duplication becomes problematic

2. **Two Apps to Maintain**: Increases overall maintenance burden
   - Mitigation: Same tech stack reduces learning curve

3. **Additional Deployment Complexity**: Need to configure subdomain routing
   - Mitigation: Well-documented nginx configuration

4. **User Confusion**: Admins need to know to use different URL
   - Mitigation: POS login shows clear message directing admins to admin panel

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Component drift (apps diverge in styling) | Medium | Same TailwindCSS config, could extract shared package |
| Authentication token incompatibility | High | Same JWT structure, same API, same auth endpoints |
| API version mismatch | Medium | Shared `packages/shared` for types and schemas |
| Nginx misconfiguration | Medium | Documented config, tested in docker-compose |

## Alternatives Considered

### Alternative A: Single App with Store Selector

Add a store selector banner for admin users to choose which store's data to view.

```
┌─────────────────────────────────────────────────┐
│ [🏪 Select Store: Downtown Store ▼]              │
├─────────────────────────────────────────────────┤
│                                                 │
│   (Rest of POS/Dashboard UI)                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Rejected because:**
- Adds complexity to every store-scoped component
- Doesn't solve the offline-first mismatch (admins don't need it)
- Mixes admin and operational concerns in one app
- Still missing admin-only features (audit logs, cross-store reports)

### Alternative B: Role-Based Feature Flags

Use feature flags to show/hide features based on user role.

```typescript
{user.role === 'admin' && <AdminDashboard />}
{user.role !== 'admin' && <StoreDashboard />}
```

**Rejected because:**
- Increases bundle size (all code shipped to all users)
- Complex conditional rendering throughout app
- Testing matrix explodes (3 roles × all features)
- Doesn't address offline-first mismatch

### Alternative C: Micro-Frontends

Use Module Federation or similar to compose app from role-specific modules.

**Rejected because:**
- Over-engineering for current scale
- Significant complexity increase
- Team size doesn't justify the overhead
- Shared state becomes challenging

### Alternative D: Keep Current State

Continue without admin UI, use database/API directly for admin tasks.

**Rejected because:**
- Poor admin experience
- Error-prone manual database operations
- No audit trail for admin actions
- Missing features (import/export, reports)

## Implementation Notes

### Authentication Flow

**Admin Panel Login:**
1. User submits credentials to `/api/v1/auth/login`
2. API returns user data including `role`
3. Admin panel checks `role === 'admin'`
4. If not admin, show error: "Access denied. This panel is for administrators only."
5. If admin, store tokens and proceed

**POS Web Login:**
1. User submits credentials to `/api/v1/auth/login`
2. API returns user data including `role`
3. POS web checks `role !== 'admin'`
4. If admin, show message: "Admin users should use the Admin Panel at admin.example.com"
5. If manager/cashier, store tokens and proceed

### Nginx Configuration (Production)

```nginx
# Admin Panel
server {
    listen 80;
    server_name admin.example.com;
    
    location / {
        proxy_pass http://admin:80;
    }
}

# POS Web
server {
    listen 80;
    server_name pos.example.com;
    
    location / {
        proxy_pass http://web:80;
    }
}

# API
server {
    listen 80;
    server_name api.example.com;
    
    location / {
        proxy_pass http://api:3000;
    }
}
```

### Audit Logging Integration

New utility function for recording admin actions:

```typescript
// apps/api/src/utils/audit.ts
export async function logAuditEvent(params: {
  userId: string;
  userEmail: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout';
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress?: string;
  userAgent?: string;
}) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    ...params,
    createdAt: new Date(),
  });
}
```

Integrated into route handlers:

```typescript
// Example: Store creation
app.post('/stores', async (c) => {
  const user = c.get('user');
  const data = await c.req.json();
  
  const store = await db.insert(stores).values(data).returning();
  
  await logAuditEvent({
    userId: user.id,
    userEmail: user.email,
    action: 'create',
    entityType: 'store',
    entityId: store.id,
    entityName: store.name,
    ipAddress: c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
  });
  
  return c.json(store);
});
```

## Related Documents

- **Feature Specification**: `docs/features/admin-panel.md`
- **ADR-0001**: Dexie Query Pattern for Offline Data Access
- **PLAN.md**: Original system plan with role permissions

## References

- [Separation of Concerns](https://en.wikipedia.org/wiki/Separation_of_concerns)
- [Micro Frontends](https://micro-frontends.org/)
- [The Twelve-Factor App](https://12factor.net/)
