# Product Requirements Document: Reusable Numpad Component

**Document Version:** 1.0  
**Last Updated:** 2026-02-16  
**Status:** Draft  

---

## 1. Executive Summary

### 1.1 Overview

Create a reusable `Numpad` UI component to replace duplicated numeric keypad implementations across the POS application. The component will standardize input behavior for currency amounts, PINs, and other numeric data entry.

### 1.2 Goals

| Goal | Description |
|------|-------------|
| **Code Reusability** | Single component used across PIN Entry, Payment Modal, and Open Shift Modal |
| **Consistency** | Uniform keypad behavior and styling across all screens |
| **Maintainability** | Single source of truth for numpad logic and styling |
| **Touch Optimization** | Tablet-friendly large touch targets |

### 1.3 Key Design Decisions

| Decision | Choice |
|----------|--------|
| **Component Name** | `Numpad` |
| **Location** | `packages/ui/src/Numpad.tsx` |
| **Layout** | 3x4 grid (digits 0-9, decimal, clear, backspace) + optional submit |
| **Styling** | Tailwind CSS, following existing UI patterns |

---

## 2. Component Specification

### 2.1 Interface

```typescript
interface NumpadProps {
  /** Current input value */
  value: string;
  
  /** Callback when value changes */
  onChange: (value: string) => void;
  
  /** Maximum number of characters (default: 10) */
  maxLength?: number;
  
  /** Allow decimal point input (default: false) */
  allowDecimal?: boolean;
  
  /** Show Clear (C) button (default: false) */
  showClear?: boolean;
  
  /** Show Backspace (⌫) button (default: true) */
  showBackspace?: boolean;
  
  /** Label for submit button */
  submitLabel?: string;
  
  /** Callback when submit button clicked */
  onSubmit?: () => void;
  
  /** Disable all keypad buttons */
  disabled?: boolean;
  
  /** Auto-submit when maxLength reached (default: false) */
  autoSubmit?: boolean;
}
```

### 2.2 Visual Layout

```
┌─────────────────────────────────────┐
│           NUMERIC KEYPAD            │
├─────────────────────────────────────┤
│                                     │
│      ┌───┬───┬───┐                 │
│      │ 1 │ 2 │ 3 │                 │
│      ├───┼───┼───┤                 │
│      │ 4 │ 5 │ 6 │                 │
│      ├───┼───┼───┤                 │
│      │ 7 │ 8 │ 9 │                 │
│      ├───┼───┼───┤                 │
│      │ . │ 0 │ ⌫ │  (or C | 0 | ⌫)│
│      └───┴───┴───┘                 │
│                                     │
│   [optional submit button here]     │
│                                     │
└─────────────────────────────────────┘
```

### 2.3 Button States

| State | Visual |
|-------|--------|
| Default | `bg-white hover:bg-gray-200` |
| Active/Pressed | `bg-gray-300` |
| Disabled | `bg-gray-100 text-gray-400 cursor-not-allowed` |
| Clear (C) | `bg-red-100 text-red-700 hover:bg-red-200` |
| Submit | `bg-primary-600 text-white hover:bg-primary-700` |

### 2.4 Key Behaviors

| Feature | Behavior |
|---------|----------|
| **Digit (0-9)** | Append to value if length < maxLength |
| **Decimal (.)** | Only add if `allowDecimal=true` AND value doesn't already contain `.` |
| **Clear (C)** | Reset value to empty string `""` |
| **Backspace (⌫)** | Remove last character |
| **Auto-submit** | If `autoSubmit=true` and value.length === maxLength, call `onSubmit()` after 100ms delay |
| **Submit button** | Call `onSubmit()` if value is not empty |

---

## 3. Current Implementations (To Replace)

### 3.1 PIN Entry Screen

**File:** `apps/web/src/components/auth/PinEntryScreen.tsx`

**Current behavior:**
- 3x4 grid: digits 1-9, backspace, 0, submit (checkmark)
- Fixed 6-digit PIN
- Auto-submits when 6 digits entered
- No decimal, no clear

**Required props:**
```tsx
<Numpad
  value={pin}
  onChange={setPin}
  maxLength={6}
  showBackspace={true}
  submitLabel="✓"
  onSubmit={() => onSubmit(pin)}
  autoSubmit={true}
/>
```

### 3.2 Payment Modal

**File:** `apps/web/src/components/pos/PaymentModal.tsx`

**Current behavior:**
- 3x4 grid: digits 0-9, decimal (.), clear (C), backspace (⌫)
- Supports decimals for currency input
- Handles multiple focused fields (amount, voucher code, approval code)

**Required props:**
```tsx
<Numpad
  value={amount}
  onChange={setAmount}
  allowDecimal={true}
  showClear={true}
  showBackspace={true}
/>
```

### 3.3 Open Shift Modal (NEW)

**File:** `apps/web/src/components/shift/ShiftModal.tsx`

**Current behavior:**
- Uses `<Input type="number">` for float amount
- Plain text input with system numpad on mobile/tablet

**Required changes:**
- Remove note textarea (per requirement)
- Replace input with Numpad + display area
- Supports decimals for currency

**Required props:**
```tsx
<Numpad
  value={floatAmount}
  onChange={setFloatAmount}
  allowDecimal={true}
  showClear={true}
  showBackspace={true}
/>
```

---

## 4. UI/UX Requirements

### 4.1 Display Area (External)

The Numpad component only handles the keypad buttons. Display area is managed by the parent component:

```
┌─────────────────────────────────────────┐
│  Opening Float Amount                   │
│  ┌─────────────────────────────────────┐│
│  │         Rp 150.000                  ││  ← Display (parent)
│  └─────────────────────────────────────┘│
│  ┌───┬───┬───┐                          │
│  │ 1 │ 2 │ 3 │                          │
│  ├───┼───┼───┤                          │
│  │ 4 │ 5 │ 6 │    ← Numpad component    │
│  ├───┼───┼───┤                          │
│  │ 7 │ 8 │ 9 │                          │
│  ├───┼───┼───┤                          │
│  │ . │ 0 │ ⌫ │                          │
│  └───┴───┴───┘                          │
└─────────────────────────────────────────┘
```

### 4.2 Styling Standards

- Button height: `h-14` (56px) for touch targets
- Font size: `text-xl` for digits
- Gap between buttons: `gap-2`
- Border radius: `rounded-lg`
- Shadow: `shadow-sm` for depth
- Focus ring: `focus:outline-none focus:ring-2 focus:ring-primary-500`

---

## 5. Open Shift Modal Changes

### 5.1 Current State

```tsx
// Lines 144-175 in ShiftModal.tsx
<div className="space-y-4">
  <div>
    <label>Opening Float Amount</label>
    <Input type="number" ... />
  </div>
  
  <div>
    <label>Note (optional)</label>
    <textarea ... />  // ← TO BE REMOVED
  </div>
</div>
```

### 5.2 Target State

```tsx
<div className="space-y-4">
  <div>
    <label>Opening Float Amount</label>
    <div className="text-3xl font-bold text-center py-4 bg-gray-50 rounded-lg mb-4">
      {floatAmount ? formatCurrency(parseFloat(floatAmount)) : 'Rp 0'}
    </div>
    <Numpad
      value={floatAmount}
      onChange={setFloatAmount}
      allowDecimal={true}
      showClear={true}
      showBackspace={true}
    />
  </div>
</div>
```

### 5.3 State Changes

- Remove `openingNote` state variable
- Remove note from `openShift()` API call
- Remove note textarea from JSX
- Update useEffect to not reset `openingNote`

---

## 6. Implementation Tasks

### Phase 1: Create Numpad Component
- [ ] Create `packages/ui/src/Numpad.tsx`
- [ ] Implement all button handlers
- [ ] Add styling following existing UI patterns
- [ ] Export from `packages/ui/src/index.ts`

### Phase 2: Update PIN Entry Screen
- [ ] Import Numpad component
- [ ] Replace inline keypad JSX with Numpad
- [ ] Keep PIN dot display (separate from Numpad)

### Phase 3: Update Payment Modal
- [ ] Import Numpad component
- [ ] Replace inline keypad JSX with Numpad
- [ ] Simplify `handleKeypadClick` if possible

### Phase 4: Update Open Shift Modal
- [ ] Remove note input field
- [ ] Add display area for float amount
- [ ] Replace Input with Numpad component
- [ ] Update API call to not send note

### Phase 5: Testing
- [ ] Test PIN entry flow
- [ ] Test payment modal
- [ ] Test open shift flow
- [ ] Verify all edge cases (decimal, clear, backspace, maxLength)

---

## 7. Files to Modify

| File | Action |
|------|--------|
| `packages/ui/src/Numpad.tsx` | Create new component |
| `packages/ui/src/index.ts` | Add export |
| `apps/web/src/components/auth/PinEntryScreen.tsx` | Replace keypad |
| `apps/web/src/components/pos/PaymentModal.tsx` | Replace keypad |
| `apps/web/src/components/shift/ShiftModal.tsx` | Remove note, add Numpad |

---

## 8. Acceptance Criteria

1. **Reusability**: Single Numpad component used in all 3 locations
2. **Decimal Support**: Works correctly in Payment and Open Shift
3. **Clear Function**: C button clears entire input in Payment and Open Shift
4. **Backspace**: ⌫ removes last character in all locations
5. **PIN Auto-submit**: PIN Entry auto-submits when 6 digits entered
6. **Styling Consistency**: All keypads look and feel identical
7. **Disabled State**: Numpad buttons properly disabled when `disabled=true`
8. **Open Shift Note Removed**: Note textarea no longer appears in Open Shift modal

---

## 9. Related Documentation

- [Payment Modal Redesign PRD](./payment-modal-redesign.md)
- [Shift Management Feature](./features/shift-management.md)
