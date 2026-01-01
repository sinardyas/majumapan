# ADR-0006: UI Component Sharing Strategy

## Status

Accepted

## Date

2024-12-30

## Context

The Majumapan POS system now has two web applications:
- `apps/web` - POS web app for managers and cashiers
- `apps/admin` - Admin panel for system administrators

Both applications use the same tech stack (React, Vite, TailwindCSS) and share the `@pos/shared` package for types and constants.

### Problem Discovered

During Phase 1 of admin panel implementation, duplicate UI components were created:
- `Button.tsx` exists in both apps
- `Toast.tsx` exists in both apps
- New components created only for admin (Input, Select, Table, Modal, Card)

This creates code duplication and maintenance burden. The question arose: **Should we share UI components via a common `packages/ui` package?**

Additionally, there's the question of whether to share the `Sidebar` component between both apps.

### Root Cause Analysis

Both apps were created independently without consideration for shared UI infrastructure. The monorepo pattern with `@pos/shared` was not extended to include UI components.

## Decision

We will **create a `packages/ui` package for stateless, reusable UI components**. However, **Sidebar components will NOT be shared** between POS web and Admin Panel.

### Shared Components Strategy

Components to move to `@pos/ui`:

| Component | Rationale for Sharing |
|-----------|----------------------|
| Button | Identical in both apps, pure UI component |
| Toast | Similar in both apps, pure UI component |
| Input | Admin only, but POS may need it in the future |
| Select | Admin only, but POS may need it in the future |
| Table | Admin only, but POS may need it in the future |
| Modal | Admin only, but POS may need it in the future |
| Card | Admin only, but POS may need it in the future |

### Sidebar Component Decision

**Sidebar components will remain separate** and NOT shared.

**Reasoning:**

1. **App-Specific Concerns in POS Sidebar:**
   - Sync status display (online/offline indicator)
   - Sync button with loading state
   - Pending syncs badge
   - Rejected transactions button and modal
   - Permission-based navigation filtering
   - Logout handler with IndexedDB cleanup

2. **Purpose-Built Differences:**
   - POS Sidebar is designed for offline-first workflows
   - Admin Sidebar is intentionally simple (navigation + logout only)
   - These differences reflect fundamentally different user experiences

3. **Risk Mitigation:**
   - Sharing would risk breaking existing POS offline features
   - Would require complex props configuration to support both modes
   - Testing burden increases significantly

4. **Minimal Duplication:**
   - 140 lines of code duplication is acceptable for distinct components
   - Maintenance burden is manageable for two separate apps

## Consequences

### Positive

- **Single source of truth** for shared UI components (Button, Input, etc.)
- **Consistent styling** across both applications
- **Easier maintenance** - fix once in `@pos/ui`, applies to both apps
- **Reduced bundle size** via Turborepo hoisting (deduplication)
- **Follows established monorepo pattern**
- **Protects POS stability** - Sidebar changes don't affect POS web app
- **Clear separation of concerns** - POS Sidebar handles POS-specific features, Admin Sidebar handles admin-only navigation

### Negative

- **Sidebar code duplication** remains (140 lines × 2 apps = 280 lines)
- **Different Sidebar implementations** may confuse new developers
- **If POS web needs admin-style sidebar in future**, it would require new component

## Alternatives Considered

### Alternative A: Share All Components Including Sidebar

Create a generic, configurable `Sidebar` component in `@pos/ui` that supports:
- Props for sync status display
- Props for pending/rejected badges
- Props for permission filtering
- Props for offline/online indicators

**Rejected because:**
- Too complex - would require many optional props
- Risky to change - could break existing POS offline features
- Two apps have fundamentally different navigation needs
- Increases testing burden significantly
- YAGNI (You Aren't Gonna Need It) - admin doesn't need sync features

### Alternative B: Create Base Sidebar Component

Create `Sidebar` base component with shared structure, extend per-app.

**Rejected because:**
- Composition over inheritance is preferred in React
- Would still have app-specific logic in child components
- Minimal benefit over separate implementations
- Adds abstraction layer without real advantage

### Alternative C: Keep All Components Separate

Don't create `@pos/ui` package, keep all UI components in individual apps.

**Rejected because:**
- Button and Toast already duplicated
- Future duplication inevitable as both apps grow
- Violates DRY (Don't Repeat Yourself) principle
- No clear benefit to avoiding shared package
- Existing `@pos/shared` proves monorepo approach works

### Alternative D: Share Only Exactly Identical Components

Only share components that are byte-for-byte identical between both apps.

**Rejected because:**
- Currently only Button and Toast are nearly identical
- Too narrow - doesn't solve the broader problem
- Still creates duplication as apps evolve
- More work to evaluate each component individually

## Files Changed

### New Files to Create

```
packages/ui/
├── package.json
├── tsconfig.json
├── src/
│   ├── Button.tsx       # Consolidated from both apps
│   ├── Input.tsx       # From admin app
│   ├── Select.tsx      # From admin app
│   ├── Table.tsx       # From admin app
│   ├── Modal.tsx       # From admin app
│   ├── Card.tsx        # From admin app
│   ├── Toast.tsx       # Consolidated from both apps
│   └── index.ts         # Re-exports all components
```

### Files to Delete

| App | File | Reason |
|------|-------|--------|
| `apps/web/src/components/ui/Button.tsx` | Moving to `@pos/ui` |
| `apps/web/src/components/ui/Toast.tsx` | Moving to `@pos/ui` |
| `apps/admin/src/components/ui/Button.tsx` | Moving to `@pos/ui` |
| `apps/admin/src/components/ui/Input.tsx` | Moving to `@pos/ui` |
| `apps/admin/src/components/ui/Select.tsx` | Moving to `@pos/ui` |
| `apps/admin/src/components/ui/Table.tsx` | Moving to `@pos/ui` |
| `apps/admin/src/components/ui/Modal.tsx` | Moving to `@pos/ui` |
| `apps/admin/src/components/ui/Card.tsx` | Moving to `@pos/ui` |
| `apps/admin/src/components/ui/Toast.tsx` | Moving to `@pos/ui` |

### Files to Modify

| File | Change |
|-------|--------|
| `apps/web/package.json` | Add dependency on `@pos/ui` |
| `apps/admin/package.json` | Add dependency on `@pos/ui` |
| `apps/web/src/components/layout/Sidebar.tsx` | Update imports to use `@pos/ui/Button` |
| `apps/admin/src/components/layout/Sidebar.tsx` | Update imports to use `@pos/ui/Button` |
| All components in both apps | Update imports to use `@pos/ui/*` |

### Files to Keep Separate

| File | Reason |
|-------|--------|
| `apps/web/src/components/layout/Sidebar.tsx` | POS-specific sync features, not shareable |
| `apps/admin/src/components/layout/Sidebar.tsx` | Admin-specific navigation, not shareable |
| `apps/web/src/components/layout/Header.tsx` | May be different, evaluate later |
| `apps/admin/src/components/layout/Header.tsx` | May be different, evaluate later |

## Related Documents

- **ADR-0005**: Admin Panel Separation (architectural decision)
- **docs/features/admin-panel.md**: Admin Panel specification

## References

- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [Composition over Inheritance](https://reactpatterns.com/composition-over-inheritance)
- [Turborepo Hoisting](https://turbo.build/repo/handbook/hooking#hoisting-dependencies)

## Lessons Learned

1. **Assess before sharing** - Not all components should be shared, even if similar in appearance
2. **App-specific concerns break sharing** - Components tied to app-specific features (sync, permissions) are poor candidates for sharing
3. **Separation of concerns is more important** - than eliminating all code duplication
4. **Monorepo pattern works well** - `@pos/ui` will integrate seamlessly with existing `@pos/shared`
5. **Sidebar complexity varies by app** - POS sidebar (220 lines, sync features) vs Admin sidebar (140 lines, navigation only)
6. **Future proofing** - Adding Input/Select/Table/Modal/Card to `@pos/ui` benefits both apps even if not immediately used in POS
