# Product Requirements Document: Credit Card Approval Code Input

**Document Version:** 1.0  
**Last Updated:** 2026-02-04  
**Status:** Draft  

---

## 1. Executive Summary

Add approval code input functionality to the payment modal for credit card transactions. The approval code, obtained from the EDC device receipt, is required for all card payments and stored with the transaction for end-of-day settlement and audit purposes.

### Key Outcomes

| Outcome | Description |
|---------|-------------|
| EOD Settlement Ready | Approval codes captured for reconciliation |
| Audit Trail | Voided transactions retain approval codes |
| Offline Support | Approval codes captured offline, synced later |
| Split Payment Support | Each card payment has its own approval code |

### Quick Reference

| Aspect | Description |
|--------|-------------|
| Payment Methods | Card (single + split) |
| Approval Code | Required for all card payments |
| Format | Any string (no validation) |
| Split Mode | Each card payment has separate approval code |
| Persistence | Saved even for voided transactions |
| Offline | Works offline, synced when online |

---

## 2. Problem Statement

### Current Challenges

| Challenge | Impact |
|-----------|--------|
| No approval code capture | Cannot settle card transactions at EOD |
| No card payment reference | Audit trail gaps for voided transactions |
| Single card only in split | No approval code per card payment |

### User Pain Points

1. **Store Managers**: Cannot reconcile card payments without approval codes
2. **End-of-Day Processing**: Missing data for settlement reports
3. **Auditing**: No way to trace voided card transactions
4. **Split Payments**: Cannot distinguish multiple card payments

---

## 3. Goals & Objectives

### Primary Goals

| Goal | Success Metric |
|------|----------------|
| Required approval code | 100% of card transactions have approval code |
| Offline capture | Approval codes saved when offline |
| Split support | Each card payment tracked separately |
| Audit retention | Voided transactions preserve approval codes |

---

## 4. Functional Requirements

### 4.1 Approval Code Input

| Condition | Behavior |
|-----------|----------|
| Single card payment | Input field displayed, required |
| Single cash payment | Input field hidden |
| Split - add card | Input field displayed for each card payment |
| Split - add cash | Input field hidden |
| Empty/optional | No - required for all card payments |
| Format validation | None - accepts any string |

### 4.2 UI Display Rules

| Scenario | Display |
|----------|---------|
| Single card selected | Approval code input visible |
| Single cash selected | Approval code input hidden |
| Split - card active | Approval code input visible for card |
| Split - cash active | Approval code input hidden for cash |

### 4.3 Confirmation Button

| Condition | Button State |
|-----------|--------------|
| Card payment, code entered | Enabled |
| Card payment, no code | Disabled with error message |
| Cash payment | Enabled (code not applicable) |

### 4.4 Error Messages

| Scenario | Message |
|----------|---------|
| Card payment without code | "Approval code is required for card payments" |

---

## 5. Data Model

### 5.1 Updated LocalPayment Interface

```typescript
interface LocalPayment {
  id: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
  approvalCode?: string;    // NEW: EDC approval code
}
```

### 5.2 Updated LocalTransaction Interface

```typescript
interface LocalTransaction {
  // ... existing fields ...
  
  // NEW: Single card payment
  approvalCode?: string;
  cardLast4?: string;
}
```

### 5.3 Payment Data Structure

```
Single Payment - Card:
{
  paymentMethod: 'card',
  amountPaid: 99.99,
  approvalCode: '123456',  // REQUIRED
  changeAmount: 0
}

Split Payment:
{
  isSplitPayment: true,
  payments: [
    {
      paymentMethod: 'cash',
      amount: 50.00,
      changeAmount: 0.01
    },
    {
      paymentMethod: 'card',
      amount: 49.99,
      approvalCode: '789012',  // REQUIRED per card
      changeAmount: 0
    }
  ]
}
```

---

## 6. User Flows

### Flow 1: Single Card Payment

```
Preconditions:
- Cart has items
- Total: $99.99
- Cashier selects Card payment

Steps:
1. Payment modal shows Card payment selected
2. Approval code input field is visible and focused
3. Cashier enters code from EDC receipt (e.g., "123456")
4. Cashier clicks Confirm
5. Transaction created with approvalCode
6. Receipt printed with approval code
7. Cart cleared

Expected Outcome:
- Transaction saved with approvalCode: "123456"
- Receipt shows "Approval Code: 123456"
```

### Flow 2: Split Payment with Card

```
Preconditions:
- Cart has items
- Total: $100.00
- Cashier enables split payment

Steps:
1. Cashier adds Cash payment: $50.00
2. Cashier adds Card payment
3. Approval code input appears for card payment
4. Cashier enters code: "654321"
5. Cashier clicks Confirm
6. Transaction created with split payments
7. Receipt printed with both payments and card approval code

Expected Outcome:
- Transaction saved with:
  - payments[0]: cash $50.00
  - payments[1]: card $50.00, approvalCode: "654321"
- Receipt shows card approval code
```

### Flow 3: Missing Approval Code

```
Preconditions:
- Cart has items
- Cashier selects Card payment

Steps:
1. Cashier clicks Confirm WITHOUT entering code
2. Button disabled OR error message shown
3. Modal doesn't close
4. Cashier enters approval code
5. Cashier clicks Confirm again

Expected Outcome:
- Transaction only created when approval code is entered
- Error: "Approval code is required for card payments"
```

---

## 7. UI/UX Requirements

### 7.1 Single Payment - Card Selected

```
┌─────────────────────────────────────────────────────────┐
│                    Complete Payment                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Total: $99.99                                        │
│                                                         │
│   ┌───────────────────────────────────────────────────┐   │
│   │  [Cash]                    [💳 Card - SELECTED]  │   │
│   └───────────────────────────────────────────────────┘   │
│                                                         │
│   ┌───────────────────────────────────────────────────┐   │
│   │  Enter Approval Code from EDC Receipt             │   │
│   │                                                   │   │
│   │  ┌───────────────────────────────────────────┐   │   │
│   │  │ 123456                                   │   │   │
│   │  └───────────────────────────────────────────┘   │   │
│   │  * Required for card payment                  │   │
│   └───────────────────────────────────────────────────┘   │
│                                                         │
│              [  ✕ Cancel  ]       [  ✓ Confirm  ]      │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Single Payment - Cash Selected

```
┌─────────────────────────────────────────────────────────┐
│                    Complete Payment                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Total: $99.99                                        │
│                                                         │
│   ┌───────────────────────────────────────────────────┐   │
│   │  [💳 Cash - SELECTED]      [Card]               │   │
│   └───────────────────────────────────────────────────┘   │
│                                                         │
│              [  ✕ Cancel  ]       [  ✓ Confirm  ]      │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Split Payment - Add Card

```
┌─────────────────────────────────────────────────────────┐
│                    Split Payment                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Remaining: $49.99                                    │
│                                                         │
│   ✓ Cash: $50.00 (Change: $0.01)                      │
│                                                         │
│   ┌───────────────────────────────────────────────────┐   │
│   │  💳 Add Card Payment                             │   │
│   │                                                   │   │
│   │  Amount: $49.99                                   │   │
│   │                                                   │   │
│   │  Approval Code:                                   │   │
│   │  ┌───────────────────────────────────────────┐   │   │
│   │  │ 789012                                   │   │   │
│   │  └───────────────────────────────────────────┘   │   │
│   │                                                   │   │
│   │              [ ✓ Add Card Payment ]              │   │
│   └───────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.4 Input Field Specifications

| Aspect | Specification |
|--------|---------------|
| Type | Text input |
| Autofocus | Yes (when card selected) |
| Placeholder | "Enter code from receipt" |
| Max length | 50 characters |
| Validation | None (accepts any string) |
| Required indicator | Red asterisk or helper text |

### 7.5 Button States

| State | Enabled | Disabled |
|-------|---------|----------|
| Card, no code | No | Yes |
| Card, code entered | Yes | No |
| Cash | Yes | No |

---

## 8. Receipt Output

### 8.1 Single Card Payment

```
┌─────────────────────────────────────────────────┐
│              STORE NAME                          │
│           123 Main Street                       │
│              (555) 123-4567                      │
├─────────────────────────────────────────────────┤
│ Receipt #: TXN-20260204-1234                    │
│ Date: 04/02/2026  Time: 14:32:15               │
│ Cashier: John Smith                             │
├─────────────────────────────────────────────────┤
│ Item 1                          2 x $10.00      │
│                                        $20.00    │
│ Item 2                          1 x $79.99      │
│                                        $79.99    │
├─────────────────────────────────────────────────┤
│ Subtotal:                             $99.99    │
│ Tax (10%):                            $10.00    │
│ TOTAL:                               $109.99    │
├─────────────────────────────────────────────────┤
│ Payment Method: Card                         $109.99
│ Approval Code: 123456                               │
│ Amount Paid:                             $109.99
├─────────────────────────────────────────────────┤
│ Thank you for your purchase!                    │
│ Transaction pending sync                         │
└─────────────────────────────────────────────────┘
```

### 8.2 Split Payment (Cash + Card)

```
┌─────────────────────────────────────────────────┐
│ Payment Method: Card                    $50.00
│ Approval Code: 789012                          │
│ Payment Method: Cash                   $59.99
│ Change:                                      $0.00
├─────────────────────────────────────────────────┤
│ TOTAL PAID:                               $109.99
└─────────────────────────────────────────────────┘
```

---

## 9. Technical Implementation

### 9.1 Files Modified

| File | Change | Description |
|------|--------|-------------|
| `apps/web/src/db/index.ts` | Modified | Add approvalCode to LocalPayment and LocalTransaction |
| `apps/web/src/components/pos/PaymentModal.tsx` | Modified | Add approval code input field and validation |
| `apps/web/src/components/pos/Receipt.tsx` | Modified | Print approval code on receipt |
| `apps/web/src/pages/POS.tsx` | Modified | Pass approval code to transaction creation |

### 9.2 Type Changes

**LocalPayment:**
```typescript
// Before:
interface LocalPayment {
  id: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}

// After:
interface LocalPayment {
  id: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
  approvalCode?: string;  // ADDED
}
```

**LocalTransaction:**
```typescript
// Before:
interface LocalTransaction {
  // ... existing fields ...
  isSplitPayment: boolean;
  paymentMethod?: 'cash' | 'card';
  amountPaid?: number;
  changeAmount?: number;
  payments?: LocalPayment[];
  // ... rest ...
}

// After:
interface LocalTransaction {
  // ... existing fields ...
  isSplitPayment: boolean;
  paymentMethod?: 'cash' | 'card';
  amountPaid?: number;
  changeAmount?: number;
  payments?: LocalPayment[];
  approvalCode?: string;        // ADDED: Single card payment
  cardLast4?: string;            // ADDED: Future use
  // ... rest ...
}
```

### 9.3 PaymentModal Changes

**State Additions:**
```typescript
const [approvalCode, setApprovalCode] = useState<string>('');
const [approvalCodeError, setApprovalCodeError] = useState<string>('');
```

**Validation Logic:**
```typescript
const handleConfirm = () => {
  if (paymentMethod === 'card' && !approvalCode.trim()) {
    setApprovalCodeError('Approval code is required for card payments');
    return;
  }
  // Proceed with payment
};
```

**UI Integration:**
- Show input when `paymentMethod === 'card'`
- Hide input when `paymentMethod === 'cash'`
- Clear code when switching to cash
- Focus input when card is selected

### 9.4 Split Payment Handling

For split payments, each card payment needs its own approval code:

```typescript
interface SplitPaymentFlow {
  cashPayment?: {
    amount: number;
    changeAmount: number;
  };
  cardPayment?: {
    amount: number;
    approvalCode: string;  // Required
  };
}
```

### 9.5 Transaction Creation

```typescript
const createTransaction = (approvalCode?: string) => {
  const transaction: LocalTransaction = {
    // ... existing fields ...
    approvalCode,  // Single card payment
    payments: isSplitPayment ? paymentsWithCodes : undefined,
  };
};
```

---

## 10. Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| Card selected, no code entered | Disable confirm button, show error |
| Switch from card to cash | Clear approval code |
| Switch from cash to card | Focus approval code input |
| Split - card amount, no code | Prevent adding card payment |
| Offline transaction | Save approval code, sync when online |
| Voided transaction | Retain approval code for audit |

---

## 11. Dependencies

### Related Features

| Feature | Relationship |
|---------|--------------|
| Cart Store | Source of transaction data |
| IndexedDB | Transaction persistence |
| Receipt Generation | Approval code display |
| Sync | Offline capture + later sync |

### Integration Points

- `apps/web/src/db/index.ts` (types)
- `apps/web/src/components/pos/PaymentModal.tsx` (UI)
- `apps/web/src/components/pos/Receipt.tsx` (output)
- `apps/web/src/pages/POS.tsx` (orchestration)

---

## 12. Testing Requirements

### 12.1 Unit Tests

```typescript
describe('Approval Code Input', () => {
  it('shows input when card is selected');
  it('hides input when cash is selected');
  it('requires approval code for card payment');
  it('clears code when switching to cash');
  it('validates each card payment in split mode');
});
```

### 12.2 Integration Tests

- [ ] Single card payment with approval code
- [ ] Single card payment without code (should fail)
- [ ] Split payment with card (requires code)
- [ ] Split payment cash only (no code needed)
- [ ] Receipt shows approval code
- [ ] Offline transaction with approval code

---

## 13. Rollout Plan

### 13.1 Phased Rollout

| Phase | Description |
|-------|-------------|
| 1 | Feature flag enabled for 10% of users |
| 2 | Feature flag enabled for 50% of users |
| 3 | 100% rollout |

### 13.2 Monitoring

| Metric | Alert Threshold |
|--------|-----------------|
| Card transactions without code | >1% |
| Payment failures | >5% increase |
| Receipt print errors | Any |

---

## 14. Glossary

| Term | Definition |
|------|------------|
| Approval Code | Authorization code from EDC device |
| EDC | Electronic Data Capture (card terminal) |
| Settlement | End-of-day reconciliation process |
| Split Payment | Multiple payment methods in one transaction |

---

## 15. Related Documents

| Document | Description |
|----------|-------------|
| [POS Page](../../apps/web/src/pages/POS.tsx) | Payment orchestration |
| [PaymentModal](apps/web/src/components/pos/PaymentModal.tsx) | Modified component |
| [Receipt](apps/web/src/components/pos/Receipt.tsx) | Modified component |
| [DB Schema](apps/web/src/db/index.ts) | Type definitions |

---

## 16. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-04 | Initial draft |

---

**Document End**
