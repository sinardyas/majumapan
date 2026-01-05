# Product Requirements Document: Interactive Promotions for Customer Display

**Document Version:** 1.2
**Last Updated:** 2026-01-04
**Status:** Draft
**Prepared By:** Product & Engineering Team
**Related Document:** [Feature Specification (FSD)](features/promotions.md) - For technical implementation details

---

## 1. Executive Summary

The Interactive Promotions feature enhances the Customer Display with a rich, carousel-based promotional system that managers can easily configure from the Admin Panel. Unlike the current static marquee displaying active discounts, this feature introduces:

- **Rich Media Support**: Upload custom banner images for promotions
- **Standalone Promotions**: Create promotional content without requiring a linked discount code
- **Manual Priority**: Drag-and-drop reordering to control display sequence
- **Interactive Carousel**: Swipeable, pauseable carousel with progress indicators
- **Global Scope**: Promotions are visible across all stores (not store-scoped)

### Key Outcomes

- **Manager Control**: Easy-to-use admin interface for promotion management
- **Visual Engagement**: Rich banner images capture customer attention
- **Flexible Content**: Promotions with or without discount codes
- **Intuitive Ordering**: Manual drag-and-drop priority control
- **Interactive Experience**: Touch-friendly carousel with pause on hover
- **Centralized Management**: Promotions apply globally to all stores

### Value Proposition

The current Customer Display shows promotions as simple scrolling text extracted from active discounts. This is limiting because:

1. **No Visual Impact**: Text-only promotions lack visual appeal
2. **Mixed Concerns**: Discounts serve two purposes (pricing and marketing)
3. **Fixed Ordering**: No control over which promotions appear first
4. **No Preview**: Managers cannot see how promotions will look
5. **No Standalone Content**: Cannot create marketing messages without discounts

The Interactive Promotions feature solves these by separating promotional content from discount logic and adding rich media capabilities.

### Quick Reference

| Aspect | Description |
|--------|-------------|
| Display Format | Interactive carousel with rich media |
| Banner Images | Direct upload to server |
| Linked Discounts | Optional (can be standalone) |
| Priority Control | Manual drag-and-drop |
| Scope | Global (applies to all stores) |
| Navigation | Touch/swipe, dots, pause on hover |
| Admin Interface | Full CRUD with preview |

> **Technical Details**: See [Feature Specification](features/promotions.md) for architecture, implementation, and code references.

---

## 2. Problem Statement

### Current Challenges

| Challenge | Impact |
|-----------|--------|
| **Text-only promotions** | Low visual impact, hard to notice |
| **Mixed concerns** | Discounts serve dual purpose (pricing + marketing) |
| **Fixed ordering** | No control over promotion sequence |
| **No preview** | Cannot preview how promotions look before publishing |
| **No standalone content** | Cannot create marketing-only messages |
| **Scattered management** | No dedicated promotion management interface |

### User Pain Points

1. **Store Managers**: Cannot create visually appealing promotions, no preview capability, fixed ordering
2. **Customers**: Ignore text-only promotions, no engaging visual content
3. **Marketing Teams**: Cannot create branded promotional content
4. **Cashiers**: No involvement (promotions managed by managers)

### Market Context

Modern customer-facing displays in retail environments use rich visual content to engage customers. Text-only scrolling promotions are outdated and fail to capture attention in busy retail environments.

---

## 3. Goals & Objectives

### Primary Goals

| Goal | Success Metric |
|------|----------------|
| Enable rich media promotions | 100% of promotions include banner images |
| Manual priority control | Managers can reorder promotions via drag-drop |
| Standalone content | Promotions without linked discounts are supported |
| Global scope | Promotions apply to all stores |
| Interactive carousel | Customers can swipe/pause carousel |

### Secondary Objectives

- Reduce time to create and publish promotions
- Improve customer engagement with promotions
- Enable seasonal/themed promotional campaigns
- Support branded visual content
- Provide preview before publish

---

## 4. User Personas

### Persona 1: Store Manager

**Profile:** Responsible for store operations and marketing
**Goals:**
- Create visually appealing promotions quickly
- Control which promotions appear first
- Preview promotions before publishing
- Create marketing messages without discount codes

**Behaviors:**
- Creates promotions before seasonal campaigns
- Reorders promotions based on priorities
- Uses preview to verify visual appearance
- Uploads branded banner images

**Frustrations:**
- Cannot control promotion ordering
- No preview before publishing
- Text-only promotions lack impact
- Must create discount codes for marketing messages

### Persona 2: Retail Customer

**Profile:** End customer at checkout
**Goals:**
- Notice and understand promotions
- See visually appealing content while waiting
- Interact with promotion display if desired

**Behaviors:**
- Watches customer display while waiting
- Notices colorful banner images
- May interact (pause, swipe) with carousel
- Reads promotion details

**Frustrations:**
- Text-only promotions are ignored
- No engaging visual content
- Cannot get more details about promotions

### Persona 3: Marketing Team (via Store Manager)

**Profile:** Creates branded promotional content
**Goals:**
- Maintain brand consistency
- Use high-quality images
- Coordinate promotions across stores

**Behaviors:**
- Provides banner images to store managers
- Specifies promotion priorities
- Reviews promotion effectiveness

**Frustrations:**
- Cannot ensure brand consistency with text-only
- No control over visual presentation

---

## 5. Functional Requirements

### 5.1 Promotion Management Requirements

| Requirement | Description |
|-------------|-------------|
| Create promotion | Add new promotion with name, description, banner image |
| Edit promotion | Modify existing promotion details |
| Delete promotion | Remove promotion from system |
| Duplicate promotion | Copy existing promotion for quick variants |
| Activate/deactivate | Toggle promotion visibility on display |
| Preview promotion | See how promotion looks on customer display |

### 5.2 Banner Image Requirements

| Requirement | Description |
|-------------|-------------|
| Image upload | Upload banner images directly to server |
| Image formats | Support JPG, PNG, WebP |
| Image size | Max 2MB per image |
| Dimensions | Recommended 1920x600px (3.2:1 aspect ratio) |
| Image preview | See uploaded image before saving |
| Image deletion | Remove image when promotion is deleted |

### 5.3 Discount Linking Requirements

| Requirement | Description |
|-------------|-------------|
| Optional linkage | Promotions can exist without linked discount |
| Discount selection | Select existing discount from dropdown |
| Validation | Show warning if linked discount is inactive |
| Sync behavior | Promotion stays active even if discount expires |

### 5.4 Priority Control Requirements

| Requirement | Description |
|-------------|-------------|
| Drag-and-drop | Reorder promotions via drag-and-drop |
| Visual feedback | Highlight during drag operation |
| Auto-save | Order persists immediately after drop |
| Multiple selection | Support bulk reordering |

### 5.5 Display Control Requirements

| Requirement | Description |
|-------------|-------------|
| Show on display | Toggle to show/hide on Customer Display |
| Active date range | Set start and end dates |
| Display duration | Seconds per slide (default: 5s) |
| Auto-rotate | Automatic slide transition |
| Pause on hover | Stop rotation when cursor over carousel |
| Touch/swipe | Mobile-friendly navigation |

### 5.6 Admin Interface Requirements

| Requirement | Description |
|-------------|-------------|
| Promotions list | Table view with search and filters |
| Status filters | All, Active, Inactive, Scheduled |
| Bulk actions | Activate, Deactivate, Delete selected |
| Sortable columns | Name, Status, Created, Modified |
| Pagination | Handle large numbers of promotions |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|-------------|--------|
| Page load | < 2 seconds |
| Image upload | < 5 seconds (2MB max) |
| Preview render | < 500ms |
| Carousel transitions | 60fps smooth animation |
| Reorder save | < 200ms |

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
| Image persistence | Images survive promotion edits/deletions |
| Upload reliability | Retry on network failure |
| Sync consistency | Promotions sync across devices |
| Graceful degradation | Text fallback if image fails |

### 6.4 Scalability

| Requirement | Description |
|-------------|-------------|
| Promotion limit | No hard limit per store |
| Image storage | Server-side storage with cleanup |
| Concurrent uploads | Support multiple simultaneous uploads |

### 6.5 Security

| Requirement | Description |
|-------------|-------------|
| Authentication | Admin/Manager only |
| Authorization | Role-based access control |
| File validation | Verify file types on upload |
| Storage limits | Per-store storage quotas |

### 6.6 Sync Strategy

Promotions use incremental sync to propagate changes to all stores:

| Aspect | Description |
|--------|-------------|
| Sync Type | Incremental with sync logs |
| Trigger | Admin CRUD operations create syncLog entries |
| Propagation | Sync entries created for ALL stores |
| Client Sync | Pull changes via `/sync/pull` endpoint |
| Initial Sync | Full sync via `/sync/full` endpoint |

#### Sync Flow

1. Admin creates/updates/deletes promotion in Admin Panel
2. Server creates syncLog entries for ALL active stores
3. Clients pull changes on next sync interval
4. Clients apply changes to local IndexedDB
5. Customer Display queries local promotions

#### Sync Log Entries

| Action | Entity Type | Created For |
|--------|-------------|-------------|
| create | promotion | All stores |
| update | promotion | All stores |
| delete | promotion | All stores |
| reorder | promotion | All stores (each promotion) |

This ensures promotions sync efficiently to all stores without store-specific scoping.

---

## 7. User Flows

### Flow 1: Create Promotion with Banner

```
Preconditions:
- Manager is logged into Admin Panel
- Manager has promotions management access

Steps:
1. Manager clicks [Promotions] in sidebar
2. Manager clicks [+ New Promotion]
3. Promotion Editor modal opens
4. Manager fills in:
   - Name: "Summer Sale 2026"
   - Description: "Save 20% on all summer items!"
   - Banner Image: Clicks upload, selects summer_banner.jpg
   - Linked Discount: Selects "SUMMER20" (optional)
   - Color Theme: Selects "Sunset Orange"
   - Display Duration: 6 seconds
   - Active: Toggle ON
   - Start Date: Jun 1, 2026
   - End Date: Aug 31, 2026
5. Manager clicks [Preview] to see how it looks
6. Preview modal shows carousel with promotion
7. Manager adjusts styling if needed
8. Manager clicks [Save]
9. System:
   - Uploads banner image to server
   - Creates promotion record
   - Syncs to connected stores
10. Toast: "Promotion created successfully"

Expected Outcome:
- Promotion created with banner image
- Promotion appears in list
- Syncs to Customer Display
```

### Flow 2: Reorder Promotions

```
Preconditions:
- At least 2 promotions exist
- Manager is on Promotions page

Steps:
1. Manager sees promotions in list with drag handles
2. Manager drags "Summer Sale" above "Back to School"
3. Visual highlight shows drop position
4. Manager releases mouse
5. System auto-saves new order
6. Toast: "Promotion order updated"
7. Customer Display shows new order on next refresh

Expected Outcome:
- Promotions reordered
- New order persists
- Customer Display reflects new order
```

### Flow 3: Create Standalone Promotion

```
Preconditions:
- Manager wants to create marketing-only content

Steps:
1. Manager clicks [+ New Promotion]
2. Manager fills:
   - Name: "Grand Opening!"
   - Description: "Visit us this weekend for exclusive deals!"
   - Banner Image: Uploads grand_opening.jpg
   - Linked Discount: Leaves empty (no discount)
   - Active: Toggle ON
3. Manager clicks [Save]
4. Promotion publishes without discount link

Expected Outcome:
- Promotion created without discount
- Shows on Customer Display
- No discount code associated
```

### Flow 4: Preview Before Publishing

```
Preconditions:
- Promotion is being created or edited

Steps:
1. Manager completes promotion details
2. Manager clicks [Preview]
3. Preview Modal opens showing:
   - Live carousel preview
   - Banner image at full size
   - All text and styling
   - Auto-rotation behavior
4. Manager can:
   - Hover to pause carousel
   - Click dots to navigate
   - See timing progression
5. Manager clicks [Close Preview]
6. Returns to editor to adjust if needed

Expected Outcome:
- Accurate preview of promotion
- Manager confident before publishing
```

### Flow 5: Customer Interacts with Carousel

```
Preconditions:
- Customer Display is open
- Multiple active promotions exist

Steps:
1. Customer sees carousel with active promotions
2. Carousel auto-rotates every 5 seconds
3. Customer hovers over carousel
4. Rotation pauses
5. Customer swipes left/right (touch) or clicks dots
6. Customer moves cursor away
7. Rotation resumes after 2 seconds

Expected Outcome:
- Engaging interactive experience
- Customer can view promotions of interest
- Smooth transitions
```

---

## 8. UI/UX Requirements

### 8.1 Admin Promotions Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Promotions                                                    [+ New Promo] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Search...] [Status: All ▾] [Show on Display: All ▾]                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                             │
│ │  ┌─────┐  Summer Sale 2026      [●] [Inactive]                    ⟨ ⟩  │ │
│ │  │ img │  Save 20% on summer items!                                   │ │
│ │  │     │  Banner uploaded · Created Jun 1, 2026                       │ │
│ │  └─────┘                                                              │ │
│ │                                                                             │
│ │  ┌─────┐  Back to School      [●] [Active]                      ⟨ ⟩  │ │
│ │  │ img │  15% off school supplies                                    │ │
│ │  │     │  Banner uploaded · Created Aug 1, 2026                      │ │
│ │  └─────┘                                                              │ │
│ │                                                                             │
│ │  ┌─────┐  Holiday Special     [●] [Scheduled]                  ⟨ ⟩  │ │
│ │  │ img │  Coming soon!                                                │ │
│ │  │     │  Banner uploaded · Created Sep 1, 2026                       │ │
│ │  └─────┘                                                              │ │
│ │                                                                             │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Showing 3 promotions                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Promotion Editor Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ New Promotion                                              ✕    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Name *                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Summer Sale 2026                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Description                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Save 20% on all summer items! Valid while supplies last. │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Banner Image *                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │                                                 │     │   │
│  │  │           [Upload Image]                        │     │   │
│  │  │           (1920x600px, max 2MB)                 │     │   │
│  │  │           JPG, PNG, WebP                        │     │   │
│  │  │                                                 │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ✓ Remove existing image                                      │
│                                                                 │
│  Linked Discount (Optional)                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Select discount...                           [▾]        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Color Theme                                                   │
│  ○ Sunset Orange  ○ Ocean Blue  ○ Forest Green  ○ Custom      │
│                                                                 │
│  Display Settings                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Display Duration: [ 5 ] seconds                         │   │
│  │ Show on Customer Display: [✓]                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Active Period                                                 │
│  Start: [2026-06-01]  End: [2026-08-31]                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│           [Cancel]                           [Preview] [Save]   │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Carousel Display on Customer Display

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          │                                                     │
│     CAROUSEL AREA         │                   CART ITEMS AREA                 │
│     (Full-width banner)   │                   (33.4%)                         │
│                          │                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐     │   │
│  │   │                                                             │     │   │
│  │   │                         SUMMER SALE 2026                     │     │   │
│  │   │                                                             │     │   │
│  │   │              Save 20% on all summer items!                   │     │   │
│  │   │                                                             │     │   │
│  │   │              Limited time offer - Shop now!                  │     │   │
│  │   │                                                             │     │   │
│  │   │    CODE: SUMMER20            [20% OFF]                      │     │   │
│  │   │                                                             │     │   │
│  │   └─────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │   ───────────────────────────────────────────────────────────────     │   │
│  │                                                                       │   │
│  │   ○ ● ○                                                           5s   │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                          │                                                     │
└──────────────────────────┴─────────────────────────────────────────────────────┘
```

### 8.4 Component Specifications

**Admin Promotions List**

| Property | Value |
|----------|-------|
| Table layout | Full width |
| Columns | Drag handle, Preview thumbnail, Name, Status, Dates, Actions |
| Row height | Fixed (80px) |
| Status badges | Green (Active), Gray (Inactive), Amber (Scheduled) |

**Promotion Editor Modal**

| Property | Value |
|----------|-------|
| Width | 600px |
| Height | Auto (max 90vh) |
| Scrollable | Yes |
| Backdrop | Click to dismiss (disabled) |

**Carousel Banner**

| Property | Value |
|----------|-------|
| Width | Full container (66.6%) |
| Height | 400px |
| Aspect ratio | 3.2:1 (1920x600) |
| Object-fit | Cover |
| Transition | Fade (500ms) |

**Carousel Indicators**

| Property | Value |
|----------|-------|
| Position | Bottom center |
| Style | Circular dots |
| Active indicator | Filled, larger |
| Hover | Show thumbnail preview |
| Touch | Swipe gestures |

### 8.5 Color Themes

| Theme | Primary Color | Secondary Color |
|-------|---------------|-----------------|
| Sunset Orange | #F97316 | #EA580C |
| Ocean Blue | #0EA5E9 | #0284C7 |
| Forest Green | #22C55E | #16A34A |
| Royal Purple | #A855F7 | #9333EA |
| Cherry Red | #EF4444 | #DC2626 |

---

## 9. Success Metrics

### 9.1 KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Promotion adoption | 80% of stores use promotions | Promotions created per store |
| Banner image usage | 100% of promotions have images | Promotions with images / total |
| Manager engagement | Average 5 promotions per store | Promotions per store |
| Customer interaction | 30% pause on hover | Carousel pause events |

### 9.2 Adoption Tracking

- Monitor promotions created per store
- Track banner image upload rate
- Measure drag-and-drop reordering frequency
- Monitor preview usage
- Track carousel pause events

---

## 10. Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| No promotions created | Show welcome message with creation prompt |
| All promotions inactive | Show welcome message on Customer Display |
| Image upload fails | Show error, allow retry |
| Large image file | Resize on client before upload |
| Invalid image format | Validate on client, show supported formats |
| Linked discount deleted | Show warning, allow promotion to continue |
| Promotion expires | Auto-hide from carousel |
| Network during upload | Retry with progress indicator |
| Carousel in background tab | Pause auto-rotation |
| Touch device | Enable swipe gestures |

---

## 11. Future Enhancements

| Enhancement | Description |
|-------------|-------------|
| Video banners | Support MP4/WebM video clips |
| Animation templates | Pre-built animation effects |
| A/B testing | Test different banner designs |
| Multi-language | Translatable promotion content |
| Analytics | Track promotion views and conversions |
| Templates | Pre-built promotion templates |
| Bulk import | Import promotions from CSV |
| Scheduled publish | Schedule promotions in advance |
| Product tags | Link products to promotions |
| QR codes | Generate QR codes in banners |

> **Technical Details**: See [Feature Specification](features/promotions.md) for current implementation details, architecture, and code references.

---

## 12. Dependencies

### 12.1 Related Features

| Feature | Relationship |
|---------|--------------|
| Customer Display | Display target for promotions |
| Discount Management | Optional source of discount codes |
| Sync Service | Promotions sync to local stores |
| File Upload | Banner image storage |
| Authentication | Admin/Manager access control |

### 12.2 Integration Points

- Admin Panel sidebar navigation
- Customer Display carousel component
- File upload service
- Sync service for promotions table
- Discount selection dropdown

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Promotion | Marketing content displayed on Customer Display |
| Banner Image | Visual image uploaded for promotion |
| Carousel | Rotating display of multiple promotions |
| Drag-and-Drop | Manual reordering of promotions |
| Color Theme | Predefined color scheme for banners |
| Standalone Promotion | Promotion without linked discount |
| Display Duration | Seconds each promotion is shown |
| Priority | Order in which promotions appear |

---

## 14. Related Documents

| Document | Description |
|----------|-------------|
| [Feature Specification](features/promotions.md) | Technical implementation details, architecture, code references |
| [Customer Display PRD](prd/customer-display-prd.md) | Base Customer Display feature requirements |
| [Customer Display FSD](features/customer-display.md) | Current Customer Display implementation |
| [ADR-0011](adr/ADR-0011-cross-tab-cart-sync.md) | Cross-tab synchronization architecture |

---

## 15. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-03 | Initial draft |
| 1.1 | 2026-01-03 | Updated for global promotions scope |
| 1.2 | 2026-01-04 | Added sync strategy section |

---

**Document End**

*For technical implementation details, see [Feature Specification](features/promotions.md).*

*For questions or updates, contact the Product Engineering team.*
