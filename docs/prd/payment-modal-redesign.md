# Product Requirements Document: Payment Modal Redesign

**Document Version:** 1.4  
**Last Updated:** 2026-02-07  
**Status:** Completed  
**Related PRD:** Member Customer Integration for POS

---

## 1. Executive Summary

### 1.1 Overview

Redesign the Payment Modal in the POS system to provide a more intuitive, tablet-friendly interface for processing payments. The new design features a tab-based payment method selection, split payment support, and a dedicated numeric keypad optimized for touch input.

### 1.2 Goals

| Goal | Description |
|------|-------------|
| **Tablet Optimization** | Full touch-friendly interface with numeric keypad |
| **Split Payment Support** | Multiple payment methods per transaction |
| **Clear Breakdown** | Transparent payment listing and totals |
| **Efficient Flow** | Minimize steps from cart to completion |

### 1.3 Key Design Decisions

| Decision | Choice |
|----------|--------|
| **Layout** | Two-column (Left: Form + Table, Right: Numeric Keypad) |
| **Width** | 95vw (w-[95vw]) for tablet optimization |
| **Numeric Keypad** | 3-column phone-style layout |
| **Payment Methods** | Tabs: Cash, Debit, Credit, Voucher |

---

## 2. User Interface Design

### 2.1 Overall Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  TOTAL AMOUNT:                                                        123,527   │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  [○ CASH]  [■ DEBIT]  [⊟ CREDIT]  [⊞ VOUCHER]                               │
│  ════════════════════════════════════════════════════════════════════════════   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  AMOUNT: [_________________]  (Cash/Debit/Credit)                     │   │
│  │  APPROVAL CODE: [_____________]  (Debit/Credit ONLY - EDC transaction)│   │
│  │  VOUCHER CODE: [_____________]  (Voucher ONLY - Amount auto-filled)   │   │
│  │  Voucher Balance: [ 50,000 ]  (shown when voucher code entered)         │   │
│  │                                                                         │   │
│  │                                                           [    ADD    ]  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
├─────────────────────────────────────────┬─────────────────────────────────────┤
│                                         │                                     │
│  BREAKDOWN TABLE                        │  NUMERIC KEYPAD (full height)       │
│  ┌───────────────────────────┐           │                                     │
│  │ PAYMENT │ AMOUNT │ APPROVAL│           │      ┌───┬───┬───┐              │
│  ├─────────┼────────┼─────────┤           │      │ 1 │ 2 │ 3 │              │
│  │ Cash   │ 50,000 │         │           │      ├───┼───┼───┤              │
│  │ Debit  │ 30,000 │ 908309  │           │      │ 4 │ 5 │ 6 │              │
│  │ Credit │ 43,527 │1902999  │           │      ├───┼───┼───┤              │
│  └─────────┴────────┴─────────┘           │      │ 7 │ 8 │ 9 │              │
│                                         │      ├───┼───┼───┤              │
│  ╔═══════════════════════════════════╗  │      │ . │ 0 │ C │              │
│  ║  PAYMENT TOTAL:     123,527     ║  │      └───┴───┴───┘              │
│  ║  CHANGE:                  0     ║  │            [⌫]                   │
│  ╚═══════════════════════════════════╝  │                                     │
│                                         │                                     │
│  [           CANCEL          ]           │                                     │
│  [            SAVE           ]           │                                     │
│                                         │                                     │
└─────────────────────────────────────────┴─────────────────────────────────────┘
```

### 2.2 Component Details

#### 2.2.1 Header Section

| Element | Description |
|---------|-------------|
| **Total Amount** | Display total from cart (formatted with currency) |

#### 2.2.2 Payment Method Tabs

| Tab | Icon | Fields Shown |
|-----|------|-------------|
| **Cash** | ○ | Amount only |
| **Debit** | ■ | Amount + Approval Code |
| **Credit** | ⊟ | Amount + Approval Code |
| **Voucher** | ⊞ | Voucher Code (amount auto-filled) |

#### 2.2.3 Payment Entry Form

| Field | Required | Shown For | Focus Behavior |
|-------|----------|-----------|----------------|
| Amount | Yes | All methods | Click/tap to focus, keypad types here |
| Approval Code | Yes | Debit, Credit | Click/tap to focus, keypad types here (EDC transaction code) |
| Voucher Code | Yes | Voucher | Click/tap to focus, keypad types here |

**Focus Management:**
- Input fields are clickable/tappable (no `readOnly`)
- Clicking/tapping a field sets it as focused
- Keypad numbers are routed to the focused field
- Focused field has visual indicator (blue border/ring)
- Focus is cleared after adding a payment
- Focus is cleared when switching tabs

#### 2.2.4 Breakdown Table

| Column | Description |
|--------|-------------|
| **Payment** | Payment method name + icon |
| **Amount** | Payment amount (formatted) |
| **Card** | Last 4 digits of card or voucher code |

#### 2.2.5 Numeric Keypad

| Layout | 3-column phone-style |
|--------|---------------------|
| Keys | 1, 2, 3, 4, 5, 6, 7, 8, 9, ., 0, C |
| Backspace | ⌫ (separate button) |

#### 2.2.6 Summary Section

| Element | Description |
|---------|-------------|
| **Payment Total** | Sum of all added payments |
| **Change** | Payment Total - Cart Total (if positive) |

#### 2.2.7 Action Buttons

| Button | Action |
|--------|--------|
| **ADD** | Add payment to breakdown table |
| **CANCEL** | Close modal, discard changes |
| **SAVE** | Confirm payments, proceed to completion |

---

## 3. Functional Requirements

### 3.1 Payment Method Selection

#### FR-001: Tab-Based Selection
- Display 4 payment method tabs: Cash, Debit, Credit, Voucher
- Clicking a tab activates that payment method
- Active tab should have visual highlight (e.g., underline or different background)

#### FR-002: Form Display
- Show appropriate form fields based on selected tab
- **Cash**: Show only Amount input
- **Debit/Credit**: Show Amount + Card Number inputs
- **Voucher**: Show Voucher Code input

### 3.2 Payment Entry

#### FR-003: Amount Entry
- Type amount using numeric keypad or manual input
- Validate amount is greater than 0
- Validate amount is a valid number (max 2 decimal places)

#### FR-004: Approval Code Entry (Debit/Credit)
- **Required field** for Debit/Credit payments
- Enter EDC transaction approval code from card terminal
- Auto-focus after amount when debit/credit method selected

#### FR-005: Voucher Code Entry
- **Amount field is HIDDEN** for voucher tab - cashier only enters voucher code
- Lookup voucher balance automatically when code is entered (4+ characters)
- Display voucher balance below the input field
- Amount is auto-filled from voucher balance
- Validate voucher has balance before adding
- **Gift Card (GC) vs Promotional (PR):**
  - GC vouchers: Proceed with payment flow
  - PR vouchers: Show error "This is a discount voucher. Apply as cart discount first."
- **Multiple Gift Cards:**
  - Unlimited GC vouchers can be added to a single transaction
  - Same GC voucher cannot be added twice (frontend validation)
  - Backend also validates via `/use` endpoint
  - Breakdown table groups same vouchers: "Gift Card (2x)"
  - Single remove button (✕) removes all instances of that voucher

### 3.2.1 Focus Management

#### FM-001: Click-to-Focus
- Input fields (Amount, Card Number, Voucher Code) are clickable/tappable
- Clicking a field sets it as the focused field
- Keypad numbers are routed to the focused field

#### FM-002: Visual Focus Indicator
- Focused field has visual highlight (blue border/ring)
- Provides clear feedback on which field will receive keypad input

#### FM-003: Focus Behavior
- For Cash/Debit/Credit: Focus defaults to Amount field
- For Voucher: Focus defaults to Voucher Code field
- Focus is cleared after adding a payment
- Focus is cleared when switching tabs
- Focus is cleared when clicking CANCEL

### 3.3 Add Payment

#### FR-006: Validation
- Amount must be greater than 0 (Cash/Debit/Credit)
- Approval code is required for Debit/Credit
- Voucher code must be at least 4 characters
- Voucher must have positive balance

#### FR-007: Add to Table
- Clicking ADD adds payment to breakdown table
- Generate unique ID for each payment entry
- Update payment total
- Clear all form fields after successful add
- Clear focus after adding a payment
- Switch to Amount field of first tab after add

### 3.4 Split Payments

#### FR-008: Multiple Payments
- Support adding multiple payment entries
- Each payment appears as separate row in breakdown table
- Payment total = sum of all payment entries

#### FR-009: Remove Payment
- Add delete/remove button for each table row
- Clicking remove deletes payment from table
- Update payment total after removal

### 3.5 Totals and Change

#### FR-010: Payment Total Calculation
- Payment Total = Sum of all payment amounts
- Update in real-time as payments are added/removed

#### FR-011: Change Calculation
- Change = Payment Total - Cart Total
- Show only if Payment Total > Cart Total
- Show as positive number

#### FR-012: Validation Before Save
- Payment Total must be >= Cart Total
- Show error if Payment Total < Cart Total
- Disable SAVE button if validation fails

### 3.6 Actions

#### FR-013: CANCEL
- Clicking CANCEL closes modal
- Discard all unsaved changes
- Return to POS screen

#### FR-014: SAVE
- Validate Payment Total >= Cart Total
- Create payment records for each entry
- Trigger transaction completion
- Close modal
- Return to POS screen

---

## 4. Data Models

### 4.1 PaymentEntry Interface

```typescript
interface PaymentEntry {
  id: string;
  type: 'cash' | 'debit' | 'credit' | 'voucher';
  amount: number;
  approvalCode?: string;    // EDC transaction approval code for card payments
  voucherCode?: string;
  createdAt: string;
}
```

### 4.2 Component Props

```typescript
interface PaymentModalNewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payments: PaymentEntry[]) => void;
  total: number;
  cartItems?: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}
```

---

## 5. Technical Implementation

### 5.1 File Structure

```
apps/web/src/
├── components/pos/
│   └── PaymentModalNew.tsx    # NEW component
└── utils/
    └── formatCurrency.ts      # Existing - reuse
```

### 5.2 Component Structure

```tsx
export function PaymentModalNew({ isOpen, onClose, onConfirm, total }: PaymentModalNewProps) {
  // State
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [selectedTab, setSelectedTab] = useState<'cash' | 'debit' | 'credit' | 'voucher'>('cash');
  const [amount, setAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [focusedField, setFocusedField] = useState<'amount' | 'card' | 'voucher' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Computed
  const paymentTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const change = Math.max(0, paymentTotal - total);

  // Handlers
  const handleAddPayment = () => { /* ... */ };
  const handleRemovePayment = (id: string) => { /* ... */ };
  const handleKeypadClick = (value: string) => { /* ... */ };
  const handleSave = () => { /* ... */ };
  const handleCancel = () => { /* ... */ };

  if (!isOpen) return null;

  return (
    <Modal>
      <Header total={total} />
      <Tabs selectedTab={selectedTab} onSelect={setSelectedTab} />
      <PaymentForm
        selectedTab={selectedTab}
        amount={amount}
        cardNumber={cardNumber}
        voucherCode={voucherCode}
        onAmountChange={setAmount}
        onCardNumberChange={setCardNumber}
        onVoucherCodeChange={setVoucherCode}
        onAdd={handleAddPayment}
      />
      <SplitLayout
        left={
          <>
            <BreakdownTable payments={payments} onRemove={handleRemovePayment} />
            <Summary paymentTotal={paymentTotal} change={change} />
            <Actions onCancel={handleCancel} onSave={handleSave} />
          </>
        }
        right={
          <NumericKeypad onKeyPress={handleKeypadClick} />
        }
      />
    </Modal>
  );
}
```

### 5.3 Modal Dimensions

| Property | Value |
|----------|-------|
| Width | `w-[95vw]` |
| Height | `h-[90vh]` |
| Max Width | `max-w-6xl` (~1152px) |

### 5.4 Styling (Tailwind CSS)

| Section | Classes |
|---------|---------|
| **Modal** | `fixed inset-0 z-50 flex items-center justify-center bg-black/50` |
| **Content** | `bg-white rounded-2xl shadow-xl w-[95vw] max-w-6xl h-[90vh] flex flex-col` |
| **Tabs** | `flex gap-2 border-b` |
| **Tab Active** | `border-b-2 border-primary-600 text-primary-600` |
| **Tab Inactive** | `text-gray-500 hover:text-gray-700` |
| **Breakdown Table** | `w-full border-collapse` |
| **Keypad** | `grid grid-cols-3 gap-2 h-full` |
| **Keypad Button** | `py-4 rounded-lg bg-gray-100 hover:bg-gray-200` |

---

## 6. User Flow

### 6.1 Single Payment Flow (Cash)

```
1. Cart Total: 123,527
2. Click "Pay" button → Payment Modal opens
3. Select "CASH" tab (default)
4. Type amount using keypad OR leave blank for exact amount
5. Click ADD
6. Payment appears in breakdown table
7. Payment Total: 123,527
8. Change: 0
9. Click SAVE
10. Transaction completed, modal closes
```

### 6.2 Split Payment Flow (Cash + Card)

```
1. Cart Total: 123,527
2. Click "Pay" button → Payment Modal opens
3. Select "CASH" tab
4. Type 50,000 using keypad
5. Click ADD
6. Cash payment appears in breakdown table
7. Select "CREDIT" tab
8. Type 73,527 using keypad
9. Enter approval code: 908309
10. Click ADD
11. Credit payment appears in breakdown table
12. Payment Total: 123,527
13. Change: 0
14. Click SAVE
15. Transaction completed, modal closes
```

### 6.3 Insufficient Payment Flow

```
1. Cart Total: 123,527
2. Click "Pay" button → Payment Modal opens
3. Select "CASH" tab
4. Type 100,000 using keypad
5. Click ADD
6. Payment appears in breakdown table
7. Payment Total: 100,000
8. Change: 0
9. Click SAVE
10. Error: "Payment total must be at least 123,527"
11. Add more payments or cancel
```

---

## 7. Error Handling

### 7.1 Validation Errors

| Error | Condition | Message |
|-------|-----------|---------|
| **Amount Required** | Amount is empty | "Please enter an amount" |
| **Invalid Amount** | Amount <= 0 | "Amount must be greater than 0" |
| **Approval Code Required** | Debit/Credit selected, approval code empty | "Approval code is required for card payments" |
| **Discount Voucher Entered** | Voucher type is PR (promotional) | "This is a discount voucher. Apply as cart discount first." |
| **Voucher Already Added** | Same GC voucher code entered twice | "This voucher already added (2x total)" |
| **Voucher No Balance** | GC voucher has zero balance | "Voucher has no balance or already used" |
| **Voucher Not Found** | Voucher code invalid | "Voucher not found" |
| **Insufficient Payment** | Payment Total < Cart Total | "Payment total must be at least {total}" |

### 7.2 Technical Errors

| Error | Handling |
|-------|----------|
| **Network Error** | Show error toast, allow retry |
| **Timeout** | Show error, allow retry |

---

## 8. Accessibility

### 8.1 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Navigate between fields |
| Enter | Submit form / Add payment / Save |
| Escape | Cancel |
| Backspace | Delete last character in input |

### 8.2 Touch Targets

| Element | Minimum Size |
|---------|-------------|
| Buttons | 44x44px |
| Tab buttons | 48x48px |
| Keypad keys | 48x48px |
| Table action buttons | 32x32px |

---

## 9. Integration Points

### 9.1 Related Components

| Component | Integration |
|-----------|-------------|
| **POS.tsx** | Opens modal on Pay button click |
| **Receipt.tsx** | Receives payment data for receipt printing |
| **TransactionStore** | Stores completed transaction |

### 9.2 Data Flow

```
POS.tsx (Cart Total)
    ↓
PaymentModalNew.tsx (receives total)
    ↓
User selects payment, adds to table
    ↓
onConfirm(payments) → POS.tsx
    ↓
Transaction creation
    ↓
Receipt printing
```

---

## 10. Future Enhancements

### 10.2 Out of Scope (v1)

| Feature | Reason |
|---------|--------|
| **Surcharge/Service Fee** | Not required for v1 |
| **Discount Application** | Handled in cart |
| **Loyalty Points** | Future integration |
| **Partial Voucher Usage** | Future enhancement |
| **Payment Reversal** | Separate refund flow |

### 10.1 Future Considerations

| Feature | Description |
|---------|-------------|
| **Voucher Balance Lookup** | Auto-check voucher balance |
| **Card Terminal Integration** | Direct EDC integration |
| **QR Code Payment** | QRIS, GoPay, etc. |
| **Saved Cards** | Customer saved payment methods |
| **Favorites** | Frequently used payment amounts |

---

## 11. Testing Requirements

### 11.1 Unit Tests

| Test Case | Expected Result |
|-----------|-----------------|
| Add single cash payment | Payment appears in table |
| Add multiple split payments | All payments appear, total calculated |
| Remove payment | Payment removed, total updated |
| Insufficient total | Error message, SAVE disabled |
| Empty payment | Error message |
| Negative payment | Error message |

### 11.2 Integration Tests

| Test Case | Expected Result |
|-----------|-----------------|
| Full payment flow | Transaction completed, receipt printed |
| Cancel flow | Modal closes, no transaction created |
| Split payment flow | Multiple payments recorded |

---

## 12. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-05 | Initial draft |
| 1.1 | 2026-02-05 | Added focus management: click-to-focus input fields, visual focus indicator, keypad routes to focused field |
| 1.2 | 2026-02-06 | Voucher flow updated: Amount field hidden for voucher, voucher balance lookup, auto-fill amount from voucher. Changed Card Number to Approval Code (EDC transaction code) for debit/credit payments. |
| 1.3 | 2026-02-06 | Fixed PR voucher handling: Promotional vouchers show error message guiding cashier to apply as cart discount instead of payment. Added voucher type validation (GC vs PR). |
| 1.4 | 2026-02-07 | Added multiple Gift Card support: Unlimited GC vouchers per transaction, duplicate prevention, grouped display "Gift Card (2x)", single remove button removes all instances. |

---

**Document End**
