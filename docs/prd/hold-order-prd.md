# Product Requirements Document: Hold Order

**Document Version:** 1.0
**Last Updated:** 2026-01-03
**Status:** Implemented
**Prepared By:** Product & Engineering Team
**Related Document:** [Feature Specification (FSD)](features/hold-order.md) - For technical implementation details

---

## 1. Executive Summary

The Hold Order feature allows cashiers to temporarily save an in-progress order and serve other customers. This is essential for scenarios where a customer needs to step away (e.g., forgot wallet, needs to get more items, waiting for someone) but intends to return and complete their purchase.

### Key Outcomes

- **Workflow Continuity**: Cashiers can serve other customers without losing pending orders
- **Customer Flexibility**: Customers can pause transactions and resume when ready
- **Operational Efficiency**: No lost sales from interrupted transactions
- **Data Integrity**: Held orders persist across page refreshes and browser sessions

### Value Proposition

In a busy retail environment, transactions are frequently interrupted. Customers may need to check their wallet, ask a family member for approval, or grab additional items. The Hold Order feature enables cashiers to seamlessly manage these interruptions without losing cart data, reducing friction and preserving the customer relationship.

### Quick Reference

| Aspect | Description |
|--------|-------------|
| Hold Duration | 24 hours (auto-expires) |
| Storage | IndexedDB (local, offline-capable) |
| Visibility | Cashier-scoped (only see own orders) |
| Discount Handling | Re-validated on resume |
| Customer Data | Optional name and note |
| Expiration | Automatic cleanup on page load |

> **Technical Details**: See [Feature Specification](features/hold-order.md) for architecture, implementation, and code references.

---

## 2. Problem Statement

### Current Challenges

Before Hold Order was implemented, checkout operations faced several challenges:

| Challenge | Impact |
|-----------|--------|
| **Lost cart data on interruption** | Cashiers had to re-enter items when customers stepped away |
| **No pending order management** | Could not queue customers while serving others |
| **Lost sales** | Customers left without completing purchase due to interruptions |
| **Manual tracking** | Cashiers used paper notes or memory to track pending orders |
| **Discount expiration issues** | Expired discounts applied without validation |

### User Pain Points

1. **Cashiers**: Re-enter items after interruptions, manage multiple pending orders manually
2. **Customers**: Feel rushed, may leave without completing purchase
3. **Store Managers**: No visibility into pending orders or interrupted transactions
4. **Business**: Lost sales from abandoned transactions

### Market Context

Modern POS systems universally include hold/suspend order functionality. Customers expect the ability to pause transactions, especially in retail environments where comparison shopping or payment method issues are common.

---

## 3. Goals & Objectives

### Primary Goals

| Goal | Success Metric |
|------|----------------|
| Enable order pausing | 100% of interrupted transactions can be held |
| Data persistence | Held orders survive page refresh/crash |
| Auto-cleanup | Expired orders removed within 24h + 1 load |
| Discount integrity | No expired discounts applied on resume |

### Secondary Objectives

- Reduce cashier friction during interruptions
- Improve customer experience during paused transactions
- Minimize lost sales from abandoned transactions
- Maintain offline-first architecture consistency

---

## 4. User Personas

### Persona 1: Retail Cashier

**Profile:** Employee operating the POS system
**Goals:**
- Process transactions quickly and accurately
- Serve multiple customers efficiently
- Keep track of pending orders

**Behaviors:**
- Uses hold feature when customers step away
- Reviews held orders list when customer returns
- Relies on badge count to know pending orders exist

**Frustrations:**
- Re-entering items after interruptions
- Losing track of pending orders
- Managing multiple paused transactions

### Persona 2: Store Manager

**Profile:** Responsible for store operations and sales
**Goals:**
- Ensure smooth checkout operations
- Minimize lost sales
- Monitor pending order trends

**Behaviors:**
- Reviews held orders indirectly through cashier reports
- Sets expectations for hold duration
- Monitors discount re-validation patterns

**Frustrations:**
- No visibility into pending transactions
- Lost sales from unmanaged interruptions
- Discount policy violations from expired discounts

### Persona 3: Retail Customer

**Profile:** End customer with interrupted transaction
**Goals:**
- Complete purchase when ready
- Not feel rushed during checkout
- Preserve their cart items

**Behaviors:**
- Steps away to get payment method
- Returns within reasonable time
- Expects cart to be preserved

**Frustrations:**
- Feeling rushed to complete purchase
- Cart items lost when stepping away
- Having to re-select products

---

## 5. Functional Requirements

### 5.1 Hold Order Requirements

| Requirement | Description |
|-------------|-------------|
| Hold button | Accessible in cart section when items present |
| Optional customer name | Text input for customer reference |
| Optional note | Textarea for order notes (e.g., "Went to ATM") |
| Cart snapshot | Full cart state saved at hold time |
| Auto-naming | Default name "Order at [time]" if no customer name |
| Expiration | 24 hours from hold time |
| Success feedback | Toast notification on successful hold |

### 5.2 Resume Order Requirements

| Requirement | Description |
|-------------|-------------|
| Held orders list | Modal showing all held orders for current cashier |
| Filter by cashier | Only shows orders held by logged-in cashier |
| Order by time | Most recent orders shown first |
| Item count | Shows number of items and total |
| Customer name | Displays if provided during hold |
| Note display | Shows note if provided during hold |
| Time since hold | Relative time (e.g., "5 minutes ago") |
| Resume action | Restores held order to cart |
| Delete action | Removes held order from storage |

### 5.3 Cart Replacement Requirements

| Requirement | Description |
|-------------|-------------|
| Empty cart resume | Resumes immediately without confirmation |
| Non-empty cart | Shows confirmation modal before replacing |
| Confirmation message | Warns about current cart data loss |
| Cancel option | Returns to list without changes |
| Replace option | Clears current cart, loads held order |

### 5.4 Discount Re-validation Requirements

| Requirement | Description |
|-------------|-------------|
| Check validity | Validates discount still exists and active |
| Date range check | Checks startDate and endDate |
| Usage limit check | Verifies usageCount < usageLimit |
| Invalid discount | Removed from order with warning toast |
| Valid discount | Applied as originally held |

### 5.5 Expiration Requirements

| Requirement | Description |
|-------------|-------------|
| 24-hour expiry | Orders expire 24 hours after hold |
| Auto-cleanup | Expired orders deleted on POS page load |
| Query filtering | List query excludes expired orders |
| No manual expiry | Users cannot manually expire orders |

### 5.6 Delete Requirements

| Requirement | Description |
|-------------|-------------|
| Delete button | Inline action on each held order |
| Confirmation | Inline modal confirmation before delete |
| Irreversible | Delete cannot be undone |
| Toast feedback | Notification on successful deletion |

### 5.7 Badge Requirements

| Requirement | Description |
|-------------|-------------|
| Count display | Shows number of held orders |
| Cart header | Badge on held orders icon button |
| Updates on change | Count updates after hold/resume/delete |
| Empty state | No badge when zero held orders |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|-------------|--------|
| Hold operation | < 100ms |
| Resume operation | < 200ms (includes discount validation) |
| List load | < 100ms |
| Expiration cleanup | < 50ms |

### 6.2 Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 15+ |
| Edge | 90+ |

### 6.3 Reliability

| Requirement | Description |
|-------------|-------------|
| Data persistence | Survives page refresh and browser crash |
| Offline operation | Fully functional without network |
| Auto-cleanup | No accumulated expired orders |
| Type safety | Full TypeScript interfaces |

### 6.4 Security

| Requirement | Description |
|-------------|-------------|
| Cashier isolation | Each cashier sees only their own orders |
| No server sync | Held orders stay local |
| Authentication | Protected by existing auth system |

---

## 7. User Flows

### Flow 1: Hold an Order

```
Preconditions:
- Cashier is logged into POS
- Cart has at least one item
- Customer needs to step away temporarily

Steps:
1. Cashier clicks [Hold Order] button in cart section
2. HoldOrderModal appears with fields:
   - Customer name (optional, placeholder: "Customer name or reference")
   - Note (optional, placeholder: "Add a note...")
3. Cashier optionally enters:
   - Customer name: "John - Table 5"
   - Note: "Went to ATM for cash"
4. Cashier clicks [Hold Order]
5. System:
   - Generates UUID for held order
   - Sets heldAt = now
   - Sets expiresAt = heldAt + 24 hours
   - Snapshots cart items, discounts, totals
   - Saves to IndexedDB heldOrders table
   - Clears current cart
6. Toast appears: "Order held successfully"
7. Held orders badge updates (count + 1)
8. Cashier can now serve next customer

Expected Outcome:
- Held order persisted in IndexedDB
- Cart cleared for new transaction
- Badge shows updated count
```

### Flow 2: Resume an Order (Empty Cart)

```
Preconditions:
- Cashier has held orders
- Current cart is empty

Steps:
1. Cashier clicks held orders icon button in cart header
2. HeldOrdersList modal opens
3. Shows list filtered to current cashier's orders
4. Each order shows:
   - Customer name or "Order at [time]"
   - Item count and total
   - Relative time (e.g., "5 minutes ago")
   - Note if provided
5. Cashier clicks [Resume] on desired order
6. System:
   - Fetches held order from IndexedDB
   - Re-validates discount (if any)
   - Loads items into cart
   - Deletes held order from IndexedDB
7. Modal closes
8. Cart header shows: "Resumed: [customer name or time]"
9. Toast appears: "Order resumed"
10. Cashier completes payment as normal

Expected Outcome:
- Held order restored to cart
- All items, quantities, prices correct
- Discount applied if still valid
- Held order removed from storage
```

### Flow 3: Resume an Order (Cart Has Items)

```
Preconditions:
- Cashier has held orders
- Current cart has at least one item

Steps:
1. Cashier clicks held orders icon button in cart header
2. HeldOrdersList modal opens
3. Cashier clicks [Resume] on a held order
4. ResumeConfirmModal appears:
   - Warning icon
   - Message: "Your current cart has X items ($Y). This will be cleared."
   - Buttons: [Cancel] [Replace Cart]
5a. If [Cancel]:
   - Modal closes
   - No changes to cart or held order
5b. If [Replace Cart]:
   - Current cart cleared (not held)
   - Held order loaded into cart
   - Held order deleted from IndexedDB
6. Toast appears: "Order resumed"
7. Cart header shows resumed indicator

Expected Outcome:
- Cashier confirms before losing current cart
- Held order replaces current cart
- Previous cart items discarded
```

### Flow 4: Discount Re-validation Warning

```
Preconditions:
- Held order had a discount applied
- Discount has expired or become invalid

Steps:
1. Cashier resumes order that had discount
2. System checks discount validity:
   - Discount exists in database?
   - Is still active?
   - Within valid date range?
   - Under usage limit?
3. Discount is invalid (e.g., expired endDate)
4. System:
   - Loads cart items WITHOUT discount
   - Recalculates totals
   - Applies no discount
5. Toast warning appears:
   "Discount 'SUMMER15' is no longer valid and was removed"
6. Cashier can apply new discount if needed

Expected Outcome:
- No invalid discounts applied
- Customer informed via cashier about expired discount
- Cart totals recalculated correctly
```

### Flow 5: Delete a Held Order

```
Preconditions:
- Cashier has held orders
- Customer will not return or order is cancelled

Steps:
1. Cashier opens HeldOrdersList modal
2. Clicks [Delete] on an order
3. Inline confirmation appears within the order card:
   "Delete this held order? This cannot be undone."
   Buttons: [Cancel] [Delete]
4. Clicks [Delete]
5. System deletes order from IndexedDB
6. Toast appears: "Held order deleted"
7. List updates (count decremented)
8. Badge updates

Expected Outcome:
- Held order permanently removed
- No orphaned data
- Cashier can confirm before deleting
```

### Flow 6: Auto-Expiration Cleanup

```
Preconditions:
- Some held orders have expired (> 24 hours)

Steps:
1. Cashier opens POS page
2. System runs cleanup on mount:
   - Queries heldOrders where expiresAt < now
   - Deletes all expired orders
3. Expired orders not shown in HeldOrdersList
4. Cleanup happens silently (no toast)

Expected Outcome:
- No expired orders in list
- Storage doesn't accumulate stale data
- Cashier unaffected by cleanup process
```

---

## 8. UI/UX Requirements

### 8.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Current Order                                      [📋 (2)]│  ← Badge icon
│ (Resumed: John - Table 5)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Wireless Earbuds                                    │    │
│  │ $49.99 each                                         │    │
│  │ [-] 1 [+]                           $49.99         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Discount code input] [Apply]                               │
├─────────────────────────────────────────────────────────────┤
│ Subtotal                                              $75.97│
│ Tax (10%)                                              $7.60│
│ Total                                                 $83.57│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐  ┌─────────────────────┐  │
│  │      Pay $83.57              │  │                     │  │
│  └─────────────────────────────┘  │  Hold Order          │  │
│                                   │  Clear Cart          │  │
│                                   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Component Specifications

**Hold Order Button**

| Property | Value |
|----------|-------|
| Location | Cart section, bottom |
| Size | Medium |
| Style | Outline variant |
| Enabled when | Cart has items |
| Disabled when | Cart is empty |

**Held Orders Icon Button**

| Property | Value |
|----------|-------|
| Location | Cart header, right side |
| Icon | Clipboard/List icon |
| Badge | Red circle with count |
| Badge visible when | Count > 0 |

**Badge**

| Property | Value |
|----------|-------|
| Position | Top-right of icon |
| Color | Red |
| Text color | White |
| Maximum digits | 2 (shows 99+) |

**Hold Order Modal**

| Property | Value |
|----------|-------|
| Width | 400px |
| Header | "Hold Order" |
| Fields | Customer name (optional), Note (optional) |
| Buttons | Cancel, Hold Order |
| Backdrop | Click to dismiss (disabled when submitting) |

**Held Orders List Modal**

| Property | Value |
|----------|-------|
| Width | 450px |
| Header | "Held Orders" |
| Empty state | Icon, message, instructions |
| Order card | Customer name/time, items, total, time, note |
| Actions | Resume, Delete |

**Resume Confirmation Modal**

| Property | Value |
|----------|-------|
| Width | 400px |
| Header | "Replace Current Cart?" |
| Icon | Warning triangle |
| Message | Describes current cart items and loss |
| Buttons | Cancel, Replace Cart |

### 8.3 Color Scheme

| Element | Color |
|---------|-------|
| Hold button | Outline variant |
| Delete button | Red text/icon |
| Resume button | Primary color |
| Warning icon | Yellow/amber |
| Badge | Red background |
| Expired orders | Not shown (filtered out) |

### 8.4 Typography

| Element | Style |
|---------|-------|
| Customer name | Bold, medium |
| Time since hold | Small, subtle |
| Item count | Medium |
| Total amount | Bold |
| Note | Italic, smaller |

---

## 9. Success Metrics

### 9.1 KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Hold success rate | 100% | Successful holds / hold attempts |
| Resume accuracy | 100% | Correct item/total restoration |
| Discount validation | 100% | Invalid discounts caught |
| Expiration cleanup | 100% | Expired orders cleaned within 1 load |

### 9.2 Adoption Tracking

- Monitor held orders count over time
- Track hold-to-resume ratio
- Measure average time between hold and resume
- Monitor discount re-validation frequency

---

## 10. Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| Page refresh with held orders | Persisted in IndexedDB, survives refresh |
| Browser crash | Persisted in IndexedDB |
| Hold empty cart | "Hold Order" button disabled |
| Expired held orders | Cleaned up automatically on mount |
| Discount expired between hold and resume | Re-validated, removed with warning |
| Resume order from different cashier | Not visible (filtered by cashier ID) |
| Resume with items in cart | Confirmation modal shown |
| Delete held order | Inline confirmation before deletion |
| Network offline | Fully functional (local IndexedDB) |
| Multiple identical product names | Customer name disambiguates |
| 24+ hour hold attempt | Not allowed (auto-expires at 24h) |
| No customer name on hold | Auto-generated "Order at [time]" |

---

## 11. Future Enhancements

| Enhancement | Description |
|-------------|-------------|
| Server sync | Sync held orders to server for multi-device resume |
| Hold order queue | Visual queue for customers waiting to resume |
| SMS/notification | Notify customer when order is ready |
| Multi-day holds | Extended expiration for special circumstances |
| Manager override | Allow managers to view all held orders |
| Reports | Track hold/resume patterns for insights |
| Print hold receipt | Physical ticket for customer |
| Priority holds | Urgent orders can be prioritized in list |
| Hold grouping | Group holds by customer |

> **Technical Details**: See [Feature Specification](features/hold-order.md) for current implementation details, architecture, and code references.

---

## 12. Dependencies

### 12.1 Related Features

| Feature | Relationship |
|---------|--------------|
| Cart Management | Source of cart data to hold |
| Discount Management | Discount validation source |
| Authentication | Cashier identification |
| IndexedDB Persistence | Storage layer |

### 12.2 Integration Points

- IndexedDB heldOrders table
- Cart store state management
- Toast notification system
- Modal components

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Held Order | Temporarily saved cart state for later completion |
| Hold | Action of saving current cart |
| Resume | Action of restoring held order to cart |
| Cart Snapshot | Complete copy of cart state at hold time |
| Cashier Scoped | Visibility limited to orders held by current user |
| Discount Re-validation | Checking discount validity when resuming |

---

## 14. Related Documents

| Document | Description |
|----------|-------------|
| [Feature Specification](features/hold-order.md) | Technical implementation details, architecture, code references |
| [ADR-0004](adr/ADR-0004-hold-order-indexeddb-persistence.md) | IndexedDB persistence architectural decision |
| [Feature Spec: Customer Display](features/customer-display.md) | Related real-time sync feature |

---

## 15. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-03 | Initial release |

---

**Document End**

*For technical implementation details, see [Feature Specification](features/hold-order.md).*

*For questions or updates, contact the Product Engineering team.*
