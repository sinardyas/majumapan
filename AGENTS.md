# AGENTS.md - Agentic Coding Guidelines

This file provides guidelines for agents operating in the Majumapan POS codebase.

---

## Project Overview

| Directory | Description |
|-----------|-------------|
| `apps/api` | Backend API (Hono + Drizzle + PostgreSQL) |
| `apps/web` | POS Web Application (React + Vite + IndexedDB) |
| `apps/admin` | Admin Panel (React + Vite) |
| `packages/ui` | Shared UI components (shadcn-ui patterns) |
| `packages/shared` | Shared types and utilities |
| `packages/api-client` | API client for frontend apps |

---

## Commands

### Development
```bash
npm run dev              # All apps
npm run dev:api          # Backend API
npm run dev:web          # POS Web
npm run dev:admin        # Admin Panel
```

### Building
```bash
npm run build           # All apps
npm run build:api       # Specific app
npm run build:web
npm run build:admin
```

### Linting & Type Checking
```bash
npm run lint            # All apps
npm run typecheck       # All apps
cd apps/api && npx tsc --noEmit    # Specific app
cd apps/web && npx tsc --noEmit
cd apps/admin && npx tsc --noEmit
```

### Testing
```bash
cd apps/admin && npm run test      # Watch mode
cd apps/admin && npm run test:run # Once
npx vitest run apps/admin/src/lib/utils.test.ts  # Single file
npx vitest run -t "test name"      # By name
```

### Database (API)
```bash
npm run db:generate  # Generate migration
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema (dev)
npm run db:seed      # Seed data
npm run db:studio   # Open Drizzle Studio
npm run db:reset    # Migrate + seed
```

---

## Code Style Guidelines

### TypeScript
- **Strict mode** - avoid `any`
- Use `interface` for objects, `type` for unions
```typescript
interface User { id: string; name: string; role: 'manager' | 'cashier'; }
```

### ESLint Rules (apps/admin/eslint.config.js)
- **Semicolons required** - `semi: ['error', 'always']`
- **Strict equality** - `eqeqeq: ['error', 'always']` (`===` not `==`)

### React Components
- Functional components with hooks
- Use **CVA** for variants (see `packages/ui/src/Button.tsx`)
- Follow shadcn-ui compositional patterns

### Import Conventions
Use **path aliases**, not relative imports:

```typescript
// Good
import { Button } from '@pos/ui';
import { useAuthStore } from '@/stores/authStore';

// Available aliases:
// @/*        -> ./src/*
// @pos/ui    -> packages/ui/src
// @pos/shared -> packages/shared/src
// @pos/api-client -> packages/api/src
```

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PaymentModal` |
| Hooks | camelCase with `use` | `useAuthStore` |
| Variables | camelCase | `activeShift` |
| Files | kebab-case | `shift-modal.tsx` |
| DB tables | snake_case | `device_bindings` |

### API Response Standards

All API endpoints must follow the standard response envelope format (see ADR-0012).

**TypeScript Interface** (`packages/api/src/types.ts`):
```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: { page: number; limit: number; total: number; totalPages: number; };
}
```

**Success Response:**
```typescript
{ success: true, data: { entity: {...} } }
```

**Error Response:**
```typescript
{ success: false, error: "Error message", details?: {...} }
```

**HTTP Status Codes:**
- Always use HTTP 200 for responses
- Business errors indicated via `success: false` in body
- Validation error: `200` with `{ success: false, error: "Validation failed", details: {...} }`

**Response Formats by Endpoint Type:**
- Single Entity: `{ success: true, data: { entity: {...} } }`
- List/Paginated: `{ success: true, data: { items: [], pagination: {...} } }`
- Action: `{ success: true, message: "..." }`

**Backend Examples:**
```typescript
// ✅ CORRECT
return c.json({ success: true, data: { shift: newShift } });
return c.json({ success: false, error: 'Not found' }, 400);

// ❌ INCORRECT - missing success field
return c.json({ shift: newShift });

// ❌ INCORRECT - data at root level
return c.json({ success: true, shift: newShift });
```

**Frontend Handling:**
```typescript
const response = await api.get<{ success: boolean; data: Shift }>('/shifts/active');
if (response.success && response.data?.shift) { /* handle success */ }
if (!response.success) { /* handle error */ }
```

**Code Review Checklist:**
1. Success responses include `success: true`
2. Success responses wrap data in `data` field
3. Error responses include `success: false` and `error` field
4. No responses have data at root level alongside `success`

### Database (Drizzle ORM)
- Migrations in `apps/api/drizzle/*.sql`
- Naming: `0018_device_bindings_master_terminal.sql`
- Snake_case for tables/columns

```typescript
export const deviceBindings = pgTable('device_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull(),
  isMasterTerminal: boolean('is_master_terminal').default(false),
});
```

### State Management (Zustand)
```typescript
interface ShiftState {
  activeShift: LocalShift | null;
  loadActiveShift: () => Promise<void>;
}

export const useShiftStore = create<ShiftState>((set) => ({
  activeShift: null,
  loadActiveShift: async () => { ... },
}));
```

---

## Project-Specific Patterns

### API Client
```typescript
import { api } from '@/services/api';
const response = await api.get<{ success: boolean; data: Shift }>('/shifts/active');
```

### Offline Support (POS Web)
- Uses IndexedDB (Dexie) for offline
- Local-first, then reconcile with server
- See ADR-0008

### UI Components
- Create in `packages/ui/src/`
- Export from `packages/ui/src/index.ts`
- Use Radix UI primitives

---

## Common Tasks

### Add API endpoint
1. Add route in `apps/api/src/routes/`
2. Add Zod schema validation
3. Add to API client if needed

### Add UI component
1. Create in `packages/ui/src/`
2. Export from `packages/ui/src/index.ts`

### Add database migration
1. `npm run db:generate`
2. Edit SQL in `apps/api/drizzle/`
3. `npm run db:migrate`

---

## Key Dependencies
| Package | Purpose |
|---------|---------|
| `hono` | API framework |
| `drizzle-orm` | Database ORM |
| `zod` | Schema validation |
| `react` | UI framework |
| `zustand` | State management |
| `dexie` | IndexedDB |
| `tailwindcss` | Styling |
| `lucide-react` | Icons |
| `cva` | Component variants |
| `@radix-ui/react-slot` | Polymorphic components |

---

## Documentation
- **ADRs**: `docs/adr/` - Architecture decisions
- **PRDs**: `docs/prd/` - Product requirements
- **Features**: `docs/features/` - Feature specs
