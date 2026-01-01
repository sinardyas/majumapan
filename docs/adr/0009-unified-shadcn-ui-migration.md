# ADR-0009: Unified shadcn-ui Base Library Migration

## Status

Phase 1-3 Completed

## Date

2025-01-01

## Context

The Majumapan POS system currently has inconsistent UI component architectures:

### Current State

| Aspect | Admin Panel | POS Web |
|--------|-------------|---------|
| **UI Pattern** | shadcn-like (Radix UI + CVA) | Simple props-based |
| **Dependencies** | `@radix-ui/react-slot`, `cva`, `clsx`, `tailwind-merge`, `lucide-react` | None (inline classes) |
| **Button Variants** | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` | `primary`, `secondary`, `danger`, `success`, `outline`, `ghost` |
| **Card Pattern** | Compositional (`Card`, `CardHeader`, `CardTitle`, etc.) | Single component with `title`, `header`, `footer` props |
| **Icons** | `lucide-react` | Inline SVG |
| **Utilities** | `cn()` from `@/lib/utils` | None |

### Problems

1. **Code duplication**: Similar components implemented differently
2. **Maintenance burden**: Changes must be applied in multiple places
3. **Inconsistent UX**: Different visual behavior across apps
4. **Missing components**: @pos/ui lacks Badge, Skeleton, Textarea
5. **Icon inconsistency**: Inline SVGs vs lucide-react

### Solution

Migrate both applications to use a unified `@pos/ui` package based on shadcn-ui architecture with:
- CVA for variant management
- Radix UI primitives for accessibility
- lucide-react for icons
- Consistent compositional component patterns

## Decision

We will refactor `@pos/ui` to use shadcn-ui conventions and migrate both admin panel and POS web to use it.

### Guiding Principles

1. Follow shadcn conventions (default/destructive variants, compositional patterns)
2. Use lucide-react for all icons
3. Prioritize admin panel migration first, then POS web
4. Maintain all existing functionality (manual testing)

## Migration Progress

### Phase 1: Foundation - Upgrade @pos/ui to shadcn Architecture ✅ COMPLETED

| # | Task | Status |
|---|------|--------|
| 1.1 | Update `packages/ui/package.json` - add dependencies | ✅ |
| 1.2 | Create `packages/ui/src/lib/utils.ts` with `cn()` function | ✅ |
| 1.3 | Refactor `Button.tsx` - adopt CVA, Radix Slot, `asChild`, `default/destructive` naming | ✅ |
| 1.4 | Refactor `Card.tsx` - switch to compositional pattern | ✅ |
| 1.5 | Refactor `Input.tsx` - add proper labeling, accessibility | ✅ |
| 1.6 | Refactor `Modal.tsx` - add portal, animation, accessibility | ✅ |
| 1.7 | Add `Textarea.tsx` - from admin panel | ✅ |
| 1.8 | Add `Badge.tsx` - from admin panel | ✅ |
| 1.9 | Add `Skeleton.tsx` - from admin panel | ✅ |
| 1.10 | Refactor `Select.tsx` - use shadcn patterns | ✅ |
| 1.11 | Refactor `Table.tsx` - use shadcn patterns | ✅ |
| 1.12 | Update `packages/ui/src/index.ts` exports | ✅ |
| 1.13 | Update `packages/ui/tsconfig.json` | ✅ |

**Phase 1 Total: ~9 hours - COMPLETED**

### Phase 2: Admin Panel - Migrate to @pos/ui ✅ COMPLETED

| # | Task | Status |
|---|------|--------|
| 2.1 | Remove `apps/admin/src/components/ui/` directory | ✅ |
| 2.2 | Update `apps/admin/tsconfig.json` - add @pos/ui path alias | ✅ |
| 2.3 | Update imports in Login.tsx | ✅ |
| 2.4 | Update imports in Dashboard.tsx | ✅ |
| 2.5 | Update imports in Stores.tsx | ✅ |
| 2.6 | Update imports in Users.tsx | ✅ |
| 2.7 | Update imports in Reports.tsx | ✅ |
| 2.8 | Update imports in AuditLogs.tsx | ✅ |
| 2.9 | Update imports in DataManagement.tsx | ✅ |
| 2.10 | Update imports in Settings.tsx | ✅ |
| 2.11 | Update layout components (Sidebar, Header, AdminLayout) | ✅ (not needed) |
| 2.12 | Build and verify admin panel | ✅ |

**Phase 2 Total: ~9 hours - COMPLETED**

### Phase 3: POS Web - Update Component Usage

| # | Task | Effort | Status |
|---|------|--------|--------|
| 3.1 | Update Button usage - change `primary` → `default`, `danger` → `destructive` | 1 hour | ⏳ |
| 3.2 | Update Card usage - switch from `title` prop to `CardTitle` component | 2 hours | ⏳ |
| 3.3 | Update Select usage - adjust to new API | 30 min | ⏳ |
| 3.4 | Update Table usage - adjust to new API | 30 min | ⏳ |
| 3.5 | Update Modal usage - adjust to new API | 30 min | ⏳ |
| 3.6 | Add lucide-react to POS web dependencies | 10 min | ⏳ |
| 3.7 | Replace inline SVG icons with lucide-react | 3 hours | ⏳ |
| 3.8 | Manual testing of all POS pages | 3 hours | ⏳ |

**Phase 3 Total: ~11 hours - IN PROGRESS**

### Phase 4: Final Verification

| # | Task | Effort | Status |
|---|------|--------|--------|
| 4.1 | Full admin panel smoke test | 1 hour | ⏳ |
| 4.2 | Full POS web smoke test | 1 hour | ⏳ |
| 4.3 | Fix any issues found | 4 hours (buffer) | ⏳ |
| 4.4 | Update documentation | 30 min | ⏳ |

**Phase 4 Total: ~7 hours - PENDING**

## Grand Total: ~36 hours (Phase 1-2: 18h completed, Phase 3-4: 18h pending)

## Component API Changes

### Button Variants Mapping

| Old (POS) | New (shadcn) | Action |
|-----------|--------------|--------|
| `primary` | `default` | Rename |
| `secondary` | `secondary` | Keep |
| `danger` | `destructive` | Rename |
| `success` | `success` | Add new variant |
| `outline` | `outline` | Keep |
| `ghost` | `ghost` | Keep |
| `link` | `link` | Keep |

### Card Pattern Migration

**Before (POS web):**
```tsx
<Card title="Sales" footer={<Button>Action</Button>}>
  Content here
</Card>
```

**After (shadcn):**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Sales</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### New Components Added to @pos/ui

| Component | Source | Description |
|-----------|--------|-------------|
| `Textarea` | Admin panel | Multi-line text input |
| `Badge` | Admin panel | Status indicator |
| `Skeleton` | Admin panel | Loading placeholder |

### Dependencies to Add to @pos/ui

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "@radix-ui/react-slot": "^1.2.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.460.0"
  }
}
```

## Files Impacted

### Created Files

| File | Purpose |
|------|---------|
| `packages/ui/src/lib/utils.ts` | `cn()` utility function |
| `packages/ui/src/Textarea.tsx` | Textarea component |
| `packages/ui/src/Badge.tsx` | Badge component |
| `packages/ui/src/Skeleton.tsx` | Skeleton component |

### Modified Files

| File | Change |
|------|--------|
| `packages/ui/package.json` | Add dependencies |
| `packages/ui/tsconfig.json` | Update include paths |
| `packages/ui/src/Button.tsx` | Refactor to shadcn pattern |
| `packages/ui/src/Card.tsx` | Refactor to compositional |
| `packages/ui/src/Input.tsx` | Add accessibility |
| `packages/ui/src/Modal.tsx` | Add portal, animation |
| `packages/ui/src/Select.tsx` | Refactor pattern |
| `packages/ui/src/Table.tsx` | Refactor pattern |
| `packages/ui/src/Toast.tsx` | Minor updates |
| `packages/ui/src/index.ts` | Update exports |

### Deleted Files

| File | Reason |
|------|--------|
| `apps/admin/src/components/ui/` | Migrated to @pos/ui |

### Updated Files (Admin Panel)

| File | Change |
|------|--------|
| `apps/admin/src/App.tsx` | Update imports |
| `apps/admin/src/pages/Login.tsx` | Update imports |
| `apps/admin/src/pages/Dashboard.tsx` | Update imports |
| `apps/admin/src/pages/Stores.tsx` | Update imports |
| `apps/admin/src/pages/Users.tsx` | Update imports |
| `apps/admin/src/pages/Reports.tsx` | Update imports |
| `apps/admin/src/pages/AuditLogs.tsx` | Update imports |
| `apps/admin/src/pages/DataManagement.tsx` | Update imports |
| `apps/admin/src/pages/Settings.tsx` | Update imports |
| `apps/admin/src/components/layout/Sidebar.tsx` | Update imports, add lucide icons |
| `apps/admin/src/components/layout/Header.tsx` | Update imports |
| `apps/admin/src/components/layout/AdminLayout.tsx` | Update imports |

### Updated Files (POS Web)

| File | Change |
|------|--------|
| `apps/web/package.json` | Add lucide-react |
| `apps/web/src/pages/Login.tsx` | Update imports, use lucide icons |
| `apps/web/src/pages/POS.tsx` | Update imports, use lucide icons |
| `apps/web/src/pages/Dashboard.tsx` | Update imports, use lucide icons |
| `apps/web/src/pages/Products.tsx` | Update imports, use lucide icons |
| `apps/web/src/pages/Categories.tsx` | Update imports, use lucide icons |
| `apps/web/src/pages/Discounts.tsx` | Update imports, use lucide icons |
| `apps/web/src/pages/Transactions.tsx` | Update imports, use lucide icons |
| `apps/web/src/pages/SyncStatus.tsx` | Update imports, use lucide icons |
| `apps/web/src/components/layout/Sidebar.tsx` | Update imports, use lucide icons |
| `apps/web/src/components/pos/PaymentModal.tsx` | Update imports, use lucide icons |
| `apps/web/src/components/pos/HoldOrderModal.tsx` | Update imports |
| `apps/web/src/components/pos/HeldOrdersList.tsx` | Update imports, use lucide icons |
| `apps/web/src/components/pos/ResumeConfirmModal.tsx` | Update imports |
| `apps/web/src/components/shared/OfflineBanner.tsx` | Update imports, use lucide icons |
| `apps/web/src/components/shared/SyncStatus.tsx` | Update imports, use lucide icons |
| `apps/web/src/components/shared/RejectedTransactions.tsx` | Update imports, use lucide icons |

## Testing Strategy

### Manual Testing Checklist

#### Admin Panel
- [ ] Login page renders correctly with toast notifications
- [ ] Dashboard displays charts, metrics, and loading states
- [ ] Store CRUD operations work with proper validation
- [ ] User management displays all users with proper badges
- [ ] Reports filter and export functionality
- [ ] Audit logs display with filters
- [ ] Data import/export works correctly
- [ ] Settings page saves changes
- [ ] All buttons (variants, sizes, loading states) work
- [ ] All modals open/close properly
- [ ] Badges display correctly for all status types

#### POS Web
- [ ] Login page authenticates correctly
- [ ] POS page product grid and cart work
- [ ] Payment modal processes transactions
- [ ] Hold order functionality works
- [ ] Dashboard displays correct metrics
- [ ] Product/Categories/Discounts management works
- [ ] Transactions history displays correctly
- [ ] Sync status page shows entity progress
- [ ] All buttons work with new variants
- [ ] All modals work correctly
- [ ] Offline/online indicators work
- [ ] All lucide icons render correctly

## Rollback Plan

1. Keep backup of current `@pos/ui` implementation
2. Keep backup of current admin local components
3. Use git branches for each phase
4. Test thoroughly before merging

## Alternatives Considered

### Alternative A: Keep separate implementations

Rejected because:
- Code duplication
- Inconsistent UX
- Maintenance burden

### Alternative B: Migrate POS web to admin's local components

Rejected because:
- Admin's local components not in shared package
- Would not be accessible to other potential apps
- Duplication remains

### Alternative C: Create new shadcn-based package

Rejected because:
- @pos/ui already exists
- Migration path is straightforward
- Keep existing package for consistency

## Related Documents

- **ADR-0006**: UI Component Sharing Strategy
- **docs/features/admin-panel.md**: Admin Panel specification

## References

- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Class Variance Authority](https://cva.style/docs)
- [Lucide Icons](https://lucide.dev/)
