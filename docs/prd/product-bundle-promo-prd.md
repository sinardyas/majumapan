# Product Requirements Document: Product Bundle Promo

## Document Information

| Attribute | Value |
|-----------|-------|
| **Feature** | Product Bundle Promo |
| **Status** | In Progress - P0 Complete |
| **Created** | 2026-01-05 |
| **Version** | 1.1 |
| **Last Updated** | 2026-01-05 |

## Executive Summary

Product Bundle Promo enables retailers to create product-specific promotional pricing that applies automatically when customers add eligible products to cart. Unlike cart-level discount codes that require manual entry, product promos are tied directly to product SKUs and apply automatically based on quantity thresholds and date ranges.

**Key Benefits:**
- Increased average order value through quantity-based discounts
- Reduced cashier friction (no manual discount entry)
- Time-limited promotions for clearance and seasonal sales
- Clear customer communication of savings

---

## Problem Statement

### Current State

The current discount system only supports **cart-level discount codes** that:
- Require manual entry by the cashier or customer
- Apply to the entire cart (not individual products)
- Don't support automatic quantity-based discounts
- Lack product-specific promotional pricing

### Pain Points

1. **Cashier Friction**: Cashiers must manually calculate and apply quantity-based discounts
2. **Missed Savings**: Customers don't automatically get bulk discounts when adding multiple qualifying items
3. **Limited Promo Types**: No support for "buy X, get Y% off" or bundle pricing
4. **Poor Customer Communication**: No visual indication of savings at product level

---

## User Personas

### Persona 1: Retail Manager (Promo Creator)

| Attribute | Value |
|-----------|-------|
| **Name** | Sarah, Store Manager |
| **Goals** | Create promotional offers to drive sales |
| **Frustrations** | Complex promo setup processes |
| **Tech Proficiency** | Medium - comfortable with admin interfaces |

**Needs:**
- Easy promo creation tied to specific products
- Date range controls for time-limited offers
- Clear preview of how promo will appear to customers
- Usage reports to measure promo effectiveness

### Persona 2: Cashier (Promo Enactor)

| Attribute | Value |
|-----------|-------|
| **Name** | Budi, Cashier |
| **Goals** | Process transactions quickly and accurately |
| **Frustrations** | Manual calculations, customer complaints about prices |
| **Tech Proficiency** | Low - prefers simple, intuitive workflows |

**Needs:**
- Promos apply automatically (no manual entry)
- Clear visual indication when promo is applied
- Easy to explain savings to customers
- Works with barcode scanner workflow

### Persona 3: Customer (Promo Beneficiary)

| Attribute | Value |
|-----------|-------|
| **Name** | Dewi, Shopper |
| **Goals** | Find good deals, complete purchase efficiently |
| **Frustrations** | Hidden fees, unclear pricing |
| **Tech Proficiency** | Medium |

**Needs:**
- Clear display of promotional pricing
- Automatic application of qualifying discounts
- Easy to understand total savings
- Trust in displayed prices

---

## Goals & Success Metrics

### Primary Goals

1. **Increase Average Order Value**: Drive higher basket sizes through quantity-based discounts
2. **Reduce Transaction Time**: Eliminate manual promo calculations by cashiers
3. **Improve Customer Satisfaction**: Clear communication of savings at product level

### Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Average order value | $45.00 | +10% ($49.50) | Weekly avg transaction total |
| Transaction time | 2:30 | -15% (2:07) | Time from first scan to payment |
| Promo usage rate | N/A | 20% of transactions | Transactions with product promos |
| Customer satisfaction | 4.2/5 | 4.5/5 | Post-transaction survey |

---

## Functional Requirements

### FR-01: Promo Creation (Admin)

**Priority:** P0 (Must Have)

As an admin/manager, I want to create product-specific promos so that customers get automatic discounts.

**Acceptance Criteria:**
- [x] Promo can be tied to any product by SKU (stored on product record)
- [x] Promo type: Percentage or Fixed Amount
- [x] Minimum quantity trigger (e.g., "Buy 2")
- [x] Optional date range (start date, end date)
- [ ] Preview shows how promo will display to customers (TBD in Admin Panel task)
- [x] Promos sync to POS clients automatically

**Business Rules:**
- Fixed discount is applied to TOTAL (not per item)
- Percentage discount applies to the affected items
- Date range is optional (if empty, promo is always active)
- Promos can be edited but not deleted if used in transactions

---

### FR-02: Automatic Promo Application (POS)

**Priority:** P0 (Must Have)

As a cashier, I want promos to apply automatically when products are scanned so that I don't need manual calculations.

**Acceptance Criteria:**
- [x] Promo applies when quantity meets minimum threshold
- [x] Promo removes when quantity drops below threshold
- [x] Cart recalculates immediately when quantity changes
- [x] Clear visual indication of applied promo
- [x] Original price and discounted price both displayed
- [x] Total savings shown for each promo item

**Business Rules:**
- Promo applies only to the qualifying product(s)
- Multiple different promos can coexist in cart
- Product promos stack with cart-level discount codes

---

### FR-03: Visual Promo Indicators (POS)

**Priority:** P1 (Should Have)

As a customer, I want to see promotional pricing clearly so that I understand my savings.

**Acceptance Criteria:**
- [x] Product grid shows promo badge (e.g., "30% OFF")
- [ ] Product list view shows promo indicator (TBD)
- [x] Cart item shows original price with promo price
- [x] Order summary shows "Promo Savings" line item
- [x] Total savings displayed prominently

**UI Requirements:**
- Red badge for promo items
- Green text for savings amounts
- Strikethrough on original price (optional - not implemented)
- Clear distinction between product promo and cart discount

---

### FR-04: Promo Expiration Handling

**Priority:** P1 (Should Have)

As a system, I want to handle promo expiration gracefully so that customers aren't charged expired prices.

**Acceptance Criteria:**
- [x] Expired promos don't apply to new items (date check in isPromoActive)
- [ ] Items in cart with expired promos recalculate at regular price (TBD)
- [ ] Customer notified (toast) when promo expires in cart (TBD)
- [x] Sync updates promo status from server

**Business Rules:**
- Expired promos are ignored (no negative pricing)
- Recalculation happens immediately on sync update

---

### FR-05: Promo Stacking

**Priority:** P1 (Should Have)

As a customer, I want to combine product promos with cart discount codes so that I maximize my savings.

**Acceptance Criteria:**
- [x] Product-level promo and cart-level discount both apply
- [x] Total discount = (product promo) + (cart discount)
- [x] Order summary shows both discount types separately
- [x] No negative totals possible

**Business Rules:**
- Product promos apply first
- Cart discount applies to reduced subtotal
- Tax calculated on final discounted amount

---

### FR-06: Promo Reporting (Admin)

**Priority:** P2 (Could Have)

As a store manager, I want to track promo usage so that I can measure effectiveness.

**Acceptance Criteria:**
- [ ] Report shows transactions using each promo (TBD)
- [ ] Report includes revenue during promo period (TBD)
- [ ] Report shows total customer savings per promo (TBD)
- [ ] Export capability (CSV/PDF) (TBD)

**Report Fields:**
- Promo name/code
- Product(s) included
- Transaction count
- Revenue during promo period
- Total savings

---

## Non-Functional Requirements

### Performance

- Promo calculation: < 50ms
- Cart recalculation: < 100ms
- Sync update propagation: < 5 seconds

### Scalability

- Support 100+ active promos per store
- Handle 50+ different products with promos in single cart

### Security

- Only admin/manager can create/edit promos
- Cashiers can view but not modify promos
- Promos validated server-side on transaction

### Offline Behavior

- Promos sync to IndexedDB on connection
- Expired promos detected on sync update
- No promo creation possible offline

---

## UI/UX Requirements

### Admin Panel - Product Form

```
┌─────────────────────────────────────────────────────────────┐
│ Product Details                                             │
├─────────────────────────────────────────────────────────────┤
│ SKU:           [WE-001            ]                        │
│ Name:          [Wireless Earbuds                          ]│
│ Price:         [$49.99           ]                        │
├─────────────────────────────────────────────────────────────┤
│ Promo Settings                                             │
├─────────────────────────────────────────────────────────────┤
│ [✓] Enable Product Promo                                   │
│                                                             │
│ Promo Type:  (●) Percentage  ( ) Fixed Amount              │
│ Value:       [__________] 30                               │
│ Min Quantity:[____] 2                                      │
│                                                             │
│ Valid From:  [____________] (optional)                      │
│ Valid Until: [____________] (optional)                      │
│                                                             │
│ Preview: "30% OFF (Min 2)"                                 │
└─────────────────────────────────────────────────────────────┘
```

### POS - Product Card

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  │      [Product Image]            ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  Wireless Earbuds                   │
│  $49.99 → $34.99                    │
│  🔴 30% OFF (Min 2)                 │
│  Stock: 45                          │
└─────────────────────────────────────┘
```

### POS - Cart Item

```
┌─────────────────────────────────────────────────────┐
│  Wireless Earbuds                       $34.99 x2  │
│  $49.99 each (30% OFF)                                │
│  [-] 2 [+]                                     $69.98 │
│  ✓ You save $30.00                                  │
└─────────────────────────────────────────────────────┘
```

### POS - Order Summary

```
Order Summary
─────────────────────────────────────────────────
Subtotal                              $99.98
Promo Savings                        -$30.00
Holiday Sale (10%)                    -$7.00
Tax (10%)                              $6.30
─────────────────────────────────────────────────
Total                                $69.28
Pay $69.28
─────────────────────────────────────────────────
```

---

## Data Model

### Product Promo Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `hasPromo` | boolean | No | false | Whether product has active promo |
| `promoType` | enum | No | null | 'percentage' or 'fixed' |
| `promoValue` | number | No | null | Discount value |
| `promoMinQty` | number | No | 1 | Minimum quantity to trigger |
| `promoStartDate` | datetime | No | null | Promo start date |
| `promoEndDate` | datetime | No | null | Promo end date |

### Cart Item (Extended)

| Field | Type | Description |
|-------|------|-------------|
| `promoType` | enum | Product promo type (percentage/fixed/null) |
| `promoValue` | number | Product promo value |
| `promoMinQty` | number | Min qty for promo |
| `promoDiscount` | number | Calculated promo discount amount |

---

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Quantity increases to meet min | Promo auto-applies |
| Quantity decreases below min | Promo removed, price recalculated |
| Promo expires while in cart | Promo removed, price recalculated |
| Mixed products with/without promos | Each handled independently |
| Cart discount + product promo | Both apply (sum discounts) |
| Fixed promo with qty below min | Promo doesn't apply |
| Network offline during promo change | Promo updates on sync |

---

## Dependencies

### External Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| PostgreSQL | Database for promo storage | Existing |
| IndexedDB | Client-side promo storage | Existing |
| Drizzle ORM | Database schema | Existing |

### Internal Dependencies

| Dependency | Status |
|------------|--------|
| Product CRUD | Complete |
| Cart Store | Complete |
| Sync Service | Complete |
| Discount Code System | Complete |

---

## Success Criteria

### Minimum Viable Product (MVP)

**Completed (P0):**
- [x] Backend schema supports promo fields on products
- [x] POS applies promos automatically when quantity meets threshold
- [x] Cart recalculates on quantity changes
- [x] Visual indicators show promo savings (grid badge, cart item, order summary)
- [x] Promos sync to offline clients (IndexedDB)

**Remaining (P1+):**
- [ ] Admin Panel product form includes promo fields
- [ ] Promo preview in admin form
- [ ] Product list view shows promo indicator
- [ ] Expired promo handling with toast notification
- [ ] Promo reporting in admin panel

### Future Enhancements (Out of Scope)

- Multi-product bundle promos (e.g., "Buy headset + mouse, get 20% off")
- Promo stacking rules (e.g., "Max 2 promos per transaction")
- Customer-specific promos (loyalty-based)
- Promo scheduling/automation

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| Product Promo | Discount tied to a specific product SKU |
| Cart Discount | Discount code applied to entire cart |
| Promo Type | Percentage (e.g., 30%) or Fixed ($5) |
| Min Quantity | Minimum item quantity to trigger promo |
| Promo Savings | Total amount saved from product promos |

### References

- **FSD**: [Product Bundle Promo FSD](../features/product-bundle-promo.md) - Technical implementation details
- **Existing Discount System**: `apps/web/src/stores/cartStore.ts`
- **Database Schema**: `apps/api/src/db/schema.ts`
