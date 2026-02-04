# Product Requirements Document: Member Customer Integration for POS

**Document Version:** 1.1  
**Last Updated:** 2026-02-04  
**Status:** In Progress (Phases 1-2 Complete)  

---

## 1. Executive Summary

### Overview

Add member customer functionality to the POS system that allows:
- **Phone-based customer lookup** before starting a transaction
- **Auto-registration** of new customers with additional info collection
- **Member voucher access** from customer's voucher vault
- **Loyalty tracking** with customer reference in transactions

### Key Design Decisions

| Decision | Choice |
|----------|--------|
| Member Pricing | **None** - Members get benefits via vouchers/discounts only |
| Member Eligibility | **All members** - No group-specific restrictions |
| Registration Fields | Name (required) + Email (optional) |
| Default Group | Bronze (priority 0) |
| Implementation | **Phased** - Incremental rollout |

### Key Outcomes

| Outcome | Description |
|---------|-------------|
| Customer Identification | Each transaction can be linked to a member |
| Offline Support | Customer lookup works without network |
| Voucher Access | Cashiers can apply member's vouchers |
| Loyalty Tracking | Customer spend/visit counts updated |

---

## 2. Current State Analysis

### 2.1 Existing Customer System (Admin)

**Customer Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `phone` | varchar(20) | Unique, required |
| `name` | varchar(100) | Optional |
| `email` | varchar(100) | Optional |
| `customerGroupId` | uuid | FK to groups |
| `totalSpend` | decimal | Cumulative spending |
| `visitCount` | integer | Number of visits |

**Customer Groups:**
| Tier | Priority | Default |
|------|----------|---------|
| Bronze | 0 | Yes |
| Silver | 1 | No |
| Gold | 2 | No |
| VIP | 3 | No |

**Auto-Assignment:** Customers upgraded based on `minSpend` + `minVisits` thresholds.

---

### 2.2 Current Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| Customers NOT synced to IndexedDB | No offline lookup | High |
| CustomerLookup not integrated | Cashiers can't identify members | High |
| No customerId in transactions | No loyalty tracking | High |
| No additional registration flow | Can't capture new member info | Medium |

---

## 3. Functional Requirements

### 3.1 Customer Lookup Flow

```
Preconditions:
- Cart has items (or empty cart)
- Cashier initiates transaction

Steps:
1. Customer Lookup Modal appears
2. Cashier enters phone number (10-20 digits)
3. System searches for matching customer:
   a) Online: Query API `/api/v1/customers/phone/:phone`
   b) Offline: Search local IndexedDB

Scenario A - Customer Found:
4a. Display customer info:
    - Name (or "Member" if no name)
    - Phone (masked)
    - Group badge (e.g., "Gold Member")
    - Visit count and total spend
    - Available vouchers
5a. Cashier can:
    - Apply member vouchers
    - Proceed to checkout
    - Skip (continue without customer)
    - Clear selection

Scenario B - Customer NOT Found:
4b. Show "Register New Member" option
5b. Cashier asks for additional info:
    - Full name (required)
    - Email (optional)
6b. Customer created with:
    - Phone from lookup
    - Provided name/email
    - Auto-assigned to Bronze group
7b. Display new member info
8b. Proceed with transaction

Alternative:
4c. Cashier can "Skip" to continue without customer
```

### 3.2 Voucher Integration

**Customer Vouchers Display:**
```
┌─────────────────────────────────────────┐
│ Member Vouchers (3 available)             │
├─────────────────────────────────────────┤
│ ☑ SAVE10 - 10% off           [Apply]   │
│ ☑ GIFTCARD50 - Balance: $50   [Apply]   │
│ ☑ BUY1GET1 - Free item        [Apply]   │
└─────────────────────────────────────────┘
```

**Voucher Application:**
- Applied at checkout via existing VoucherEntryModal
- Same voucher flow as existing
- Customer's available vouchers fetched by phone

---

## 4. User Interface Design

### 4.1 Customer Lookup Modal

```
┌─────────────────────────────────────────────────────────┐
│                    Member Lookup                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   Phone Number                                           │
│   ┌─────────────────────────────────────────────────┐   │
│   │ 081234567890                                 [X] │   │
│   └─────────────────────────────────────────────────┘   │
│                                                          │
│   ┌──────────────────┐  ┌──────────────────┐           │
│   │   [Search]       │  │   [Skip]         │           │
│   └──────────────────┘  └──────────────────┘           │
│                                                          │
│   ──────────────────────────────────────────────────    │
│                                                          │
│   [RESULT: Customer Found]                               │
│   ┌─────────────────────────────────────────────────┐   │
│   │ 👤 John Doe                                     │   │
│   │ 📱 ****567890                                   │   │
│   │ 🏆 Gold Member (Visit: 15, Spend: $1,250)      │   │
│   │ 🎁 3 Vouchers Available                         │   │
│   │                                                  │   │
│   │ ☑ VOUCHER10 - 10% off            [Apply]    │   │
│   │ ☑ VOUCHER25 - $25 off              [Apply]  │   │
│   │ ☑ GIFTCARD100 - Balance: $100       [Apply]  │   │
│   └─────────────────────────────────────────────────┘   │
│                                                          │
│   [Continue as Member]    [Skip]    [Clear]              │
└─────────────────────────────────────────────────────────┘
```

### 4.2 New Member Registration

```
┌─────────────────────────────────────────────────────────┐
│               Register New Member                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   Phone: 081234567890 (auto-filled from lookup)         │
│                                                          │
│   Full Name *                                            │
│   ┌─────────────────────────────────────────────────┐   │
│   │ John Doe                                         │   │
│   └─────────────────────────────────────────────────┘   │
│                                                          │
│   Email (Optional)                                       │
│   ┌─────────────────────────────────────────────────┐   │
│   │ john@example.com                                │   │
│   └─────────────────────────────────────────────────┘   │
│                                                          │
│   ┌──────────────────┐  ┌──────────────────┐           │
│   │   [Cancel]       │  │   [Register]     │           │
│   └──────────────────┘  └──────────────────┘           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Cart with Member Vouchers

```
┌─────────────────────────────────────────┐
│ 🛒 Current Order                  [+]: │
├─────────────────────────────────────────┤
│ ☑ Wireless Earbuds                 1× │
│      $49.99                                │
│                                    $49.99 │
├─────────────────────────────────────────┤
│ ☑ USB-C Cable                       2× │
│      $12.99                                │
│                                    $25.98 │
├─────────────────────────────────────────┤
│ 👤 Member: John Doe (Gold)               │
│ ─────────────────────────────────────────│
│ Vouchers Applied:                       │
│ ☑ SAVE10 (10% off)            -$7.60    │
│ ─────────────────────────────────────────│
│ Subtotal:                              $75.97│
│ Discount:                              $7.60 │
│ Tax (10%):                            $6.84 │
│ TOTAL:                                $75.21 │
├─────────────────────────────────────────┤
│ [💳 Pay $75.21]                           │
└─────────────────────────────────────────┘
```

---

## 5. Data Model

### 5.1 LocalTransaction - Add Customer Fields

```typescript
interface LocalTransaction {
  // ... existing fields ...

  // NEW FIELDS:
  customerId?: string;           // Reference to customer
  customerName?: string;         // Denormalized for receipts
  customerPhone?: string;        // Denormalized for receipts
  customerGroupId?: string;     // For reporting/analytics
}
```

### 5.2 CartStore - Add Customer State

```typescript
interface CartState {
  // ... existing ...

  // NEW:
  selectedCustomer: Customer | null;

  // Methods:
  setSelectedCustomer: (customer: Customer) => void;
  clearSelectedCustomer: () => void;
}
```

### 5.3 Customer Interface

```typescript
interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  customerGroupId: string | null;
  totalSpend: string;
  visitCount: number;
  group?: CustomerGroup | null;
  vouchers?: CustomerVoucher[];  // Loaded on demand
}

interface CustomerVoucher {
  id: string;
  code: string;
  type: 'GC' | 'PR';
  discountType?: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
  value?: string;
  currentBalance?: string;
  minPurchase?: string;
  expiresAt?: string | null;
}
```

---

## 6. Technical Implementation

### 6.1 Phased Implementation Plan

#### Phase 1: Database & Sync (Offline Support) ✅ COMPLETED
| File | Change |
|------|--------|
| `apps/web/src/db/index.ts` | Add customer tables to IndexedDB |
| `apps/web/src/services/sync.ts` | Add customer and customerGroups to sync |

#### Phase 2: Customer Lookup Service ✅ COMPLETED
| File | Change |
|------|--------|
| `apps/web/src/services/customer-lookup.ts` | Hybrid online/offline lookup (NEW) |
| `apps/web/src/db/index.ts` | Add IndexedDB stores |

#### Phase 3: Customer Lookup UI
| File | Change |
|------|--------|
| `apps/web/src/components/pos/CustomerLookup.tsx` | Enhance for full workflow |
| `apps/web/src/components/pos/CustomerRegistration.tsx` | New registration modal |

#### Phase 4: Cart Integration
| File | Change |
|------|--------|
| `apps/web/src/stores/cartStore.ts` | Add customer state |
| `apps/web/src/components/pos/CurrentOrder.tsx` | Show member info |

#### Phase 5: POS Integration
| File | Change |
|------|--------|
| `apps/web/src/pages/POS.tsx` | Integrate lookup before payment |
| `apps/web/src/components/pos/PaymentModal.tsx` | Pass customer to transaction |

#### Phase 6: Receipt & Transaction
| File | Change |
|------|--------|
| `apps/web/src/components/pos/Receipt.tsx` | Print member info |
| `apps/web/src/pages/Transactions.tsx` | Show customer in transaction detail |

---

### 6.2 IndexedDB Schema

```typescript
// apps/web/src/db/index.ts

export interface LocalCustomer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  customerGroupId: string | null;
  totalSpend: string;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'synced' | 'pending_create' | 'pending_update';
}

export interface LocalCustomerGroup {
  id: string;
  name: string;
  minSpend: string;
  minVisits: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// Schema version 8:
this.version(8).stores({
  // ... existing ...
  customers: 'id, phone, customerGroupId, syncStatus',
  customerGroups: 'id, priority',
});
```

---

### 6.3 Customer Service (Hybrid Lookup)

```typescript
// apps/web/src/services/customer.ts

class CustomerService {
  async findByPhone(phone: string): Promise<Customer | null> {
    // Try local first
    const local = await this.getLocalByPhone(phone);
    if (local) {
      return this.enrichWithGroup(local);
    }

    // Online fallback
    if (navigator.onLine) {
      const result = await this.api.getByPhone(phone);
      if (result.success && result.data) {
        await this.cacheCustomer(result.data);
        return result.data;
      }
    }

    return null;
  }

  async register(data: { phone: string; name: string; email?: string }): Promise<Customer> {
    // Create online first
    const result = await this.api.create(data);
    if (result.success && result.data) {
      await this.cacheCustomer(result.data);
      return result.data;
    }

    // Offline: create pending sync
    const pending = await this.createPending(data);
    return pending;
  }

  async getVouchers(customerId: string): Promise<CustomerVoucher[]> {
    // Try local cache first
    // Fall back to API if online
  }
}

export const customerService = new CustomerService();
```

---

### 6.4 Customer Lookup Modal Component

```typescript
// apps/web/src/components/pos/CustomerLookupModal.tsx

interface CustomerLookupModalProps {
  isOpen: boolean;
  onSelect: (customer: Customer) => void;
  onSkip: () => void;
  onClose: () => void;
}

export function CustomerLookupModal({ ... }: CustomerLookupModalProps) {
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  const handleSearch = async () => {
    setIsLoading(true);
    const result = await customerService.findByPhone(phone);
    if (result) {
      setCustomer(result);
      setShowRegistration(false);
    } else {
      setShowRegistration(true);
    }
    setIsLoading(false);
  };

  const handleRegister = async (data: { name: string; email?: string }) => {
    const newCustomer = await customerService.register({ phone, ...data });
    setCustomer(newCustomer);
    setShowRegistration(false);
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      {/* Phone input */}
      {/* Search button */}
      {/* Result display or registration form */}
    </Modal>
  );
}
```

---

## 7. Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| Offline, customer not in local DB | Show error, allow offline registration |
| Online, no network for registration | Allow offline registration, sync later |
| No customer selected | Allow checkout without customer |
| Customer lookup empty phone | Show validation error |
| Duplicate phone on registration | Show error, suggest lookup |
| Voucher validation fails | Show error, remove voucher |
| Customer has no group | Assign Bronze by default |

---

## 8. Dependencies

### Integration Points

- `apps/api/src/routes/customers.ts` - Customer API (existing)
- `apps/web/src/db/index.ts` - IndexedDB schema
- `apps/web/src/stores/cartStore.ts` - Cart state
- `apps/web/src/pages/POS.tsx` - POS integration
- `apps/web/src/components/pos/Receipt.tsx` - Receipt output
- `apps/web/src/pages/Transactions.tsx` - Transaction detail

---

## 9. Testing Requirements

### Unit Tests

```typescript
describe('Customer Lookup', () => {
  it('finds customer by phone (online)');
  it('falls back to local lookup (offline)');
  it('shows registration modal when customer not found');
  it('validates phone format');
});

describe('Customer Registration', () => {
  it('creates customer with phone and name');
  it('validates required fields');
  it('syncs new customer when online');
});

describe('Cart Integration', () => {
  it('stores selected customer in cart');
  it('clears customer when cleared');
});
```

### Integration Tests

- [ ] End-to-end customer lookup flow
- [ ] Offline customer lookup
- [ ] Customer vouchers displayed
- [ ] Transaction saved with customer reference
- [ ] Receipt shows member info

---

## 10. Rollout Plan

### Phase 1: Database & Sync ✅ COMPLETED
- Add customer tables to IndexedDB
- Implement customer sync from server

**Files Modified:**
| File | Changes |
|------|---------|
| `apps/web/src/db/index.ts` | Added customer tables to IndexedDB schema (version 8) |

**Added to IndexedDB:**
- `customers` table - Stores customers with sync status
- `customerGroups` table - Stores customer groups
- `customerVouchers` table - Stores customer vouchers

---

### Phase 2: Customer Lookup ✅ COMPLETED
- Create customer lookup service
- Implement hybrid online/offline lookup

**Files Created:**
| File | Description |
|------|-------------|
| `apps/web/src/services/customer-lookup.ts` | Hybrid online/offline lookup service |

**Files Modified:**
| File | Changes |
|------|---------|
| `apps/web/src/services/sync.ts` | Added customer sync to fullSync() and pullChanges() |

**Customer Lookup Service Features:**
- `findByPhone(phone)` - Find customer by phone (online/offline)
- `register(data)` - Register new customer (online with offline fallback)
- `getVouchers(customerId)` - Get customer's vouchers

---

### Phase 3: Customer Registration
- Create registration modal
- Handle online and offline registration

### Phase 4: Cart & POS Integration
- Add customer state to cart
- Integrate lookup before payment

### Phase 5: Receipt & Transaction
- Print member info on receipts
- Show customer in transaction detail

---

## 11. Glossary

| Term | Definition |
|------|------------|
| Member | Customer with a registered account |
| Customer Lookup | Phone-based customer identification |
| Offline Lookup | Local IndexedDB search when offline |
| Pending Sync | Local changes waiting for server sync |

---

## 12. Related Documents

| Document | Description |
|----------|-------------|
| [Admin Customers](../apps/admin/src/pages/Customers.tsx) | Customer management |
| [Customer API](../apps/api/src/routes/customers.ts) | API endpoints |
| [POS Page](../apps/web/src/pages/POS.tsx) | Main POS interface |
| [Voucher Service](../apps/web/src/services/voucher.ts) | Voucher handling |

---

## 13. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-04 | Initial draft |
| 1.1 | 2026-02-04 | Implemented Phases 1 & 2: Database schema, sync service, customer lookup service |

---

**Document End**
