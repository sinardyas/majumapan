# Product Requirements Document: Member Customer Integration for POS

**Document Version:** 1.5  
**Last Updated:** 2026-02-05  
**Status:** Completed (All Phases Complete - UX Updated)  

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

**UX Approach:** Inline lookup in CartSidebar (optional, non-blocking)

```
Preconditions:
- Cart has items (or empty cart)
- Cashier adds items to cart

Steps:
1. Member Lookup section visible in CartSidebar below header
2. Phone input always visible - cashier can enter number or leave blank
3. Cashier clicks "Lookup" or presses Enter
4. System searches for matching customer:
   a) Online: Query API `/api/v1/customers/phone/:phone`
   b) Offline: Search local IndexedDB

Scenario A - Customer Found:
5a. Display customer info inline:
    - Name (or "Member" if no name)
    - Phone number
    - Group badge (e.g., "Gold Member")
    - Clear (X) button to remove selection
6a. Customer automatically associated with transaction
7a. Cashier proceeds with payment

Scenario B - Customer NOT Found:
5b. Show error message: "Customer not found. Leave blank to skip."
6b. Cashier can:
    - Enter different phone number
    - Leave blank to continue without customer

Scenario C - No Customer Selected (Default):
- Phone input left blank
- Transaction proceeds without customer reference
- Cashier simply continues to payment
```

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

### 4.1 Member Lookup Section (Inline in CartSidebar)

```
┌─────────────────────────────────────────────────────────┐
│ 🛒 Current Order                                   [+]: │
├─────────────────────────────────────────────────────────┤
│ 👤 Member Lookup (Optional)                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📞 [Enter phone number...]                    [Lookup]│ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ☑ Wireless Earbuds                                 1×  │
│      $49.99                                              │
├─────────────────────────────────────────────────────────┤
│ ☑ USB-C Cable                                       2×  │
│      $12.99                                              │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Always visible below Current Order header
- Phone input field with "Lookup" button
- Optional - leave blank to skip member lookup
- Inline customer display when found (yellow badge)

### 4.2 Customer Found State

```
┌─────────────────────────────────────────────────────────┐
│ 🛒 Current Order                                   [+]: │
├─────────────────────────────────────────────────────────┤
│ 👤 Member Lookup (Optional)                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ⭐ John Doe • Gold Member                    [✕]     │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ☑ Item 1                                            1×  │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Yellow background highlight
- Star icon + name + tier badge
- Clear (X) button to remove customer
```
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

#### Phase 3: Customer Lookup UI ✅ COMPLETED
| File | Change |
|------|--------|
| `apps/web/src/components/pos/CustomerLookupModal.tsx` | Customer lookup modal component (NEW) |
| `apps/web/src/services/customer-lookup.ts` | Hybrid lookup service |

#### Phase 4: Cart Integration ✅ COMPLETED
| File | Change |
|------|--------|
| `apps/web/src/stores/cartStore.ts` | Added `selectedCustomer` state and actions |
| `apps/web/src/components/pos/CurrentOrder.tsx` | Show member info in order header |

#### Phase 5: POS Integration ✅ COMPLETED
| File | Change |
|------|--------|
| `apps/web/src/pages/POS.tsx` | Integrated lookup before payment flow |
| `apps/web/src/components/pos/MemberLookupSection.tsx` | Inline member lookup component (NEW) |

#### Phase 6: Receipt & Transaction ✅ COMPLETED
| File | Change |
|------|--------|
| `apps/web/src/db/index.ts` | Added customer fields to LocalTransaction |
| `apps/web/src/pages/POS.tsx` | Include customer in transaction, update stats |
| `apps/web/src/components/pos/Receipt.tsx` | Print member info on receipt |
| `apps/web/src/pages/Transactions.tsx` | Display member info in transaction detail modal |

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

### Phase 3: Member Lookup UI ✅ COMPLETED
- Create inline MemberLookupSection component
- Display in CartSidebar below header

**Files Created:**
| File | Description |
|------|-------------|
| `apps/web/src/components/pos/MemberLookupSection.tsx` | Inline member lookup component |

**Features:**
- Compact phone input field
- Inline customer display with tier badge
- Clear button to remove selection
- Always visible, optional input

---

### Phase 4: Cart Integration ✅ COMPLETED
- Integrate MemberLookupSection into CurrentOrder
- Remove CustomerLookupModal component

**Files Modified:**
| File | Changes |
|------|---------|
| `apps/web/src/components/pos/CurrentOrder.tsx` | Added MemberLookupSection below header |
| `apps/web/src/components/pos/CustomerLookupModal.tsx` | Deleted (replaced by inline component) |

---

### Phase 5 & 6: Receipt & Transaction ✅ COMPLETED
| `apps/web/src/components/pos/CustomerLookupModal.tsx` | Removed (replaced by inline component) |

---

### Phase 5 & 6: Receipt & Transaction ✅ COMPLETED
- Customer fields added to transaction record
- Member info printed on receipts
- Customer stats (totalSpend, visitCount) updated after transaction

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
| 1.2 | 2026-02-05 | Implemented Phases 3-5: Customer lookup modal, cart integration, POS integration |
| 1.3 | 2026-02-05 | Completed all phases: Receipt integration, transaction customer fields, stats update |
| 1.4 | 2026-02-05 | UX Updated: Replaced modal with inline MemberLookupSection in CartSidebar |
| 1.5 | 2026-02-05 | Added member info display in Transaction Detail modal |

---

**Document End**
