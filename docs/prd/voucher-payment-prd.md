# Product Requirements Document: Voucher Payment

## Document Information

| Attribute | Value |
|-----------|-------|
| **Feature** | Voucher Payment |
| **Status** | Phase 2: Customer Management In Progress |
| **Version** | 2.5 |
| **Created** | 2026-01-27 |
| **Updated** | 2026-01-28 |
| **Priority** | P1 (Must Have) |

---

## 1. Executive Summary

### Overview

The Voucher Payment feature enables customers to pay for transactions using vouchers (Gift Cards and Promotional Vouchers). This addresses customer demand for flexible payment options and provides businesses with tools for promotions and refund alternatives.

### Key Outcomes

- **Payment flexibility**: Support for Gift Cards and Promotional Vouchers
- **Promotional capability**: Multiple promotional voucher types (percentage, fixed, free item) with flexible rules
- **Refund mechanism**: Generate Gift Cards as alternative to cash refunds
- **Clear audit trail**: Complete transaction history for voucher usage
- **Multi-entry methods**: Support scan, manual entry, and customer voucher selection

### Quick Reference

| Aspect | Description |
|--------|-------------|
| **Voucher Types** | Gift Card, Promotional (3 subtypes) |
| **Code Format** | XXXX-XXXX-XXXX-XXXX (16 chars) |
| **Multiple vouchers** | Yes, same type only |
| **Offline support** | No (online-only for MVP) |
| **Partial payment** | Yes (Gift Card only) |
| **Expiration** | Yes, configurable |
| **Promo Rules** | Min purchase, max discount, applicable items |

---

## 2. Problem Statement

### Current State

The current POS system does not support voucher payments:

| Scenario | Current Behavior |
|----------|------------------|
| Customer has Gift Card | Cannot apply to transaction |
| Promotional voucher distribution | Manual discounts only |
| Refund without cash | No alternative available |
| Customer wants percentage discount promo | Not supported |
| Customer wants free item promo | Not supported |

### Pain Points

| Pain Point | Impact |
|------------|--------|
| **Lost sales** | Customers with vouchers cannot complete purchases |
| **Limited promotions** | Cannot run effective voucher-based campaigns |
| **Refund challenges** | No alternative when cash refunds aren't possible |
| **Manual workarounds** | Staff manually track voucher balances (error-prone) |
| **No audit trail** | Voucher usage not recorded for reconciliation |

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | Customer | Pay with my Gift Card | I can use pre-paid balance for purchases |
| US-02 | Customer | Apply a promotional voucher (percentage) | I can get percentage discounts on my purchase |
| US-03 | Customer | Apply a promotional voucher (fixed) | I can get fixed amount discounts on my purchase |
| US-04 | Customer | Apply a promotional voucher (free item) | I can get free items with my purchase |
| US-05 | Cashier | Enter voucher code manually | I can process vouchers without scanning |
| US-06 | Cashier | Scan voucher barcode | I can quickly apply vouchers |
| US-07 | Cashier | See remaining voucher balance | I can inform customers of remaining value |
| US-08 | Cashier | Use multiple vouchers | Customer can combine multiple vouchers |
| US-09 | Manager | Create promotional vouchers with rules | I can run targeted marketing campaigns |
| US-10 | Manager | Set minimum purchase requirement | Discounts apply only above certain amounts |
| US-11 | Manager | Set maximum discount cap | I can control discount costs |
| US-12 | Manager | Limit discounts to specific categories/products | Targeted promotions for specific items |
| US-13 | Manager | Void lost/stolen vouchers | I can prevent unauthorized usage |
| US-14 | Admin | Generate Gift Cards for refunds | I can offer alternatives to cash refunds |
| US-15 | Customer | View my available vouchers | I know what vouchers I have |

---

## 3. Goals & Success Metrics

### Primary Goals

| Goal | Success Metric | Target |
|------|----------------|--------|
| Enable voucher payments | % of transactions using vouchers | 5-10% of transactions |
| Support promotions | Promotional voucher redemption rate | Track campaign effectiveness |
| Enable refund alternative | Gift Cards issued from refunds | 100% of refund-to-credit cases |
| Reduce manual work | Staff time on voucher management | <30 seconds per voucher |
| Accurate balance tracking | Voucher balance accuracy | 100% (no discrepancies) |

### Secondary Goals

- Clear receipt showing voucher usage
- Expiration handling with clear messaging
- Void/lost voucher prevention
- Customer voucher history
- Admin voucher management reports
- Flexible promotional rules for targeted campaigns

---

## 4. Requirements

### 4.1 Functional Requirements

#### 4.1.1 Voucher Types

| Type | Purpose | Balance Tracking | Expiration | Tax Treatment |
|------|---------|------------------|------------|---------------|
| **Gift Card** | Pre-paid purchase + Refund compensation | Yes | Optional | After tax |
| **Promotional - Percentage** | Percentage discount | No | Required | Before tax |
| **Promotional - Fixed** | Fixed amount discount | No | Required | Before tax |
| **Promotional - Free Item** | Free item with purchase | No | Required | N/A |

#### 4.1.2 Voucher Code Format

```
XXXX-XXXX-XXXX-XXXX
│││ └── 10-char random alphanumeric (unique identifier)
││└── 2-char check digit + type flag
└┴── 2-char type prefix: GC (Gift Card), PR (Promo)
```

| Type | Code Pattern | Example |
|------|--------------|---------|
| Gift Card | `GC##-XXXXXXXXXX` | `GC12-ABC123XYZ45` |
| Promotional | `PR##-XXXXXXXXXX` | `PR34-PROMO2024AB` |

**Code Specifications:**
- Total length: 16 characters (including dashes)
- Character set: A-Z, 0-9 (uppercase)
- Separator: Dash every 4 characters
- Uniqueness: 100% unique, no duplicates

#### 4.1.3 Promotional Voucher Configuration

##### 4.1.3.1 Percentage Discount

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `discount_type` | ENUM('PERCENTAGE', 'FIXED', 'FREE_ITEM') | Yes | Must be 'PERCENTAGE' |
| `percentage_value` | DECIMAL | Yes | Discount percentage (e.g., 20 for 20%) |
| `scope` | ENUM('ENTIRE_ORDER', 'ITEMS_ONLY', 'SUBTOTAL', 'SPECIFIC_ITEMS') | Yes | Where discount applies |
| `applicable_categories` | UUID[] | Conditional | Categories for SPECIFIC_ITEMS scope |
| `applicable_products` | UUID[] | Conditional | Products for SPECIFIC_ITEMS scope |
| `min_purchase` | DECIMAL | No | Minimum order subtotal required |
| `max_discount` | DECIMAL | No | Maximum discount cap |
| `expires_at` | TIMESTAMP | Yes | Expiration datetime |

**Scope Behavior:**

| Scope | Behavior | Tax Treatment |
|-------|----------|---------------|
| **ENTIRE_ORDER** | Discount applies to items + tax | Discount reduces taxable amount |
| **ITEMS_ONLY** | Discount applies to items before tax | Tax calculated on discounted items |
| **SUBTOTAL** | Discount applies to items before other discounts | Base calculation |
| **SPECIFIC_ITEMS** | Discount applies only to selected categories/products | Only affected items discounted |

**Applicable Items (for SPECIFIC_ITEMS scope):**
- Can select one or more categories
- Can select one or more products
- Can select combination of both

##### 4.1.3.2 Fixed Amount Discount

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `discount_type` | ENUM('PERCENTAGE', 'FIXED', 'FREE_ITEM') | Yes | Must be 'FIXED' |
| `fixed_value` | DECIMAL | Yes | Fixed discount amount |
| `scope` | ENUM('ENTIRE_ORDER', 'ITEMS_ONLY', 'SUBTOTAL', 'SPECIFIC_ITEMS') | Yes | Where discount applies |
| `applicable_categories` | UUID[] | Conditional | Categories for SPECIFIC_ITEMS scope |
| `applicable_products` | UUID[] | Conditional | Products for SPECIFIC_ITEMS scope |
| `min_purchase` | DECIMAL | No | Minimum order subtotal required |
| `max_discount` | DECIMAL | No | Maximum discount cap |
| `expires_at` | TIMESTAMP | Yes | Expiration datetime |

##### 4.1.3.3 Free Item

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `discount_type` | ENUM('PERCENTAGE', 'FIXED', 'FREE_ITEM') | Yes | Must be 'FREE_ITEM' |
| `free_item_id` | UUID | Yes | Product to give free |
| `free_item_mode` | ENUM('AUTO_ADD', 'QUALIFY_FIRST') | Yes | How free item is applied |
| `qualifier_type` | ENUM('CATEGORY', 'PRODUCT', 'BOTH') | Conditional | Required if mode is QUALIFY_FIRST |
| `qualifier_categories` | UUID[] | Conditional | Categories that qualify (QUALIFY_FIRST mode) |
| `qualifier_products` | UUID[] | Conditional | Products that qualify (QUALIFY_FIRST mode) |
| `expires_at` | TIMESTAMP | Yes | Expiration datetime |

**Free Item Mode Behavior:**

| Mode | Behavior | Example |
|------|----------|---------|
| **AUTO_ADD** | Free item automatically added to cart when voucher applied | Customer has nothing → voucher adds Free Coffee |
| **QUALIFY_FIRST** | Customer must add qualifying item first | Customer adds Coffee ($5) → voucher makes it free |

**Qualifier (for QUALIFY_FIRST mode):**

| Qualifier Type | Behavior | Config |
|----------------|----------|--------|
| **CATEGORY** | Any item in selected category qualifies | Select category(ies) |
| **PRODUCT** | Specific product(s) must be in cart | Select product(s) |
| **BOTH** | Either category OR product qualifies | Select categories AND/OR products |

#### 4.1.4 Gift Card Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `initial_value` | DECIMAL | Yes | Initial balance on Gift Card |
| `currency` | VARCHAR(3) | No | Currency code (default: IDR) |
| `expires_at` | TIMESTAMP | No | Expiration datetime (optional) |
| `customer_id` | UUID | No | Assigned customer |

#### 4.1.5 Voucher Creation

| Scenario | Method | Who |
|----------|--------|-----|
| Manual creation at POS | Manager creates manually | Manager only |
| Batch creation at POS | Manager creates batch with quota | Manager only |
| Pre-generated by HQ | Batch generation | Admin |
| Online system | API integration | External system |
| Refund to Gift Card | Auto-generate on refund | System |

#### 4.1.6 Voucher Validation

Before applying to order, validate:

| Check | Behavior |
|-------|----------|
| **Exists** | Voucher code must exist in system |
| **Active** | `is_active = true` |
| **Not Voided** | `is_void = false` |
| **Not Expired** | `expires_at > current_time` (or no expiration for Gift Card) |
| **Sufficient Balance** | For Gift Card: `balance >= amount_to_apply` |
| **Min Purchase Met** | For Promotional: Order subtotal >= `min_purchase` |
| **Applicable Items** | For SPECIFIC_ITEMS: Cart contains qualifying items |

**Validation Response:**
```
Valid Gift Card:
{
  "valid": true,
  "type": "GC",
  "balance": 50000,
  "expiresAt": null,
  "customerId": null
}

Valid Promotional (Percentage):
{
  "valid": true,
  "type": "PR",
  "discountType": "PERCENTAGE",
  "percentageValue": 20,
  "scope": "ITEMS_ONLY",
  "applicableItems": "Coffee Category",
  "minPurchase": 50000,
  "maxDiscount": 20000,
  "message": "20% off Coffee Category, min Rp 50,000"
}

Invalid (Min Purchase Not Met):
{
  "valid": false,
  "error": "MIN_PURCHASE_NOT_MET",
  "message": "Minimum purchase of Rp 50,000 required",
  "currentSubtotal": 30000,
  "requiredMinPurchase": 50000
}

Invalid (No Qualifying Items):
{
  "valid": false,
  "error": "NO_QUALIFYING_ITEMS",
  "message": "Add items from Coffee Category to use this voucher",
  "requiredCategory": "Coffee"
}
```

#### 4.1.7 Voucher Application to Order

##### 4.1.7.1 Percentage Discount Flow

**ENTIRE_ORDER Scope:**
1. Customer has $100 order ($90 items + $10 tax)
2. Apply 20% Promo voucher
3. Discount = 20% of ($90 + $10) = $20
4. New order = $80
5. Voucher marked as used

**ITEMS_ONLY Scope:**
1. Customer has $100 order ($90 items + $10 tax)
2. Apply 20% Promo voucher with scope ITEMS_ONLY
3. Discount = 20% of $90 = $18
4. New order = $82 ($72 items + $10 tax)
5. Voucher marked as used

**SUBTOTAL Scope:**
1. Customer has $100 order ($90 items + $10 tax)
2. Apply 20% Promo voucher with scope SUBTOTAL
3. Discount = 20% of $90 = $18
4. Tax calculated on $90 = $9.90
5. New order = $81.90
6. Voucher marked as used

**SPECIFIC_ITEMS Scope:**
1. Customer has $100 order (Coffee $50 + Cake $50 + $10 tax)
2. Apply 20% Promo voucher for Coffee Category only
3. Discount = 20% of $50 = $10
4. New order = $90 ($40 Coffee + $50 Cake + $10 tax)
5. Voucher marked as used

##### 4.1.7.2 Fixed Amount Discount Flow

Same logic as percentage, but with fixed discount value.

**Example:**
1. Customer has $100 order
2. Apply $10 FIXED Promo voucher
3. Discount = $10
4. New order = $90
5. Voucher marked as used

##### 4.1.7.3 Free Item Flow

**AUTO_ADD Mode:**
1. Customer has order (no Coffee)
2. Apply "Free Coffee with Sandwich" voucher
3. System auto-adds Coffee to cart with $0 price
4. Customer pays for items + free Coffee
5. Voucher marked as used

**QUALIFY_FIRST Mode:**
1. Customer adds Coffee ($5) to order
2. Customer adds Sandwich ($20) to order
3. Apply "Free Coffee with Sandwich" voucher
4. System verifies Sandwich in cart
5. Coffee price changed to $0
6. Voucher marked as used

##### 4.1.7.4 Max Discount Cap

When percentage/fixed discount exceeds `max_discount`:
1. Customer has $200 order
2. Apply 20% Promo voucher with max_discount = $30
3. Calculated discount = 20% of $200 = $40
4. Applied discount = min($40, $30) = $30
5. New order = $170
6. Voucher marked as used

##### 4.1.7.5 Gift Card Flow

1. Customer has $100 order (including tax)
2. Apply $50 Gift Card
3. Remaining $50 due
4. Gift Card balance updated: $100 → $50
5. Customer can use remaining $50 later

##### 4.1.7.6 Multiple Vouchers

- Allowed: Multiple Gift Cards OR Multiple Promotional Vouchers
- Not allowed: Mix of Gift Card + Promotional in same transaction
- Order of application: User-defined (user selects order)
- Discounts applied sequentially in user-specified order

**Example (Multiple Promos):**
1. Customer has $100 order
2. Apply 10% off voucher → $90
3. Apply $5 fixed voucher → $85
4. Final order = $85

#### 4.1.8 Partial Usage

| Voucher Type | Amount > Order Total | Amount < Order Total |
|--------------|---------------------|---------------------|
| **Gift Card** | Use amount, keep balance | Use full balance, remaining due |
| **Promotional** | Mark as used, no change | Use full discount, no partial |

#### 4.1.9 Refund to Gift Card

When processing a refund and cash refund is not possible:

1. Staff selects "Refund to Gift Card" option
2. System auto-generates Gift Card with refund amount
3. Gift Card assigned to customer (optional)
4. Customer receives voucher code
5. Gift Card added to customer's voucher list

**Auto-Generated Gift Card Fields:**
- `type`: GC
- `initial_value`: refund_amount
- `balance`: refund_amount
- `expires_at`: null (no expiration)
- `customer_id`: refunded_customer_id (if customer selected)

#### 4.1.10 Void Voucher

For lost/stolen vouchers:

- Staff/Admin can void voucher
- `is_void` set to `true`
- `voided_at` timestamp recorded
- `voided_by` user ID recorded
- Cannot be used after void
- Balance set to 0

**Audit Trail:**
```
Voucher voided:
{
  "voucherId": "GC12-ABC123XYZ45",
  "voidedAt": "2026-01-27T10:00:00Z",
  "voidedBy": "user_123",
  "reason": "Lost voucher"
}
```

#### 4.1.11 Voucher Lookup Methods

| Method | Description |
|--------|-------------|
| **Scan** | Barcode/QR code scanner |
| **Manual Entry** | Staff types 16-character code |
| **Customer Selection** | Select from customer's registered vouchers |

---

### 4.2 Non-Functional Requirements

#### 4.2.1 Performance

| Metric | Target |
|--------|--------|
| Voucher lookup latency | < 200ms |
| Balance check latency | < 100ms |
| Voucher validation (with rules) | < 300ms |
| Voucher application | < 500ms |

#### 4.2.2 Availability

- **MVP**: Online-only (always requires internet connection)
- Future: Offline capability with reconciliation

#### 4.2.3 Security

- Voucher codes not guessable (high entropy)
- Void requires authentication
- Audit trail for all voucher operations
- No PIN required (consistent with current POS patterns)

#### 4.2.4 Scalability

- Support up to 1M+ vouchers
- Index on `code` for fast lookups
- Partition by `type` if needed

---

### 4.3 Data Requirements

#### 4.3.1 Database Tables

**`vouchers`** - Main voucher records

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | VARCHAR(19) | Unique voucher code (XXXX-XXXX-XXXX-XXXX) |
| `type` | ENUM('GC', 'PR') | Voucher type |
| `discount_type` | ENUM('PERCENTAGE', 'FIXED', 'FREE_ITEM') | Promo type (GC: null) |
| `initial_value` | DECIMAL | Original value when created (GC only) |
| `current_balance` | DECIMAL | Remaining balance (GC only) |
| `currency` | VARCHAR(3) | Currency code (default: IDR) |
| `percentage_value` | DECIMAL | Percentage discount (PERCENTAGE only) |
| `fixed_value` | DECIMAL | Fixed discount (FIXED only) |
| `scope` | ENUM('ENTIRE_ORDER', 'ITEMS_ONLY', 'SUBTOTAL', 'SPECIFIC_ITEMS') | Promo scope |
| `free_item_id` | UUID | Free item product (FREE_ITEM only) |
| `free_item_mode` | ENUM('AUTO_ADD', 'QUALIFY_FIRST') | Free item mode (FREE_ITEM only) |
| `min_purchase` | DECIMAL | Minimum purchase required (promo only) |
| `max_discount` | DECIMAL | Maximum discount cap (promo only) |
| `expires_at` | TIMESTAMP | Expiration datetime (null = no expiry) |
| `is_active` | BOOLEAN | Whether voucher can be used |
| `is_void` | BOOLEAN | Whether voucher is voided |
| `customer_id` | UUID | Optional assigned customer |
| `created_by` | UUID | User who created |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `voided_at` | TIMESTAMP | Void timestamp |
| `voided_by` | UUID | Who voided |
| `void_reason` | TEXT | Void reason |

**`voucher_applicable_items`** - Applicable items for promo vouchers

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `voucher_id` | UUID | Reference to voucher |
| `item_type` | ENUM('CATEGORY', 'PRODUCT') | Type of applicable item |
| `item_id` | UUID | Category or Product ID |

**`voucher_qualifier_items`** - Qualifier items for FREE_ITEM (QUALIFY_FIRST mode)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `voucher_id` | UUID | Reference to voucher |
| `qualifier_type` | ENUM('CATEGORY', 'PRODUCT', 'BOTH') | Qualifier type |
| `item_type` | ENUM('CATEGORY', 'PRODUCT') | Type of qualifier item |
| `item_id` | UUID | Category or Product ID |

**`voucher_transactions`** - Ledger for audit trail

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `voucher_id` | UUID | Reference to voucher |
| `type` | ENUM('usage', 'refund', 'adjustment', 'void', 'create') | Transaction type |
| `amount` | DECIMAL | Amount of transaction |
| `order_id` | UUID | Reference to order (if applicable) |
| `created_by` | UUID | User who performed action |
| `balance_before` | DECIMAL | Balance before transaction |
| `balance_after` | DECIMAL | Balance after transaction |
| `notes` | TEXT | Additional notes |
| `created_at` | TIMESTAMP | Transaction timestamp |

**`order_vouchers`** - Links vouchers to orders

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `order_id` | UUID | Reference to order |
| `voucher_id` | UUID | Reference to voucher |
| `amount_applied` | DECIMAL | Amount applied to this order |
| `discount_details` | JSONB | Details of discount applied |
| `type` | ENUM('GC', 'PR') | Voucher type at time of use |
| `created_at` | TIMESTAMP | Creation timestamp |

#### 4.3.2 Indexes

```sql
-- Fast voucher lookup by code
CREATE INDEX idx_vouchers_code ON vouchers(code);

-- Customer's vouchers
CREATE INDEX idx_vouchers_customer ON vouchers(customer_id);

-- Expiration queries
CREATE INDEX idx_vouchers_expires ON vouchers(expires_at) WHERE expires_at IS NOT NULL;

-- Active vouchers
CREATE INDEX idx_vouchers_active ON vouchers(is_active, is_void);

-- Transaction history
CREATE INDEX idx_voucher_transactions_voucher ON voucher_transactions(voucher_id);
CREATE INDEX idx_voucher_transactions_order ON voucher_transactions(order_id);

-- Applicable items
CREATE INDEX idx_voucher_applicable_voucher ON voucher_applicable_items(voucher_id);
CREATE INDEX idx_voucher_qualifier_voucher ON voucher_qualifier_items(voucher_id);
```

---

### 4.4 API Requirements

#### 4.4.1 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/vouchers` | Create voucher |
| GET | `/api/v1/vouchers/:code` | Get voucher details |
| GET | `/api/v1/vouchers/:code/balance` | Quick balance check |
| POST | `/api/v1/vouchers/validate` | Validate for payment (with rules) |
| POST | `/api/v1/vouchers/:code/use` | Apply voucher to order |
| POST | `/api/v1/vouchers/:code/void` | Void voucher |
| GET | `/api/v1/vouchers/customer/:customerId` | List customer's vouchers |
| POST | `/api/v1/vouchers/refund` | Create Gift Card from refund |

#### 4.4.2 Request/Response Examples

**Create Promotional Voucher (Percentage with Rules):**
```json
POST /api/v1/vouchers
{
  "type": "PR",
  "discountType": "PERCENTAGE",
  "percentageValue": 20,
  "scope": "SPECIFIC_ITEMS",
  "applicableCategories": ["cat-coffee-uuid"],
  "applicableProducts": ["prod-cake-uuid"],
  "minPurchase": 50000,
  "maxDiscount": 20000,
  "expiresAt": "2026-02-28T23:59:59Z",
  "notes": "20% off Coffee and Cake, min Rp 50k, max Rp 20k"
}

Response:
{
  "success": true,
  "voucher": {
    "id": "uuid",
    "code": "PR12-ABC123XYZ45",
    "type": "PR",
    "discountType": "PERCENTAGE",
    "percentageValue": 20,
    "scope": "SPECIFIC_ITEMS",
    "applicableItems": ["Coffee Category", "Cake Product"],
    "minPurchase": 50000,
    "maxDiscount": 20000,
    "expiresAt": "2026-02-28T23:59:59Z"
  }
}
```

**Create Free Item Voucher:**
```json
POST /api/v1/vouchers
{
  "type": "PR",
  "discountType": "FREE_ITEM",
  "freeItemId": "prod-coffee-uuid",
  " "QUALIFY_FIRST",
  "qualifierType": "freeItemMode":CATEGORY",
  "qualifierCategories": ["cat-sandwich-uuid"],
  "expiresAt": "2026-02-28T23:59:59Z",
  "notes": "Free Coffee with Sandwich purchase"
}

Response:
{
  "success": true,
  "voucher": {
    "id": "uuid",
    "code": "PR34-PROMO2024AB",
    "type": "PR",
    "discountType": "FREE_ITEM",
    "freeItem": "Coffee",
    "freeItemMode": "QUALIFY_FIRST",
    "qualifier": "Sandwich Category",
    "expiresAt": "2026-02-28T23:59:59Z"
  }
}
```

**Validate Voucher (Promotional with Rules):**
```json
POST /api/v1/vouchers/validate
{
  "code": "PR12-ABC123XYZ45",
  "cartItems": [
    { "id": "item-1", "productId": "prod-coffee-uuid", "categoryId": "cat-coffee-uuid", "price": 50000 }
  ],
  "subtotal": 50000
}

Response:
{
  "valid": true,
  "type": "PR",
  "discountType": "PERCENTAGE",
  "percentageValue": 20,
  "scope": "SPECIFIC_ITEMS",
  "applicableItems": "Coffee Category, Cake Product",
  "minPurchase": 50000,
  "maxDiscount": 20000,
  "calculatedDiscount": 10000,
  "finalDiscount": 10000,
  "message": "20% off Coffee and Cake (Rp 10,000 discount)"
}
```

**Use Voucher:**
```json
POST /api/v1/vouchers/PR12-ABC123XYZ45/use
{
  "orderId": "order_uuid",
  "cartItems": [
    { "id": "item-1", "productId": "prod-coffee-uuid", "categoryId": "cat-coffee-uuid", "price": 50000, "quantity": 1 }
  ],
  "subtotal": 50000,
  "discountApplied": 10000
}

Response:
{
  "success": true,
  "voucher": {
    "code": "PR12-ABC123XYZ45",
    "type": "PR",
    "discountType": "PERCENTAGE",
    "status": "USED"
  },
  "orderVoucherId": "uuid"
}
```

---

### 4.5 Frontend Requirements

#### 4.5.1 Promotional Voucher Rule Builder UI

**Step 1: Basic Info**
- Voucher Type: Percentage / Fixed / Free Item
- Expiration Date (required)
- Notes (optional)

**Step 2: Discount Configuration**

For **Percentage:**
- Input field: Discount percentage (e.g., 20)
- Scope dropdown: Entire Order / Items Only / Subtotal / Specific Items

For **Fixed:**
- Input field: Discount amount (e.g., 10000)
- Scope dropdown: Entire Order / Items Only / Subtotal / Specific Items

For **Free Item:**
- Product selector: Select free item
- Mode: AUTO_ADD / QUALIFY_FIRST
- If QUALIFY_FIRST: Select qualifier type and items

**Step 3: Applicable Items (if scope = Specific Items)**
- Categories multi-select
- Products multi-select

**Step 4: Rules (Optional)**
- Min Purchase: Input amount (Rp)
- Max Discount: Input amount (Rp)

**Step 5: Review & Create**
- Preview of voucher configuration
- Auto-generated code display
- Create button

#### 4.5.2 Checkout Flow

**Step 1: Add Voucher**
- Button in checkout screen: "Add Voucher"
- Opens voucher entry modal

**Step 2: Voucher Entry**
- Tab 1: Scan (barcode/QR)
- Tab 2: Manual Entry (16-char input)
- Tab 3: Customer's Vouchers (select from list)

**Step 3: Validation & Preview**
- Show voucher details: type, rules, discount preview
- Validation error messages (expired, insufficient balance, min purchase not met, no qualifying items)

**Step 4: Apply to Order**
- Add voucher to payment list
- Show calculated discount for Promotional vouchers
- Multiple vouchers of same type allowed
- Remove/change vouchers
- Reorder vouchers to adjust discount application order

**Step 5: Complete Payment**
- Voucher discount applied to order
- Gift Card balance deducted
- Receipt shows voucher details

#### 4.5.3 Voucher Management UI

**List Customer's Vouchers:**
- Show all vouchers assigned to customer
- Filter by: Active, Expired, Voided, Type (GC, PERCENTAGE, FIXED, FREE_ITEM)
- Show: Code, Type, Balance/Value, Rules, Expiration, Status

**Create Voucher:**
- Access to Rule Builder UI
- Auto-generate code displayed

**Void Voucher:**
- Confirmation dialog
- Reason input
- Audit trail recorded

#### 4.5.4 Receipt Format

```
================================
           RECEIPT
================================
Items: 3
  Coffee           Rp  50,000
  Cake             Rp  30,000
  Sandwich         Rp  20,000
                         -----
Subtotal:          Rp 100,000
Discount:
  Promo PR12-ABC123XYZ45
  (20% off Coffee):
                    Rp  10,000
                         -----
Subtotal:          Rp  90,000
Tax (11%):         Rp   9,900
                         -----
TOTAL:             Rp  99,900
                         =================
PAYMENT:
  Voucher GC12-ABC123XYZ45: Rp  50,000
  Cash:                    Rp  49,900
                         =================
CHANGE:        Rp       100
                         =================
Voucher Balance: Rp  50,000
================================
```

---

### 4.6 Voucher Analytics Dashboard

#### 4.6.1 Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Enable Manager/Admin to monitor voucher and gift card spending |
| **Access** | Admin panel, authenticated users with role Manager or Admin |
| **Refresh** | Manual only (user-triggered refresh button) |

#### 4.6.2 Key Metrics Dashboard

**Gift Card Metrics:**

| Metric | Description | Calculation |
|--------|-------------|-------------|
| Total Issued | Gift Cards created (count + value) | COUNT + SUM(initial_value) |
| Total Redeemed | Gift Cards used (count + value) | COUNT + SUM(amount_applied) |
| Outstanding Balance | Unused value remaining | SUM(current_balance) |
| Refund-to-Gift Card | Created from refunds (count + value) | COUNT + SUM from refund flow |
| Active vs Expired | Breakdown by status | COUNT by is_void + expires_at |

**Promotional Voucher Metrics:**

| Metric | Description | Calculation |
|--------|-------------|-------------|
| Vouchers Created | Total promos issued | COUNT by type |
| Vouchers Redeemed | Total promos used | COUNT where status = USED |
| Redemption Rate | % of promos used | (Redeemed / Created) × 100 |
| Total Discount Given | Value of all discounts | SUM(discount_applied) |
| Avg Discount per Voucher | Mean discount per redemption | Total Discount / Redeemed Count |
| Top Performing Promos | Most used voucher types | GROUP BY discount_type |
| Revenue Impact | Orders with vouchers vs without | Compare AOV |

**Scope-Specific Metrics (for Promos):**

| Scope | Metric |
|-------|--------|
| ENTIRE_ORDER | Total discount with tax impact |
| ITEMS_ONLY | Discount by category |
| SUBTOTAL | Pre-discount subtotal analysis |
| SPECIFIC_ITEMS | Target category/product performance |

#### 4.6.3 Dashboard Views

**View 1: Overview Summary Cards**

```
┌─────────────────────────────────────────────────────────┐
│  Gift Cards        │  Promotional       │  Total       │
│  Outstanding       │  Discount Given    │  Usage       │
│  Rp 1,250,000      │  Rp 450,000        │  2,340       │
└─────────────────────────────────────────────────────────┘
```

**View 2: Gift Card Performance**

| KPI | Value | Trend |
|-----|-------|-------|
| Total Issued | 450 cards | +12% vs last month |
| Total Redeemed | 380 cards | +8% vs last month |
| Outstanding Balance | Rp 1,250,000 | -5% vs last month |
| Avg Usage per Card | Rp 72,222 | +3% vs last month |

**View 3: Promotional Performance**

| Promo Type | Created | Redeemed | Redemption Rate | Total Discount |
|------------|---------|----------|-----------------|----------------|
| Percentage | 1,000 | 750 | 75% | Rp 125,000 |
| Fixed | 500 | 400 | 80% | Rp 80,000 |
| Free Item | 200 | 180 | 90% | Rp 36,000 (item value) |

**View 4: Charts**

| Chart Type | Data Shown |
|------------|------------|
| Line Chart | Daily/Weekly voucher usage trend |
| Pie Chart | Promo type distribution |
| Bar Chart | Top 10 promos by redemption |
| Stacked Bar | Gift Card issuance vs redemption |

**View 5: Recent Transactions (Top 10)**

| Date | Voucher Code | Type | Amount | Order ID |
|------|--------------|------|--------|----------|
| 2026-01-27 | GC12-ABC123XYZ45 | Gift Card | Rp 50,000 | ORD-001 |
| 2026-01-27 | PR34-PROMO2024AB | Percentage | Rp 10,000 | ORD-002 |
| 2026-01-26 | GC56-DEF98765432 | Gift Card | Rp 25,000 | ORD-003 |
| ... | ... | ... | ... | ... |

#### 4.6.4 Filters

| Filter | Options | Default |
|--------|---------|---------|
| **Date Range** | Today, Last 7 days, Last 30 days, Custom | Last 30 days |
| **Voucher Type** | All, Gift Card, Percentage, Fixed, Free Item | All |
| **Store** | All stores (if multi-store) | All |
| **Status** | All, Active, Expired, Voided, Used | All |
| **Created By** | All users, Specific user | All |

#### 4.6.5 Export Options

| Format | Description |
|--------|-------------|
| **CSV** | Raw data export for external analysis |
| **PDF** | Printable report with charts |
| **Excel** | Formatted spreadsheet with pivot tables |

#### 4.6.6 API Requirements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/vouchers/analytics/summary` | Overview metrics |
| GET | `/api/v1/vouchers/analytics/gift-cards` | Gift Card metrics |
| GET | `/api/v1/vouchers/analytics/promos` | Promo metrics |
| GET | `/api/v1/vouchers/analytics/trend` | Time series data |
| GET | `/api/v1/vouchers/analytics/top` | Top performing promos |
| GET | `/api/v1/vouchers/analytics/transactions` | Recent transactions (top 10) |
| POST | `/api/v1/vouchers/analytics/export` | Generate export file |

**Example Response - Summary:**
```json
{
  "giftCards": {
    "totalIssued": { "count": 450, "value": 2500000 },
    "totalRedeemed": { "count": 380, "value": 1250000 },
    "outstandingBalance": 1250000,
    "refundToGiftCard": { "count": 45, "value": 225000 }
  },
  "promos": {
    "totalCreated": 1700,
    "totalRedeemed": 1330,
    "redemptionRate": 78.2,
    "totalDiscountGiven": 241000,
    "byType": {
      "PERCENTAGE": { "created": 1000, "redeemed": 750, "discount": 125000 },
      "FIXED": { "created": 500, "redeemed": 400, "discount": 80000 },
      "FREE_ITEM": { "created": 200, "redeemed": 180, "discount": 36000 }
    }
  },
  "period": {
    "start": "2026-01-01",
    "end": "2026-01-27"
  }
}
```

**Example Response - Transactions:**
```json
{
  "transactions": [
    {
      "date": "2026-01-27T10:30:00Z",
      "code": "GC12-ABC123XYZ45",
      "type": "GC",
      "amount": 50000,
      "orderId": "ord-001"
    },
    {
      "date": "2026-01-27T10:25:00Z",
      "code": "PR34-PROMO2024AB",
      "type": "PR",
      "discountType": "PERCENTAGE",
      "amount": 10000,
      "orderId": "ord-002"
    }
  ],
  "totalCount": 1250
}
```

#### 4.6.7 Frontend Requirements

**Dashboard Layout:**

1. **Header**
   - Date range picker
   - Store selector
   - Refresh button (manual)
   - Export dropdown

2. **Summary Cards** (top row)
   - Gift Card Outstanding
   - Promo Discount Given
   - Total Vouchers Used
   - Avg Redemption Rate

3. **Charts Section** (middle)
   - Usage trend (line)
   - Promo distribution (pie)
   - Top promos (bar)

4. **Recent Transactions Table** (bottom)
   - Date, Voucher Code, Type, Amount, Order ID
   - Maximum 10 rows
   - Pagination if total > 10

#### 4.6.8 UI Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│  Voucher Analytics                                [📅 Last 30] │
│                                                 [🔄 Refresh]   │
├─────────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Gift Cards   │  │ Promo        │  │ Total        │         │
│  │ Outstanding  │  │ Discount     │  │ Redemptions  │         │
│  │ Rp 1.25M     │  │ Rp 241K      │  │ 1,710        │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Usage Trend (Last 30 Days)                            │  │
│  │  │∿∿∿∿∿\                                                │  │
│  │  └─────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────┐  ┌─────────────────────────┐    │
│  │  Promo Distribution     │  │  Top Performing Promos  │    │
│  │  ┌─────┐               │  │  1. 20% Coffee  - 450   │    │
│  │  │  %  │ 75%           │  │  2. Rp10 Off    - 380   │    │
│  │  │ Free│ 10%           │  │  3. Free Coffee - 180   │    │
│  │  └─────┘               │  │  4. 15% Cake    - 120   │    │
│  └─────────────────────────┘  └─────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Recent Transactions (Top 10)                          │  │
│  │  Date       Code          Type     Amount    Order     │  │
│  │  01/27      GC12-ABC...   GC       Rp 50K    ORD-001   │  │
│  │  01/27      PR34-PROMO... PR       Rp 10K    ORD-002   │  │
│  │  01/26      GC56-DEF...   GC       Rp 25K    ORD-003   │  │
│  │  ...                                                ... │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  [📊 Export CSV]  [📄 Export PDF]                            │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.6.9 Acceptance Criteria

- [ ] Dashboard accessible by Manager and Admin roles only
- [ ] Summary cards show correct metrics
- [ ] Gift Card refunds shown separately from promo metrics
- [ ] Charts display accurate data based on date filter
- [ ] Filters (date, type, store, status) work correctly
- [ ] Refresh button updates all metrics and charts
- [ ] Recent Transactions table shows maximum 10 rows
- [ ] Export CSV generates valid file with all data
- [ ] Export PDF generates readable report with charts
- [ ] Loading states show during data fetch
- [ ] Empty states show when no data available
- [ ] Export includes data matching current filters

#### 4.6.10 Effort Estimate

| Task | Effort |
|------|--------|
| Analytics API endpoints | 1.5 days |
| Dashboard frontend UI | 2 days |
| Charts integration | 1 day |
| Export functionality | 0.5 day |
| Testing | 0.5 day |
| **Subtotal** | **5.5 days** |

---

## 5. User Experience

### 5.1 Happy Path Scenarios

#### Scenario 1: Gift Card Payment

1. Customer brings $100 item to checkout
2. Cashier scans items → Total: $100
3. Customer hands Gift Card
4. Cashier clicks "Add Voucher" → "Scan"
5. Scanner reads `GC12-ABC123XYZ45`
6. System validates: Balance $150, Active, Not expired
7. Cashier applies $100 from Gift Card
8. Remaining order: $0
9. Payment complete
10. Receipt shows: Gift Card used $100, Balance $50

#### Scenario 2: Percentage Discount Voucher

1. Customer has $100 order (Coffee Category)
2. Cashier clicks "Add Voucher" → "Manual Entry"
3. Enters `PR12-ABC123XYZ45` (20% off Coffee, min $50)
4. System validates: Cart has Coffee, subtotal $100 ≥ min $50
5. Promo preview: 20% of $100 = $20 discount
6. Cashier applies voucher
7. Order total: $80
8. Customer pays $80
9. Voucher marked as used

#### Scenario 3: Fixed Discount with Max Cap

1. Customer has $200 order
2. Cashier applies $10 FIXED promo with max_discount = $5
3. Calculated discount = $10, but max = $5
4. Applied discount = $5
5. Order total: $195
6. Voucher marked as used

#### Scenario 4: Free Item Voucher (AUTO_ADD)

1. Customer has order (Sandwich only)
2. Cashier applies "Free Coffee with Sandwich" voucher (AUTO_ADD)
3. System auto-adds Coffee to cart ($0 price)
4. Order now: Sandwich ($20) + Coffee ($0)
5. Customer pays $20
6. Voucher marked as used

#### Scenario 5: Free Item Voucher (QUALIFY_FIRST)

1. Customer adds Coffee ($5) and Sandwich ($20)
2. Cashier applies "Free Coffee with Sandwich" voucher (QUALIFY_FIRST)
3. System verifies Sandwich in cart
4. Coffee price changed to $0
5. Order total: $20 (Sandwich only)
6. Voucher marked as used

#### Scenario 6: Multiple Promotional Vouchers

1. Customer has $100 order
2. Cashier adds 10% off voucher → $90
3. Cashier adds $5 FIXED voucher → $85
4. Cashier adds another 5% off voucher → $80.75
5. Final order: $80.75
6. All vouchers marked as used

#### Scenario 7: Refund to Gift Card

1. Customer returns defective item ($50)
2. Cash refund not possible (policy)
3. Cashier processes refund → selects "Gift Card"
4. System auto-generates GC voucher
5. Customer receives Gift Card worth $50
6. Customer can use Gift Card for future purchases

### 5.2 Error Handling

| Error | User Message | Resolution |
|-------|--------------|------------|
| Voucher not found | "Voucher not found. Please check the code." | Verify code, try manual entry |
| Voucher expired | "This voucher expired on [date]" | Use different voucher |
| Voucher voided | "This voucher has been voided" | Contact management |
| Insufficient balance | "Gift Card balance: $50. Order needs: $75" | Use additional payment |
| Min purchase not met | "Minimum purchase of Rp 50,000 required. Current: Rp 30,000" | Add more items |
| No qualifying items | "Add items from Coffee Category to use this voucher" | Add qualifying items |
| No qualifying product | "Add [Product Name] to use this voucher" | Add qualifying product |
| Offline | "Voucher validation requires internet connection" | Retry when online |
| Voucher already used | "This promotional voucher has already been used" | Use different voucher |
| Max discount exceeded | "Discount capped at Rp 20,000" | Inform customer |

---

## 6. Implementation Plan

### Phase 1: Database & Backend Foundation (COMPLETED ✓)

| Task | Description | Status | Files |
|------|-------------|--------|-------|
| Create migration | vouchers, voucher_applicable_items, voucher_qualifier_items, voucher_transactions, order_vouchers tables | ✅ Done | `apps/api/src/db/schema.ts` |
| Voucher enums | voucherTypeEnum, voucherDiscountTypeEnum, voucherScopeEnum, voucherFreeItemModeEnum, voucherQualifierTypeEnum, voucherItemTypeEnum, voucherTransactionTypeEnum | ✅ Done | `apps/api/src/db/schema.ts` |
| Voucher service (GC) | Create, validate, use, void operations for Gift Cards | ✅ Done | `apps/api/src/services/voucher-service.ts` |
| Voucher service (PR) | Create, validate, use operations for Promotional vouchers | ✅ Done | `apps/api/src/services/voucher-service.ts` |
| Discount calculation engine | Handle scope, min purchase, max discount, applicable items | ✅ Done | `apps/api/src/services/voucher-service.ts` |
| Free item logic | Handle AUTO_ADD and QUALIFY_FIRST modes | ✅ Done | `apps/api/src/services/voucher-service.ts` |
| API endpoints | All 10 endpoints with validation | ✅ Done | `apps/api/src/routes/vouchers.ts` |
| Check digit algorithm | Code validation logic (XXXX-XXXX-XXXX-XXXX) | ✅ Done | `apps/api/src/services/voucher-service.ts` |
| Permissions | vouchers:create (Manager only), vouchers:read, vouchers:use, vouchers:void | ✅ Done | `packages/shared/src/constants/permissions.ts` |
| Route registration | Mount vouchers router | ✅ Done | `apps/api/src/routes/index.ts` |
| Migration file | Create 0011_vouchers.sql migration | ✅ Done | `apps/api/drizzle/0011_vouchers.sql` |

### Phase 2: Frontend Integration (COMPLETED ✓)

| Task | Description | Status | Files |
|------|-------------|--------|-------|
| Voucher API service | API client for voucher operations | ✅ Done | `apps/web/src/services/voucher.ts` |
| Voucher entry component | Scan, manual, customer selection | ✅ Done | `apps/web/src/components/pos/VoucherEntryModal.tsx` |
| Rule Builder UI | Create promotional vouchers with rules | ✅ Done | `apps/web/src/components/pos/VoucherRuleBuilder.tsx` |
| Voucher management UI | List, filter, void vouchers | ✅ Done | `apps/web/src/pages/Vouchers.tsx` |
| Checkout integration | Apply vouchers in PaymentModal | ✅ Done | `apps/web/src/components/pos/PaymentModal.tsx` |
| Database migration | Create voucher tables in DB | ✅ Done | `apps/api/drizzle/0011_vouchers.sql` |

### Phase 3: Refund Flow (COMPLETED ✓)

| Task | Description | Status | Files |
|------|-------------|--------|-------|
| Refund to Gift Card | Auto-generate on refund | ✅ Done | `apps/api/src/services/voucher-service.ts` |
| Customer voucher list | View assigned vouchers | ✅ Done | `apps/web/src/pages/CustomerVouchers.tsx` |
| Refund modal UI | Process refunds with cash/gift card option | ✅ Done | `apps/web/src/components/pos/RefundModal.tsx` |
| Transactions integration | Add Refund button to transactions page | ✅ Done | `apps/web/src/pages/Transactions.tsx` |

### Phase 4: Testing & Polish (COMPLETED ✓)

| Task | Description | Status | Files |
|------|-------------|--------|-------|
| Unit tests | Voucher service + discount calculation | ✅ Done | `apps/api/src/services/voucher-service.test.ts` (22 tests passing) |
| Voucher code validation tests | Check digit algorithm tests | ✅ Done | `apps/api/src/services/voucher-service.test.ts` |
| TypeScript checks | All typechecks passing | ✅ Done | `bun run typecheck` |

### Phase 5: Analytics Dashboard (PENDING)

| Task | Description | Effort |
|------|-------------|--------|
| Analytics API endpoints | Summary, gift cards, promos, trend, top, transactions | 1.5 days |
| Dashboard frontend UI | Summary cards, charts, recent transactions | 2 days |
| Charts integration | Usage trend, promo distribution, top promos | 1 day |
| Export functionality | CSV, PDF export options | 0.5 day |

### Phase 6: Batch Distribution & Permissions Fix (NEXT)

| Task | Description | Effort |
|------|-------------|--------|
| Permissions fix | Restrict vouchers:create to Manager only | 0.25 day |
| Database schema (batches) | Add voucher_batches table, update vouchers columns | 0.5 day |
| Batch service logic | Create batch, distribute, auto-void, claim logic | 1 day |
| Batch API endpoints | 8 new endpoints for batch management | 0.5 day |
| Frontend batch creation | Add batch option to Rule Builder | 1 day |
| Frontend batch management | Batch list, detail, distribution UI | 1 day |
| Print/export functionality | CSV and PDF for physical vouchers | 0.5 day |
| Auto-void cron job | Daily cleanup of expired undistributed vouchers | 0.5 day |
| Testing | Integration tests for batch flow | 0.75 day |

### Estimated Total Effort: 23.5-26.5 days (Phases 1-4 completed: ~21.5 days)

---

## 7. Out of Scope (MVP)

| Feature | Reason |
|---------|--------|
| Offline voucher balance | Complex reconciliation needed |
| Voucher reload/top-up | Low priority, add later |
| Voucher transfer | Not required |
| PIN verification | Not needed per requirements |
| Promotional rules engine (advanced) | Date-based schedules, time-limited promos |
| Partial promo usage | Mark promo as fully used |
| Voucher expiration warnings | Add in future update |
| Voucher combination rules | Only same type allowed in MVP |
| Tiered discounts | Single discount rate per voucher |

---

## 8. Dependencies

| Dependency | Description |
|------------|-------------|
| Orders module | Need order ID to link voucher usage |
| Customers module | Customer voucher assignment, qualifier validation |
| Users module | Audit trail (created_by, voided_by) |
| Products module | Free item, applicable items, qualifier items |
| Categories module | Applicable categories, qualifier categories |
| Sync module | Future offline support |

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Code collision (duplicate) | High | 16-char format provides 839 quadrillion combinations |
| Double-spend (offline) | Medium | Online-only for MVP eliminates risk |
| Complex discount calculation | High | Thorough unit tests, edge case coverage |
| Free item logic errors | Medium | Test both AUTO_ADD and QUALIFY_FIRST modes |
| Min/max discount edge cases | Medium | Test boundary conditions |
| Expired voucher usage | Low | Validation check on every use |
| User error in manual entry | Medium | Check digit validation, clear error messages |
| Performance at scale | Low | Indexes on code and customer_id |

---

## 10. Acceptance Criteria

### Functional Acceptance Criteria

- [ ] Gift Cards can be created with initial value
- [ ] Promotional vouchers can be created with percentage, fixed, or free item types
- [ ] Percentage discounts can be configured with scope (entire/items/subtotal/specific)
- [ ] Fixed discounts can be configured with scope (entire/items/subtotal/specific)
- [ ] Free Item vouchers can be configured with AUTO_ADD and QUALIFY_FIRST modes
- [ ] Promo vouchers can target specific categories and/or products
- [ ] Min purchase rule can be configured on promo vouchers
- [ ] Max discount cap can be configured on promo vouchers
- [ ] Vouchers can be validated before use (including rules)
- [ ] Gift Cards can be applied to orders (partial or full)
- [ ] Promotional vouchers reduce order total correctly based on scope
- [ ] Free Item vouchers add free items or make qualifying items free
- [ ] Max discount cap is respected in calculations
- [ ] Min purchase rule is validated before application
- [ ] Multiple vouchers of same type can be used
- [ ] Voucher balance updates correctly after use
- [ ] Expired vouchers are rejected
- [ ] Voided vouchers are rejected
- [ ] Refund to Gift Card auto-generates new voucher
- [ ] Vouchers can be assigned to customers
- [ ] Void operation records audit trail
- [ ] Refund-to-Gift Card metrics shown separately from promo metrics

### Non-Functional Acceptance Criteria

- [ ] Voucher lookup response < 200ms
- [ ] Voucher validation response < 300ms
- [ ] 100% accuracy in discount calculations
- [ ] 100% accuracy in balance tracking
- [ ] Online-only mode works without errors
- [ ] Receipt shows voucher details and discounts correctly
- [ ] Error messages are clear and actionable

### UI Acceptance Criteria

- [ ] Scan functionality works with barcode scanner
- [ ] Manual entry accepts 16-char code format
- [ ] Customer voucher list shows correct balances and rules
- [ ] Voucher can be removed from order before payment
- [ ] Multiple vouchers applied in correct order
- [ ] Rule Builder UI allows creating all promo types
- [ ] Applicable items selector works for categories and products
- [ ] Free Item qualifier selector works correctly
- [ ] Min purchase and max discount fields work correctly

### Dashboard Acceptance Criteria

- [ ] Dashboard accessible by Manager and Admin roles only
- [ ] Summary cards show correct metrics
- [ ] Gift Card refunds shown separately from promo metrics
- [ ] Charts display accurate data based on date filter
- [ ] Filters (date, type, store, status) work correctly
- [ ] Refresh button updates all metrics and charts
- [ ] Recent Transactions table shows maximum 10 rows
- [ ] Export CSV generates valid file with all data
- [ ] Export PDF generates readable report with charts
- [ ] Loading states show during data fetch
- [ ] Empty states show when no data available
- [ ] Export includes data matching current filters

---

## 4.7 Voucher Batch Distribution

### 4.7.1 Overview

Promotional vouchers can be distributed in batches with a limited quota. This enables:
- Physical voucher printing for distribution (e.g., flyers, in-store handouts)
- Digital distribution with customer assignment tracking
- Quota enforcement to limit total distributions
- Automatic voiding of undistributed vouchers after expiration

### 4.7.2 Batch vs Individual Vouchers

| Aspect | Individual Voucher | Batch Voucher |
|--------|-------------------|---------------|
| Creation | One at a time | Multiple at once |
| Quota | N/A | Yes (e.g., 50 vouchers) |
| Codes | Single code | Multiple unique codes |
| Tracking | Simple | Batch + individual tracking |
| Physical voucher support | No | Yes |
| Max per batch | N/A | 500 vouchers |

### 4.7.3 Voucher Distribution States

| State | `is_distributed` | `distributed_to` | Description |
|-------|------------------|------------------|-------------|
| Undistributed | `false` | `null` | Ready for distribution |
| Physical voucher given | `true` | `null` | Physical slip, no customer account |
| Digital voucher assigned | `true` | `customer_id` | Linked to customer account |
| Physical voucher claimed | `true` | `customer_id` | Customer registers physical voucher later |

### 4.7.4 Database Schema Changes

#### 4.7.4.1 New Table: `voucher_batches`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR | Batch name (auto-generated or manual) |
| `type` | ENUM('GC', 'PR') | Voucher type (PR for MVP) |
| `discount_type` | ENUM('PERCENTAGE', 'FIXED', 'FREE_ITEM') | Promo type |
| `percentage_value` | DECIMAL | Percentage discount |
| `fixed_value` | DECIMAL | Fixed discount |
| `scope` | ENUM('ENTIRE_ORDER', 'ITEMS_ONLY', 'SUBTOTAL', 'SPECIFIC_ITEMS') | Discount scope |
| `free_item_id` | UUID | Free item product |
| `free_item_mode` | ENUM('AUTO_ADD', 'QUALIFY_FIRST') | Free item mode |
| `min_purchase` | DECIMAL | Minimum purchase |
| `max_discount` | DECIMAL | Maximum discount cap |
| `expires_at` | TIMESTAMP | Expiration datetime |
| `quota` | INT | Total vouchers to generate (max 500) |
| `distributed_count` | INT | Counter of distributed vouchers |
| `applicable_categories` | JSONB | Applicable category IDs |
| `applicable_products` | JSONB | Applicable product IDs |
| `qualifier_type` | ENUM('CATEGORY', 'PRODUCT', 'BOTH') | Qualifier type (free item) |
| `qualifier_categories` | JSONB | Qualifier category IDs |
| `qualifier_products` | JSONB | Qualifier product IDs |
| `created_by` | UUID | User who created |
| `created_at` | TIMESTAMP | Creation timestamp |
| `notes` | TEXT | Optional notes |

#### 4.7.4.2 Updated `vouchers` Table

Add columns:

| Column | Type | Description |
|--------|------|-------------|
| `batch_id` | UUID | Reference to voucher_batches (nullable, null = individually created) |
| `is_distributed` | BOOLEAN | Has been distributed (physical or digital) |
| `distributed_at` | TIMESTAMP | When voucher was distributed |
| `distributed_to` | UUID | Customer ID (nullable - null for physical vouchers) |
| `claimed_at` | TIMESTAMP | When physical voucher was claimed by customer |
| `claimed_by` | UUID | Customer who claimed the physical voucher |

### 4.7.5 Batch Creation Flow

1. Manager fills Rule Builder with promo rules
2. Manager selects "Create Batch"
3. Manager enters batch name (auto-generated if)
4. Manager empty enters quota (1-500)
5. System validates rules
6. System generates N unique voucher codes
7. All N vouchers created with:
   - Same promo rules
   - Same expiration
   - `batch_id` = new batch ID
   - `is_distributed` = false
   - `is_active` = true
8. Batch record created with `quota=N`, `distributed_count=0`
9. Return batch ID and list of generated codes

**Auto-generated Batch Name Format:**
```
Promo-YYYY-MM-DD-XXX (e.g., Promo-2026-01-27-001)
```

### 4.7.6 Distribution Flow

#### 4.7.6.1 Physical Voucher Distribution

```
1. Manager views undistributed vouchers in batch
2. Manager exports undistributed codes for printing
3. Customer receives printed physical voucher
4. System marks voucher as distributed:
   - is_distributed = true
   - distributed_at = now()
   - distributed_to = null (no customer linked)
5. System increments batch.distributed_count
```

#### 4.7.6.2 Digital Voucher Distribution

```
1. Staff selects undistributed voucher from batch
2. Staff selects customer (required for digital)
3. System updates voucher:
   - is_distributed = true
   - distributed_at = now()
   - distributed_to = customer_id
4. System increments batch.distributed_count
5. Customer sees voucher in their voucher list
```

#### 4.7.6.3 Physical Voucher Claim

When customer registers a physical voucher to their account:
```
1. Customer provides voucher code
2. System validates voucher exists and is distributed
3. System updates voucher:
   - claimed_at = now()
   - claimed_by = customer_id
4. Voucher now appears in customer's vouchers
```

### 4.7.7 Quota Validation

**Distribution Check:**
```
Before distribution:
1. Check voucher exists and is_active
2. Check voucher.is_distributed = false
3. Check batch.distributed_count < batch.quota
4. If quota reached: return "QUOTA_REACHED" error
```

**Quota Reached Response:**
```json
{
  "valid": false,
  "error": "QUOTA_REACHED",
  "message": "This batch has reached its distribution limit of 50 vouchers",
  "batchId": "batch-uuid",
  "quota": 50,
  "distributedCount": 50
}
```

### 4.7.8 Auto-Void Logic

**Trigger:** Daily cron job or on-demand cleanup

**Process:**
```
1. Find all vouchers where:
   - batch_id IS NOT NULL
   - is_distributed = false
   - batch.expires_at < now()
2. For each voucher:
   - is_active = false
   - is_void = true
   - voided_at = now()
   - voided_by = SYSTEM
   - void_reason = "Auto-voided: batch expired with undistributed vouchers"
3. Log batch void event for audit
```

### 4.7.9 API Endpoints

#### 4.7.9.1 New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/vouchers/batches` | Create voucher batch |
| GET | `/api/v1/vouchers/batches` | List all batches |
| GET | `/api/v1/vouchers/batches/:batchId` | Get batch details |
| GET | `/api/v1/vouchers/batches/:batchId/vouchers` | List vouchers in batch |
| GET | `/api/v1/vouchers/batches/:batchId/undistributed` | Get undistributed codes for printing |
| POST | `/api/v1/vouchers/batches/:batchId/distribute` | Distribute voucher to customer |
| POST | `/api/v1/vouchers/batches/:batchId/close` | Manually close batch |
| POST | `/api/v1/vouchers/batches/:batchId/claim` | Claim physical voucher |

#### 4.7.9.2 Request/Response Examples

**Create Batch:**
```json
POST /api/v1/vouchers/batches
{
  "name": "Promo January 2026",
  "discountType": "PERCENTAGE",
  "percentageValue": 20,
  "scope": "SPECIFIC_ITEMS",
  "applicableCategories": ["cat-coffee-uuid"],
  "minPurchase": 50000,
  "maxDiscount": 20000,
  "expiresAt": "2026-02-28T23:59:59Z",
  "quota": 50,
  "notes": "20% off Coffee, first 50 customers"
}

Response:
{
  "success": true,
  "batch": {
    "id": "batch-uuid",
    "name": "Promo-2026-01-27-001",
    "quota": 50,
    "distributedCount": 0,
    "remaining": 50,
    "expiresAt": "2026-02-28T23:59:59Z"
  },
  "vouchers": [
    { "code": "PR12-ABC123XYZ45", "status": "undistributed" },
    { "code": "PR12-DEF678UVW90", "status": "undistributed" },
    ...
  ]
}
```

**Distribute to Customer:**
```json
POST /api/v1/vouchers/batches/:batchId/distribute
{
  "voucherCode": "PR12-ABC123XYZ45",
  "customerId": "cust-uuid"
}

Response:
{
  "success": true,
  "voucher": {
    "code": "PR12-ABC123XYZ45",
    "distributedTo": "cust-uuid",
    "distributedAt": "2026-01-27T10:00:00Z"
  },
  "batch": {
    "remaining": 49,
    "distributedCount": 1
  }
}
```

**Get Undistributed for Printing:**
```json
GET /api/v1/vouchers/batches/:batchId/undistributed

Response:
{
  "batch": {
    "id": "batch-uuid",
    "name": "Promo-2026-01-27-001",
    "expiresAt": "2026-02-28T23:59:59Z"
  },
  "undistributed": [
    { "code": "PR12-GHI345RST12", "status": "ready" },
    { "code": "PR12-JKL678MNO34", "status": "ready" },
    ...
  ]
}
```

**Claim Physical Voucher:**
```json
POST /api/v1/vouchers/batches/:batchId/claim
{
  "voucherCode": "PR12-ABC123XYZ45",
  "customerId": "cust-uuid"
}

Response:
{
  "success": true,
  "voucher": {
    "code": "PR12-ABC123XYZ45",
    "claimedAt": "2026-01-27T10:00:00Z",
    "claimedBy": "cust-uuid"
  }
}
```

### 4.7.10 Frontend Requirements

#### 4.7.10.1 Rule Builder Updates

**New Step 0: Voucher Type Selection**
```
○ Create Single Voucher
● Create Batch (Multiple Vouchers)
```

**New Step (appears when "Create Batch" selected): Batch Configuration**
```
Batch Name: [Input field, auto-filled if empty]
Quota: [Number input, min=1, max=500]
Notes: [Optional text area]
```

**Updated Review & Create:**
- Show batch summary: "50 vouchers will be generated"
- Show all generated codes (expandable list)
- Download as CSV button (for printing)
- Download as PDF button (printable voucher sheet)

#### 4.7.10.2 Batch Management Page

**Batch List View:**

| Column | Description |
|--------|-------------|
| Batch Name | Name of batch |
| Type | Promo type |
| Quota | Total vouchers (e.g., 50) |
| Distributed | Distributed count (e.g., 32/50) |
| Remaining | Undistributed count |
| Expires | Expiration date |
| Status | Active/Expired/Depleted/Closed |
| Actions | View, Print, Close |

**Batch Detail View:**

```
┌─────────────────────────────────────────────────────────┐
│  Batch: Promo-2026-01-27-001                            │
│  Status: Active | Expires: 2026-02-28                   │
│  Distributed: 32/50 (64%)                               │
├─────────────────────────────────────────────────────────┤
│  [Print Undistributed] [Close Batch] [Export CSV]       │
├─────────────────────────────────────────────────────────┤
│  Vouchers:                                              │
│  Code               Status          Customer   Date     │
│  PR12-ABC123XYZ45   Distributed     John D.    01/27    │
│  PR12-DEF678UVW90   Distributed     Jane S.    01/27    │
│  PR12-GHI345RST12   Undistributed   -          -        │
│  PR12-JKL678MNO34   Undistributed   -          -        │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

#### 4.7.10.3 Distribution Modal

```
┌─────────────────────────────────────┐
│  Distribute Voucher                 │
├─────────────────────────────────────┤
│  Batch: Promo January 2026          │
│  Remaining: 18 / 50                 │
├─────────────────────────────────────┤
│  Voucher Code: [Auto-select or enter]│
│  Customer (optional):               │
│  [Search customer...]               │
├─────────────────────────────────────┤
│  [Cancel]  [Distribute]             │
└─────────────────────────────────────┘
```

#### 4.7.10.4 Physical Voucher Print Format

**Printable Sheet (PDF):**
```
┌─────────────────────────────────────────────────────────┐
│           PROMO JANUARY 2026                            │
│           20% off Coffee                                │
│           Valid until: 2026-02-28                       │
├─────────────────────────────────────────────────────────┤
│  Code: PR12-ABC123XYZ45                                 │
│                                                         │
│  ████████████████████████████████████████████████       │
│                                                         │
│  Present this voucher at checkout.                      │
│  One-time use. Cannot be exchanged for cash.            │
├─────────────────────────────────────────────────────────┤
│  Code: PR12-DEF678UVW90                                 │
│                                                         │
│  ████████████████████████████████████████████████       │
│                                                         │
│  ... (repeat for all undistributed codes)               │
└─────────────────────────────────────────────────────────┘
```

### 4.7.11 Indexes for Performance

```sql
-- Fast batch lookup
CREATE INDEX idx_voucher_batches_created ON voucher_batches(created_at);

-- Undistributed vouchers in batch
CREATE INDEX idx_vouchers_batch_undistributed ON vouchers(batch_id, is_distributed) WHERE is_distributed = false;

-- Customer's vouchers (including claimed physical)
CREATE INDEX idx_vouchers_claimed_by ON vouchers(claimed_by) WHERE claimed_by IS NOT NULL;

-- Auto-void query
CREATE INDEX idx_vouchers_batch_expired ON vouchers(batch_id, is_distributed, expires_at) WHERE batch_id IS NOT NULL AND is_distributed = false;
```

### 4.7.12 Acceptance Criteria

- [ ] Batch name auto-generated if empty (format: Promo-YYYY-MM-DD-XXX)
- [ ] Quota configurable (1-500 vouchers per batch)
- [ ] All voucher codes in batch are unique
- [ ] Physical voucher distribution works without customer ID
- [ ] Digital voucher distribution requires customer ID
- [ ] Quota reached blocks further distribution with clear error
- [ ] Undistributed vouchers auto-voided after batch expiration
- [ ] Physical vouchers can be claimed to customer account
- [ ] Customer sees both digital and claimed physical vouchers
- [ ] Undistributed codes exportable as CSV for printing
- [ ] Printable PDF format for physical vouchers
- [ ] Batch can be manually closed
- [ ] Batch list shows distributed/remaining counts
- [ ] Batch detail shows all vouchers with status

### 4.7.13 Effort Estimate

| Task | Effort |
|------|--------|
| Database migration & schema | 0.5 day |
| Batch service logic | 1 day |
| Batch API endpoints | 0.5 day |
| Frontend batch creation UI | 1 day |
| Frontend batch management UI | 1 day |
| Print/export functionality | 0.5 day |
| Auto-void cron job | 0.5 day |
| Testing | 1 day |
| **Total** | **6 days** |

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Gift Card (GC)** | Pre-paid voucher with balance tracking |
| **Promotional Voucher (PR)** | Discount voucher with rules, marked as used after single application |
| **Percentage Discount** | Promo type that applies percentage reduction to order |
| **Fixed Discount** | Promo type that applies fixed amount reduction to order |
| **Free Item** | Promo type that gives free or discounted item |
| **Voucher Code** | 16-character identifier (XXXX-XXXX-XXXX-XXXX) |
| **Void Voucher** | Deactivate a voucher (lost/stolen scenario) |
| **Balance** | Remaining value on Gift Card |
| **Check Digit** | Algorithm to validate voucher code format |
| **Partial Usage** | Using only part of voucher value |
| **Scope** | Which parts of order discount applies to |
| **Applicable Items** | Specific categories/products for discount |
| **Qualifier** | Item required to activate free item voucher |
| **Min Purchase** | Minimum order subtotal required to use voucher |
| **Max Discount** | Maximum discount amount cap |

---

## 12. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-27 | POS Team | Initial draft (simple promo: fixed amount only) |
| 2.0 | 2026-01-27 | POS Team | Added: percentage discounts, fixed discounts, free item promos, scope options, applicable items, min purchase, max discount, free item modes |
| 2.1 | 2026-01-27 | POS Team | Added: Voucher Analytics Dashboard (metrics, charts, filters, export, top 10 transactions) |
| 2.2 | 2026-01-27 | POS Team | Phase 1 Complete: Database schema, voucher service, API endpoints, permissions, check digit algorithm |
| 2.3 | 2026-01-27 | POS Team | Phase 2 Complete: VoucherEntryModal, RuleBuilder, PaymentModal integration, Vouchers page. Phase 3 Complete: Refund flow, RefundModal, CustomerVouchers page. Phase 4 Complete: 22 unit tests passing. POS.tsx updated to pass cartItems. Database migration executed. |
| 2.4 | 2026-01-28 | POS Team | Added Section 4.7: Voucher Batch Distribution - quota system, physical vouchers, distribution tracking, auto-void, batch management UI, print/export functionality. |
| 2.5 | 2026-01-28 | POS Team | Section 4.1.5: Manual creation at POS changed from Cashier/Manager to Manager only. Added batch creation by Manager. Updated permissions to Manager-only for voucher:create. Added Phase 6 for implementation.
| 2.6 | 2026-01-28 | POS Team | **Phase 2A Progress:** Customer management tables (customers, customer_groups, message_templates, distribution_history), customer service with auto-assignment, customer API routes. Phase 2B (Frontend) and Phase 2C (Distribution) pending. |

---

## 13. Appendices

### Appendix A: Check Digit Algorithm

The 2-character type flag + check digit ensures code validity:

```
Position:  0  1 2  3 4  5 6  7 8  9 10 11  12 13 14 15
Example:   G  C 1  2  -  A  B  C  1  2  3  X   Y   Z  4  5

Step 1: Type prefix (GC or PR)
Step 2: Generate 10 random characters (A-Z, 0-9)
Step 3: Calculate check digit from type + random chars
Step 4: Format as XXXX-XXXX-XXXX-XXXX
```

### Appendix B: Discount Calculation Flowchart

```
                    Start
                       │
                       ▼
              Get Voucher Details
                       │
                       ▼
           Check: Expired? / Void? / Active?
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
      Invalid                   Valid
           │                       │
           ▼                       ▼
      Return Error          Check Scope
                                   │
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
    ENTIRE_ORDER            ITEMS_ONLY              SUBTOTAL
           │                       │                       │
           ▼                       ▼                       ▼
    (Items + Tax) × %        Items × %              Items × %
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   │
                                   ▼
                        Check Min Purchase?
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
        Min Not Met                                Min Met
              │                                         │
              ▼                                         ▼
        Return Error                          Check Max Discount
                                                   │
                          ┌────────────────────────┴────────────────────────┐
                          ▼                                                 ▼
                    Max Exceeded                                          Within Max
                          │                                                 │
                          ▼                                                 ▼
                    Apply Max                                        Apply Calculated
                          │                                                 │
                          └───────────────────────┬─────────────────────────┘
                                                  │
                                                  ▼
                                           Apply to Order
```

### Appendix C: Free Item Logic Flowchart

```
                    Start
                       │
                       ▼
              Get Free Item Voucher
                       │
                       ▼
           Check: Expired? / Void? / Active?
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
      Invalid                   Valid
           │                       │
           ▼                       ▼
      Return Error          Check Mode
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
         AUTO_ADD                               QUALIFY_FIRST
              │                                         │
              ▼                                         ▼
    Add Free Item to Cart                   Check Qualifier Items
    (Price = 0)                                    │
              │                        ┌─────────────┴─────────────┐
              │                        ▼                           ▼
              │                  Qualifying Items              No Qualifying
              │                        │                           │
              │                        ▼                           ▼
              │                  Make Qualifying           Return Error
              │                  Item Free                     (Prompt
              │                  (Price = 0)                   to add)
              │                        │
              └────────────────────────┤
                                       ▼
                                Mark Voucher Used
```

### Appendix D: Voucher Types Quick Reference

| Type | Code Prefix | Balance Tracking | Expiration | Tax Treatment | Rules |
|------|-------------|------------------|------------|---------------|-------|
| Gift Card | GC | Yes | Optional | After tax | None |
| Promo % | PR | No | Required | Before tax | Scope, Min, Max, Items |
| Promo Fixed | PR | No | Required | Before tax | Scope, Min, Max, Items |
| Promo Free | PR | No | Required | N/A | Mode, Qualifier |

### Appendix E: Related Documents

- PRD: Split Payment (for payment combination)
- PRD: End of Day (voucher reconciliation)
- API Documentation: Voucher Endpoints
