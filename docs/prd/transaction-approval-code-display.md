# Plan: Display Approval Code in Transaction Detail

## Current State

| Component | Approval Code Displayed |
|-----------|----------------------|
| Receipt | ✅ Yes |
| Transaction Detail Modal | ❌ No |
| Transaction List | N/A (not applicable) |

## Implementation Plan

### Files Modified

| File | Change |
|------|--------|
| `apps/web/src/pages/Transactions.tsx` | Add approval code display in detail modal |

### Changes Required

#### 1. Transaction Detail Modal - Single Payment

**Location:** Payment Info section for non-split payments (after "Change" field)

```tsx
{/* Add after Change display (around line 385) */}
{transaction.paymentMethod === 'card' && transaction.approvalCode && (
  <div className="flex justify-between text-gray-500">
    <span>Approval Code</span>
    <span className="font-mono">{transaction.approvalCode}</span>
  </div>
)}
{transaction.paymentMethod === 'card' && transaction.cardLast4 && (
  <div className="flex justify-between text-gray-500">
    <span>Card</span>
    <span>**** {transaction.cardLast4}</span>
  </div>
)}
```

#### 2. Transaction Detail Modal - Split Payment

**Location:** Payment Breakdown section (inside the payments.map, around line 400)

```tsx
{payment.paymentMethod === 'card' && payment.approvalCode && (
  <div className="flex justify-between text-gray-500">
    <span>  Approval Code</span>
    <span className="font-mono">{payment.approvalCode}</span>
  </div>
)}
```

### Updated UI Mockup

**Single Payment - Card:**
```
┌─────────────────────────────────────────────────┐
│ Transaction #: TXN-20260204-1234              │
│ Date: Feb 4, 2026  Time: 2:32 PM            │
│ Status: Completed                              │
├─────────────────────────────────────────────────┤
│ Payment Method: Card                            │
│ Approval Code: 123456                           │
│ Card: **** 1234                                │
│ Amount Paid: $109.99                           │
│ Change: $0.00                                  │
└─────────────────────────────────────────────────┘
```

**Split Payment:**
```
┌─────────────────────────────────────────────────┐
│ Payment Breakdown                                │
│ Card: $50.00                                   │
│   Approval Code: 789012                         │
│ Cash: $59.99                                   │
│ Change: $0.00                                  │
└─────────────────────────────────────────────────┘
```

### Acceptance Criteria

- [ ] Single card payment shows approval code
- [ ] Single card payment shows card last 4 (if available)
- [ ] Split payment shows approval code for each card payment
- [ ] Cash payments don't show approval code
- [ ] Typecheck passes

---

## Implementation Steps

1. **Read** `apps/web/src/pages/Transactions.tsx` to find exact line numbers
2. **Add** approval code display in single payment section
3. **Add** approval code display in split payment section
4. **Run** typecheck to verify
5. **Test** manually with a card transaction
