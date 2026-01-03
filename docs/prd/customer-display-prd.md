# Product Requirements Document: Customer Display

**Document Version:** 1.0  
**Last Updated:** 2026-01-02  
**Status:** Implemented  
**Prepared By:** Product & Engineering Team  
**Related Document:** [Feature Specification (FSD)](features/customer-display.md) - For technical implementation details

---

## 1. Executive Summary

The Customer Display feature provides a read-only, customer-facing view of the current order during checkout. It mirrors the cart contents in real-time and displays promotional banners sourced from active discounts, allowing customers to verify their order items and see running totals throughout the checkout process.

### Key Outcomes

- **Transparency**: Customers see exactly what items are being rung up
- **Verification**: Customers can catch errors before payment
- **Engagement**: Promotional banners attract attention while waiting
- **Professionalism**: Modern checkout experience with split-screen layout

### Value Proposition

The Customer Display transforms the traditional point-of-sale checkout into an interactive experience. By separating the cashier's operational view from the customer's informational view, we create trust through transparency while also creating opportunities for promotional visibility during the checkout window when customer attention is highest.

### Quick Reference

| Aspect | Description |
|--------|-------------|
| Display Mode | Full-screen, read-only |
| Layout | Vertical split (66.6% promotions / 33.4% cart) |
| Sync Method | Real-time mirroring |
| Promotion Source | Active discounts |
| Access | Opens from POS header button |
| Offline Support | Yes |

> **Technical Details**: See [Feature Specification](features/customer-display.md) for architecture, implementation, and code references.

---

## 2. Problem Statement

### Current Challenges

Before the Customer Display was implemented, checkout operations faced several challenges:

| Challenge | Impact |
|-----------|--------|
| **No customer visibility** | Customers couldn't see what was being scanned, leading to distrust |
| **No promotional exposure** | The checkout counter had no marketing opportunity |
| **Manual verification** | Cashiers had to verbally confirm items with customers |
| **Error discovery delays** | Pricing mistakes were often caught only after payment |
| **Generic checkout** | No differentiation from competitors on customer experience |

### User Pain Points

1. **Cashiers**: Have to verbally confirm each item, slowing down checkout
2. **Customers**: Cannot verify charges before payment, causing anxiety
3. **Store Managers**: Missed promotional opportunities during high-attention checkout moments
4. **Business Owners**: Cannot differentiate their brand through checkout experience

### Market Context

Modern POS systems increasingly include customer-facing displays as a standard feature. Customers expect to see their order on screen during checkout, similar to how they see items in an online shopping cart. This feature meets that expectation while adding promotional value.

---

## 3. Goals & Objectives

### Primary Goals

| Goal | Success Metric |
|------|----------------|
| Enable customer order visibility | 100% of checkout transactions visible on customer display |
| Real-time synchronization | <100ms latency between POS action and display update |
| Promotional exposure | Active promotions visible during checkout |
| Customer satisfaction | Reduction in "item verification" complaints by 80% |

### Secondary Objectives

- Increase promotional awareness through checkout visibility
- Reduce checkout errors through customer verification
- Enhance perceived professionalism of the store
- Create opportunities for impulse purchases via promotions

---

## 4. User Personas

### Persona 1: Retail Customer

**Profile:** End customer at checkout  
**Goals:**
- See what items are being scanned
- Verify prices before payment
- Understand discounts being applied
- Complete transaction quickly

**Behaviors:**
- Watches the display during checkout
- Notices promotional banners
- Asks questions if items don't match expectations
- Expects transparency in pricing

**Frustrations:**
- Not seeing what's being charged
- Unclear pricing or discounts
- Slow checkout due to manual verification

### Persona 2: Cashier

**Profile:** Employee operating the POS system  
**Goals:**
- Process transactions quickly
- Avoid customer disputes over charges
- Highlight promotions to customers

**Behaviors:**
- Opens customer display at shift start
- Monitors display to ensure accuracy
- Relies on display for customer verification

**Frustrations:**
- Manual item confirmation with customers
- Customer disputes over charges
- No promotional visibility during checkout

### Persona 3: Store Manager

**Profile:** Responsible for store operations and sales  
**Goals:**
- Ensure checkout transparency
- Maximize promotional exposure
- Reduce transaction errors

**Behaviors:**
- Sets up customer display on secondary monitor
- Configures promotions to show during checkout
- Monitors checkout experience

**Frustrations:**
- Missed promotional opportunities
- Transaction disputes
- Inconsistent checkout experience

---

## 5. Functional Requirements

### 5.1 Display Mode

| Requirement | Description |
|-------------|-------------|
| Full-screen mode | Customer Display takes entire browser window |
| Read-only | No customer interaction with cart items |
| Split layout | Vertical split: 66.6% promotions / 33.4% cart |
| Protected access | Requires authentication (same security as POS) |

### 5.2 Real-Time Cart Mirroring

| Requirement | Description |
|-------------|-------------|
| Instant updates | Cart changes appear immediately on display |
| Full cart sync | All cart data (items, discounts, totals) synced |
| Cross-tab sync | Changes in POS tab reflect in display tab |
| Offline compatible | Works without network connectivity |

### 5.3 Promotion Display Requirements

| Requirement | Description |
|-------------|-------------|
| Source | Active discounts from the system |
| Filter criteria | Only active promotions within valid date range |
| Display format | Animated banner with promotion details |
| Auto-rotation | Cycles through promotions if multiple exist |
| Refresh rate | Updates periodically to show new promotions |
| Fallback | Welcome message when no promotions exist |

**Promotion Fields Displayed:**

| Field | Description |
|-------|-------------|
| Name | Prominent display of promotion name |
| Description | Optional description text |
| Discount value | Percentage or fixed amount off |

### 5.4 Cart Display Requirements

| Requirement | Description |
|-------------|-------------|
| Item list | Scrollable list of all cart items |
| Quantity display | Badge showing item quantity |
| Price display | Line item subtotal |
| Discount indicator | Highlight showing applied discount |
| Name handling | Long names are truncated appropriately |

**Order Summary Fields:**

| Field | Description |
|-------|-------------|
| Subtotal | Sum of all item subtotals |
| Discount | Total discount amount (if any) |
| Tax | Tax amount (10% rate) |
| TOTAL | Final amount due (prominent display) |

### 5.5 Cashier Identification

| Requirement | Description |
|-------------|-------------|
| Source | From authentication system |
| Display location | Top-right of cart area |
| Format | "Cashier: [Name]" |
| Fallback | "Cashier: Staff" if no name available |

### 5.6 Window Management

| Requirement | Description |
|-------------|-------------|
| Open new window | Opens in new browser tab/window |
| Window size | Recommended minimum size for visibility |
| Close | Close tab or window to exit |
| Reopen | Cashier can reopen anytime |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|-------------|--------|
| Initial load time | < 2 seconds |
| Sync latency | < 100ms |
| Animation smoothness | 60fps |

### 6.2 Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 15+ |
| Edge | 90+ |

### 6.3 Accessibility

| Standard | Compliance |
|----------|------------|
| WCAG 2.1 | AA |
| High contrast | Text meets contrast ratios |
| Screen reader | Compatible structure |

### 6.4 Reliability

| Requirement | Description |
|-------------|-------------|
| Sync reliability | 99.9% successful delivery |
| Offline operation | Fully functional without network |
| Graceful degradation | Works without promotion data |

---

## 7. User Flows

### Flow 1: Open Customer Display

```
Preconditions:
- Cashier is logged into POS
- POS page is open in one browser tab

Steps:
1. Cashier clicks [Customer Display] button in POS header
2. System opens new browser window/tab
3. Customer Display loads and connects to POS
4. Display shows:
   - Left panel: Promotion banner (or welcome message)
   - Right panel: Current cart items and totals
5. Display begins syncing with POS tab

Expected Outcome:
- Customer Display shows current cart state
- Cashier can verify display is working
- Customer can now see their order
```

### Flow 2: Add Item to Cart (Real-Time Sync)

```
Preconditions:
- Customer Display is open and synced
- Cashier is about to add an item

Steps:
1. Cashier scans product or clicks product on POS
2. POS updates cart with new item
3. Customer sees new item appear on display

Expected Outcome:
- New item appears within 100ms
- Quantities update correctly
- Totals recalculate automatically
```

### Flow 3: Update Item Quantity

```
Preconditions:
- Customer Display is open with items in cart

Steps:
1. Cashier adjusts item quantity on POS
2. Customer sees updated quantity and price

Expected Outcome:
- Quantity badge updates
- Line item subtotal updates
- Cart totals update
```

### Flow 4: Apply Discount

```
Preconditions:
- Customer Display is open with items in cart
- Cashier has a valid discount code

Steps:
1. Cashier applies discount on POS
2. Customer sees discount applied and price adjustment

Expected Outcome:
- Discount indicator appears
- Discount amount shown in green
- Total recalculated with discount applied
```

### Flow 5: Promotion Display and Rotation

```
Preconditions:
- Customer Display is open
- Multiple active promotions exist

Steps:
1. System loads active promotions
2. If no promotions: Shows welcome message
3. If single promotion: Displays full details
4. If multiple promotions: Cycles through promotions
5. Promotions refresh periodically

Expected Outcome:
- Promotions scroll horizontally
- Current promotion is highlighted
- Changes reflect new promotions
```

### Flow 6: Customer Verifies Order

```
Preconditions:
- Customer Display is open
- Cart has items

Steps:
1. Customer watches display as items are added
2. Customer sees item details, quantities, and prices
3. Customer notes total before payment
4. If discrepancy: Customer alerts cashier
5. Payment proceeds with verified total

Expected Outcome:
- Customer can read all item details
- Total is clearly visible
- Errors caught before payment
```

### Flow 7: Complete Transaction and Clear

```
Preconditions:
- Payment is processed
- Cart is cleared

Steps:
1. Cart is cleared after payment
2. Customer Display shows empty state
3. Display remains open for next customer

Expected Outcome:
- Display shows empty state
- Ready for next customer
- Promotions continue to display
```

---

## 8. UI/UX Requirements

### 8.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                          │                                           │
│     PROMOTION AREA       │           CART ITEMS AREA                 │
│     (Width: 66.6%)       │           (Width: 33.4%)                  │
│     Full-height banner   │                                           │
│                          │  ┌─────────────────────────────────────┐  │
│  ┌────────────────────┐  │  │  Cashier: John Doe                  │  │
│  │                    │  │  │                                     │  │
│  │   Sliding Banner   │  │  │  Coffee x2              $8.00       │  │
│  │   with active      │  │  │  Sandwich             $12.00       │  │
│  │   promotions       │  │  │  Latte x1               $5.00       │  │
│  │                    │  │  │  Cake x1                $4.50       │  │
│  │                    │  │  │  ...                                  │  │
│  │                    │  │  │                                     │  │
│  └────────────────────┘  │  │  ─────────────────────────────────  │  │
│                          │  │                                     │  │
│                          │  │  Subtotal              $29.50       │  │
│                          │  │  Discount              -$2.00       │  │
│                          │  │  Tax (10%)              $2.75       │  │
│                          │  │  ─────────────────────────────────  │  │
│                          │  │                                     │  │
│                          │  │  TOTAL                $30.25        │  │
│                          │  │                                     │  │
│                          │  └─────────────────────────────────────┘  │
│                          │                                           │
└──────────────────────────┴───────────────────────────────────────────┘
```

### 8.2 Component Specifications

**Promotion Banner (Left Panel)**

| Property | Value |
|----------|-------|
| Width | 66.6% of viewport |
| Background | Gradient (amber to red) |
| Animation | Smooth scrolling |
| Highlight area | Center with promotion details |
| Navigation | Dot indicators (when multiple promotions) |
| Fallback | Welcome message when no promotions |

**Cart Area (Right Panel)**

| Property | Value |
|----------|-------|
| Width | 33.4% of viewport |
| Background | White |
| Header | Cashier name (right-aligned) |
| List area | Scrollable |
| Summary | Fixed at bottom |

**Item Row**

| Property | Value |
|----------|-------|
| Quantity badge | Circular badge with number |
| Font size | Readable from distance |
| Price font | Bold for visibility |
| Discount indicator | Green color |

**Order Summary**

| Property | Value |
|----------|-------|
| Background | Light gray |
| Total font | Large and prominent |
| Total color | Green |

### 8.3 Color Scheme

| Element | Color Purpose |
|---------|---------------|
| Promotion banner | Gradient (amber-orange-red) for visibility |
| Total amount | Green for emphasis |
| Discount | Green to highlight savings |
| Tax label | Neutral gray |
| Cart background | Clean white |
| Summary background | Light gray |

### 8.4 Typography

| Element | Style |
|---------|-------|
| Promotion name | Large, bold, white |
| Item name | Large, readable |
| Item price | Bold |
| TOTAL | Largest, bold, green |
| Cashier name | Small, subtle |

---

## 9. Success Metrics

### 9.1 KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sync latency | < 100ms | Time from POS action to display update |
| Display uptime | 99.9% | Time display is responsive |
| Customer visibility | 100% | All checkout transactions visible |
| Promotion views | 80% | Of transactions show at least one promotion |

### 9.2 Adoption Tracking

- Monitor Customer Display button clicks
- Track display session duration
- Measure promotional engagement (time viewing)
- Gather customer feedback on transparency

---

## 10. Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| No promotions in database | Show welcome message |
| No items in cart | Show "Your cart is empty" message |
| Large number of items | Item list scrolls vertically |
| Long product names | Truncated appropriately |
| Browser compatibility | Feature works on supported browsers |
| Network offline | Fully functional (local data) |
| Browser window resized | Responsive layout adapts |
| Promotions expire | Auto-refresh shows current promotions |
| Cart discount applied | Shown and deducted from total |

---

## 11. Future Enhancements

| Enhancement | Description |
|-------------|-------------|
| IndexedDB Persistence | Save cart state across sessions |
| localStorage Fallback | Broader browser compatibility |
| Debounced Updates | Optimized for high-frequency scanning |
| Custom Banner Messages | Admin-configurable promotion text |
| Product Images | Show product thumbnails |
| Multi-Promotion Display | Grid view of promotions |
| Payment Integration | Show payment status |
| Language Support | Multi-language options |
| Accessibility Mode | High contrast, larger fonts |
| Hardware Integration | Display control features |

> **Technical Details**: See [Feature Specification](features/customer-display.md) for current implementation details, architecture, and code references.

---

## 12. Dependencies

### 12.1 Related Features

| Feature | Relationship |
|---------|--------------|
| Discount Management | Source of promotional content |
| Cart Management | Source of cart data |
| Authentication | User identification |

### 12.2 Integration Points

- Opens from POS header
- Syncs with cart state
- Reads from discount data

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Customer Display | Read-only, customer-facing view of the cart |
| Cart Mirroring | Real-time synchronization of cart state |
| Promotion | Active discount displayed on customer-facing banner |
| Cross-Tab Sync | Real-time data synchronization between tabs |

---

## 14. Related Documents

| Document | Description |
|----------|-------------|
| [Feature Specification](features/customer-display.md) | Technical implementation details, architecture, code references |
| [ADR-0011](adr/ADR-0011-cross-tab-cart-sync.md) | Cross-tab synchronization architectural decision |
| [Feature Spec: Hold Order](features/hold-order.md) | Similar real-time sync architecture |

---

## 15. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-02 | Initial release |

---

**Document End**

*For technical implementation details, see [Feature Specification](features/customer-display.md).*

*For questions or updates, contact the Product Engineering team.*
