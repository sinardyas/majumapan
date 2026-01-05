# Feature Specification: Interactive Promotions for Customer Display

## Status

**Almost Complete** - Backend complete, Admin UI complete, Customer Display complete, Sync integration complete

> **Last Updated**: January 4, 2026
> **Recent Changes**: 
> - Added promotions to sync process (full sync, pull sync, status) (Jan 4, 2026)
> - Added syncLog entries for all stores on promotion CRUD (Jan 4, 2026)
> - Promotions are now **global** (store-agnostic), visible across all stores (Jan 3, 2026)
> - Removed store selector from admin panel
> - Admin panel simplified - only admins access, no manager role handling needed (Jan 3, 2026)
> **Business Context**: See [Promotions PRD](../prd/promotions-prd.md) for product requirements, user personas, goals, and success metrics. This document covers technical implementation details.

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Backend & Database | ✅ Complete | Table, API routes, upload, permissions, sync |
| Phase 2: Admin Promotions Page | ✅ Complete | Full CRUD, drag-and-drop, no store scoping |
| Phase 3: Customer Display Carousel | ✅ Complete | New carousel component with touch support |
| Phase 4: Integration & Testing | ⏳ Pending | Full E2E testing pending |

## Global Promotions

Promotions are now **global** (store-agnostic) and visible across all stores. This simplifies the system:

- **No store scoping** - promotions apply to all stores
- **Single promotion list** - no per-store filtering needed
- **Simplified admin** - no store selector in promotion form
- **Unified carousel** - all stores show the same promotions

### Admin Panel

The Admin Panel is **admin-only** and manages global promotions:

| User | Access | Data Shown |
|------|--------|------------|
| Admin | Full access to /promotions | All global promotions |
| Manager | No access | N/A (managers use POS web, not admin panel) |

### API Behavior

| Endpoint | Behavior |
|----------|----------|
| GET /promotions | Returns all global promotions |
| POST /promotions | Creates global promotion (no storeId) |
| PUT /promotions/:id | Updates global promotion |
| DELETE /promotions/:id | Deletes global promotion |

### Files Modified (Global Promotions)

| File | Change |
|------|--------|
| `apps/api/drizzle/0004_promotions_global.sql` | Migration to remove store scoping |
| `apps/api/src/db/schema.ts` | storeId made nullable |
| `apps/api/src/routes/promotions.ts` | Simplified, no storeId logic |
| `apps/admin/src/components/promotions/PromotionEditor.tsx` | Removed store selector |
| `apps/admin/src/pages/Promotions.tsx` | Removed stores fetch, storeId handling |
| `apps/web/src/db/index.ts` | storeId optional in LocalPromotion |

## Overview

The Interactive Promotions feature adds a rich, carousel-based promotional system to the Customer Display with full management capabilities from the Admin Panel. Key features include:

- **Rich Media Banners**: Upload custom banner images directly to server
- **Interactive Carousel**: Touch-friendly swipeable carousel with pause on hover
- **Manual Priority**: Drag-and-drop reordering of promotions
- **Standalone Support**: Create promotions without linked discount codes
- **Global Scope**: Promotions visible across all stores
- **Preview Mode**: See how promotions look before publishing

## Use Case

**Scenario**: A store manager wants to create visually appealing promotions for the customer display during a summer sale campaign.

1. Manager uploads a branded summer banner image
2. Creates promotion with name, description, and optional discount code
3. Reorders promotions via drag-and-drop to prioritize summer sale
4. Previews the carousel to verify appearance
5. Publishes and promotions appear on Customer Display
6. Customers see engaging carousel with rich visuals

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Display Format | Interactive carousel |
| Banner Images | Direct upload to server (2MB max, 1920x600px) |
| Linked Discounts | Optional (standalone allowed) |
| Priority Control | Manual drag-and-drop |
| Store Scoping | Per-store management |
| Carousel Features | Touch/swipe, pause on hover, progress dots |
| Color Themes | 5 predefined themes + custom |

## Layout

### Admin Promotions Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Promotions                                                    [+ New Promo] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Search...] [Status: All ▾] [Show on Display: All ▾]                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ┌─────┐  Summer Sale 2026      [●] [Active]                    ⟨ ⟩  │   │
│ │  │ img │  Save 20% on summer items!                                   │   │
│ │  └─────┘  Drag to reorder                                              │   │
│ │                                                                             │
│ │ ┌─────┐  Back to School      [○] [Inactive]                  ⟨ ⟩  │   │
│ │  │ img │  15% off school supplies                                   │   │
│ │  └─────┘                                                                 │   │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Promotion Editor Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ New Promotion                                              ✕    │
├─────────────────────────────────────────────────────────────────┤
│  Name *                    ┌───────────────────────────────┐    │
│  Summer Sale 2026          │                               │    │
│                             │       [Upload Image]         │    │
│  Description                │    1920x600px, max 2MB       │    │
│  ┌───────────────────────┐  │    JPG, PNG, WebP            │    │
│  │ Save 20% on...        │  │                               │    │
│  └───────────────────────┘  └───────────────────────────────┘    │
│                                                                 │
│  Linked Discount (Optional)                                      │
│  ┌───────────────────────────────┐                              │
│  │ Select discount...    [▾]     │                              │
│  └───────────────────────────────┘                              │
│                                                                 │
│  Color Theme                                                    │
│  ○ Sunset Orange  ○ Ocean Blue  ○ Forest Green  ○ Custom      │
│                                                                 │
│  Display Settings                                               │
│  ┌───────────────────────────────┐                              │
│  │ Duration: [ 5 ] seconds       │                              │
│  │ Show on Display: [✓]          │                              │
│  └───────────────────────────────┘                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│           [Cancel]                       [Preview] [Save]       │
└─────────────────────────────────────────────────────────────────┘
```

### Customer Display Carousel

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
│  │   │                    SUMMER SALE 2026                          │     │   │
│  │   │                                                             │     │   │
│  │   │         Save 20% on all summer items!                        │     │   │
│  │   │                                                             │     │   │
│  │   │         CODE: SUMMER20                    [20% OFF]          │     │   │
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

## Technical Quick Reference

| Category | Details |
|----------|---------|
| Architecture | File upload + IndexedDB + Zustand |
| State Management | Promotions store with drag-drop state |
| File Upload | Multer on server, File API on client |
| Drag-and-Drop | @dnd-kit/core for list reordering |
| Carousel | Custom with touch events |
| Route | `/promotions` (admin only) |
| File Changes | 12+ files |

## Data Model

### Database Schema (PostgreSQL)

```typescript
// apps/api/src/db/schema.ts

// New promotions table
export const promotions = pgTable('promotions', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  bannerImageUrl: text('banner_image_url').notNull(),
  discountId: uuid('discount_id').references(() => discounts.id),
  colorTheme: varchar('color_theme', { length: 50 }).default('sunset-orange'),
  displayPriority: integer('display_priority').default(0),
  displayDuration: integer('display_duration').default(5),
  showOnDisplay: boolean('show_on_display').default(true),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_promotions_store').on(table.storeId),
  index('idx_promotions_priority').on(table.storeId, table.displayPriority),
  index('idx_promotions_active').on(table.isActive, table.showOnDisplay),
]);
```

### Dexie Schema (IndexedDB)

```typescript
// apps/web/src/db/index.ts

this.version(5).stores({
  // ... existing tables
  promotions: 'id, storeId, displayPriority, showOnDisplay, isActive',
});
```

### Client Types

```typescript
// apps/web/src/db/index.ts

interface Promotion {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  bannerImageUrl: string;
  discountId: string | null;
  colorTheme: string;
  displayPriority: number;
  displayDuration: number;
  showOnDisplay: boolean;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ColorTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

const COLOR_THEMES: ColorTheme[] = [
  { id: 'sunset-orange', name: 'Sunset Orange', primaryColor: '#F97316', secondaryColor: '#EA580C' },
  { id: 'ocean-blue', name: 'Ocean Blue', primaryColor: '#0EA5E9', secondaryColor: '#0284C7' },
  { id: 'forest-green', name: 'Forest Green', primaryColor: '#22C55E', secondaryColor: '#16A34A' },
  { id: 'royal-purple', name: 'Royal Purple', primaryColor: '#A855F7', secondaryColor: '#9333EA' },
  { id: 'cherry-red', name: 'Cherry Red', primaryColor: '#EF4444', secondaryColor: '#DC2626' },
];
```

## User Flows

### Flow 1: Create Promotion

```
1. Manager opens Promotions page
2. Clicks [+ New Promotion]
3. Fills promotion form:
   - Selects store (for admins; pre-selected for managers)
   - Name, Description
   - Uploads banner image
   - Selects optional discount
   - Chooses color theme
   - Sets display duration
   - Sets active dates
4. Clicks [Preview]
5. Preview modal shows carousel
6. Clicks [Save]
7. System uploads image, saves promotion
8. Toast: "Promotion created"
```

### Flow 2: Reorder Promotions

```
1. Manager sees promotions list
2. Drags promotion by handle to new position
3. System saves new order
4. Toast: "Order updated"
```

### Flow 3: Customer Interacts with Carousel

```
1. Customer sees carousel on display
2. Carousel auto-rotates every 5 seconds
3. Customer hovers over carousel
4. Rotation pauses
5. Customer swipes left/right (touch device)
6. Customer moves cursor away
7. Rotation resumes after 2 seconds
```

## API Endpoints

### Promotions API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/promotions` | List all global promotions |
| GET | `/api/promotions/:id` | Get single promotion |
| POST | `/api/promotions` | Create global promotion |
| PUT | `/api/promotions/:id` | Update global promotion |
| DELETE | `/api/promotions/:id` | Delete global promotion |
| PUT | `/api/promotions/reorder` | Reorder global promotions |
| POST | `/api/upload/promotion-image` | Upload banner image |

### Request/Response Types

```typescript
// Create Promotion Request
interface CreatePromotionRequest {
  name: string;
  description?: string;
  bannerImageUrl: string;
  discountId?: string;
  colorTheme: string;
  displayDuration: number;
  showOnDisplay: boolean;
  startDate?: string;
  endDate?: string;
}

// Reorder Request
interface ReorderPromotionsRequest {
  promotionIds: string[]; // In desired order
}

// List Response
interface PromotionsResponse {
  promotions: Promotion[];
  total: number;
}
```

## File Structure

### New Files to Create

```
apps/api/src/
├── routes/
│   └── promotions.ts         # Promotions CRUD endpoints
├── services/
│   └── promotionImage.ts     # Image upload service

apps/web/src/
├── pages/
│   └── Promotions.tsx        # Admin promotions page
├── components/
│   └── promotions/
│       ├── index.ts          # Barrel export
│       ├── PromotionsList.tsx     # Table with drag-drop
│       ├── PromotionEditor.tsx    # Create/edit modal
│       ├── PromotionPreview.tsx   # Preview carousel modal
│       └── ColorThemePicker.tsx   # Theme selector
├── stores/
│   └── promotionsStore.ts    # Promotions Zustand store
└── services/
    └── promotions.ts         # Promotions API service

apps/admin/src/
├── pages/
│   └── Promotions.tsx        # Promotions page wrapper
├── components/
│   └── layout/
│       └── Sidebar.tsx       # Add Promotions nav item
```

### Files to Modify

```
apps/api/src/
├── db/
│   └── schema.ts             # Add promotions table
└── routes/
    └── index.ts              # Mount promotions routes

apps/web/src/
├── db/
│   └── index.ts              # Add Dexie schema
├── pages/
│   └── CustomerDisplay.tsx   # Integrate carousel component
└── App.tsx                   # Add /promotions route
```

## Implementation Details

### Drag-and-Drop Implementation

Using @dnd-kit for drag-and-drop reordering:

```typescript
// PromotionsList.tsx

import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

function PromotionsList() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = promotions.findIndex(p => p.id === active.id);
      const newIndex = promotions.findIndex(p => p.id === over.id);
      const newOrder = arrayMove(promotions, oldIndex, newIndex);
      setPromotions(newOrder);

      // Save new order to server
      await api.put('/promotions/reorder', {
        promotionIds: newOrder.map(p => p.id),
      });
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={promotions} strategy={verticalListSortingStrategy}>
        {promotions.map(promotion => (
          <SortableItem key={promotion.id} promotion={promotion} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### File Upload Service

```typescript
// promotionImage.ts

import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';

const storage = multer.diskStorage({
  destination: './uploads/promotions',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

export const uploadPromotionImage = upload.single('banner');
```

### Carousel Component

```typescript
// CustomerDisplay.tsx - PromotionCarousel component

function PromotionCarousel({ promotions }: { promotions: Promotion[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const currentPromotion = promotions[currentIndex];
  const duration = currentPromotion?.displayDuration || 5;

  useEffect(() => {
    if (isPaused || promotions.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length);
    }, duration * 1000);

    return () => clearInterval(interval);
  }, [isPaused, promotions.length, duration]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setCurrentIndex((prev) =>
        diff > 0
          ? (prev + 1) % promotions.length
          : (prev - 1 + promotions.length) % promotions.length
      );
    }
    setTouchStart(null);
  };

  return (
    <div
      className="relative h-full w-full bg-cover bg-center"
      style={{ backgroundImage: `url(${currentPromotion?.bannerImageUrl})` }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-black/25" />

      {/* Content */}
      <div className="relative z-10 flex h-full items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-5xl font-bold">{currentPromotion?.name}</h2>
          {currentPromotion?.description && (
            <p className="mt-4 text-2xl">{currentPromotion.description}</p>
          )}
        </div>
      </div>

      {/* Progress indicators */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {promotions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-3 w-3 rounded-full transition-all ${
              i === currentIndex ? 'bg-white scale-110' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

## Permissions

| Role | Admin Panel Access | Notes |
|------|-------------------|-------|
| Admin | Full access (CRUD, reorder) | Only role that can access admin panel |
| Manager | No access | Managers use POS web app, not admin panel |
| Cashier | No access | POS only, no admin access |

```typescript
// In permissions constant
// Note: Promotions permissions are defined but only admin role accesses admin panel
'promotions:create': ['admin'],
'promotions:read': ['admin'],
'promotions:update': ['admin'],
'promotions:delete': ['admin'],
'promotions:reorder': ['admin'],
```

## Sync Strategy

Promotions are synced as part of the standard sync process using incremental sync with sync logs:

### Sync Flow

1. Admin creates/updates/deletes promotion in Admin Panel
2. Server creates syncLog entries for ALL stores (promotions are global)
3. On next sync, clients pull promotion changes via `/sync/pull` endpoint
4. Clients apply changes to IndexedDB via `bulkPut` and `bulkDelete`
5. Customer Display queries IndexedDB for active promotions
6. Carousel displays promotions in priority order

### Sync Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /sync/full` | Returns all promotions (for initial sync) |
| `GET /sync/pull` | Returns created/updated/deleted promotions since last sync |
| `GET /sync/status` | Returns promotion count for status display |

### Sync Log Entries

When a promotion is modified, syncLog entries are created for all stores:

| Action | Entity Type | Entity ID |
|--------|-------------|-----------|
| create | promotion | promotion.id |
| update | promotion | promotion.id |
| delete | promotion | promotion.id |
| update (reorder) | promotion | each promotion.id |

### Sync Priority

Promotions sync after:
- Products
- Categories
- Discounts

This ensures linked discounts are available when promotions sync.

### Files Modified (Sync Integration)

| File | Change |
|------|--------|
| `apps/api/src/routes/sync.ts` | Added promotions to full/pull/status endpoints |
| `apps/api/src/routes/promotions.ts` | Added syncLog calls on CRUD operations |
| `apps/web/src/services/sync.ts` | Added transformPromotion, fullSync, pullChanges support |
| `apps/web/src/stores/syncStore.ts` | Added promotions to entityCounts |

## Color Themes

```typescript
const COLOR_THEMES = [
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    gradient: 'from-orange-500 to-red-500',
    bgColor: '#F97316',
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    gradient: 'from-blue-500 to-cyan-500',
    bgColor: '#0EA5E9',
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    gradient: 'from-green-500 to-emerald-500',
    bgColor: '#22C55E',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    gradient: 'from-purple-500 to-indigo-500',
    bgColor: '#A855F7',
  },
  {
    id: 'cherry-red',
    name: 'Cherry Red',
    gradient: 'from-red-500 to-rose-500',
    bgColor: '#EF4444',
  },
];
```

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| No promotions | Show welcome message |
| All inactive | Show welcome message |
| Image upload fails | Show error, retry button |
| Invalid image type | Validate on client, show error |
| Large image file | Resize on client before upload |
| Linked discount inactive | Show warning icon |
| Promotion expires | Auto-hide from carousel |
| Drag interrupted | Snap back to original position |
| Network offline | Queue for later sync |

## Testing Scenarios

1. Create promotion with image upload
2. Create standalone promotion (no discount)
3. Edit promotion details
4. Delete promotion
5. Reorder promotions via drag-drop
6. Preview promotion before publish
7. Activate/deactivate promotion
8. Upload invalid image type
9. Upload large image
10. Customer display carousel auto-rotation
11. Pause on hover
12. Touch swipe on mobile
13. Progress indicator navigation
14. Promotion expiration auto-hide
15. Sync promotions to client
16. Offline promotion creation

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @dnd-kit/core | ^8.0.0 | Drag-and-drop functionality |
| @dnd-kit/sortable | ^8.0.0 | Sortable list for reordering |
| @dnd-kit/utilities | ^8.0.0 | Drag-and-drop utilities |
| multer | ^2.1.0 | File upload handling |
| uuid | ^9.0.0 | Generate unique filenames |

## Implementation Strategy

This section outlines the phased implementation approach for the Interactive Promotions feature.

### Phase Overview

| Phase | Description | Effort |
|-------|-------------|--------|
| Phase 1 | Backend & Database | 2-3 hours |
| Phase 2 | Admin Promotions Page | 4-5 hours |
| Phase 3 | Customer Display Carousel | 3-4 hours |
| Phase 4 | Integration & Testing | 2-3 hours |
| **Total** | | **11-15 hours** |

---

### Phase 1: Backend & Database

**Goal:** Set up database schema, API endpoints, and file upload infrastructure.

#### Tasks

| # | Task | Description | Files |
|---|------|-------------|-------|
| 1.1 | Add promotions table | Add `promotions` table to PostgreSQL schema | `apps/api/src/db/schema.ts` |
| 1.2 | Create promotions table migration | Run Drizzle migration | `apps/api/drizzle/` |
| 1.3 | Create promotions API routes | CRUD endpoints for promotions | `apps/api/src/routes/promotions.ts` |
| 1.4 | Add file upload endpoint | Configure multer for banner images | `apps/api/src/routes/upload.ts` |
| 1.5 | Mount promotions routes | Register routes in main app | `apps/api/src/routes/index.ts` |
| 1.6 | Add sync endpoint | Include promotions in sync process | `apps/api/src/routes/sync.ts` |
| 1.7 | Add permissions | Ensure role-based access control | `apps/api/src/middleware/rbac.ts` |
| 1.8 | Create API client methods | Add promotion API calls | `apps/api-client/src/index.ts` |

#### File Changes (Phase 1)

```
apps/api/src/db/schema.ts
  + promotions table with all fields
  + index on storeId, displayPriority, showOnDisplay

apps/api/src/routes/promotions.ts (NEW)
  GET /promotions
  GET /promotions/:id
  POST /promotions
  PUT /promotions/:id
  DELETE /promotions/:id
  PUT /promotions/reorder

apps/api/src/routes/upload.ts (NEW)
  POST /upload/promotion-image
  + multer configuration
  + file validation

apps/api/src/routes/index.ts
  + mount promotions router
  + mount upload router

apps/api/src/routes/sync.ts
  + include promotions in sync response

apps/api-client/src/index.ts
  + promotion API methods

apps/api/drizzle/
  + migration file for promotions table
```

---

### Phase 2: Admin Promotions Page

**Goal:** Create the full promotions management interface in the Admin Panel.

#### Tasks

| # | Task | Description | Files |
|---|------|-------------|-------|
| 2.1 | Add Dexie schema | Update IndexedDB for promotions | `apps/web/src/db/index.ts` |
| 2.2 | Create promotions types | Add Promotion interface | `apps/web/src/db/index.ts` |
| 2.3 | Create Promotions store | Zustand store for state | `apps/web/src/stores/promotionsStore.ts` |
| 2.4 | Create API service | Promotion API calls | `apps/web/src/services/promotions.ts` |
| 2.5 | Create Promotions page | Main admin page | `apps/admin/src/pages/Promotions.tsx` |
| 2.6 | Create PromotionsList component | Table with drag-drop | `apps/admin/src/components/promotions/PromotionsList.tsx` |
| 2.7 | Create PromotionEditor modal | Create/edit form | `apps/admin/src/components/promotions/PromotionEditor.tsx` |
| 2.8 | Create PromotionPreview modal | Preview carousel | `apps/admin/src/components/promotions/PromotionPreview.tsx` |
| 2.9 | Create ColorThemePicker | Theme selector | `apps/admin/src/components/promotions/ColorThemePicker.tsx` |
| 2.10 | Add sidebar navigation | Add Promotions nav item | `apps/admin/src/components/layout/Sidebar.tsx` |
| 2.11 | Add route | Register /promotions route | `apps/admin/src/App.tsx` |

#### File Changes (Phase 2)

```
apps/web/src/db/index.ts
  + Promotions interface
  + Dexie version 5 with promotions table

apps/web/src/stores/promotionsStore.ts (NEW)
  + Promotions Zustand store
  + CRUD actions
  + reorder action
  + loadPromotions action

apps/web/src/services/promotions.ts (NEW)
  + getPromotions()
  + getPromotion(id)
  + createPromotion(data)
  + updatePromotion(id, data)
  + deletePromotion(id)
  + reorderPromotions(ids)
  + uploadBannerImage(file)

apps/admin/src/pages/Promotions.tsx (NEW)
  + Promotions page component
  + State for list, filters, modal

apps/admin/src/components/promotions/index.ts (NEW)
  + Barrel export

apps/admin/src/components/promotions/PromotionsList.tsx (NEW)
  + Sortable table with @dnd-kit
  + Search/filter controls
  + Bulk actions

apps/admin/src/components/promotions/PromotionEditor.tsx (NEW)
  + Form with validation
  + Image upload
  + Discount selector
  + Color theme picker
  + Date range picker

apps/admin/src/components/promotions/PromotionPreview.tsx (NEW)
  + Live carousel preview
  + Interactive controls

apps/admin/src/components/promotions/ColorThemePicker.tsx (NEW)
  + Theme selection grid
  + Custom color option

apps/admin/src/components/layout/Sidebar.tsx
  + Promotions nav item with icon

apps/admin/src/App.tsx
  + /promotions route with protection
```

#### UI Components (Phase 2)

```
PromotionsList:
├── Search input
├── Status filter dropdown
├── Sortable table rows
│   ├── Drag handle
│   ├── Preview thumbnail
│   ├── Name
│   ├── Status badge
│   ├── Date range
│   └── Actions (edit, delete)
├── Bulk actions bar (when items selected)
└── Pagination

PromotionEditor:
├── Name input (required)
├── Description textarea
├── Banner image upload
│   ├── File input
│   ├── Preview
│   └── Remove button
├── Discount dropdown (optional)
├── Color theme selector (5 presets + custom)
├── Display duration input
├── Show on display toggle
├── Active date range
└── Form actions (cancel, preview, save)

PromotionPreview:
├── Live carousel
├── Pause/play toggle
├── Navigation dots
└── Close button

ColorThemePicker:
├── 5 color preset cards
├── Custom color input (hex)
└── Selected state
```

---

### Phase 3: Customer Display Carousel

**Goal:** Implement the interactive carousel on the Customer Display page.

#### Tasks

| # | Task | Description | Files |
|---|------|-------------|-------|
| 3.1 | Create Carousel component | Main carousel UI | `apps/web/src/components/customer-display/PromotionCarousel.tsx` |
| 3.2 | Create Promotions query | Fetch active promotions | `apps/web/src/db/index.ts` |
| 3.3 | Update Customer Display | Integrate carousel | `apps/web/src/pages/CustomerDisplay.tsx` |
| 3.4 | Add carousel animations | Smooth transitions | CSS modules |
| 3.5 | Add touch support | Swipe gestures | `PromotionCarousel.tsx` |
| 3.6 | Add keyboard navigation | Arrow key support | `PromotionCarousel.tsx` |

#### File Changes (Phase 3)

```
apps/web/src/components/customer-display/PromotionCarousel.tsx (NEW)
  + Main carousel component
  + Auto-rotation
  + Pause on hover
  + Touch/swipe
  + Progress indicators
  + Keyboard navigation

apps/web/src/components/customer-display/index.ts
  + Export carousel

apps/web/src/db/index.ts
  + getActivePromotions() query
  + Promotions table definition

apps/web/src/pages/CustomerDisplay.tsx
  - Remove old PromotionBanner component
  - Remove old marquee styles
  + Import PromotionCarousel
  + Fetch promotions on mount
  + Show carousel or welcome message

apps/web/src/styles/
  + Carousel animations
  + Touch feedback
```

#### Carousel Features (Phase 3)

```
PromotionCarousel:
├── Auto-rotation (configurable duration)
├── Pause on hover
├── Touch swipe (left/right)
├── Keyboard navigation (left/right arrows)
├── Progress dots (click to navigate)
├── Smooth fade transition
├── Banner image display
├── Gradient overlay
├── Text content (name, description)
├── Discount code badge (if linked)
└── Expiration countdown (if applicable)
```

---

### Phase 4: Integration & Testing

**Goal:** Ensure all components work together and test thoroughly.

#### Tasks

| # | Task | Description | Files |
|---|------|-------------|-------|
| 4.1 | End-to-end testing | Full user flow testing | Manual + Playwright |
| 4.2 | Error handling | Upload errors, API failures | All components |
| 4.3 | Offline testing | Promotions work offline | Customer Display |
| 4.4 | Responsive testing | Mobile layouts | Admin, Customer Display |
| 4.5 | Performance testing | Large image uploads | Upload endpoint |
| 4.6 | Accessibility testing | Keyboard nav, screen readers | Carousel, Admin |
| 4.7 | Documentation | Update README if needed | - |
| 4.8 | Code review cleanup | Address PR feedback | All files |

#### Testing Checklist (Phase 4)

```
Admin Panel:
✓ Create promotion with all fields
✓ Create standalone promotion (no discount)
✓ Edit promotion details
✓ Delete promotion
✓ Reorder via drag-drop
✓ Upload valid image (JPG, PNG, WebP)
✓ Reject invalid image type
✓ Handle large image file
✓ Preview before publish
✓ Activate/deactivate toggle
✓ Filter by status
✓ Search promotions
✓ Pagination works

Customer Display:
✓ Carousel auto-rotates
✓ Pause on hover works
✓ Touch swipe works
✓ Keyboard navigation works
✓ Progress dots navigate
✓ Empty state shows welcome
✓ Promotions display correctly
✓ Color themes apply
✓ Transitions are smooth
✓ Offline mode works

Edge Cases:
✓ No promotions created
✓ All promotions inactive
✓ Image upload fails
✓ Network offline
✓ Session expires
✓ Concurrent edits
```

---

### Effort Summary

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Backend & Database | 8 | 2-3 |
| Phase 2: Admin Promotions Page | 11 | 4-5 |
| Phase 3: Customer Display Carousel | 6 | 3-4 |
| Phase 4: Integration & Testing | 8 | 2-3 |
| **Total** | **33** | **11-15** |

---

### Implementation Order

1. **Week 1, Day 1**: Phase 1 (Backend & Database)
2. **Week 1, Day 2**: Phase 2 (Admin Page - List + Editor)
3. **Week 1, Day 3**: Phase 2 (Admin Page - Preview + ColorPicker)
4. **Week 1, Day 4**: Phase 3 (Customer Display Carousel)
5. **Week 1, Day 5**: Phase 4 (Integration & Testing)

---

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Image upload issues | Client-side validation, retry logic, clear error messages |
| Drag-and-drop complexity | Use established @dnd-kit library, test on mobile |
| Carousel performance | Lazy load images, use CSS transforms, debounce updates |
| Sync conflicts | Last-write-wins with timestamp, show conflict UI |
| Large file uploads | Client-side resize, server-side limits, progress indicators |

---

### Rollout Strategy

1. **Deploy to staging** - Full feature deployment
2. **Internal testing** - Team tests all flows
3. **Gradual rollout** - Enable for one store at a time
4. **Monitor** - Track errors, performance, usage
5. **Full rollout** - Enable for all stores

---

## Related Documents

- **PRD**: [Promotions PRD](../prd/promotions-prd.md) - Product requirements, user personas, goals, success metrics
- **Customer Display PRD**: [Customer Display PRD](prd/customer-display-prd.md) - Base Customer Display requirements
- **Customer Display FSD**: [Customer Display FSD](features/customer-display.md) - Current implementation
- **ADR-0011**: [Cross-Tab Sync](adr/ADR-0011-cross-tab-cart-sync.md) - Sync architecture
