# Product Requirements Document: POS View Enhancement

**Document Version:** 1.0
**Last Updated:** 2026-01-05
**Status:** Planned
**Prepared By:** Product & Engineering Team
**Related Document:** [Feature Specification (FSD)](features/pos-view-enhancement.md) - For technical implementation details

---

## 1. Executive Summary

The POS View Enhancement adds toggleable List View and Cart View modes with dedicated SKU search functionality to the existing POS interface. This enhancement enables cashiers and managers to quickly add items to the cart by scanning or typing product SKUs, while preserving the current Grid View as the default experience.

### Key Outcomes

- **Faster SKU-based entry**: Cashiers can type SKUs directly into a dedicated field for quick product lookup
- **Keyboard-first workflow**: Power users can navigate and add products entirely via keyboard
- **View flexibility**: Users can switch between Grid View (visual browsing), List View (SKU-focused table), and Cart View (full-width cart management)
- **Focused cart management**: Cart View provides a dedicated area for cart operations with SKU input at the top
- **Zero disruption**: Existing Grid View remains unchanged as default; List and Cart Views are opt-in

### Value Proposition

In high-volume retail environments, cashiers often know SKUs by heart or work with products that lack visible branding. The current Grid View requires visual searching, which slows down experienced cashiers. The new List View with dedicated SKU input allows for rapid, keyboard-driven product entry without sacrificing the visual Grid View for customers who prefer it.

The Cart View provides an even more focused workflow for cashiers who need to rapidly add multiple items by SKU. With the full-width cart display and SKU input at the top, cashiers can quickly scan/type SKUs and see the cart update in real-time.

### Quick Reference

| Aspect | Description |
|--------|-------------|
| View Modes | Grid (default), List, Cart (3 options) |
| SKU Search | Dedicated input field (List View and Cart View) |
| Search Results | Popover with grid layout |
| Keyboard Navigation | Full support (↑/↓/Enter/Escape) |
| View Toggle | F2 cycles through Grid → List → Cart → Grid |
| Storage | No new storage (uses existing product data) |
| Customer Display | Works unchanged (view-agnostic) |

> **Technical Details**: See [Feature Specification](features/pos-view-enhancement.md) for architecture, implementation, and code references.

---

## 2. Problem Statement

### Current Challenges

Before the POS View Enhancement, checkout operations faced several challenges:

| Challenge | Impact |
|-----------|--------|
| **No dedicated SKU input** | Cashiers use general search, mixing SKU lookup with product browsing |
| **Visual-only product browsing** | Grid View requires visual identification, slowing SKU-based entry |
| **Limited keyboard support** | No keyboard navigation for product selection in the product area |
| **Single view mode** | Users cannot choose between visual browsing and list-based workflows |

### User Pain Points

1. **Cashiers**: Mix general search with SKU lookup; cannot efficiently type SKUs for known products
2. **Experienced cashiers**: Forced to visually search when they know the SKU by memory
3. **High-volume stores**: Slower checkout times due to visual-only product browsing
4. **Managers**: Cannot train cashiers on efficient SKU-based workflows

### Market Context

Modern POS systems typically offer multiple view modes for different workflows. Visual grid views support new employees and customer-facing browsing, while list views with quick-search capabilities serve experienced cashiers who process transactions rapidly.

---

## 3. Goals & Objectives

### Primary Goals

| Goal | Success Metric |
|------|----------------|
| Enable SKU-focused workflow | Cashiers can add products by SKU in under 2 seconds |
| Add keyboard navigation | 100% of cart actions achievable via keyboard |
| Preserve existing workflow | Grid View remains unchanged, used by default |
| View toggle adoption | Users can seamlessly switch between Grid/List/Cart views |
| Focused cart management | Cart View enables rapid cart operations with SKU input |

### Secondary Objectives

- Reduce time-to-add for known products
- Support barcode scanner input in dedicated SKU field
- Enable efficient bulk entry workflows
- Maintain offline-first architecture consistency

---

## 4. User Personas

### Persona 1: Experienced Retail Cashier

**Profile:** Employee with months of POS experience, knows many SKUs by memory
**Goals:**
- Process transactions as fast as possible
- Use keyboard shortcuts for efficiency
- Enter SKUs directly without visual searching

**Behaviors:**
- Types SKUs directly into search
- Uses keyboard navigation extensively
- Prefers list views over grid views for speed

**Frustrations:**
- Visual grid view requires mouse/visual search
- General search mixes product names with SKUs
- No keyboard navigation for product selection

### Persona 2: New Retail Cashier

**Profile:** Recently hired, still learning product locations and SKUs
**Goals:**
- Find products visually when unsure
- Learn SKUs over time
- Build speed gradually

**Behaviors:**
- Uses Grid View for visual browsing
- Switches to List View when confident
- Uses SKU search for repeat customers

**Frustrations:**
- None with Grid View default
- May accidentally switch to List View without guidance

### Persona 3: Store Manager

**Profile:** Manages store operations, trains new cashiers
**Goals:**
- Train cashiers on efficient workflows
- Monitor transaction times
- Ensure system supports various skill levels

**Behaviors:**
- Demonstrates both view modes during training
- Sets expectations for view toggle usage
- Monitors adoption of efficient workflows

**Frustrations:**
- Cannot enforce specific view modes for specific workflows
- No visibility into view mode preferences

---

## 5. Functional Requirements

### 5.1 View Toggle Requirements

| Requirement | Description |
|-------------|-------------|
| Toggle control | Segmented control with "Grid" and "List" options |
| Default state | "Grid" view is active on page load |
| Toggle location | Top of product area, above search/filter bar |
| Visual indicator | Active view highlighted, inactive view subdued |
| State persistence | Toggle state persists across page refreshes (optional) |
| Keyboard shortcut | F2 key toggles between views |

### 5.2 List View Requirements

| Requirement | Description |
|-------------|-------------|
| Table layout | Products displayed in table with columns: SKU, Name, Price, Stock, Action |
| Column order | SKU, Product Name, Price, Stock, Add Button |
| Stock indicator | Color-coded: Green (≥10), Yellow (1-9), Red (0) |
| Row selection | Highlighted row indicates keyboard selection |
| Infinite scroll | Load more products on scroll (if >100 products) |
| Empty state | "No products found" when filtered results are empty |

### 5.3 SKU Search Input Requirements

| Requirement | Description |
|-------------|-------------|
| Input field | Located at top of List View, auto-focused when switching to List View |
| Placeholder | "Enter SKU or barcode..." |
| Debounced search | Searches after 300ms pause in typing |
| Minimum characters | 1 (instant search) |
| Search scope | SKU, barcode, then product name (same as current search) |
| Auto-focus | Input receives focus when List View is activated |
| Clear button | "X" button to clear search query |

### 5.4 SKU Search Popover Requirements

| Requirement | Description |
|-------------|-------------|
| Trigger | Appears when SKU search has results (query length > 0) |
| Position | Anchored below SKU input field |
| Layout | Grid of matching products (2 columns, 3 rows = 6 items) |
| Scrollable | Shows more results if > 6 matches |
| Product card | Same visual style as Grid View product cards |
| Selection | Hovered item highlighted, supports keyboard navigation |
| Auto-dismiss | Closes on product selection, Escape key, or clicking outside |
| No results | Shows "No products found" message when empty |
| Out of stock | Products with 0 stock shown as disabled |

### 5.5 Keyboard Navigation Requirements

| Context | Key | Action |
|---------|-----|--------|
| List View | ↑ | Move selection up one row |
| List View | ↓ | Move selection down one row |
| List View | Enter | Add selected product to cart |
| List View | Home | Jump to first product |
| List View | End | Jump to last product |
| SKU Popover | ↑ | Move selection up in popover grid |
| SKU Popover | ↓ | Move selection down in popover grid |
| SKU Popover | Enter | Select product, add to cart, close popover |
| SKU Popover | Escape | Close popover without selection |
| Global | F2 | Cycle through Grid → List → Cart → Grid |

### 5.6 Cart Integration Requirements

| Requirement | Description |
|-------------|-------------|
| Add to cart | Click [+], Enter key, or click product in popover |
| Stock check | Prevents adding out-of-stock items |
| Quantity | Defaults to 1, can increment after adding |
| Feedback | Toast notification on successful add |
| Duplicate items | Allowed (increments quantity if same product) |

### 5.7 Category Filter Requirements

| Requirement | Description |
|-------------|-------------|
| Filter display | Category filter visible in both Grid and List Views |
| Filter behavior | Filters products by category in both views |
| Empty category | Shows empty state if category has no products |

### 5.8 List View Maintains Grid View Behavior

| Requirement | Description |
|-------------|-------------|
| Same filtering | Category filter applies identically to both views |
| Same search scope | SKU, barcode, and product name search (no changes) |
| Same product actions | Click, Enter key, or [+]/[-] buttons add/update cart |
| Same stock checking | Out-of-stock products handled identically |
| Same discount behavior | Cart discounts apply regardless of view mode |
| Same cart integration | Both views use `cartStore.addItem()` for product addition |
| Same toast feedback | Success/error notifications unchanged |

### 5.9 Customer Display Compatibility

| Requirement | Description |
|-------------|-------------|
| Real-time sync | Customer Display updates via BroadcastChannel cart sync |
| View-agnostic | Customer Display shows cart regardless of POS view mode |
| No changes needed | Existing Customer Display works unchanged |
| Data source | Customer Display uses `cartStore` state, not view state |

> **Technical Note**: The Customer Display (`/customer-display` route) subscribes to the cart store via `BroadcastChannel('pos-cart-sync')`. Cart actions (`addItem`, `updateItemQuantity`, etc.) broadcast the full cart state. Since both Grid and List views use the same cart actions, the Customer Display works identically regardless of view mode. No modifications to Customer Display are required.

### 5.8 List View Maintains Grid View Behavior

| Requirement | Description |
|-------------|-------------|
| Same filtering | Category filter applies identically to both views |
| Same search scope | SKU, barcode, and product name search (no changes) |
| Same product actions | Click, Enter key, or [+]/[-] buttons add/update cart |
| Same stock checking | Out-of-stock products handled identically |
| Same discount behavior | Cart discounts apply regardless of view mode |
| Same cart integration | Both views use `cartStore.addItem()` for product addition |
| Same toast feedback | Success/error notifications unchanged |

### 5.9 Customer Display Compatibility

| Requirement | Description |
|-------------|-------------|
| Real-time sync | Customer Display updates via BroadcastChannel cart sync |
| View-agnostic | Customer Display shows cart regardless of POS view mode |
| No changes needed | Existing Customer Display works unchanged |
| Data source | Customer Display uses `cartStore` state, not view state |

> **Technical Note**: The Customer Display (`/customer-display` route) subscribes to the cart store via `BroadcastChannel('pos-cart-sync')`. Cart actions (`addItem`, `updateItemQuantity`, etc.) broadcast the full cart state. Since both Grid and List views use the same cart actions, the Customer Display works identically regardless of view mode. No modifications to Customer Display are required.

### 5.10 Cart View Requirements

| Requirement | Description |
|-------------|-------------|
| Full-width cart | Cart section occupies 100% width (no product grid) |
| SKU input | Dedicated input at top of view, auto-focused |
| Debounced search | 200ms delay before triggering popover |
| Popover | Grid layout showing matching products |
| Barcode scanner | Works directly in Cart View SKU input |
| All cart actions | [+]/[-] quantity, remove, discount, hold, pay |
| Empty state | Shows cart instructions when empty |
| View toggle | 3-segment control: Grid \| List \| Cart |

### 5.11 View Toggle Requirements (Updated)

| Requirement | Description |
|-------------|-------------|
| Toggle control | Segmented control with "Grid", "List", and "Cart" options |
| Default state | "Grid" view is active on page load |
| Toggle location | Top of product/cart area, above search/SKU input |
| Visual indicator | Active view highlighted, inactive views subdued |
| State persistence | Toggle state persists across page refreshes (localStorage) |
| Keyboard shortcut | F2 cycles through: Grid → List → Cart → Grid |

### 5.12 Cart View Layout Specifications

| Aspect | Specification |
|--------|---------------|
| Width | 100% of container (full-width) |
| Height | Full viewport height |
| SKU input | Top section, prominent, auto-focused |
| Cart items | Scrollable area with full cart item cards |
| Cart totals | Fixed bottom section with subtotal, tax, total |
| Action buttons | Pay, Hold Order, Clear Cart (all visible) |
| Background | Light gray to distinguish from Grid/List views |

### 5.13 Cart View SKU Input Behavior

| Behavior | Description |
|----------|-------------|
| Auto-focus | Input receives focus when switching to Cart View |
| Debounce | 200ms delay after typing stops |
| Popover | Appears below input with matching products |
| Enter key | Adds selected product, clears input |
| Barcode scanner | Scanner input works same as manual typing |
| Clear button | "X" button to clear input |
| Empty input | Popover hidden when query is empty |

### 5.14 Cart View Maintains Existing Behavior

| Requirement | Description |
|-------------|-------------|
| Same cart actions | All existing cart actions work identically |
| Same toast feedback | Success/error notifications unchanged |
| Same stock checking | Out-of-stock products handled identically |
| Same discount behavior | Cart discounts apply regardless of view mode |
| Same Customer Display sync | Customer Display works unchanged |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|-------------|--------|
| View toggle | < 50ms (instant switch) |
| SKU search | < 100ms (debounced) |
| Popover open | < 50ms |
| List render | < 200ms for 100+ products |
| Keyboard response | < 30ms (immediate feedback) |

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
| State persistence | Toggle state persists on refresh (localStorage) |
| Offline operation | Fully functional without network |
| Graceful degradation | If IndexedDB unavailable, shows error state |
| Type safety | Full TypeScript interfaces |

### 6.4 Accessibility

| Requirement | Description |
|-------------|-------------|
| ARIA labels | Toggle buttons, input fields, and popovers properly labeled |
| Focus management | Focus moves logically between elements |
| Keyboard support | All interactions achievable via keyboard |
| Screen readers | Popover announcements for search results |

---

## 7. User Flows

### Flow 1: Switch to List View and Add Product by SKU

```
Preconditions:
- Cashier is logged into POS
- Default view is Grid

Steps:
1. Cashier presses F2 (or clicks "List" toggle)
2. View switches to List View
3. SKU input field auto-focuses
4. Cashier types SKU: "ABC123"
5. Popover appears with matching products (debounced 300ms)
6. Cashier sees product in popover
7. Cashier presses Enter (or clicks product)
8. Product added to cart
9. Toast appears: "Product added to cart"
10. Popover closes
11. Cashier continues transaction

Expected Outcome:
- Product appears in cart with quantity 1
- Total updates accordingly
- Cashier can continue typing next SKU
```

### Flow 2: List View with Keyboard Navigation

```
Preconditions:
- Cashier has switched to List View
- Products are loaded

Steps:
1. Cashier presses ↓ multiple times
2. Selection highlight moves down each row
3. Cashier presses Enter on desired product
4. Product added to cart
5. Toast appears
6. Cashier can continue navigating

Expected Outcome:
- Each row highlighted on selection
- Product added on Enter key
- Visual feedback on add action
```

### Flow 3: Search with No Results

```
Preconditions:
- Cashier is in List View
- SKU input has focus

Steps:
1. Cashier types SKU that doesn't exist: "NOTFOUND"
2. Popover appears after debounce
3. Popover shows: "No products found"
4. Cashier can continue typing or clear input

Expected Outcome:
- Helpful message displayed
- Cashier knows to check SKU or try different search
```

### Flow 4: Toggle Back to Grid View

```
Preconditions:
- Cashier is in List View

Steps:
1. Cashier presses F2 (or clicks "Grid" toggle)
2. View switches to Grid View
3. SKU input field is hidden
4. Products displayed in grid layout
5. Cashier can browse visually or use general search

Expected Outcome:
- Grid View renders correctly
- No SKU input visible
- Original grid layout preserved
```

### Flow 5: Barcode Scanner Input

```
Preconditions:
- Cashier has barcode scanner connected
- Cashier is in List View

Steps:
1. Cashier scans product barcode
2. Scanner types characters + Enter
3. SKU input receives: "1234567890123" + Enter
4. Popover shows matching product
5. Product auto-selected and added
6. Toast appears

Expected Outcome:
- Barcode scanner works as SKU input
- Product added immediately (scanner sends Enter)
- Same as manual SKU entry workflow
```

### Flow 6: Add Multiple Products via SKU

```
Preconditions:
- Cashier is in List View
- Familiar with product SKUs

Steps:
1. Cashier types SKU1, presses Enter (product added)
2. Cashier types SKU2, presses Enter (product added)
3. Cashier types SKU3, presses Enter (product added)
4. Cart accumulates all items
5. Cashier proceeds to checkout

Expected Outcome:
- Rapid SKU entry workflow
- No mouse required
- Efficient for high-volume transactions
```

### Flow 7: Cart View with Focused Cart Management

```
Preconditions:
- Cashier is logged into POS
- Default view is Grid
- Cart is empty or has items

Steps:
1. Cashier presses F2 twice (or clicks "Cart" toggle)
2. View switches to Cart View
3. Full-width cart section displays
4. SKU input field auto-focuses at top
5. Cashier types SKU: "ABC123"
6. Popover appears with matching products
7. Cashier presses Enter
8. Product added to cart (appears in cart items)
9. Toast appears: "Product added to cart"
10. Cashier types another SKU, repeats until done
11. Cashier adjusts quantities using [+]/[-] buttons
12. Cashier applies discount code if needed
13. Cashier clicks "Pay" to proceed to checkout

Expected Outcome:
- Cart View renders with full-width layout
- SKU input is prominently displayed at top
- Products added appear in cart immediately
- Cart totals update in real-time
- All cart actions (+/-, remove, discount, hold, pay) work correctly
```

### Flow 8: View Cycle with F2 Shortcut

```
Preconditions:
- Cashier is in any view

Steps:
1. Cashier presses F2
2. View switches: Grid → List
3. Cashier presses F2 again
4. View switches: List → Cart
5. Cashier presses F2 again
6. View switches: Cart → Grid

Expected Outcome:
- Each F2 press cycles to next view in order
- View mode persists after each toggle
- View mode saved to localStorage
```

---

## 8. UI/UX Requirements

### 8.1 View Toggle Control (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│ [Grid] | [List] | [Cart]                            [F2 x3]│
├─────────────────────────────────────────────────────────────┤
│ Products/SKU Input                          [Search/SKU...] │
├─────────────────────────────────────────────────────────────┤
│ ...                                                    ...   │
```

| Property | Value |
|----------|-------|
| Location | Top of product/cart area, above search/SKU input |
| Style | Segmented control (pill shape) with 3 options |
| Active state | Filled background, bold text |
| Inactive state | Outlined, subtle text |
| Icons | Grid icon for Grid, List icon for List, Cart icon for Cart |

### 8.2 List View Layout

```
┌─────────────────────────────────────────────────────────────┐
│ SKU: [____________]  (auto-focuses)                         │
├─────────────────────────────────────────────────────────────┤
│ ┌──────┬──────────────┬──────────┬────────┬────────────────┐ │
│ │  SKU │ Product      │  Price   │ Stock  │ Action         │ │
│ ├──────┼──────────────┼──────────┼────────┼────────────────┤ │
│ │ ABC1 │ Product A    │ $10.00   │ 50     │ [+]            │ │ ← Selected
│ │ ABC2 │ Product B    │ $15.00   │ 12     │ [+]            │ │
│ │ ABC3 │ Product C    │ $8.50    │ 0      │ [-]            │ │
│ │ ABC4 │ Product D    │ $22.00   │ 8      │ [+]            │ │
│ │ ...  │ ...          │ ...      │ ...    │ ...            │ │
│ └──────┴──────────────┴──────────┴────────┴────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Table Columns:**

| Column | Width | Content | Alignment |
|--------|-------|---------|-----------|
| SKU | 15% | Product SKU (compact) | Left |
| Name | 40% | Product name (truncated) | Left |
| Price | 15% | Formatted price | Right |
| Stock | 15% | Quantity with indicator | Right |
| Action | 15% | [+] button | Center |

**Stock Indicators:**

| Stock Quantity | Color | Meaning |
|----------------|-------|---------|
| ≥ 10 | Green | In stock |
| 1-9 | Yellow | Low stock |
| 0 | Red | Out of stock |

### 8.3 SKU Search Popover

```
                    ┌────────────────────────────┐
SKU: [ABC123]  ────►│  ┌────────┐  ┌────────┐   │
                    │  │ Prod 1 │  │ Prod 2 │   │  ← Grid layout
                    │  │ $10.00 │  │ $15.00 │   │    (2 columns)
                    │  └────────┘  └────────┘   │
                    │  ┌────────┐  ┌────────┐   │
                    │  │ Prod 3 │  │ Prod 4 │   │
                    │  │ $8.50  │  │ $12.00 │   │
                    │  └────────┘  └────────┘   │
                    │                            │
                    │  Scroll for more results   │
                    └────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Width | 320px |
| Max height | 240px |
| Items per row | 2 |
| Max visible items | 6 |
| Overflow | Scrollable |
| Animation | Fade in, slide down |

### 8.4 Cart View Layout (Split Layout)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Grid] | [List] | [Cart]                                          [F2] │
├─────────────────────────────────┬───────────────────────────────────────┤
│                                 │                                       │
│  SKU: [__________________]      │  Order Summary                        │
│  (auto-focuses)                 │  ─────────────────────────────────    │
│                                 │                                       │
│  ┌───────────────────────┐      │  Cashier: John Smith                 │
│  │ Wireless Earbuds      │      │  2026-01-05 14:32:15                 │
│  │ $49.99 each           │      │                                       │
│  │ [-] 1 [+]   $49.99    │      │  ─────────────────────────────────    │
│  └───────────────────────┘      │                                       │
│                                 │  Subtotal:                      $75.97│
│  ┌───────────────────────┐      │  Discount (SUMMER10):           -$7.60│
│  │ USB-C Cable           │      │  Tax (10%):                      $7.60│
│  │ $12.99 each           │      │                                       │
│  │ [-] 2 [+]   $25.98    │      │  ─────────────────────────────────    │
│  └───────────────────────┘      │                                       │
│                                 │  Total:                          $83.57│
│  ┌───────────────────────┐      │                                       │
│  │ Wireless Earbuds      │      │                                       │
│  │ $49.99 each           │      │  ┌─────────────────────────────────┐  │
│  │ [-] 1 [+]   $49.99    │      │  │ [Hold]  [Clear]          [Pay] │  │
│  └───────────────────────┘      │  └─────────────────────────────────┘  │
│                                 │                                       │
│  ... (infinite scroll)          │                                       │
│                                 │                                       │
├─────────────────────────────────┴───────────────────────────────────────┤
│                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
      Left Panel (65%)                       Right Panel (35%)
```

**Cart View Structure:**

| Panel | Width | Content |
|-------|-------|---------|
| Left Panel | 65% | SKU Input + Cart Items (infinite scroll) |
| Right Panel | 35% | Order Summary + Action Buttons |

**Left Panel Sections:**

| Section | Description |
|---------|-------------|
| View Toggle | 3-segment control at top |
| SKU Input | Prominent input field, auto-focused, with search icon |
| Cart Items | Scrollable area with cart item cards (infinite scroll) |

**Right Panel Sections:**

| Section | Description |
|---------|-------------|
| Summary Header | Cashier name + Current timestamp (real-time) |
| Discount Section | Input field or applied discount display |
| Totals | Subtotal, discount (if any), tax, total |
| Action Buttons | Hold/Clear (left-aligned), Pay (right-aligned) |

**Cart View Specifications:**

| Aspect | Specification |
|--------|---------------|
| Total Width | 100% of container |
| Left Panel | 65% (flex-1) with min-width |
| Right Panel | 35% (fixed width: 300-400px) |
| Height | Full viewport height |
| Left Scroll | Independent vertical scroll |
| Timestamp | Real-time updates (every second) |
| Action Layout | [Hold] [Clear] [Pay $$$] |

### 8.5 Order Summary Details

| Field | Description |
|-------|-------------|
| Cashier Name | Current logged-in cashier |
| Timestamp | Current date/time, updates in real-time |
| Subtotal | Sum of all item subtotals |
| Discount | Applied discount amount (if any) |
| Tax | 10% of (subtotal - discount) |
| Total | Final amount to pay |

### 8.6 Action Button Layout

```
┌────────────────────────────────────────┐
│ [Hold Order]  [Clear Cart]    [Pay $$$]│
└────────────────────────────────────────┘
   Left-aligned    Left-aligned   Right-aligned
```

### 8.7 Keyboard Focus Management (Updated)

| Action | Focus Behavior |
|--------|----------------|
| Switch to List View | Focus moves to SKU input |
| Switch to Cart View | Focus moves to Cart View SKU input |
| Clear SKU input | Focus remains in input |
| Escape in popover | Focus returns to SKU input |
| Add product via Enter | Focus remains in SKU input (for rapid entry) |
| Switch to Grid View | Focus moves to general search input |

### 8.6 Visual Consistency

| Element | Style |
|---------|-------|
| Selected row | Light gray background, subtle border |
| Hovered product | Slightly darker background |
| [+]/[-] buttons | Same style as Grid View |
| Toast notifications | Same as existing (success/info) |
| Empty states | Same style as existing empty states |

---

## 9. Success Metrics

### 9.1 KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| SKU search latency | < 100ms p95 | Time from keystroke to popover |
| View toggle adoption | 30%+ use List View | Percentage of sessions using List View |
| Keyboard usage rate | 20%+ keyboard-driven | Sessions with keyboard cart additions |
| Transaction time (SKU) | < 2s per item | Average time to add product by SKU |
| Error rate | < 1% | Failed SKU lookups / total SKU searches |

### 9.2 Adoption Tracking

- Monitor view toggle usage patterns
- Track SKU search frequency vs general search
- Measure average items per transaction by view mode
- Compare transaction times between view modes

---

## 10. Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| No search results | Show "No products found" in popover |
| Out of stock product | Show disabled in popover/list, show 0 stock, prevent add |
| Product already in cart | Allow adding more (same as current behavior) |
| Switching views | Maintain scroll position in list view |
| Popover at screen edge | Auto-adjust position (flip/avoid overflow) |
| Rapid typing | Debounce prevents excessive search calls |
| Empty SKU input | Popover hidden when query is empty |
| Lost focus | Popover closes on blur (with delay for click) |
| Screen reader | ARIA live region announces search results |
| Mobile viewport | List View may require horizontal scroll for table |

---

## 11. Future Enhancements

| Enhancement | Description |
|-------------|-------------|
| Customizable columns | Allow users to show/hide table columns |
| Saved favorite SKUs | Quick-access list of frequently used SKUs |
| Bulk SKU entry | Enter multiple SKUs at once (one per line) |
| View mode per user | Remember view preference per cashier |
| SKU lookup history | Show recent SKU searches |
| Voice SKU entry | Voice input for SKU field |

> **Technical Details**: See [Feature Specification](features/pos-view-enhancement.md) for current implementation details, architecture, and code references.

---

## 12. Dependencies

### 12.1 Related Features

| Feature | Relationship |
|---------|--------------|
| Product Display | Source of product data for list/grid |
| Cart Management | Destination for products added via SKU |
| Search/Filter | Existing search infrastructure reused |
| Barcode Scanning | Existing hook can work with SKU input |

### 12.2 Integration Points

- POS page component (POS.tsx)
- Cart store (cartStore.ts)
- Product database queries (db/index.ts)
- Existing Modal/Toast components
- Existing Input/Button components

### 12.3 Customer Display Integration

| Aspect | Details |
|--------|---------|
| Sync Mechanism | BroadcastChannel API (`pos-cart-sync` channel) |
| Cart Actions | `addItem()`, `updateItemQuantity()`, `removeItem()`, etc. |
| Subscription | Customer Display subscribes to `cartStore` state |
| View Dependency | None - Customer Display is view-agnostic |
| Required Changes | None - existing implementation works unchanged |

The Customer Display is completely independent of the POS view mode. It receives cart updates through the same BroadcastChannel mechanism regardless of whether the POS is in Grid or List view. Both view modes use the identical cart actions from `cartStore`, ensuring seamless Customer Display synchronization without any modifications.

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Grid View | Default visual layout showing products as cards in a grid |
| List View | Alternative layout showing products in a table format |
| SKU | Stock Keeping Unit - unique product identifier |
| Popover | Floating panel that appears near the triggering element |
| Debounce | Delay before executing search to prevent excessive queries |
| View Toggle | Control to switch between Grid and List views |

---

## 14. Related Documents

| Document | Description |
|----------|-------------|
| [Feature Specification](features/pos-view-enhancement.md) | Technical implementation details, architecture, code references |
| [POS Page](../apps/web/src/pages/POS.tsx) | Current implementation of POS interface |
| [Cart Store](../apps/web/src/stores/cartStore.ts) | Cart state management |
| [Database Schema](../apps/web/src/db/index.ts) | IndexedDB schema for products |

---

## 15. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-05 | Initial release |

---

**Document End**

*For technical implementation details, see [Feature Specification](features/pos-view-enhancement.md).*

*For questions or updates, contact the Product Engineering team.*
