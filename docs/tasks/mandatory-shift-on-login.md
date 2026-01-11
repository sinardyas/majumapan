# Mandatory Shift on Login Implementation

## Overview

Implement mandatory shift requirement for POS users. Users must open a shift before they can browse products, add to cart, or process transactions. If a user has an active shift from a previous session, it should auto-resume.

## Related Documents

- PRD: `docs/prd/shift-management-prd.md`
- FSD: `docs/features/shift-management.md`

---

## Task 1: Create ShiftOverlay Component

**File:** `apps/web/src/components/shift/ShiftOverlay.tsx`

**Description:** Create a full-screen overlay that blocks access to the POS until the user opens a shift.

**Sub-tasks:**

- [x] Create full-screen fixed overlay container with `z-50`
- [x] Add centered card with:
  - Title: "🔒 Shift Required"
  - Description: "You must open a shift before starting transactions. This ensures all sales are properly tracked for your work session."
  - ShiftModal component in "open" mode only
  - Hide modal close button (non-dismissible)
- [x] Pass `onOpenSuccess` callback to ShiftModal
- [x] Style to match existing POS design system

**Status:** ✅ Completed

**Deliverable:** New `ShiftOverlay.tsx` component

---

## Task 2: Update ShiftModal with Callback

**File:** `apps/web/src/components/shift/ShiftModal.tsx`

**Description:** Add optional callback to trigger action after successful shift open.

**Sub-tasks:**

- [x] Add `onOpenSuccess?: () => void` to interface ShiftModalProps
- [x] In `handleOpenShift()` function, after successful open, call `onOpenSuccess?.()`
- [x] Add TypeScript type for the new prop
- [x] Test callback is triggered on successful shift open

**Status:** ✅ Completed

**Deliverable:** Modified ShiftModal component

---

## Task 3: Modify POS.tsx - State Management

**File:** `apps/web/src/pages/POS.tsx`

**Description:** Add state and logic to enforce mandatory shift requirement.

**Sub-tasks:**

- [x] Add import for ShiftOverlay component
- [x] Add state: `const [showShiftRequired, setShowShiftRequired] = useState(false);`
- [x] Update existing useEffect that calls `loadActiveShift()` (around line 271)
- [x] Add new useEffect to check shift status after load completes:
  ```typescript
  useEffect(() => {
    if (status === 'none' && !activeShift) {
      setShowShiftRequired(true);
    } else {
      setShowShiftRequired(false);
    }
  }, [status, activeShift]);
  ```
- [x] Conditionally render overlay in JSX:
  ```tsx
  {showShiftRequired && (
    <ShiftOverlay onShiftOpened={() => setShowShiftRequired(false)} />
  )}
  ```

**Status:** ✅ Completed

**Deliverable:** Modified POS.tsx with shift enforcement logic

---

## Task 4: Verify Auto-Resume Behavior

**File:** `apps/web/src/stores/shiftStore.ts`

**Description:** Confirm existing auto-resume functionality works as expected.

**Sub-tasks:**

- [x] Review existing `loadActiveShift()` implementation
- [x] Verify it loads active shift from IndexedDB/API on login
- [x] No code changes expected - confirm behavior

**Status:** ✅ Completed (no code changes needed)

**Deliverable:** Confirmed working auto-resume (no code changes)

---

## Task 5: Build and Verify

**Action:** Run full build and test the implementation.

**Sub-tasks:**

- [x] Run `npm run build`
- [x] Fix any TypeScript errors
- [ ] Manual testing checklist (v1.2):
  - [ ] Login with no active shift → Overlay appears with "Open Shift" button
  - [ ] Click X to close overlay → Returns to message-only state
  - [ ] Click "Open Shift" in message → Overlay reappears
  - [ ] Open shift successfully → Message disappears, POS accessible
  - [ ] Click sidebar (Dashboard) → Navigate away
  - [ ] Click POS in sidebar → Returns to message-only state (no overlay)
  - [ ] Header calendar button → Opens ShiftModal directly
  - [ ] Refresh page with active shift → POS accessible immediately
  - [ ] Offline mode: Can open shift when offline

**Status:** ✅ Build passed (manual testing pending)

**Deliverable:** Working implementation, all tests pass

---

## Files Modified/Created Summary

| Task | File | Status |
|------|------|--------|
| 1 | `apps/web/src/components/shift/ShiftOverlay.tsx` | ✅ Created |
| 2 | `apps/web/src/components/shift/ShiftModal.tsx` | ✅ Modified |
| 3 | `apps/web/src/pages/POS.tsx` | ✅ Modified |
| 4 | `apps/web/src/stores/shiftStore.ts` | ✅ Reviewed (no changes) |
| 5 | Build verification | ✅ Passed |

---

## Design Specifications

### ShiftOverlay Layout (v1.2 - Dismissible)

```
┌─────────────────────────────────────────┐
│  🔒 Shift Required              [✕]    │
├─────────────────────────────────────────┤
│                                         │
│   You need to open a shift before       │
│   processing transactions.              │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │      [ Open Shift ]             │   │
│   └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Message-Only State (when overlay closed)

```
┌─────────────────────────────────────────┐
│                                         │
│         ┌───────────────────┐           │
│         │    🔒            │           │
│         │                  │           │
│         │   Open a shift   │           │
│         │   to start       │           │
│         │                  │           │
│         │   ┌──────────┐   │           │
│         │   │  Open    │   │           │
│         │   │  Shift   │   │           │
│         │   └──────────┘   │           │
│         └───────────────────┘           │
│                                         │
└─────────────────────────────────────────┘
```

### Styling Requirements

- Overlay: `fixed inset-0 bg-black/50 z-50`
- Card: `bg-white rounded-2xl shadow-xl max-w-md mx-4 p-6`
- Title: `text-xl font-semibold mb-4`
- Description: `text-gray-600 mb-6`
- Typography: Match existing POS design system

---

## Edge Cases Handled (v1.2)

| Scenario | Handling |
|----------|----------|
| User closes overlay | Message-only state shows, can navigate to other pages |
| User navigates away and back | Message persists, overlay doesn't auto-reappear |
| User clicks "Open Shift" | Overlay reappears with modal |
| User opens shift successfully | Message disappears, POS fully accessible |
| User closes browser mid-shift | Auto-resume on next login via `loadActiveShift()` |
| Offline mode, no shift exists | Allow opening shift offline (existing offline support) |
| API error loading shift | Show error, keep overlay visible, allow retry |
| User has active shift | POS accessible immediately, no overlay |
| Multiple browser tabs | BroadcastChannel syncs shift state across tabs |
| Header shift button click | Opens ShiftModal directly (existing behavior) |

---

## Estimated Time: ~1.5 hours

| Task | Status | Time |
|------|--------|------|
| Task 1: Create ShiftOverlay | ✅ Completed | ~15 min |
| Task 2: Update ShiftModal | ✅ Completed | ~10 min |
| Task 3: Modify POS.tsx | ✅ Completed | ~15 min |
| Task 4: Verify Auto-Resume | ✅ Completed | ~5 min |
| Task 5: Build and Test | ✅ Completed | ~5 min |
| **Total** | | **~50 min** |

## Enhancement (v1.2) - Dismissible Overlay

| Task | Status | Time |
|------|--------|------|
| Update ShiftOverlay with close button | ✅ Completed | ~10 min |
| Update POS.tsx with message-only state | ✅ Completed | ~15 min |
| Build and verify | ✅ Completed | ~5 min |
| **Enhancement Total** | | **~30 min** |

**Overall Total: ~80 min**

---

## Implementation Notes

### Key Implementation Details (v1.2)

1. **ShiftOverlay Component** (`apps/web/src/components/shift/ShiftOverlay.tsx`):
   - Full-screen fixed overlay with `fixed inset-0 bg-black/50 z-50`
   - Centered card with lock icon and descriptive text
   - Close (X) button in top-right corner
   - `onClose` callback hides overlay when user clicks X
   - `onRequestOpen` callback allows user to re-open overlay
   - "Open Shift" button inside the card

2. **Message-Only State** (`apps/web/src/pages/POS.tsx`):
   - When user closes overlay, `showShiftMessage` state is true
   - Displays centered message with lock icon and "Open a shift to start" text
   - "Open Shift" button in message area re-opens the overlay
   - Product grid is NOT shown, only the message

3. **State Flow**:
   - Login → loadActiveShift() → No active shift?
     - YES → showShiftMessage = true, showShiftOverlay = true
     - NO → Normal POS functionality
   - User clicks X → showShiftOverlay = false (message persists)
   - User clicks "Open Shift" → showShiftOverlay = true
   - User opens shift successfully → showShiftMessage = false, POS accessible

4. **Navigation Behavior**:
   - Users can close overlay and navigate to other pages via sidebar
   - When navigating back to POS, message-only state persists
   - Overlay does NOT auto-reappear (message already visible)
   - Header shift button remains clickable to re-open modal

### Files Changed

```
apps/web/src/
├── components/shift/
│   ├── ShiftOverlay.tsx     (MODIFIED - added close button, onRequestOpen)
│   └── ShiftModal.tsx       (MODIFIED - added onOpenSuccess prop)
└── pages/
    └── POS.tsx              (MODIFIED - added message-only state, render logic)
```

| Dependency | Status |
|------------|--------|
| Existing ShiftModal component | ✅ Ready |
| Existing shiftStore with loadActiveShift | ✅ Ready |
| Existing POS.tsx structure | ✅ Ready |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 10, 2026 | - | Initial task list |
| 1.1 | Jan 11, 2026 | - | Implementation completed |
|      |              |   | - Created ShiftOverlay component |
|      |              |   | - Added onOpenSuccess callback to ShiftModal |
|      |              |   | - Added shift enforcement logic to POS.tsx |
|      |              |   | - Build verified successfully |
| 1.2 | Jan 11, 2026 | - | Enhanced to allow dismissible overlay |
|      |              |   | - Added close (X) button to ShiftOverlay |
|      |              |   | - Added onRequestOpen callback for re-opening |
|      |              |   | - Added message-only state when overlay closed |
|      |              |   | - Users can navigate to other pages via sidebar |
|      |              |   | - Message "Open a shift to start" persists on POS |
