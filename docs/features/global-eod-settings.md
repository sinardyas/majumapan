# Functional Specifications Document (FSD)

## Merge EOD Settings into Global Settings

| Document Info | |
|---------------|--|
| **Project** | Majumapan POS |
| **Feature** | Global EOD Settings |
| **Version** | 1.0 |
| **Status** | Draft |
| **Parent PRD** | `../prd/prd-global-eod-settings.md` |
| **Created** | 2026-01-26 |

---

## 1. Architecture Overview

### 1.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Portal                             │
├─────────────────────────────────────────────────────────────┤
│  Settings Page          │  EOD Settings Page                │
│  (app_settings)         │  (stores columns)                 │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
            ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
├───────────────────────────┬─────────────────────────────────┤
│  GET/PUT /settings        │  GET/PUT /stores/:id/eod-settings│
│  (app_settings table)     │  (stores table)                 │
└───────────────────────────┴─────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database                                 │
├───────────────────────────┬─────────────────────────────────┤
│  app_settings             │  stores                         │
│  (key-value pairs)        │  (per-store columns)            │
│  - tax_rate               │  - operational_day_start_hour   │
│  - currency               │  - allow_auto_day_transition    │
│  - ...                    │  - eod_notification_emails      │
└───────────────────────────┴─────────────────────────────────┘
```

### 1.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Portal                             │
├─────────────────────────────────────────────────────────────┤
│              Settings Page (Consolidated)                   │
│              ├── General Settings                          │
│              └── EOD Settings                              │
│              (all from app_settings)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
├─────────────────────────────────────────────────────────────┤
│  GET/PUT /settings        │  (Removed: /stores/:id/eod-settings)
│  (app_settings table)     │
│  - tax_rate               │
│  - currency               │
│  - eod_* (NEW)            │
└───────────────────────────┴─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database                                 │
├─────────────────────────────────────────────────────────────┤
│  app_settings             │  stores                         │
│  (key-value pairs)        │  (EOD columns deprecated)       │
│  - eod_operational_*      │  - operational_day_start_hour   │
│  - eod_allow_*            │  - allow_auto_day_transition    │
│  - eod_notification_*     │  - eod_notification_emails      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Database Changes

### 2.1 New Settings in `app_settings` Table

**Table:** `public.app_settings` (existing, no schema change)

| Key | Value Type | Default | Example |
|-----|------------|---------|---------|
| `eod_operational_day_start_hour` | string (integer) | `"6"` | `"6"` |
| `eod_allow_auto_transition` | string (boolean) | `"true"` | `"true"` |
| `eod_notification_emails` | string (JSON array) | `"[]"` | `["admin@store.com"]` |

### 2.2 Seed Data Update

**File:** `apps/api/src/db/seed.ts`

```typescript
// ADD these entries to the seed data array:
{ key: 'eod_operational_day_start_hour', value: '6' },
{ key: 'eod_allow_auto_transition', value: 'true' },
{ key: 'eod_notification_emails', value: '[]' },
```

### 2.3 Migration Script (One-time)

**File:** `apps/api/src/db/migrations/migrate-eod-settings.sql`

```sql
-- Migrate EOD settings from stores table to app_settings
-- Uses the first store's values as the global defaults

INSERT INTO app_settings (key, value, updated_at)
SELECT 
    'eod_operational_day_start_hour',
    operational_day_start_hour::text,
    NOW()
FROM stores
WHERE operational_day_start_hour IS NOT NULL
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO app_settings (key, value, updated_at)
SELECT 
    'eod_allow_auto_transition',
    allow_auto_day_transition::text,
    NOW()
FROM stores
WHERE allow_auto_day_transition IS NOT NULL
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO app_settings (key, value, updated_at)
SELECT 
    'eod_notification_emails',
    COALESCE(
        (SELECT json_agg(email) FROM UNNEST(eod_notification_emails) AS email),
        '[]'::json
    )::text,
    NOW()
FROM stores
WHERE eod_notification_emails IS NOT NULL AND array_length(eod_notification_emails, 1) > 0
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### 2.4 Future Schema Migration (Post-launch)

The deprecated columns in the `stores` table can be removed in a future release:

```sql
-- Run after 3-6 months, once all clients have updated
ALTER TABLE stores DROP COLUMN operational_day_start_hour;
ALTER TABLE stores DROP COLUMN allow_auto_day_transition;
ALTER TABLE stores DROP COLUMN eod_notification_emails;
```

---

## 3. API Changes

### 3.1 Endpoints to Remove

**File:** `apps/api/src/routes/stores.ts`

| Method | Endpoint | Line | Action |
|--------|----------|------|--------|
| GET | `/api/v1/stores/:storeId/eod-settings` | 64-95 | Remove entire handler |
| PUT | `/api/v1/stores/:storeId/eod-settings` | 98-150 | Remove entire handler |

### 3.2 Endpoints to Update

#### 3.2.1 GET `/api/v1/day-close/preview`

**Current Behavior:**
```typescript
// Line ~80 in day-close.ts
const store = await db.query.stores.findFirst({
  where: eq(stores.id, storeId),
});
const operationalDayStartHour = store?.operationalDayStartHour ?? 6;
```

**New Behavior:**
```typescript
// Fetch from app_settings
const settingResult = await db.query.appSettings.findFirst({
  where: eq(appSettings.key, 'eod_operational_day_start_hour'),
});
const operationalDayStartHour = settingResult 
  ? parseInt(settingResult.value) 
  : 6;
```

#### 3.2.2 POST `/api/v1/day-close/execute`

**Current Behavior:**
- Reads `eod_notification_emails` from `stores` table

**New Behavior:**
- Reads `eod_notification_emails` from `app_settings` table
- Parses JSON array and sends emails to configured addresses

#### 3.2.3 GET `/api/v1/settings`

**No changes required** - already returns all settings from `app_settings` table.

#### 3.2.4 PUT `/api/v1/settings`

**No changes required** - already supports upserting key-value pairs.

**Optional Enhancement:** Add dedicated EOD settings endpoints:

```typescript
// NEW: GET /api/v1/settings/eod
settingsRouter.get('/eod', requireRole('admin'), async (c) => {
  const [startHour, autoTransition, emails] = await Promise.all([
    db.query.appSettings.findFirst({ where: eq(appSettings.key, 'eod_operational_day_start_hour') }),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, 'eod_allow_auto_transition') }),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, 'eod_notification_emails') }),
  ]);
  
  return c.json({
    operationalDayStartHour: parseInt(startHour?.value || '6'),
    allowAutoDayTransition: autoTransition?.value === 'true',
    notificationEmails: emails?.value ? JSON.parse(emails.value) : [],
  });
});

// NEW: PUT /api/v1/settings/eod
settingsRouter.put('/eod', requireRole('admin'), async (c) => {
  const body = await c.req.json();
  // Upsert the 3 EOD settings...
});
```

---

## 4. Shared Types

### 4.1 Updated Interface

**File:** `packages/shared/src/types/models.ts`

```typescript
// BEFORE
export interface EODSettings {
  storeId: string;
  operationalDayStartHour: number;
  allowAutoDayTransition: boolean;
  eodNotificationEmails: string[];
}

// AFTER (remove storeId)
export interface EODSettings {
  operationalDayStartHour: number;
  allowAutoDayTransition: boolean;
  eodNotificationEmails: string[];
}
```

---

## 5. Frontend Changes

### 5.1 Admin Portal - Settings Page

**File:** `apps/admin/src/pages/Settings.tsx`

**Current State:**
- Tax Rate, Currency, Transaction Prefix, etc.

**Add Section:** EOD Settings

```tsx
// New section to add in Settings.tsx

// State
const [eodSettings, setEodSettings] = useState({
  operationalDayStartHour: 6,
  allowAutoDayTransition: true,
  notificationEmails: '',
});

// Load on mount
useEffect(() => {
  api.get('/settings/eod').then(res => {
    setEodSettings({
      operationalDayStartHour: res.data.operationalDayStartHour,
      allowAutoDayTransition: res.data.allowAutoDayTransition,
      notificationEmails: res.data.notificationEmails?.join(', ') || '',
    });
  });
}, []);

// Save handler
const handleSaveEodSettings = async () => {
  const emails = eodSettings.notificationEmails
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  
  await api.put('/settings/eod', {
    operationalDayStartHour: eodSettings.operationalDayStartHour,
    allowAutoDayTransition: eodSettings.allowAutoDayTransition,
    notificationEmails: emails,
  });
};

// UI Components
return (
  <Section title="End of Day Settings">
    <FormField label="Operational Day Start Hour">
      <Select 
        value={eodSettings.operationalDayStartHour}
        onChange={v => setEodSettings({...eodSettings, operationalDayStartHour: v})}
      >
        {Array.from({length: 24}, (_, i) => (
          <option key={i} value={i}>{i}:00</option>
        ))}
      </Select>
      <HelpText>Hour when new operational day begins</HelpText>
    </FormField>
    
    <FormField label="Auto Day Transition">
      <Switch
        checked={eodSettings.allowAutoDayTransition}
        onChange={v => setEodSettings({...eodSettings, allowAutoDayTransition: v})}
      />
      <HelpText>Automatically advance to next day after EOD</HelpText>
    </FormField>
    
    <FormField label="Notification Emails">
      <Textarea
        value={eodSettings.notificationEmails}
        onChange={v => setEodSettings({...eodSettings, notificationEmails: v})}
        placeholder="email1@store.com, email2@store.com"
      />
      <HelpText>Comma-separated list of emails to receive EOD notifications</HelpText>
    </FormField>
    
    <Button onClick={handleSaveEodSettings}>Save EOD Settings</Button>
  </Section>
);
```

### 5.2 Admin Portal - Delete EOD Settings Page

**Files to Delete:**
- `apps/admin/src/pages/EODSettings.tsx`
- Remove route from `apps/admin/src/App.tsx`
- Remove menu item from `apps/admin/src/components/layout/Sidebar.tsx`

**Route to Remove:**
```typescript
// In App.tsx, REMOVE this route:
{
  path: '/settings/eod',
  element: <EODSettings />,
  loader: () => requirePermission('admin'),
},
```

**Sidebar Item to Remove:**
```typescript
// In Sidebar.tsx, REMOVE this item:
{
  label: 'EOD Settings',
  path: '/settings/eod',
  icon: <SunIcon />,
  permission: 'admin',
},
```

### 5.3 POS Web - End of Day Page

**File:** `apps/web/src/pages/EndOfDay.tsx`

**Current Behavior:**
```typescript
// Line ~80
const storeSettings = await api.get(`/stores/${storeId}/eod-settings`);
const operationalDayStartHour = storeSettings.data.operationalDayStartHour;
```

**New Behavior:**
```typescript
// Fetch from global settings
const settings = await api.get('/settings');
const operationalDayStartHour = parseInt(
  settings.data.eod_operational_day_start_hour || '6'
);
```

### 5.4 POS Web - EOD Store

**File:** `apps/web/src/stores/eodStore.ts`

**Changes:**
- Update `fetchPreEODSummary` to use global settings
- Optionally load EOD settings on store initialization

```typescript
// Add to initialization
export async function initializeEODSettings() {
  const settings = await api.get('/settings');
  return {
    operationalDayStartHour: parseInt(settings.data.eod_operational_day_start_hour || '6'),
    allowAutoDayTransition: settings.data.eod_allow_auto_transition === 'true',
  };
}
```

---

## 6. Data Flow

### 6.1 EOD Settings Read Flow

```
1. Admin/Manager opens Settings page
2. React component mounts
3. API call: GET /settings/eod
4. API queries app_settings table
5. Returns JSON with 3 EOD settings
6. UI renders form with current values
```

### 6.2 EOD Settings Write Flow

```
1. Admin modifies EOD settings
2. Clicks "Save"
3. API call: PUT /settings/eod with body
4. API upserts 3 rows in app_settings
5. Success response
6. UI shows confirmation
```

### 6.3 EOD Execution Flow (Notification)

```
1. User executes EOD
2. API reads eod_notification_emails from app_settings
3. Parses JSON array: ["admin@store.com", "mgr@store.com"]
4. Email service sends reports to all addresses
5. EOD completion recorded
```

---

## 7. Error Handling

### 7.1 Missing Settings

If settings are missing from `app_settings`, use defaults:

| Setting | Default |
|---------|---------|
| `eod_operational_day_start_hour` | `6` |
| `eod_allow_auto_transition` | `true` |
| `eod_notification_emails` | `[]` |

### 7.2 Invalid Values

- `eod_operational_day_start_hour`: Validate 0-23, default to 6
- `eod_allow_auto_transition`: Parse boolean, default to true
- `eod_notification_emails`: Validate JSON array, default to []

### 7.3 API Errors

- 401: Unauthorized (no permission)
- 403: Forbidden (not admin/manager)
- 500: Internal server error

---

## 8. Testing Requirements

### 8.1 Unit Tests

| Component | Test Cases |
|-----------|------------|
| Settings API | GET returns EOD settings, PUT updates EOD settings |
| Day Close API | Reads global EOD settings correctly |
| Admin UI | Form renders, validation works, save succeeds |
| POS UI | Loads settings, uses correct values |

### 8.2 Integration Tests

| Scenario | Expected Result |
|----------|-----------------|
| Admin saves EOD settings | Settings persisted in app_settings |
| EOD execution | Uses global settings for hour/auto-transition |
| Email notifications | Sent to globally configured addresses |
| Multiple stores | All use same EOD settings |

### 8.3 Migration Test

| Scenario | Expected Result |
|----------|-----------------|
| Run migration script | EOD settings copied from stores to app_settings |
| Existing stores after migration | EOD settings work as before |

---

## 9. Security Considerations

### 9.1 Access Control

- Only users with `admin` role can modify EOD settings
- `manager` role can view but not modify
- Enforced by `requireRole('admin')` middleware

### 9.2 Input Validation

- Validate email format in notification emails
- Sanitize inputs to prevent XSS
- Limit email array size (max 10 emails)

### 9.3 Audit Logging

Settings changes are already logged via existing audit log infrastructure in `stores.ts`.

---

## 10. Deployment Checklist

### 10.1 Pre-Deployment

- [ ] Database migration script reviewed
- [ ] Seed data updated
- [ ] API endpoints updated
- [ ] Admin UI changes tested
- [ ] POS UI changes tested
- [ ] Unit tests passing
- [ ] Integration tests passing

### 10.2 Deployment Steps

1. Deploy API changes
2. Run database migration script
3. Clear Redis/object cache (if any)
4. Deploy Admin UI changes
5. Deploy POS Web changes
6. Verify settings work

### 10.3 Post-Deployment Verification

- [ ] Admin can access Settings page
- [ ] EOD settings can be saved
- [ ] EOD preview shows correct operational day
- [ ] EOD execution sends notifications
- [ ] No errors in logs

---

## 11. Rollback Plan

### 11.1 API Rollback

- Revert API code changes
- Deploy previous version
- Settings continue to work (both store-level and global still valid)

### 11.2 Database Rollback

```sql
-- If needed, revert migration:
DELETE FROM app_settings WHERE key LIKE 'eod_%';
-- Store-level settings in 'stores' table are still valid
```

### 11.3 Frontend Rollback

- Deploy previous Admin UI
- POS Web continues to work (may need to revert to store-level settings)

---

## 12. File Reference Summary

### Files to Modify

| File | Change Type |
|------|-------------|
| `apps/api/src/db/seed.ts` | Add seed entries |
| `apps/api/src/routes/stores.ts` | Remove EOD endpoints |
| `apps/api/src/routes/day-close.ts` | Update settings lookup |
| `packages/shared/src/types/models.ts` | Update EODSettings interface |
| `apps/admin/src/pages/Settings.tsx` | Add EOD settings section |
| `apps/admin/src/App.tsx` | Remove route |
| `apps/admin/src/components/layout/Sidebar.tsx` | Remove menu item |
| `apps/web/src/pages/EndOfDay.tsx` | Use global settings |
| `apps/web/src/stores/eodStore.ts` | Update settings loading |

### Files to Delete

| File | Reason |
|------|--------|
| `apps/admin/src/pages/EODSettings.tsx` | Consolidated into Settings page |

### New Files

| File | Purpose |
|------|---------|
| `apps/api/src/db/migrations/migrate-eod-settings.sql` | One-time migration script |
| `docs/prd/prd-global-eod-settings.md` | Product requirements |
| `docs/features/fsd-global-eod-settings.md` | This document |

---

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Platform Team | Initial draft |
