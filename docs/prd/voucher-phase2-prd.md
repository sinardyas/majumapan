# Product Requirements Document: Voucher Payment - Phase 2

## Document Information

| Attribute | Value |
|-----------|-------|
| **Feature** | Voucher Distribution & Customer Management |
| **Status** | Phase 2A: In Progress |
| **Version** | 1.1 |
| **Created** | 2026-01-28 |
| **Updated** | 2026-01-28 |
| **Priority** | P1 (Must Have) |
| **Phase** | 2 of 2 (Voucher Payment Feature) |

---

## 1A. Implementation Progress Tracking

### Completed ✅ (As of 2026-01-28)

| Task | Description | Status | Files |
|------|-------------|--------|-------|
| Database Schema | Added customers, customer_groups, message_templates, distribution_history tables | ✅ Done | `apps/api/src/db/schema.ts` |
| Migration File | Created SQL migration with default groups and templates | ✅ Done | `apps/api/drizzle/0012_phase2_customer_distribution.sql` |
| Customer Service | CRUD operations, lookup, auto-assignment logic | ✅ Done | `apps/api/src/services/customer-service.ts` |
| Customer API Routes | All 14 endpoints for customers, groups, vouchers | ✅ Done | `apps/api/src/routes/customers.ts` |
| Routes Mounted | Mounted customers route to API | ✅ Done | `apps/api/src/routes/index.ts` |
| Cleanup | Removed unused CustomerVouchers page and routes | ✅ Done | Deleted `apps/web/src/pages/CustomerVouchers.tsx` |

### Pending Implementation ⏳

| Task | Description | Effort |
|------|-------------|--------|
| Run Migration | Execute `0012_phase2_customer_distribution.sql` | - |
| Customer Management Page | List, search, add, edit, delete customers | 1 day |
| Customer Groups Page | CRUD groups with member counts | 0.5 day |
| Checkout Integration | Customer lookup at checkout | 0.5 day |
| Distribution Service | Template CRUD, WhatsApp/Email link generation | 1 day |
| Distribution API | Send distribution, history endpoints | 0.5 day |
| Distribution Page | Multi-step wizard UI | 1.5 days |
| Auto-Assignment Trigger | Update group on transaction completion | 0.25 day |

### Effort Summary

| Phase | Deliverables | Status | Effort |
|-------|--------------|--------|--------|
| 2A: Foundation | Database, API, Services | 70% | 2.5 days |
| 2B: Frontend Pages | Customers, Groups, Checkout | 0% | 3 days |
| 2C: Distribution | Service, API, Page | 0% | 3 days |
| **Remaining** | | | **~6.5 days** |

---

## 1. Executive Summary

### Overview

Phase 2 of the Voucher Payment feature adds customer management and voucher distribution capabilities. This enables businesses to build customer relationships through targeted promotional campaigns and provides a seamless checkout experience with customer recognition.

### Key Outcomes

- **Customer Database**: Track customers by phone number with auto-segmentation
- **Voucher Vault**: Customers have a "vault" of assigned vouchers
- **Distribution Channel**: Send vouchers via WhatsApp and Email
- **Auto-Assignment**: Customers automatically assigned to groups based on spend/visits
- **Seamless Checkout**: Optional customer lookup for personalized experience

### Quick Reference

| Aspect | Description |
|--------|-------------|
| **Customer ID** | Phone number (unique identifier) |
| **Customer Groups** | Bronze, Silver, Gold, VIP (auto-assigned) |
| **Auto-Assignment** | Real-time when transaction completes |
| **Voucher Assignment** | Manual, refund, or blast distribution |
| **Distribution Channels** | WhatsApp, Email, Print (QR) |
| **Message Templates** | 3-5 editable templates with variables |

---

## 2. Problem Statement

### Current State (After Phase 1)

| Scenario | Status |
|----------|--------|
| Create promotional vouchers | ✅ Manager can create via `/vouchers` page |
| Apply voucher at checkout | ✅ Staff uses VoucherEntryModal |
| Gift Card balance tracking | ✅ Implemented |
| Refund to Gift Card | ✅ Implemented |

### Gaps Identified

| Gap | Impact |
|-----|--------|
| No customer database | Can't build customer relationships |
| No voucher distribution | Can't send vouchers to customers |
| No customer segmentation | Can't target VIP customers |
| No customer vault | Customers can't "store" vouchers |

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-16 | Cashier | Ask for customer phone at checkout | Regular customers can earn rewards |
| US-17 | System | Auto-assign customer to group based on spend | VIP customers get better treatment |
| US-18 | Customer | Have vouchers assigned to my phone | I can use them across visits |
| US-19 | Manager | Send vouchers via WhatsApp | Customers receive promotions instantly |
| US-20 | Manager | Send vouchers via Email | Customers have digital record |
| US-21 | Manager | Create customer groups | I can target segments (VIP, new customers) |
| US-22 | Cashier | Select customer by phone | I can see their vouchers and apply one |
| US-23 | Manager | Edit message templates | I can customize voucher delivery |

---

## 3. Goals & Success Metrics

### Primary Goals

| Goal | Success Metric | Target |
|------|----------------|--------|
| Customer adoption | % of transactions with customer phone | 30-50% |
| VIP recognition | VIP customers auto-identified | 100% accuracy |
| Distribution reach | Vouchers sent vs redeemed | 20% redemption rate |
| Customer satisfaction | Repeat customer rate | +10% increase |

### Secondary Goals

- Clear customer history at checkout
- Personalized voucher offers
- Easy customer lookup by phone
- Multi-channel distribution

---

## 4. Requirements

### 4.1 Customer Management

#### 4.1.1 Customer Data Model

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `phone` | VARCHAR(20) | Yes | Unique, customer's phone number |
| `name` | VARCHAR(100) | No | Customer's name |
| `email` | VARCHAR(100) | No | Customer's email |
| `customer_group_id` | UUID | No | Reference to group |
| `total_spend` | DECIMAL | No | Lifetime spend (default: 0) |
| `visit_count` | INT | No | Number of visits (default: 0) |
| `created_at` | TIMESTAMP | Yes | First visit date |
| `updated_at` | TIMESTAMP | Yes | Last update |

#### 4.1.2 Customer Groups

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR(50) | Group name (e.g., "Bronze", "Silver", "Gold", "VIP") |
| `min_spend` | DECIMAL | Minimum lifetime spend to qualify |
| `min_visits` | INT | Minimum visits to qualify |
| `priority` | INT | Higher = more valuable (used for auto-assignment) |
| `created_at` | TIMESTAMP | Creation date |

**Default Groups:**

| Name | Min Spend | Min Visits | Priority |
|------|-----------|------------|----------|
| Bronze | Rp 0 | 1 | 0 |
| Silver | Rp 500,000 | 5 | 1 |
| Gold | Rp 1,000,000 | 10 | 2 |
| VIP | Rp 2,500,000 | 25 | 3 |

#### 4.1.3 Auto-Assignment Logic

When a customer completes a transaction:

```typescript
async function autoAssignGroup(customerId: string) {
  const customer = await getCustomer(customerId);
  const groups = await getGroupsOrderedByPriority();
  
  for (const group of groups) {
    if (customer.total_spend >= group.min_spend && 
        customer.visit_count >= group.min_visits) {
      await updateCustomer(customerId, { customer_group_id: group.id });
      return group;
    }
  }
  
  // Default to Bronze if no criteria met
  const bronze = await getGroupByName('Bronze');
  await updateCustomer(customerId, { customer_group_id: bronze.id });
}
```

**Trigger:** Real-time, immediately after transaction completion.

#### 4.1.4 Customer Management Page

**Path:** `/admin/customers` (Manager/Admin only)

| Feature | Description |
|---------|-------------|
| List customers | Table with phone, name, group, spend, visits, created |
| Search | By phone or name |
| Filter | By customer group |
| Add customer | Phone (required), name, email |
| Edit customer | Update name/email, manual group override |
| View details | Transaction history, assigned vouchers |
| Delete customer | Soft delete |

#### 4.1.5 Customer Groups Page

**Path:** `/admin/customer-groups` (Admin only)

| Feature | Description |
|---------|-------------|
| List groups | With member count |
| Create group | Name, min spend, min visits, priority |
| Edit group | Adjust rules (affects all members) |
| Delete group | Only if no customers assigned |

---

### 4.2 Checkout Integration

#### 4.2.1 Customer Lookup Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Customer (Optional)                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [ Phone Number ]  [ Search ]                                │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  If customer found:                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✓ John Doe                                         │   │
│  │     0812-3456-7890  │  Gold Member                 │   │
│  │     12 visits  │  Rp 1,500,000 total spend         │   │
│  │     3 vouchers available                           │   │
│  │                                                     │   │
│  │  [ Apply Customer ]    [ Change ]    [ Skip ]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  If customer NOT found:                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✗ Customer not found                              │   │
│  │                                                     │   │
│  │  [ Create New ]    [ Skip ]                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Customer's Voucher Vault

After customer is applied, staff can access their vouchers:

```
┌─────────────────────────────────────────────────────────────┐
│  John's Vouchers (3)                                   [X] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ○ GC50-KMJL-MNPQ-RSTU                                    │
│    Balance: Rp 50,000                                      │
│    [ Apply ]                                               │
│                                                              │
│  ○ PR20-OFF-COFFEE (20% off Coffee, max Rp 20k)            │
│    Expires: 28 Feb 2026                                    │
│    [ Apply ]                                               │
│                                                              │
│  ○ PR10-OFF-ALL (10% off entire order)                     │
│    Expires: 15 Mar 2026                                    │
│    [ Apply ]                                               │
│                                                              │
│                                                              │
│                                    [ Close ]                │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.3 New Customer Creation

```
┌─────────────────────────────────────────────────────────────┐
│  New Customer                                          [X] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Phone *     [ 0812-3456-7890 ]                            │
│  Name        [ ________________ ]                          │
│  Email       [ ________________ ]                          │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  [ Cancel ]                     [ Create Customer ]         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.3 Voucher Distribution

#### 4.3.1 Distribution Page

**Path:** `/admin/distribute` (Manager/Admin only)

**UI Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Distribute Vouchers                                      [?] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Choose Voucher                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ○ PR20-OFF-COFFEE                                [Select]│   │
│  │          20% off Coffee, max Rp 20k                       │   │
│  │          450 remaining  │  Expires: 28 Feb 2026           │   │
│  │                                                         │   │
│  │  ○ PR10-OFF-ALL                                     [Select]│   │
│  │          10% off entire order                             │   │
│  │          200 remaining  │  Expires: 15 Mar 2026           │   │
│  │                                                         │   │
│  │  ○ GC100-GIFT-XYZ                                  [Select]│   │
│  │          Rp 100,000 Gift Card                             │   │
│  │          50 remaining  │  No expiration                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 2: Select Recipients                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ( ) All Customers (156)                                │   │
│  │  (•) Customer Group: [ Gold ▾ ] (45)                    │   │
│  │          ○ All  ○ Bronze (60)  ○ Silver (35)            │   │
│  │          ○ Gold (45)  ○ VIP (6)                         │   │
│  │  ( ) Individual: [ Search phone... ▸ ]                  │   │
│  │          Result: John Doe (0812-3456-7890)               │   │
│  │          [ Add ]                                         │   │
│  │  ( ) Manual: [ 08123456789, 08987654321...          ]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Selected: 45 recipients                                        │
│                                                                 │
│  Step 3: Select Channels                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [x] WhatsApp    [x] Email    [ ] Print (QR Codes)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 4: Message Template                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Template: [ Casual (Default) ▾ ]  [ Preview ]  [ Edit ]│   │
│  │                                                         │   │
│  │  ══════════════════════════════════════════════════    │   │
│  │  Hey {name}! 🎉 Got something for you:                 │   │
│  │                                                         │   │
│  │  {code} = {discount}                                   │   │
│  │                                                         │   │
│  │  Use it before {expires}! See you soon! 🛒              │   │
│  │  ══════════════════════════════════════════════════    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                     [ Generate & Send ]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3.2 Message Templates

**Template Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `{name}` | Customer name | "John" |
| `{code}` | Voucher code | "PR20-OFF-COFFEE" |
| `{discount}` | Discount value | "20% off" |
| `{expires}` | Expiration date | "28 Feb 2026" |
| `{store_name}` | Store name | "Majumapan" |

**Default Templates:**

```typescript
const DEFAULT_TEMPLATES = [
  {
    id: 'formal',
    name: 'Formal',
    subject: 'Your Exclusive Voucher from {store_name}',
    message: `Hi {name}! 🎁 Here's your exclusive voucher from {store_name}:

CODE: {code}

{discount}
Valid until: {expires}

Show this message at checkout to redeem.

Best regards,
{store_name}`
  },
  {
    id: 'casual',
    name: 'Casual',
    subject: '🎁 Your voucher is here!',
    message: `Hey {name}! 🎉 Got something for you:

{code} = {discount}

Use it before {expires}! See you soon! 🛒`
  },
  {
    id: 'urgent',
    name: 'Limited Time',
    subject: '⏰ {name}, your voucher expires soon!',
    message: `⏰ {name}, your {discount} voucher expires soon!

CODE: {code}

Use it by {expires}. Don't miss out! 🛍️`
  }
];
```

**Template Editor Modal:**

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Template                                         [X] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Name:   [ Casual                                  ]        │
│                                                              │
│  Subject: [ {discount} voucher from {store_name}   ]        │
│                                                              │
│  Message:                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Hey {name}! 🎉 Got something for you:              │   │
│  │                                                     │   │
│  │ {code} = {discount}                                │   │
│  │                                                     │   │
│  │ Use it before {expires}! See you soon! 🛒           │   │
│  │                                                     │   │
│  │ Variables:                                          │   │
│  │ {name} - Customer name                              │   │
│  │ {code} - Voucher code                               │   │
│  │ {discount} - Discount value                         │   │
│  │ {expires} - Expiration date                         │   │
│  │ {store_name} - Store name                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [ Cancel ]                     [ Save Template ]            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Distribution Channels

**WhatsApp Integration**

Approach: Generate WhatsApp link (no API, no cost)

```typescript
function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/^0/, '62'); // Convert 08xx to 62xx
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
```

**Staff Workflow:**
1. Click "Generate & Send"
2. System generates individual links
3. Options:
   - Display QR codes for scanning
   - Copy links to clipboard
   - Open directly on desktop WhatsApp

**Email Integration**

Approach: `mailto:` link (client email opens)

```typescript
function generateMailToLink(
  emails: string[], 
  subject: string, 
  body: string
): string {
  return `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
```

**Print QR Codes (Optional)**

Generate printable QR codes for physical distribution:
- One QR per customer
- Contains the voucher code and customer name
- Print on stickers or paper for counter display

---

### 4.4 Data Requirements

#### 4.4.1 Database Tables

```sql
-- customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  email VARCHAR(100),
  customer_group_id UUID REFERENCES customer_groups(id),
  total_spend DECIMAL(15, 2) DEFAULT 0,
  visit_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- customer_groups table
CREATE TABLE customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  min_spend DECIMAL(15, 2) DEFAULT 0,
  min_visits INT DEFAULT 0,
  priority INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- message_templates table
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- distribution_history table
CREATE TABLE distribution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id),
  channel VARCHAR(20) NOT NULL, -- 'whatsapp', 'email', 'print'
  recipient_count INT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL
);
```

#### 4.4.2 Indexes

```sql
-- Customer lookup
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_group ON customers(customer_group_id);

-- Group ordering for auto-assignment
CREATE INDEX idx_customer_groups_priority ON customer_groups(priority DESC);

-- Template lookup
CREATE INDEX idx_templates_default ON message_templates(is_default) WHERE is_default = TRUE;
```

---

### 4.5 API Requirements

#### 4.5.1 Customer Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/customers` | List customers (paginated, filterable) |
| GET | `/api/v1/customers/:id` | Get customer by ID |
| GET | `/api/v1/customers/phone/:phone` | Get customer by phone |
| POST | `/api/v1/customers` | Create customer |
| PUT | `/api/v1/customers/:id` | Update customer |
| DELETE | `/api/v1/customers/:id` | Delete customer |
| GET | `/api/v1/customers/:id/vouchers` | Get customer's vouchers |

#### 4.5.2 Customer Group Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/customer-groups` | List groups with member counts |
| GET | `/api/v1/customer-groups/:id` | Get group by ID |
| POST | `/api/v1/customer-groups` | Create group |
| PUT | `/api/v1/customer-groups/:id` | Update group |
| DELETE | `/api/v1/customer-groups/:id` | Delete group |

#### 4.5.3 Distribution Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/distribution/templates` | List message templates |
| POST | `/api/v1/distribution/templates` | Create template |
| PUT | `/api/v1/distribution/templates/:id` | Update template |
| POST | `/api/v1/distribution/send` | Send distribution |
| GET | `/api/v1/distribution/history` | Get distribution history |

---

### 4.6 Frontend Requirements

#### 4.6.1 Pages

| Page | Path | Access | Description |
|------|------|--------|-------------|
| Customers | `/admin/customers` | Manager/Admin | Customer management |
| Customer Groups | `/admin/customer-groups` | Admin only | Group management |
| Distribute | `/admin/distribute` | Manager/Admin | Voucher distribution |

#### 4.6.2 Components

| Component | Location | Description |
|-----------|----------|-------------|
| CustomerLookup | `components/pos/CustomerLookup.tsx` | Checkout customer search |
| CustomerFormModal | `components/admin/CustomerFormModal.tsx` | Add/edit customer |
| GroupFormModal | `components/admin/GroupFormModal.tsx` | Add/edit group |
| TemplateEditor | `components/admin/TemplateEditor.tsx` | Edit message templates |
| DistributionWizard | `components/admin/DistributionWizard.tsx` | Multi-step distribution flow |
| CustomerVouchersModal | `components/pos/CustomerVouchersModal.tsx` | Show customer's vouchers |

#### 4.6.3 Services

| Service | File | Description |
|---------|------|-------------|
| customerApi | `services/customer.ts` | Customer API client |
| distributionApi | `services/distribution.ts` | Distribution API client |

---

### 4.7 Checkout Flow Updates

#### 4.7.1 Updated Checkout Sequence

```
1. Cart Complete
         │
         ▼
2. Customer Section (Optional)
   ┌─────────────────────────┐
   │ Phone: [ ______ ]       │
   │         [ Search ]      │
   └─────────────────────────┘
         │
         ▼ (if customer found)
3. Customer Details Shown
   ┌─────────────────────────┐
   │ John Doe - Gold Member  │
   │ [ Apply ] [ Change ]    │
   └─────────────────────────┘
         │
         ▼ (if applied)
4. Vouchers Available
   ┌─────────────────────────┐
   │ 3 vouchers in vault     │
   │ [ Apply Voucher ]       │
   └─────────────────────────┘
         │
         ▼
5. Continue to Payment
```

---

## 5. User Experience

### 5.1 Happy Path Scenarios

#### Scenario 1: New Customer Registration

1. Customer comes to checkout
2. Cashier asks: "Do you have a phone number for rewards?"
3. Customer provides phone number
4. Cashier enters phone → "Customer not found"
5. Cashier clicks "Create New"
6. Enters phone, name, email
7. Customer created with Bronze status
8. Transaction proceeds

#### Scenario 2: Returning Customer Lookup

1. Customer comes to checkout
2. Cashier asks phone number
3. Customer provides number
4. Cashier searches
5. System finds customer (Gold member)
6. Customer's 3 vouchers shown
7. Customer selects a voucher to apply
8. Discount applied, transaction continues

#### Scenario 3: VIP Auto-Assignment

1. Customer makes Rp 300,000 purchase
2. Total spend now Rp 1,200,000
3. Visit count now 12
4. Auto-assignment triggered
5. Customer promoted from Silver to Gold
6. Next visit shows Gold status

#### Scenario 4: Voucher Blast Distribution

1. Manager creates "20% off Coffee" promo
2. Opens Distribution page
3. Selects voucher
4. Selects "Gold" customer group (45 customers)
5. Selects WhatsApp + Email channels
6. Selects "Casual" template
7. Previews message
8. Clicks "Generate & Send"
9. 45 WhatsApp links generated
10. Manager sends to all customers

### 5.2 Error Handling

| Error | User Message | Resolution |
|-------|--------------|------------|
| Phone already exists | "This phone number is already registered" | Use "Change" to update existing |
| Customer not found | "Customer not found" | Create new or skip |
| No vouchers for customer | "No vouchers available" | Continue without voucher |
| Template save failed | "Failed to save template" | Try again |
| Distribution failed | "Failed to send to X customers" | Retry or contact admin |

---

## 6. Implementation Plan

### Phase 1: Customer Foundation (3.5 days)

| Task | Description | Effort |
|------|-------------|--------|
| Database schema | Add customers, customer_groups, message_templates tables | 0.5 day |
| Customer service | CRUD operations, lookup, auto-assignment | 1 day |
| Customer API routes | All customer endpoints | 0.5 day |
| Customer Groups service | CRUD, priority ordering | 0.5 day |
| Customer Groups API | All group endpoints | 0.5 day |
| Customers page | List, search, add, edit, delete | 1 day |
| Customer Groups page | List, create, edit, delete | 0.5 day |

### Phase 2: Checkout Integration (1.5 days)

| Task | Description | Effort |
|------|-------------|--------|
| Customer lookup component | Search by phone at checkout | 0.5 day |
| New customer creation | Add customer during checkout | 0.25 day |
| Customer vouchers modal | Show customer's vouchers at checkout | 0.5 day |
| Auto-assignment trigger | Update group after transaction | 0.25 day |

### Phase 3: Distribution Feature (4.5 days)

| Task | Description | Effort |
|------|-------------|--------|
| Distribution page UI | Multi-step wizard | 1.5 days |
| Recipient selection | All/Group/Individual/Manual | 1 day |
| Message templates service | CRUD operations | 0.5 day |
| Template editor | Edit/manage templates | 0.5 day |
| WhatsApp link generation | Generate links for each recipient | 0.5 day |
| Email link generation | Generate mailto links | 0.5 day |

### Phase 4: Testing & Polish (1 day)

| Task | Description | Effort |
|------|-------------|--------|
| Unit tests | Customer service, auto-assignment | 0.25 day |
| Integration tests | API endpoints | 0.25 day |
| E2E testing | Checkout flow, distribution | 0.25 day |
| Bug fixes | - | 0.25 day |

### Estimated Total: ~10.5 days

---

## 7. Dependencies

| Dependency | Description |
|------------|-------------|
| Phase 1 Voucher Payment | Requires voucher tables from Phase 1 |
| Dexie.js | Local database for offline customer cache |
| WhatsApp Web | Used via wa.me links (no API key needed) |
| Default mail client | Used via mailto: links (no backend needed) |

---

## 8. Out of Scope (Phase 2)

| Feature | Reason |
|---------|--------|
| WhatsApp Business API | Requires paid API account |
| SMS integration | Requires SMS gateway provider |
| Advanced segmentation | Complex criteria builder |
| Campaign analytics | Requires distribution tracking table |
| Push notifications | No mobile app |
| QR code printing | Physical printer integration |

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Phone number privacy | Medium | Store only what's provided, no PII in logs |
| Auto-assignment edge cases | Low | Manual override available |
| WhatsApp link spam | Medium | Rate limiting on distribution |
| Duplicate customers | Medium | Phone is unique constraint |

---

## 10. Acceptance Criteria

### Functional Acceptance Criteria

- [ ] Customers can be created with phone (required), name, email
- [ ] Customer lookup by phone returns correct customer
- [ ] Auto-assignment promotes customer to correct group
- [ ] Customer groups can be created with custom rules
- [ ] Voucher distribution page allows selecting voucher, recipients, channel, template
- [ ] WhatsApp links generate correctly for each recipient
- [ ] Email links generate correctly for each recipient
- [ ] Templates can be edited and saved
- [ ] Checkout shows customer lookup option
- [ ] Customer's vouchers appear in vault at checkout

### Non-Functional Acceptance Criteria

- [ ] Customer lookup response < 200ms
- [ ] Distribution page loads < 1s
- [ ] Auto-assignment completes within transaction commit
- [ ] Offline: Customer lookup works from local cache
- [ ] 100% accuracy in group assignment

### UI Acceptance Criteria

- [ ] Customer management page is intuitive
- [ ] Distribution wizard guides through steps
- [ ] Templates preview correctly
- [ ] Error messages are clear and actionable

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Customer Vault** | Collection of vouchers assigned to a customer |
| **Auto-Assignment** | Automatic customer group assignment based on rules |
| **Blast Distribution** | Sending vouchers to multiple customers at once |
| **Message Template** | Pre-defined message with variables for distribution |
| **Channel** | Distribution method (WhatsApp, Email, Print) |
| **Priority** | Customer group ordering for auto-assignment |

---

## 12. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-28 | POS Team | Initial document - Phase 2 Voucher Distribution |

---

## 13. Appendices

### Appendix A: Customer Group Priority Logic

```typescript
interface AutoAssignmentResult {
  customerId: string;
  previousGroupId: string | null;
  newGroupId: string;
  reason: string;
}

async function assignCustomerToGroup(customerId: string): Promise<AutoAssignmentResult> {
  const customer = await db.customers.findUnique({ where: { id: customerId } });
  const groups = await db.customer_groups.findMany({
    orderBy: { priority: 'desc' }
  });
  
  // Find highest priority group that matches criteria
  for (const group of groups) {
    if (customer.total_spend >= group.min_spend && 
        customer.visit_count >= group.min_visits) {
      
      if (customer.customer_group_id !== group.id) {
        const previousGroupId = customer.customer_group_id;
        
        await db.customers.update({
          where: { id: customerId },
          data: { customer_group_id: group.id }
        });
        
        return {
          customerId,
          previousGroupId,
          newGroupId: group.id,
          reason: `Promoted from ${previousGroupId || 'none'} to ${group.name}`
        };
      }
      break;
    }
  }
  
  return {
    customerId,
    previousGroupId: customer.customer_group_id,
    newGroupId: customer.customer_group_id,
    reason: 'No group change needed'
  };
}
```

### Appendix B: Distribution Link Generation

```typescript
interface DistributionRecipient {
  phone?: string;
  email?: string;
  name?: string;
}

interface MessageData {
  template: MessageTemplate;
  voucher: Voucher;
  customerName?: string;
}

function generateWhatsAppLink(recipient: DistributionRecipient, data: MessageData): string {
  const message = renderTemplate(data.template.message, {
    name: recipient.name || 'Customer',
    code: data.voucher.code,
    discount: formatDiscount(data.voucher),
    expires: formatDate(data.voucher.expiresAt),
    store_name: 'Majumapan'
  });
  
  const cleanPhone = (recipient.phone || '').replace(/^0/, '62');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function generateEmailLinks(recipients: DistributionRecipient[], data: MessageData): string {
  const emails = recipients
    .filter(r => r.email)
    .map(r => r.email!);
  
  const subject = renderTemplate(data.template.subject, {
    name: data.customerName || 'Customer',
    code: data.voucher.code,
    discount: formatDiscount(data.voucher),
    expires: formatDate(data.voucher.expiresAt),
    store_name: 'Majumapan'
  });
  
  const body = renderTemplate(data.template.message, {
    name: data.customerName || 'Customer',
    code: data.voucher.code,
    discount: formatDiscount(data.voucher),
    expires: formatDate(data.voucher.expiresAt),
    store_name: 'Majumapan'
  });
  
  return `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
```

---

## 14. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-28 | POS Team | Initial document - Full Phase 2 requirements |
| 1.1 | 2026-01-28 | POS Team | **Phase 2A Progress:** Added database schema, migration file, customer service, and API routes. Removed unused CustomerVouchers page. |
