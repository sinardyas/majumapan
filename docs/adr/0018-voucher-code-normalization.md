# ADR 0018: Voucher Code Normalization Strategy

## Status

**IMPLEMENTED** ✓

## Context

A critical bug exists in the voucher validation flow where vouchers created in the Admin panel cannot be found when attempting to use them in POS transactions. The error "Voucher not found" appears even with the correct voucher code.

### Problem Flow

1. **Admin creates voucher** → Code stored as `GCAB-CD12-3456-7890` (19 chars with dashes)
2. **User enters code in POS** → Enters `GCABCD123456789XYZ` or `GCAB-CD12-3456-7890`
3. **POS validates** → Normalizes to `GCABCD123456789XYZ` (removes dashes)
4. **Backend lookup** → `getByCode()` normalizes AGAIN (redundant)
5. **Query** → Looks for `GCABCD123456789XYZ` in database
6. **Database has** → `GCAB-CD12-3456-7890` (with dashes)
7. **Result** → No match found → "Voucher not found" error

### Affected Components

| File | Role | Issue |
|------|------|-------|
| `apps/api/src/services/voucher-service.ts` | Backend service | Double normalization in `validateVoucher()` and `getByCode()` |
| `apps/api/src/routes/distribution.ts` | Distribution API | No normalization before DB lookup |
| Database (`vouchers` table) | Storage | Stores codes with dashes (length: 19) |

## Decision

**Chosen Option:** Normalize voucher codes at storage time - store all codes without dashes in the database.

### Code Format

| Aspect | Current | Target |
|--------|---------|--------|
| **Storage Format** | `XXXX-XXXX-XXXX-XXXX` (19 chars with dashes) | `XXXXXXXXXXXXXXXX` (16 chars, no dashes) |
| **Example** | `GCAB-CD12-3456-7890` | `GCABCD1234567890` |
| **Display Format** | N/A | `XXXX-XXXX-XXXX-XXXX` (for readability) |

### Implementation

#### 1. Update Voucher Service (`apps/api/src/services/voucher-service.ts`)

**`generateVoucherCode()` - Now returns 16 chars without dashes:**
```typescript
export function generateVoucherCode(type: 'GC' | 'PR'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomPart = Array.from({ length: 12 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');

  const checkDigits = generateCheckDigits(type + randomPart);
  return type + randomPart + checkDigits;  // 16 chars, no dashes
}
```

**`getByCode()` - Normalizes user input to match stored format:**
```typescript
async getByCode(code: string) {
  const normalized = code.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
  const voucher = await db.query.vouchers.findFirst({
    where: eq(vouchers.code, normalized),
  });
  return voucher || null;
}
```

#### 2. Update Distribution Routes (`apps/api/src/routes/distribution.ts`)

Added normalization before DB lookups in two locations (lines ~113 and ~237):
```typescript
const normalizedCode = parsed.voucherCode.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
const voucherList = await db.select()
  .from(vouchers)
  .where(eq(vouchers.code, normalizedCode))
  .limit(1);
```

#### 3. Update Schema (`apps/api/src/db/schema.ts`)

```typescript
// Changed from VARCHAR(19) to VARCHAR(16)
code: varchar('code', { length: 16 }).notNull().unique(),
```

#### 4. Migration Script

**File:** `apps/api/drizzle/0014_voucher_code_normalization.sql`

```sql
-- Remove dashes from all existing voucher codes
UPDATE vouchers SET code = REPLACE(code, '-', '');

-- Verify all codes are now 16 characters
SELECT id, code, LENGTH(code) as code_length
FROM vouchers
WHERE LENGTH(code) != 16;
```

#### 5. Admin Display (`apps/admin/src/pages/Vouchers.tsx`)

Added helper function to format codes with dashes for readability:
```typescript
const formatCodeDisplay = (code: string) => {
  return code.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4');
};
```

## Consequences

### Positive

- **Fixes the bug:** Vouchers will be findable regardless of input format
- **Consistent format:** Single source of truth for code format
- **Simpler lookups:** No redundant normalization needed
- **Better performance:** Simpler queries without multiple normalization steps

### Negative

- **Breaking change:** Requires database migration
- **Existing data:** Must migrate existing voucher codes
- **Display updates:** Admin UI needs formatting for display

### Neutral

- **Code length reduced:** 19 → 16 characters (minor)

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `apps/api/src/services/voucher-service.ts` | Modified | Updated code generation to return 16 chars without dashes |
| `apps/api/src/routes/distribution.ts` | Modified | Added normalization before lookups |
| `apps/api/src/db/schema.ts` | Modified | Updated VARCHAR length to 16 |
| `apps/api/drizzle/0014_voucher_code_normalization.sql` | **NEW** | Migration script |
| `apps/admin/src/pages/Vouchers.tsx` | Modified | Added formatCodeDisplay helper for display |

## Verification

| Criterion | Status |
|-----------|--------|
| TypeScript compilation passes | ✓ |
| Voucher lookup works with/without dashes | ✓ |
| New vouchers created correctly (16 chars) | ✓ |
| Admin display shows codes with dashes | ✓ |

## Rollback Plan

If issues arise:
1. Restore from database backup
2. Or run:
```sql
UPDATE vouchers SET code = 
  SUBSTRING(code, 1, 4) || '-' ||
  SUBSTRING(code, 5, 4) || '-' ||
  SUBSTRING(code, 9, 4) || '-' ||
  SUBSTRING(code, 13, 4);
```

## Effort

| Task | Duration |
|------|----------|
| Backend service updates | 1 hour |
| Distribution routes update | 30 minutes |
| Schema update | 15 minutes |
| Migration script | 30 minutes |
| Frontend display update | 15 minutes |
| Testing | 2 hours |
| **Total** | **~5 hours** |

## Acceptance Criteria

- [x] New vouchers created in Admin can be validated in POS
- [x] "Voucher not found" error no longer occurs for valid codes
- [x] All existing vouchers (after migration) still work
- [x] Code format is consistent: 16 chars without dashes in storage
- [x] Admin display shows codes with dashes for readability
- [x] TypeScript compilation passes

## Related Documents

- **Parent PRD:** `docs/prd/voucher-payment-prd.md` (Section 4.1.2 - Code Format)
- **Database Schema:** `apps/api/src/db/schema.ts`
- **Voucher Service:** `apps/api/src/services/voucher-service.ts`

---

*ADR 0018 - Created: 2026-02-02 - **Implemented: 2026-02-02***
