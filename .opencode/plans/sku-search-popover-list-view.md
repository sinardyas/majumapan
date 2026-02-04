# Product Requirements Document: SKU Search Popover List View

**Document Version:** 1.1  
**Last Updated:** 2026-02-04  
**Status:** Draft  

---

## 1. Executive Summary

Convert the SKU search popover in the POS Cart View from a 2-column grid layout to a detailed single-column list view. The enhancement displays enhanced product information including product images, full promo pricing, and stock details to improve cashier productivity. The popover remains open after product selection for rapid SKU scanning.

### Key Outcomes

| Outcome | Description |
|---------|-------------|
| Enhanced product visibility | More product details reduce selection errors |
| Promo pricing transparency | Cashiers see discounted prices before adding to cart |
| Visual product identification | Thumbnails help identify products with similar names |
| Rapid SKU scanning | Popover stays open for continuous product entry |
| Maintained performance | Fast keyboard navigation and search responsiveness |

### Quick Reference

| Aspect | Description |
|--------|-------------|
| Layout | Single-column list (was 2-column grid) |
| Image | 40×40px thumbnail on left |
| Price | Original → Discounted with promo badge |
| Stock | Color-coded badge (green/yellow/red) |
| Max height | 800px (scrollable) |
| Popover behavior | Stays open after selection (was closes) |
| Keyboard nav | ↑/↓/Enter/Escape (Enter doesn't close popover) |

---

## 2. Problem Statement

### Current Challenges

| Challenge | Impact |
|-----------|--------|
| Limited product info in search | Cashiers cannot fully verify product selection |
| No promo pricing visibility | Unexpected cart totals, need to remove/re-add |
| No product images | Hard to identify products with similar names |
| Popover closes after selection | Slows down rapid SKU scanning workflow |
| Compact 2-column grid | Information density limits quick scanning |

### User Pain Points

1. **Cashiers**: Cannot see promo pricing before adding to cart
2. **Mixed SKUs**: Products with similar names hard to distinguish without images
3. **Visual verification**: Need to add to cart then remove if wrong product
4. **Rapid entry**: Popover closes after each selection, interrupting flow

---

## 3. Goals & Objectives

### Primary Goals

| Goal | Success Metric |
|------|----------------|
| Show promo pricing | 100% of promo products display discount info |
| Add product images | All products show thumbnail or placeholder |
| Improve readability | List layout with clear information hierarchy |
| Enable rapid scanning | Popover stays open for continuous entry |
| Maintain speed | No degradation in search or keyboard response |

---

## 4. Functional Requirements

### 4.1 Product Information Display

| Field | Display | Format | Example |
|-------|---------|--------|---------|
| Product Image | Yes | 40×40px thumbnail | - |
| Product Name | Yes | Bold, truncated | "Organic Coffee Beans" |
| SKU | Yes | Below name | SKU: COF-001 |
| Original Price | If promo | Strikethrough | ~~$15.99~~ |
| Discounted Price | If promo | Bold, green | $12.99 |
| Regular Price | If no promo | Bold | $12.99 |
| Promo Badge | If promo | Colored badge | "15% OFF" |
| Stock Status | Always | Color-coded text | "42 in stock" |

### 4.2 Stock Badge Specifications

| Stock Level | Text Color | Background | Text |
|-------------|------------|------------|------|
| 0 | Red | Red-50 | "Out of stock" |
| 1-9 | Yellow | Yellow-50 | "X left!" |
| 10+ | Green | Green-50 | "X in stock" |

### 4.3 Promo Display Specifications

```
Regular Product:
┌─────────────────────────────────────────┐
│ [IMG] Product Name                       │
│       SKU: COF-001                       │
│       $12.99                       42 in stock│
└─────────────────────────────────────────┘

Promo Product:
┌─────────────────────────────────────────┐
│ [IMG] Product Name                       │
│       SKU: COF-001                       │
│       $12.99  ~~$15.99~~  🔴 15% OFF     │
│                                    42 in stock│
└─────────────────────────────────────────┘
```

### 4.4 Popover Behavior

| Action | Behavior |
|--------|----------|
| Type SKU | Popover opens after 200ms debounce |
| Click product | Product added, popover stays open |
| Press Enter | Product added, popover stays open |
| Press Escape | Popover closes, focus returns to input |
| Click outside | Popover closes |
| Type more | Popover updates with filtered results |

### 4.5 Layout Requirements

| Aspect | Specification |
|--------|---------------|
| List item height | ~80px (varies with content) |
| Image size | 40×40px |
| Padding | 12px |
| Gap (image to content) | 12px |
| Max list height | 800px |
| Footer height | 32px |
| Scroll behavior | Overflow-y: auto |
| Popover width | 400px |

### 4.6 Visual States

| State | Visual Treatment |
|-------|------------------|
| Selected | bg-primary-50 |
| Hover | bg-gray-50 |
| Out of stock | Disabled, grayed out, not clickable |
| Promo | Green text for promo elements |

### 4.7 Keyboard Navigation

| Key | Action |
|-----|--------|
| ↑ | Move selection up |
| ↓ | Move selection down |
| Enter | Select product, add to cart, **popover stays open** |
| Escape | Close popover, focus returns to SKU input |

### 4.8 Footer

| Condition | Display |
|-----------|---------|
| Any results | "X result(s)" |
| Empty | "No products found" |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target |
|-------------|--------|
| Popover open | < 50ms |
| Image lazy load | Async, non-blocking |
| Keyboard response | < 30ms |
| Product add | Instant (optimistic UI) |

### 5.2 Image Handling

| Requirement | Specification |
|-------------|---------------|
| Lazy loading | `loading="lazy"` |
| Async decoding | `decoding="async"` |
| Placeholder | Gray background while loading |
| Missing image | Box icon |

---

## 6. User Flows

### Flow 1: Rapid SKU Scanning

```
Preconditions:
- Cashier is in Cart View
- SKU input has focus

Steps:
1. Cashier types SKU: "ABC123"
2. Popover appears (200ms debounce)
3. Cashier reviews product details (image, price, stock)
4. Cashier presses Enter
5. Product added to cart
6. Toast notification: "Product added"
7. **Popover stays open**
8. Cashier types next SKU: "DEF456"
9. Repeat until transaction complete
10. Cashier presses Escape or clicks outside to close

Expected Outcome:
- Each product added instantly with toast feedback
- Popover remains available for continuous scanning
- Cashier maintains workflow rhythm
```

### Flow 2: Search and Select Product

```
Preconditions:
- Cashier is in Cart View
- SKU input has focus

Steps:
1. Cashier types SKU: "ABC123"
2. Popover appears showing detailed list
3. Cashier sees promo pricing (if applicable)
4. Cashier identifies correct product by image/name
5. Cashier presses Enter
6. Product added to cart
7. Popover remains open for next entry

Expected Outcome:
- Product appears in cart with correct pricing
- Toast notification shown
- Popover ready for next SKU entry
```

### Flow 3: Verify Product with Image

```
Preconditions:
- Cashier searching for product with common name

Steps:
1. Cashier types partial name
2. Multiple products appear in list
3. Cashier sees product thumbnails
4. Identifies correct product by image
5. Selects product with Enter
6. Product added, popover stays open

Expected Outcome:
- Thumbnails help distinguish similar products
- Reduced selection errors
- Continuous workflow maintained
```

---

## 7. UI/UX Requirements

### 7.1 List Item Wireframe

```
┌─────────────────────────────────────────────────────┐
│ [IMG] Product Name (bold)                        $99.99│
│       SKU: ABC123                                    │
│       $84.99  ~~$99.99~~  🔴 15% OFF (min 3)  42 in st│
├─────────────────────────────────────────────────────┤
│ [IMG] Product Name                                $50.00│
│       SKU: DEF456                               15 in st│
├─────────────────────────────────────────────────────┤
│ [X] Out of Stock Product                          $30.00│
│       SKU: GHI789                                    │
│       Out of stock                                  │
└─────────────────────────────────────────────────────┘
│                 3 results                            │
└─────────────────────────────────────────────────────┘
```

### 7.2 Color Palette

| Element | Color Class |
|---------|-------------|
| Selected background | `bg-primary-50` |
| Promo text | `text-green-600` |
| Strikethrough | `text-gray-400` |
| Out of stock | `text-red-500` + opacity |
| Low stock badge | `bg-yellow-50` + `text-yellow-600` |
| In stock badge | `bg-green-50` + `text-green-600` |

---

## 8. Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| No image available | Gray placeholder box with Box icon |
| Long product name | Truncated with ellipsis |
| Long SKU | Truncated |
| No results | "No products found" message |
| Out of stock | Disabled, not selectable, gray styling |
| Rapid typing | 200ms debounce prevents excessive renders |
| Product added to full cart | Toast confirms addition, cart updates |
| Barcode scanner input | Works same as manual typing, Enter sent by scanner |

---

## 9. Dependencies

### Related Features

| Feature | Relationship |
|---------|--------------|
| Product Display | Source of product data |
| Cart Store | Uses existing addItem() |
| Search/Filter | Reuses existing search logic |
| Image handling | Uses existing imageBase64 |
| Toast notifications | Provides feedback on add |

### Integration Points

- `SkuSearchPopover.tsx` (modified)
- `POS.tsx` (modified - keyboard handler)
- `LocalProduct` type (no changes)
- `cartStore.addItem()` (unchanged)

---

## 10. Glossary

| Term | Definition |
|------|------------|
| SKU | Stock Keeping Unit - unique product identifier |
| Popover | Floating panel anchored below input |
| Lazy loading | Deferred image loading for performance |
| Debounce | Delay before executing search |
| Rapid scanning | Workflow of entering multiple SKUs quickly |

---

## 11. Related Documents

| Document | Description |
|----------|-------------|
| [POS Page](../../apps/web/src/pages/POS.tsx) | Current implementation |
| [CartView](apps/web/src/components/pos/CartView.tsx) | Cart view component |
| [SkuSearchPopover](apps/web/src/components/pos/SkuSearchPopover.tsx) | Modified component |

---

## 12. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-04 | Initial draft - grid to list conversion |
| 1.1 | 2026-02-04 | Updated: Popover stays open after selection |

---

**Document End**
