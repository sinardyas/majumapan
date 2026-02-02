# Product Requirements Document: Currency Standardization & Multi-Currency Architecture

## Document Information

| Attribute | Value |
|-----------|-------|
| **Feature** | Currency Standardization & Multi-Currency Architecture |
| **Status** | DRAFT |
| **Version** | 1.0 |
| **Created** | 2026-02-02 |
| **Updated** | 2026-02-02 |
| **Priority** | P1 (Must Have) |
| **Target Release** | MVP 2.0 |

---

## 1. Executive Summary

### Overview

The POS system currently has inconsistent currency handling across the codebase. Some components use USD while others use IDR, creating confusion and potential errors. This document outlines the requirements to standardize currency to IDR for the MVP while building a flexible multi-currency architecture that can support USD, JPY, and other currencies in future releases.

### Key Outcomes

| Outcome | Description |
|---------|-------------|
| **Single Source of Truth** | Currency configuration stored in database, used throughout the application |
| **IDR for MVP** | All monetary values default to Indonesian Rupiah (IDR) |
| **Database-Backed Config** | Dynamic currency changes without redeployment |
| **Audit Trail** | Complete history of all currency configuration changes |
| **Exchange Rate Storage** | Pre-configured exchange rates for future multi-currency support |
| **Extensible Architecture** | Support additional currencies (USD, JPY, etc.) without major refactoring |
| **Consistent Formatting** | Unified currency display with proper locale formatting (Rp prefix, thousand separators) |

### Quick Reference

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| **Currency Storage** | Hardcoded in components | Database (app_settings table) |
| **Default Currency** | Inconsistent (USD/IDR) | IDR (configurable) |
| **Currency Configuration** | Not centralized | Single source in DB |
| **Formatting Utilities** | Multiple implementations | Single shared utility |
| **Database Storage** | Vouchers: IDR default, others: none | Currency field in transactions/day_closes |
| **API Response** | No currency info | Currency code included |
| **Locale** | Mixed (en-US, id-ID) | id-ID for MVP |
| **Audit Trail** | None | Full history in audit_logs |
| **Exchange Rates** | None | Stored in DB (read-only for MVP) |
| **Admin UI** | Not available | P2 feature (future) |

---

## 2. Problem Statement

### 2.1 Current State Analysis

#### Currency Usage by Component

| Component | File | Current Currency | Issue |
|-----------|------|------------------|-------|
| **POS Page** | `apps/web/src/pages/POS.tsx:90-95` | USD | Transaction amounts display as USD |
| **Transactions** | `apps/web/src/pages/Transactions.tsx:65-70` | USD | Transaction history in USD |
| **Dashboard** | `apps/web/src/pages/Dashboard.tsx:159-163` | USD | Sales metrics in USD |
| **Receipt** | `apps/web/src/components/pos/Receipt.tsx:14-18` | USD | Customer receipts show USD |
| **PDF Export** | `apps/api/src/services/pdf-export-service.ts:22-27` | USD | Reports in USD |
| **Admin Utils** | `apps/admin/src/lib/utils.ts:8-13` | USD (default) | Admin tools use USD |
| **Vouchers** | Multiple files | IDR | Correct |
| **Customer Mgmt** | Multiple files | IDR | Correct |
| **EOD Reports** | Multiple files | IDR | Correct |
| **Payments** | Multiple files | IDR | Correct |

#### Environment Configuration Conflict

```
.env file:
  CURRENCY=USD          ← Set to USD
  CURRENCY_SYMBOL=$     ← Dollar sign
  But code uses IDR     ← Major inconsistency
```

### 2.2 Pain Points

| Pain Point | Impact |
|------------|--------|
| **Incorrect Receipts** | Customers see wrong currency on receipts, damaging trust |
| **Staff Confusion** | Cashiers see different currencies in different screens |
| **Reporting Errors** | Management reports show incorrect totals |
| **Maintenance Burden** | Currency changes require editing multiple files, redeploying |
| **No Dynamic Changes** | Cannot change currency without code deployment |
| **No Audit Trail** | No record of currency configuration changes |
| **No Exchange Rates** | Cannot support future multi-currency transactions |
| **No Multi-Currency** | Cannot expand to other markets |

### 2.3 Business Justification

| Factor | Impact |
|--------|--------|
| **Customer Experience** | Receipts with wrong currency damage trust |
| **Operational Efficiency** | Staff training and support overhead |
| **Scalability** | Cannot expand to other markets |
| **Data Integrity** | Financial reports may be misinterpreted |
| **Maintenance** | Fixing currency bugs takes developer time |
| **Audit Requirements** | No record of configuration changes for compliance |

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Success Metric | Target |
|------|----------------|--------|
| **Standardize to IDR** | All displays show IDR | 100% of screens |
| **Database Configuration** | Currency from database | 100% of lookups |
| **Centralized Config** | Single config location | 1 table (app_settings) |
| **Consistent Formatting** | Unified utility function | Single formatCurrency |
| **IDR Locale** | Proper Rp prefix and separators | 100% compliance |
| **Extensible** | New currency with DB update | Add in < 5 minutes |
| **Audit Trail** | All currency changes logged | 100% coverage |
| **Exchange Rates** | Rates stored in database | All supported currencies |

### 3.2 Secondary Goals

- All API responses include currency code
- Database supports currency field per transaction (future)
- Exchange rate management ready (future)
- Currency formatting test coverage > 90%
- Graceful fallback when DB unavailable
- Rollback capability for currency changes

---

## 4. Requirements

### 4.1 Functional Requirements

#### 4.1.1 Database Configuration Storage

| Requirement | Description |
|-------------|-------------|
| **DBC-01** | Store currency configuration in `app_settings` table |
| **DBC-02** | Store exchange rates in `app_settings` table |
| **DBC-03** | Configuration stored as JSON for flexibility |
| **DBC-04** | Track configuration update timestamp |
| **DBC-05** | Track who updated configuration (user ID) |
| **DBC-06** | Support currency code ISO 4217 standard |
| **DBC-07** | Support exchange rate to base currency (IDR) |

**Database Schema:**

```sql
-- app_settings table already exists, add/update entries:

-- Currency Configuration
INSERT INTO app_settings (key, value, updated_at, updated_by)
VALUES (
  'currency_config',
  '{
    "code": "IDR",
    "symbol": "Rp",
    "locale": "id-ID",
    "decimals": 0,
    "thousandsSeparator": ".",
    "decimalSeparator": ",",
    "isActive": true
  }',
  NOW(),
  'system'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Exchange Rates (base: IDR)
INSERT INTO app_settings (key, value, updated_at, updated_by)
VALUES (
  'exchange_rates',
  '{
    "USD": 15650.00,
    "JPY": 102.50,
    "EUR": 16800.00,
    "GBP": 19800.00,
    "SGD": 11750.00,
    "MYR": 3520.00
  }',
  NOW(),
  'system'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

#### 4.1.2 Currency Configuration Schema

| Requirement | Description |
|-------------|-------------|
| **CFG-01** | Currency code (ISO 4217: IDR, USD, JPY, EUR, GBP, SGD, MYR) |
| **CFG-02** | Currency symbol (Rp, $, ¥, €, £, S$, RM) |
| **CFG-03** | Locale for formatting (id-ID, en-US, ja-JP, en-GB, etc.) |
| **CFG-04** | Decimal places (0 for IDR/JPY, 2 for others) |
| **CFG-05** | Thousands separator (.,) |
| **CFG-06** | Decimal separator (,) |
| **CFG-07** | Active status flag |

**Currency Config JSON Schema:**
```json
{
  "code": "IDR",
  "symbol": "Rp",
  "locale": "id-ID",
  "decimals": 0,
  "thousandsSeparator": ".",
  "decimalSeparator": ",",
  "isActive": true
}
```

#### 4.1.3 Exchange Rate Schema

| Requirement | Description |
|-------------|-------------|
| **EX-01** | Exchange rate to base currency (IDR) |
| **EX-02** | Last updated timestamp |
| **EX-03** | Source of exchange rate (manual, API, etc.) |
| **EX-04** | Validity period (optional) |

**Exchange Rates JSON Schema:**
```json
{
  "USD": 15650.00,
  "JPY": 102.50,
  "EUR": 16800.00,
  "GBP": 19800.00,
  "SGD": 11750.00,
  "MYR": 3520.00,
  "updatedAt": "2026-02-02T10:00:00Z",
  "source": "manual"
}
```

#### 4.1.4 Audit Trail

| Requirement | Description |
|-------------|-------------|
| **AUD-01** | Log all currency configuration changes |
| **AUD-02** | Record old and new configuration values |
| **AUD-03** | Track user who made the change |
| **AUD-04** | Record timestamp of change |
| **AUD-05** | Support rollback to previous configuration |
| **AUD-06** | Query audit history by date range |

**Audit Log Entry:**
```json
{
  "id": "uuid",
  "userId": "user_uuid",
  "userEmail": "admin@majumapan.com",
  "action": "UPDATE",
  "entityType": "currency_config",
  "entityId": "currency_config",
  "entityName": "Currency Configuration",
  "changes": {
    "old": {
      "code": "IDR",
      "symbol": "Rp"
    },
    "new": {
      "code": "USD",
      "symbol": "$"
    }
  },
  "createdAt": "2026-02-02T10:00:00Z"
}
```

#### 4.1.5 Unified Currency Formatting

| Requirement | Description |
|-------------|-------------|
| **FMT-01** | Single `formatCurrency(amount)` function used app-wide |
| **FMT-02** | Automatically applies correct symbol and locale from DB config |
| **FMT-03** | IDR: Shows "Rp" prefix, no decimals (e.g., "Rp 1.500.000") |
| **FMT-04** | USD: Shows "$" prefix, 2 decimals (e.g., "$ 1,500.00") |
| **FMT-05** | JPY: Shows "¥" symbol, no decimals (e.g., "¥ 150,000") |
| **FMT-06** | Parse formatted string back to number |
| **FMT-07** | Compact format for charts (e.g., "1,5M", "2,3K") |
| **FMT-08** | Fallback to shared config when DB unavailable |

#### 4.1.6 Database Schema Updates

| Requirement | Description |
|-------------|-------------|
| **DB-01** | Add `currency` field to transactions table (nullable) |
| **DB-02** | Add `currency` field to day_closes table |
| **DB-03** | Existing records default to 'IDR' |
| **DB-04** | Vouchers table keeps existing `currency` field |
| **DB-05** | Customer groups use configurable currency |

#### 4.1.7 API Changes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/config/currency` | Get current currency configuration | Public |
| GET | `/api/v1/config/currencies` | List supported currencies | Public |
| GET | `/api/v1/config/exchange-rates` | Get exchange rates | Public |
| GET | `/api/v1/config/currency/history` | Get configuration change history | Admin |
| POST | `/api/v1/config/currency` | Update currency configuration | Admin |
| POST | `/api/v1/config/exchange-rates` | Update exchange rates | Admin |
| POST | `/api/v1/config/currency/rollback` | Rollback to previous config | Admin |

**API Response Examples:**

```json
// GET /api/v1/config/currency
{
  "success": true,
  "data": {
    "code": "IDR",
    "symbol": "Rp",
    "locale": "id-ID",
    "decimals": 0,
    "thousandsSeparator": ".",
    "decimalSeparator": ",",
    "isActive": true,
    "updatedAt": "2026-02-02T10:00:00Z",
    "updatedBy": {
      "id": "uuid",
      "name": "Admin User",
      "email": "admin@majumapan.com"
    }
  }
}

// GET /api/v1/config/currencies
{
  "success": true,
  "data": {
    "supported": [
      { "code": "IDR", "name": "Indonesian Rupiah", "symbol": "Rp" },
      { "code": "USD", "name": "US Dollar", "symbol": "$" },
      { "code": "JPY", "name": "Japanese Yen", "symbol": "¥" },
      { "code": "EUR", "name": "Euro", "symbol": "€" },
      { "code": "GBP", "name": "British Pound", "symbol": "£" },
      { "code": "SGD", "name": "Singapore Dollar", "symbol": "S$" },
      { "code": "MYR", "name": "Malaysian Ringgit", "symbol": "RM" }
    ],
    "current": "IDR"
  }
}

// GET /api/v1/config/exchange-rates
{
  "success": true,
  "data": {
    "baseCurrency": "IDR",
    "rates": {
      "USD": 15650.00,
      "JPY": 102.50,
      "EUR": 16800.00,
      "GBP": 19800.00,
      "SGD": 11750.00,
      "MYR": 3520.00
    },
    "updatedAt": "2026-02-02T10:00:00Z",
    "source": "manual"
  }
}

// GET /api/v1/config/currency/history
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "action": "UPDATE",
        "oldConfig": { "code": "IDR", "symbol": "Rp" },
        "newConfig": { "code": "USD", "symbol": "$" },
        "changedBy": { "id": "uuid", "name": "Admin", "email": "admin@majumapan.com" },
        "changedAt": "2026-02-02T10:00:00Z"
      }
    ],
    "total": 1
  }
}

// POST /api/v1/config/currency
{
  "code": "IDR",
  "symbol": "Rp",
  "locale": "id-ID",
  "decimals": 0,
  "thousandsSeparator": ".",
  "decimalSeparator": ","
}

Response:
{
  "success": true,
  "data": {
    "message": "Currency configuration updated successfully"
  }
}
```

#### 4.1.8 Backend Service Updates

| Requirement | Description |
|-------------|-------------|
| **SVC-01** | All monetary API responses include `currency` field |
| **SVC-02** | Transaction totals include currency in response |
| **SVC-03** | Voucher responses include currency |
| **SVC-04** | Day close reports include currency |
| **SVC-05** | PDF/CSV exports use configured currency |
| **SVC-06** | Cache currency config for performance |
| **SVC-07** | Invalidate cache on config update |

**API Response Update Example:**

```json
// Before
{ "subtotal": 100000, "total": 111000 }

// After
{ "subtotal": 100000, "total": 111000, "currency": "IDR" }
```

#### 4.1.9 Frontend Updates

| Requirement | Description |
|-------------|-------------|
| **FE-01** | Remove all hardcoded currency parameters |
| **FE-02** | Fetch currency config on app initialization |
| **FE-03** | Import `formatCurrency` from shared library |
| **FE-04** | Display loading/error states during config fetch |
| **FE-05** | Compact number format for charts |
| **FE-06** | Fallback to IDR if config fetch fails |

**Files to Update:**

| File | Current Currency | Updated |
|------|------------------|---------|
| `apps/web/src/pages/POS.tsx` | USD | Use config |
| `apps/web/src/pages/Transactions.tsx` | USD | Use config |
| `apps/web/src/pages/Dashboard.tsx` | USD | Use config |
| `apps/web/src/components/pos/Receipt.tsx` | USD | Use config |
| `apps/api/src/services/pdf-export-service.ts` | USD | Use config |
| `apps/admin/src/lib/utils.ts` | USD (default) | Use config |

### 4.2 Non-Functional Requirements

#### 4.2.1 Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Currency formatting latency | < 5ms | Client-side, cached |
| API config response | < 100ms | Cached on server |
| Migration execution | < 30s | For 100K records |
| Cache invalidation | < 1s | After config update |

#### 4.2.2 Security

| Requirement | Description |
|-------------|-------------|
| Currency config update | Admin role only |
| Exchange rate update | Admin role only |
| Currency field validation | ISO 4217 codes only |
| Audit logging | All changes logged |
| No currency in URL params | Prevent manipulation |

#### 4.2.3 Availability

| Requirement | Description |
|-------------|-------------|
| Fallback config | Use shared package defaults if DB unavailable |
| Caching | Client-side cache with TTL |
| Offline mode | Works with cached currency config |
| Graceful degradation | Format currency even if config fetch fails |

#### 4.2.4 Compatibility

| Requirement | Description |
|-------------|-------------|
| Existing transactions | Preserved in IDR |
| Existing vouchers | Preserved with original currency |
| Browser support | Modern browsers (ES2020+) |
| Node.js version | 18+ |

#### 4.2.5 Extensibility

| Requirement | Description |
|-------------|-------------|
| Add new currency | Update DB config, no code change |
| Currency symbols | From ISO 4217 standard |
| Exchange rates | Stored in DB, ready for future use |
| Multi-currency transactions | Schema supports (future feature) |
| Per-store currency | Architecture ready (not in scope) |

---

## 5. Implementation Plan

### Phase 1: Foundation (Days 1-3)

#### 1.1 Create Shared Currency Configuration

**Location:** `packages/shared/src/config/currency.ts`

```typescript
export const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  IDR: {
    code: 'IDR',
    symbol: 'Rp',
    locale: 'id-ID',
    decimals: 0,
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    locale: 'ja-JP',
    decimals: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    locale: 'de-DE',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    locale: 'en-GB',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    locale: 'en-SG',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  MYR: {
    code: 'MYR',
    symbol: 'RM',
    locale: 'ms-MY',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
};

export function getCurrencyConfig(code: string): CurrencyConfig {
  return CURRENCY_CONFIG[code] || CURRENCY_CONFIG['IDR'];
}

export function isValidCurrency(code: string): boolean {
  return code in CURRENCY_CONFIG;
}
```

#### 1.2 Create Unified Formatting Utility

**Location:** `packages/shared/src/utils/currency.ts`

```typescript
import { getCurrencyConfig, type CurrencyConfig } from '../config/currency';

interface CurrencyFormattingOptions {
  currency?: string;
  decimals?: number;
  compact?: boolean;
  symbol?: string;
}

export function formatCurrency(
  amount: number | string,
  options: CurrencyFormattingOptions = {}
): string {
  const currencyCode = options.currency || 'IDR';
  const config = getCurrencyConfig(currencyCode);
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return 'Invalid amount';
  
  if (options.compact) {
    return formatCompact(numAmount, config);
  }
  
  const decimals = options.decimals ?? config.decimals;
  
  const formatter = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  const formattedNumber = formatter.format(numAmount);
  
  return `${config.symbol} ${formattedNumber}`;
}

export function formatCompact(amount: number, config: CurrencyConfig): string {
  const formatter = new Intl.NumberFormat(config.locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return `${config.symbol} ${formatter.format(amount)}`;
}

export function parseCurrency(formatted: string, currencyCode: string = 'IDR'): number {
  const config = getCurrencyConfig(currencyCode);
  const cleanString = formatted
    .replace(config.symbol, '')
    .replace(config.thousandsSeparator, '')
    .replace(config.decimalSeparator, '.')
    .trim();
  
  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatPercent(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(
  value: number,
  config: CurrencyConfig,
  decimals?: number
): string {
  const dec = decimals ?? config.decimals;
  const formatter = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  return formatter.format(value);
}
```

#### 1.3 Database Migration

**Script:** `apps/api/src/db/migrations/003_currency_standardization.sql`

```sql
-- Migration for Currency Standardization

-- 1. Add currency columns to existing tables if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE transactions ADD COLUMN currency VARCHAR(3) DEFAULT 'IDR';
  END IF;
  
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'day_closes' AND column_name = 'currency'
  ) THEN
    ALTER TABLE day_closes ADD COLUMN currency VARCHAR(3) DEFAULT 'IDR';
  END IF;
END $$;

-- 2. Update existing null values to IDR
UPDATE transactions SET currency = 'IDR' WHERE currency IS NULL;
UPDATE day_closes SET currency = 'IDR' WHERE currency IS NULL;

-- 3. Initialize currency configuration in app_settings
-- This will be seeded by the application on startup
```

### Phase 2: Backend Implementation (Days 4-6)

#### 2.1 Create Config Service

**Location:** `apps/api/src/services/config-service.ts`

```typescript
import { db } from '../db';
import { appSettings, auditLogTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { CURRENCY_CONFIG } from '@pos/shared/config/currency';

interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  isActive?: boolean;
}

interface ExchangeRates {
  [currency: string]: number;
}

interface ExchangeRatesData {
  rates: ExchangeRates;
  updatedAt: string;
  source: string;
}

export const configService = {
  async getCurrencyConfig(): Promise<CurrencyConfig | null> {
    const result = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'currency_config'),
    });
    
    if (!result) {
      // Return default IDR config
      return {
        code: 'IDR',
        symbol: 'Rp',
        locale: 'id-ID',
        decimals: 0,
        thousandsSeparator: '.',
        decimalSeparator: ',',
        isActive: true,
      };
    }
    
    try {
      return JSON.parse(result.value) as CurrencyConfig;
    } catch {
      return null;
    }
  },
  
  async setCurrencyConfig(
    config: CurrencyConfig,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const existing = await this.getCurrencyConfig();
    
    await db.transaction(async (tx) => {
      // Update config
      await tx.insert(appSettings)
        .values({
          key: 'currency_config',
          value: JSON.stringify(config),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value: JSON.stringify(config),
            updatedAt: new Date(),
          },
        });
      
      // Log audit trail
      await tx.insert(auditLogTable).values({
        userId,
        userEmail,
        action: 'UPDATE',
        entityType: 'currency_config',
        entityId: 'currency_config',
        entityName: 'Currency Configuration',
        changes: {
          old: existing,
          new: config,
        },
        createdAt: new Date(),
      });
    });
  },
  
  async getExchangeRates(): Promise<ExchangeRatesData | null> {
    const result = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'exchange_rates'),
    });
    
    if (!result) {
      return null;
    }
    
    try {
      const data = JSON.parse(result.value);
      return {
        rates: data,
        updatedAt: result.updatedAt?.toISOString() || new Date().toISOString(),
        source: 'manual',
      };
    } catch {
      return null;
    }
  },
  
  async setExchangeRates(
    rates: ExchangeRates,
    userId: string,
    userEmail: string,
    source: string = 'manual'
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Update rates
      await tx.insert(appSettings)
        .values({
          key: 'exchange_rates',
          value: JSON.stringify(rates),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value: JSON.stringify(rates),
            updatedAt: new Date(),
          },
        });
      
      // Log audit trail
      await tx.insert(auditLogTable).values({
        userId,
        userEmail,
        action: 'UPDATE',
        entityType: 'exchange_rates',
        entityId: 'exchange_rates',
        entityName: 'Exchange Rates',
        changes: { rates },
        createdAt: new Date(),
      });
    });
  },
  
  async getCurrencyHistory(limit: number = 50) {
    const history = await db.query.auditLogTable.findMany({
      where: eq(auditLogTable.entityType, 'currency_config'),
      orderBy: (auditLog, { desc }) => [desc(auditLog.createdAt)],
      limit,
    });
    
    return history;
  },
  
  async getSupportedCurrencies() {
    return Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
      code,
      name: new Intl.DisplayNames([config.locale], { type: 'currency' }).of(code),
      symbol: config.symbol,
    }));
  },
};
```

#### 2.2 Create Config API Routes

**Location:** `apps/api/src/routes/config.ts`

```typescript
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { configService } from '../services/config-service';

const configRouter = new Hono();

configRouter.get('/currency', async (c) => {
  try {
    const config = await configService.getCurrencyConfig();
    if (!config) {
      return c.json({ success: false, error: 'Currency configuration not found' }, 404);
    }
    return c.json({ success: true, data: config });
  } catch (error) {
    console.error('Get currency config error:', error);
    return c.json({ success: false, error: 'Failed to get currency configuration' }, 500);
  }
});

configRouter.get('/currencies', async (c) => {
  try {
    const supported = await configService.getSupportedCurrencies();
    const current = await configService.getCurrencyConfig();
    return c.json({ success: true, data: { supported, current: current?.code } });
  } catch (error) {
    console.error('Get currencies error:', error);
    return c.json({ success: false, error: 'Failed to get currencies' }, 500);
  }
});

configRouter.get('/exchange-rates', async (c) => {
  try {
    const rates = await configService.getExchangeRates();
    return c.json({ success: true, data: rates });
  } catch (error) {
    console.error('Get exchange rates error:', error);
    return c.json({ success: false, error: 'Failed to get exchange rates' }, 500);
  }
});

configRouter.get('/currency/history', authMiddleware, requirePermission('settings:read'), async (c) => {
  try {
    const history = await configService.getCurrencyHistory();
    return c.json({ success: true, data: { history, total: history.length } });
  } catch (error) {
    console.error('Get currency history error:', error);
    return c.json({ success: false, error: 'Failed to get history' }, 500);
  }
});

configRouter.post('/currency', authMiddleware, requirePermission('settings:edit'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    
    const { code, symbol, locale, decimals, thousandsSeparator, decimalSeparator } = body;
    
    if (!code || !symbol || !locale) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }
    
    await configService.setCurrencyConfig(
      {
        code,
        symbol,
        locale,
        decimals: decimals ?? 0,
        thousandsSeparator: thousandsSeparator ?? ',',
        decimalSeparator: decimalSeparator ?? '.',
        isActive: true,
      },
      user.userId,
      user.email
    );
    
    return c.json({ success: true, data: { message: 'Currency configuration updated' } });
  } catch (error) {
    console.error('Update currency config error:', error);
    return c.json({ success: false, error: 'Failed to update currency configuration' }, 500);
  }
});

configRouter.post('/exchange-rates', authMiddleware, requirePermission('settings:edit'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    
    const { rates, source } = body;
    
    if (!rates || typeof rates !== 'object') {
      return c.json({ success: false, error: 'Invalid rates format' }, 400);
    }
    
    await configService.setExchangeRates(rates, user.userId, user.email, source);
    
    return c.json({ success: true, data: { message: 'Exchange rates updated' } });
  } catch (error) {
    console.error('Update exchange rates error:', error);
    return c.json({ success: false, error: 'Failed to update exchange rates' }, 500);
  }
});

export default configRouter;
```

### Phase 3: Frontend Updates (Days 7-9)

#### 3.1 Update Frontend Components

**Pattern for all components:**

```typescript
// Before
import { formatCurrency } from '@/lib/utils';
const total = formatCurrency(100000, { currency: 'USD' });

// After
import { formatCurrency } from '@pos/shared/utils/currency';
// Currency automatically loaded from API/config
const total = formatCurrency(100000);
```

#### 3.2 Create Frontend Config Hook

```typescript
// apps/web/src/hooks/useCurrencyConfig.ts
import { useState, useEffect } from 'react';
import { api } from '@/services/api';

interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}

export function useCurrencyConfig() {
  const [config, setConfig] = useState<CurrencyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await api.get('/config/currency');
        if (response.success) {
          setConfig(response.data);
        } else {
          setError('Failed to load currency config');
        }
      } catch {
        // Fallback to IDR
        setConfig({
          code: 'IDR',
          symbol: 'Rp',
          locale: 'id-ID',
          decimals: 0,
          thousandsSeparator: '.',
          decimalSeparator: ',',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  return { config, loading, error };
}
```

### Phase 4: Testing & Polish (Days 10-13)

#### 4.1 Testing Requirements

| Test Type | Coverage | Tools |
|-----------|----------|-------|
| Unit Tests | formatCurrency variants | Vitest |
| Integration | Config API endpoints | Supertest |
| E2E | Receipt formatting | Playwright |
| Migration | Database migration | pgbench |

#### 4.2 Test Cases

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| IDR formatting | 1500000 | "Rp 1.500.000" |
| USD formatting | 1500.00 | "$ 1,500.00" |
| JPY formatting | 150000 | "¥ 150,000" |
| IDR compact | 1500000 | "Rp 1,5M" |
| Parse IDR | "Rp 1.500.000" | 1500000 |
| Fallback (no config) | 1000 | "Rp 1.000" |

#### 4.3 Acceptance Criteria

- [ ] All POS screens display IDR with correct formatting
- [ ] Receipts show "Rp" prefix and proper thousand separators
- [ ] Admin reports display correct currency
- [ ] PDF exports use correct symbol
- [ ] No USD symbols anywhere in the application
- [ ] Currency config API returns correct values
- [ ] Exchange rates stored in database
- [ ] Audit trail shows all configuration changes
- [ ] Migration script completes without errors
- [ ] Existing data preserved correctly
- [ ] Fallback to IDR when DB unavailable

---

## 6. User Experience

### 6.1 Before/After Comparison

#### POS Screen

| Before | After |
|--------|-------|
| Total: $ 1,500.00 | Total: Rp 1.500.000 |
| Change: $ 50.00 | Change: Rp 50.000 |

#### Receipt

| Before | After |
|--------|-------|
| ``` | ``` |
| TOTAL: $ 150.00 | TOTAL: Rp 150.000 |
| CASH: $ 200.00 | CASH: Rp 200.000 |
| CHANGE: $ 50.00 | CHANGE: Rp 50.000 |
| ``` | ``` |

#### Admin Dashboard

| Before | After |
|--------|-------|
| Total Sales: $ 15,000.00 | Total Sales: Rp 15.000.000 |
| Revenue: $ 1,500.00 | Revenue: Rp 1.500.000 |

### 6.2 Error Handling

| Scenario | Message | Action |
|----------|---------|--------|
| Currency config failed to load | "Unable to load currency settings. Using default (IDR)." | Show toast, use IDR fallback |
| Invalid currency code | "Invalid currency configuration" | Log error, use IDR |
| Formatting error | "Unable to format price" | Show raw number with note |
| DB unavailable | "Using cached currency settings" | Show indicator |

---

## 7. Analytics & Reporting

### 7.1 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Currency config in DB | 100% | Database query |
| Audit trail coverage | 100% | Config changes logged |
| Currency config usage | 100% | Code coverage |
| Receipt accuracy | 100% | Manual testing |
| Migration success rate | 100% | Database verification |

### 7.2 Migration Metrics

| Metric | Target |
|--------|--------|
| Data preserved | 100% |
| Migration time | < 30 seconds |
| Downtime | 0 (online migration) |
| Rollback time | < 5 minutes |

---

## 8. Security Considerations

| Risk | Mitigation |
|------|------------|
| Currency manipulation | Admin-only write access |
| Invalid currency codes | Validate against ISO 4217 |
| XSS in formatting | Output encoding in formatCurrency |
| Config injection | Database-level validation |
| Unauthorized updates | RBAC: settings:edit permission |
| Audit tampering | Immutable audit log entries |

---

## 9. Future Enhancements

### 9.1 Phase 2: Admin UI (Future)

| Feature | Description |
|---------|-------------|
| **Settings Page** | Admin UI to change currency configuration |
| **Exchange Rate Management** | UI to update exchange rates |
| **Currency History View** | Visual audit trail in admin panel |
| **Currency Preview** | See how receipts/reports will look |

### 9.2 Future Features (Beyond MVP)

| Feature | Description |
|---------|-------------|
| **Multi-Currency Transactions** | Allow different currencies per sale |
| **Real-Time Exchange Rates** | Fetch rates from external API |
| **Currency Conversion** | Convert historical data to new currency |
| **Per-Store Currency** | Different currencies per store location |
| **Payment Method Currencies** | Different currencies per payment type |
| **Regional Pricing** | Price lists by currency/region |

---

## 10. Effort Estimate

| Phase | Task | Effort |
|-------|------|--------|
| **Phase 1** | Shared Currency Configuration | 1 day |
| | Unified Formatting Utility | 1 day |
| | Database Migration | 0.5 day |
| **Phase 2** | Config Service | 1 day |
| | Config API Routes | 1 day |
| | Authentication/Authorization | 0.5 day |
| **Phase 3** | Frontend POS Updates | 1 day |
| | Admin Dashboard Updates | 0.5 day |
| | PDF Export Updates | 0.5 day |
| **Phase 4** | Unit Tests | 1 day |
| | Integration Tests | 0.5 day |
| | E2E Tests | 0.5 day |
| | Documentation | 0.5 day |
| **Total** | | **10 days** |

---

## 11. Dependencies

| Dependency | Description | Status |
|------------|-------------|--------|
| Drizzle ORM | Database operations | ✓ Available |
| Shared packages | Shared utilities | ✓ Available |
| Hono | API framework | ✓ Available |
| Intl API | Number formatting | ✓ Available |
| React | Frontend framework | ✓ Available |

---

## 12. Appendix

### A. ISO 4217 Currency Codes

| Code | Currency | Symbol | Decimals | Locale |
|------|----------|--------|----------|--------|
| IDR | Indonesian Rupiah | Rp | 0 | id-ID |
| USD | US Dollar | $ | 2 | en-US |
| JPY | Japanese Yen | ¥ | 0 | ja-JP |
| EUR | Euro | € | 2 | de-DE |
| GBP | British Pound | £ | 2 | en-GB |
| SGD | Singapore Dollar | S$ | 2 | en-SG |
| MYR | Malaysian Ringgit | RM | 2 | ms-MY |

### B. Currency Config Schema Reference

```typescript
interface CurrencyConfig {
  code: string;                    // ISO 4217 code (IDR, USD, JPY)
  symbol: string;                  // Currency symbol (Rp, $, ¥)
  locale: string;                  // BCP 47 locale (id-ID, en-US, ja-JP)
  decimals: number;                // Decimal places (0, 2)
  thousandsSeparator: string;      // Grouping separator (.,)
  decimalSeparator: string;        // Decimal separator (,)
  isActive?: boolean;              // Active status
}
```

### C. Exchange Rates Schema Reference

```typescript
interface ExchangeRatesData {
  baseCurrency: string;            // IDR
  rates: {
    [currencyCode: string]: number; // Rate to base
  };
  updatedAt: string;               // ISO timestamp
  source: string;                  // 'manual', 'api'
}
```

### D. Files to Create/Modify

| File | Type | Action |
|------|------|--------|
| `packages/shared/src/config/currency.ts` | Create | Currency definitions |
| `packages/shared/src/utils/currency.ts` | Create | Formatting utilities |
| `apps/api/src/db/migrations/003_*.sql` | Create | Database migration |
| `apps/api/src/services/config-service.ts` | Create | Config business logic |
| `apps/api/src/routes/config.ts` | Create | API endpoints |
| `apps/web/src/hooks/useCurrencyConfig.ts` | Create | React hook |
| `apps/web/src/pages/POS.tsx` | Modify | Use formatCurrency |
| `apps/web/src/pages/Transactions.tsx` | Modify | Use formatCurrency |
| `apps/web/src/pages/Dashboard.tsx` | Modify | Use formatCurrency |
| `apps/web/src/components/pos/Receipt.tsx` | Modify | Use formatCurrency |
| `apps/admin/src/lib/utils.ts` | Modify | Remove hardcoded USD |
| `apps/api/src/services/pdf-export-service.ts` | Modify | Use currency config |

### E. API Permission Matrix

| Endpoint | Method | Permission Required |
|----------|--------|---------------------|
| `/api/v1/config/currency` | GET | Public |
| `/api/v1/config/currencies` | GET | Public |
| `/api/v1/config/exchange-rates` | GET | Public |
| `/api/v1/config/currency/history` | GET | settings:read |
| `/api/v1/config/currency` | POST | settings:edit |
| `/api/v1/config/exchange-rates` | POST | settings:edit |

### F. Rollback Procedure

If currency configuration causes issues:

```sql
-- View audit history
SELECT * FROM audit_logs 
WHERE entity_type = 'currency_config' 
ORDER BY created_at DESC;

-- Manual rollback (update app_settings directly)
UPDATE app_settings 
SET value = '{"code":"IDR","symbol":"Rp","locale":"id-ID","decimals":0,"thousandsSeparator":".","decimalSeparator":","}'
WHERE key = 'currency_config';
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-02 | Product Team | Initial draft |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | | | |
| Engineering Lead | | | |
| QA Lead | | | |
| Design Lead | | | |
