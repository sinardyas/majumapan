# ADR 0020: Voucher Quantity Limitation System

## Status

**Implemented** - Completed on February 3, 2026

## Context

As the POS system matures, there's a need to implement more sophisticated voucher usage controls. Currently, vouchers have basic activation/expiration controls and gift cards have balance limits, but there's no way to:

1. Limit the total number of times a voucher can be used across all customers
2. Restrict how many times a single customer can use a voucher
3. Impose daily usage caps on vouchers
4. Track and enforce these limits during both online and offline transactions

These limitations are critical for:
- Promotional campaigns with limited quantities
- Partner/sponsor vouchers with usage restrictions
- Preventing voucher abuse
- Compliance with promotional terms

## Decision

Implement a comprehensive voucher quantity limitation system with three types of limits:

1. **Total Usage Limit** - Maximum total uses across all customers
2. **Per-Customer Limit** - Maximum uses per individual customer
3. **Daily Limit** - Maximum uses per day (aggregate or per-customer)

### Database Schema Changes

#### New Columns on `vouchers` Table

```sql
ALTER TABLE vouchers ADD COLUMN total_usage_limit INTEGER;
ALTER TABLE vouchers ADD COLUMN current_usage_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE vouchers ADD COLUMN per_customer_limit INTEGER;
ALTER TABLE vouchers ADD COLUMN daily_limit INTEGER;
```

#### New Table: `voucher_customer_usage`

Tracks per-customer usage for per-customer limit enforcement:

```sql
CREATE TABLE voucher_customer_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(voucher_id, customer_id)
);
CREATE INDEX idx_vcu_customer ON voucher_customer_usage(customer_id);
CREATE INDEX idx_vcu_voucher ON voucher_customer_usage(voucher_id);
```

#### New Table: `voucher_daily_usage`

Tracks daily usage for daily limit enforcement:

```sql
CREATE TABLE voucher_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  usage_date DATE NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(voucher_id, usage_date),
  UNIQUE(voucher_id, customer_id, usage_date)
);
CREATE INDEX idx_vdu_voucher ON voucher_daily_usage(voucher_id);
```

### Validation Logic

When validating a voucher, the system performs these checks in order:

```
1. Check if voucher exists and is active
2. Check expiration date
3. Check totalUsageLimit (if set):
   - Fail if currentUsageCount >= totalUsageLimit
4. Check perCustomerLimit (if set AND customerId provided):
   - Fail if customer usage count >= perCustomerLimit
5. Check dailyLimit (if set):
   - Fail if daily usage count >= dailyLimit
6. For GC: Check balance > 0
7. Return validation result
```

### Usage Tracking

When a voucher is used:

1. **Total Usage Count**: Increment `vouchers.current_usage_count`
2. **Per-Customer Usage**: Insert or update `voucher_customer_usage`
3. **Daily Usage**: Insert or update `voucher_daily_usage`

### Offline Support

For offline transactions, usage tracking is handled through the sync mechanism:
- Usage records are created locally
- Synced to server during online reconnection
- Server resolves conflicts and updates limits atomically

### API Changes

#### Validate Endpoint

```typescript
POST /api/vouchers/validate
{
  code: string,
  cartItems?: CartItem[],
  subtotal?: number,
  customerId?: string  // NEW: for per-customer limit checks
}
```

#### Response

```typescript
{
  valid: boolean,
  error?: string,
  voucher?: Voucher
}
```

### Admin Interface Changes

#### VoucherRuleBuilder

Added "Usage Limits" section to the voucher creation/editing form:
- Total Usage Limit input
- Per Customer Limit input
- Daily Limit input

#### Vouchers Table

Added "Usage" column showing:
- `currentUsageCount / totalUsageLimit` (e.g., "3/10")
- Daily limit indicator
- Per-customer limit indicator

### Design Decisions

1. **Backward Compatible**: All new fields are nullable (`NULL` = unlimited). Existing vouchers work unchanged.

2. **Per-Customer is Optional**: Skip per-customer limit check if no `customerId` is provided. This allows anonymous/guest usage.

3. **Additional Constraints**: New limits are **additional** constraints on top of existing behavior. A promo code (PR) with no limits still works as before (single-use).

4. **Daily Limit is Aggregate**: By default, `dailyLimit` applies to all customers combined. When a customerId is provided, per-customer daily tracking is also recorded.

5. **Index Strategy**: Optimized for common query patterns:
   - `idx_vcu_voucher_customer` (composite unique index)
   - `idx_vdu_voucher_date` (composite unique index)

### Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `apps/api/src/db/schema.ts` | Modified | Added limit fields to vouchers table, created new tables, added relations |
| `apps/api/src/services/voucher-service.ts` | Modified | Updated validateVoucher() and useVoucher() with limit checks and usage tracking |
| `apps/api/src/routes/vouchers.ts` | Modified | Pass customerId to validate endpoint |
| `apps/admin/src/services/voucher.ts` | Modified | Added limit fields to interfaces |
| `apps/admin/src/components/pos/VoucherRuleBuilder.tsx` | Modified | Added usage limit fields to form |
| `apps/admin/src/pages/Vouchers.tsx` | Modified | Added usage column display |
| `apps/api/drizzle/0015_voucher_quantity_limits.sql` | New | Database migration script |

### Migration

```bash
cd apps/api
npm run db:migrate
```

### Testing Checklist

- [x] TypeScript compilation passes
- [x] Database migration runs successfully
- [x] Can create voucher with total usage limit
- [x] Can create voucher with per-customer limit
- [x] Can create voucher with daily limit
- [ ] Validation fails when total limit reached
- [ ] Validation fails when per-customer limit reached (with customer)
- [ ] Validation fails when daily limit reached
- [ ] Existing vouchers work unchanged (NULL = unlimited)
- [ ] Usage counts are tracked correctly
- [ ] Admin table displays usage info correctly

### Rollback Plan

To rollback this change:

1. Remove the new columns from the `vouchers` table:
   ```sql
   ALTER TABLE vouchers DROP COLUMN IF EXISTS total_usage_limit;
   ALTER TABLE vouchers DROP COLUMN IF EXISTS current_usage_count;
   ALTER TABLE vouchers DROP COLUMN IF EXISTS per_customer_limit;
   ALTER TABLE vouchers DROP COLUMN IF EXISTS daily_limit;
   ```

2. Drop the new tables:
   ```sql
   DROP TABLE IF EXISTS voucher_customer_usage;
   DROP TABLE IF EXISTS voucher_daily_usage;
   ```

3. Revert code changes in:
   - `apps/api/src/services/voucher-service.ts`
   - `apps/api/src/routes/vouchers.ts`
   - `apps/admin/src/services/voucher.ts`
   - `apps/admin/src/components/pos/VoucherRuleBuilder.tsx`
   - `apps/admin/src/pages/Vouchers.tsx`

## Consequences

### Positive

- Enables sophisticated promotional campaigns with usage controls
- Prevents voucher abuse and overuse
- Maintains backward compatibility
- Supports both online and offline scenarios
- Clear usage tracking and reporting

### Negative

- Increased database complexity with new tables
- Additional validation overhead during voucher processing
- Requires migration for existing deployments

## References

- Previous related ADRs:
  - [ADR 0018: Voucher Code Normalization](./0018-voucher-code-normalization.md)
  - [ADR 0019: Voucher Sync Support](./0019-voucher-sync-support.md)
