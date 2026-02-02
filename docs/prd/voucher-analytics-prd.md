# Product Requirements Document: Voucher Analytics Dashboard

## Document Information

| Attribute | Value |
|-----------|-------|
| **Feature** | Voucher Analytics Dashboard |
| **Status** | Draft |
| **Version** | 1.0 |
| **Created** | 2026-01-29 |
| **Updated** | 2026-01-29 |
| **Priority** | P2 (Should Have) |
| **Feature ID** | VOUCHER-ANALYTICS |

---

## 1. Executive Summary

### Overview

The Voucher Analytics Dashboard enables Managers and Admins to monitor voucher and gift card performance across the POS system. This feature provides comprehensive insights into promotional effectiveness, gift card adoption, and customer redemption patterns, enabling data-driven decisions for future campaigns and inventory management.

### Key Outcomes

- **Gift Card Monitoring**: Track issuance, redemption rates, and outstanding balances
- **Promo Performance**: Measure discount effectiveness and redemption rates by promo type
- **Revenue Impact**: Understand how vouchers affect average order value and customer retention
- **Export Capabilities**: Generate reports for external analysis and accounting

### Quick Reference

| Aspect | Description |
|--------|-------------|
| **Access** | Manager or Admin roles only |
| **Refresh** | Manual only (user-triggered button) |
| **Date Range** | Today, Last 7 days, Last 30 days, Custom |
| **Charts Library** | recharts (existing in project) |
| **Export Formats** | CSV, PDF, Excel |

---

## 2. Problem Statement

### Current State

After implementing voucher functionality (Phases 1-4), there is no way to:
- Track how many vouchers are being used
- Measure promotional campaign effectiveness
- Monitor gift card liability (outstanding balances)
- Identify top-performing promotional types
- Export voucher data for accounting or analysis

### Pain Points

| Pain Point | Impact |
|------------|--------|
| **No visibility into voucher usage** | Cannot measure ROI of promotional campaigns |
| **Unknown gift card liability** | Financial reporting incomplete |
| **No promo performance data** | Cannot optimize discount strategies |
| **Manual tracking required** | Staff time wasted on manual reconciliation |
| **No export capability** | Cannot share data with external stakeholders |

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-24 | Manager | See total outstanding gift card balance | I can report accurate liability |
| US-25 | Manager | View promotional voucher redemption rate | I can measure campaign effectiveness |
| US-26 | Manager | Export voucher data to CSV | I can do external analysis |
| US-27 | Admin | See top performing promos by type | I can focus on high-performing campaigns |
| US-28 | Manager | Filter analytics by date range | I can compare different time periods |

---

## 3. Goals & Success Metrics

### Primary Goals

| Goal | Success Metric | Target |
|------|----------------|--------|
| Gift Card Visibility | Outstanding balance tracking | 100% accurate liability reporting |
| Promo Effectiveness | Redemption rate visibility | 80%+ promo utilization visibility |
| Dashboard Adoption | % of managers using analytics | 90% of managers check weekly |
| Report Generation | Export functionality usage | 50+ exports per month |

### Secondary Goals

- Identify underperforming promos for optimization
- Track refund-to-gift-card ratio
- Measure customer acquisition via gift cards
- Monitor seasonal voucher trends

---

## 4. Requirements

### 4.1 Gift Card Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Total Issued** | Gift Cards created (count + total value) | COUNT + SUM(initial_value) |
| **Total Redeemed** | Gift Cards used (count + total value) | COUNT + SUM(amount_applied) |
| **Outstanding Balance** | Unused value remaining | SUM(current_balance) |
| **Refund-to-Gift Card** | Created from refunds (count + value) | COUNT + SUM from refund flow |
| **Active vs Expired** | Breakdown by status | COUNT by is_void + expires_at |
| **Avg Usage per Card** | Mean value used per redeemed card | Total Redeemed / Redeemed Count |

### 4.2 Promotional Voucher Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Vouchers Created** | Total promos issued | COUNT by discount_type |
| **Vouchers Redeemed** | Total promos used | COUNT where status = USED |
| **Redemption Rate** | % of promos used | (Redeemed / Created) × 100 |
| **Total Discount Given** | Value of all discounts | SUM(discount_applied) |
| **Avg Discount per Voucher** | Mean discount per redemption | Total Discount / Redeemed Count |
| **Top Performing Promos** | Most used voucher types | GROUP BY discount_type |
| **Revenue Impact** | Orders with vouchers vs without | Compare AOV metrics |

### 4.3 Scope-Specific Metrics (for Promotional Vouchers)

| Scope | Metric Description |
|-------|-------------------|
| **ENTIRE_ORDER** | Total discount with tax impact |
| **ITEMS_ONLY** | Discount breakdown by category |
| **SUBTOTAL** | Pre-discount subtotal analysis |
| **SPECIFIC_ITEMS** | Target category/product performance |

### 4.4 Dashboard Views

#### View 1: Overview Summary Cards

```
┌─────────────────────────────────────────────────────────┐
│  Gift Cards        │  Promotional       │  Total       │
│  Outstanding       │  Discount Given    │  Usage       │
│  Rp 1,250,000      │  Rp 450,000        │  2,340       │
└─────────────────────────────────────────────────────────┘
```

**Summary Card Metrics:**
- Gift Card Outstanding Balance
- Total Promotional Discount Given
- Total Voucher Redemptions
- Average Redemption Rate (%)

#### View 2: Gift Card Performance Table

| KPI | Value | Trend |
|-----|-------|-------|
| Total Issued | 450 cards | +12% vs last month |
| Total Redeemed | 380 cards | +8% vs last month |
| Outstanding Balance | Rp 1,250,000 | -5% vs last month |
| Avg Usage per Card | Rp 72,222 | +3% vs last month |

**Trend Indicators:**
- Green: Positive trend (>5% improvement)
- Yellow: Stable (within ±5%)
- Red: Negative trend (>5% decline)

#### View 3: Promotional Performance Table

| Promo Type | Created | Redeemed | Redemption Rate | Total Discount |
|------------|---------|----------|-----------------|----------------|
| Percentage | 1,000 | 750 | 75% | Rp 125,000 |
| Fixed | 500 | 400 | 80% | Rp 80,000 |
| Free Item | 200 | 180 | 90% | Rp 36,000 (item value) |

#### View 4: Charts Section

| Chart Type | Data Shown | Library |
|------------|------------|---------|
| **Line Chart** | Daily/Weekly voucher usage trend | recharts |
| **Pie Chart** | Promo type distribution (%, Fixed, Free) | recharts |
| **Bar Chart** | Top 10 promos by redemption count | recharts |
| **Stacked Bar** | Gift Card issuance vs redemption over time | recharts |

**Chart Color Palette:**
```typescript
const CHART_COLORS = {
  giftCard: '#3B82F6',      // Blue
  percentage: '#10B981',    // Green
  fixed: '#F59E0B',         // Amber
  freeItem: '#8B5CF6',      // Purple
  redeemed: '#EF4444',      // Red
  issued: '#6B7280',        // Gray
};
```

#### View 5: Recent Transactions (Top 10)

| Date | Voucher Code | Type | Amount | Order ID |
|------|--------------|------|--------|----------|
| 2026-01-27 | GC12-ABC123XYZ45 | Gift Card | Rp 50,000 | ORD-001 |
| 2026-01-27 | PR34-PROMO2024AB | Percentage | Rp 10,000 | ORD-002 |
| 2026-01-26 | GC56-DEF98765432 | Gift Card | Rp 25,000 | ORD-003 |
| 2026-01-26 | PR12-FREE-COFFEE | Free Item | Rp 15,000 | ORD-004 |
| 2026-01-25 | GC99-XYZ12345678 | Gift Card | Rp 100,000 | ORD-005 |
| ... | ... | ... | ... | ... |

**Display Rules:**
- Maximum 10 rows
- Pagination if total > 10
- Sortable by Date (default desc), Amount, Type

### 4.5 Filters

| Filter | Options | Default | Behavior |
|--------|---------|---------|----------|
| **Date Range** | Today, Last 7 days, Last 30 days, Custom | Last 30 days | All metrics update |
| **Voucher Type** | All, Gift Card, Percentage, Fixed, Free Item | All | Filter all views |
| **Store** | All stores, Specific store | All stores | Multi-store support |
| **Status** | All, Active, Expired, Voided, Used | All | Filter by voucher status |
| **Created By** | All users, Specific user | All | Filter by creator |

**Date Range Picker UI:**
```
┌─────────────────────────────────────────┐
│  [📅 Last 30 days ▾]  [↻ Refresh]       │
│           [Start Date]  [End Date]       │
└─────────────────────────────────────────┘
```

### 4.6 Export Options

| Format | Description | Use Case |
|--------|-------------|----------|
| **CSV** | Raw data export with all columns | External analysis, Excel |
| **PDF** | Printable report with charts | Management reporting |
| **Excel** | Formatted spreadsheet with pivot tables | Accounting, detailed analysis |

**Export Data Includes:**
- All vouchers matching filter criteria
- Summary metrics
- Export timestamp
- Filter parameters used

---

## 5. API Requirements

### 5.1 Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/vouchers/analytics/summary` | Overview metrics | Manager/Admin |
| GET | `/api/v1/vouchers/analytics/gift-cards` | Gift Card metrics | Manager/Admin |
| GET | `/api/v1/vouchers/analytics/promos` | Promo metrics by type | Manager/Admin |
| GET | `/api/v1/vouchers/analytics/trend` | Time series data | Manager/Admin |
| GET | `/api/v1/vouchers/analytics/top` | Top performing promos | Manager/Admin |
| GET | `/api/v1/vouchers/analytics/transactions` | Recent transactions (top 10) | Manager/Admin |
| POST | `/api/v1/vouchers/analytics/export` | Generate export file | Manager/Admin |

### 5.2 Request/Response Examples

#### Summary Endpoint

**Request:**
```json
GET /api/v1/vouchers/analytics/summary?dateRange=last30days
```

**Response:**
```json
{
  "giftCards": {
    "totalIssued": { "count": 450, "value": 2500000 },
    "totalRedeemed": { "count": 380, "value": 1250000 },
    "outstandingBalance": 1250000,
    "refundToGiftCard": { "count": 45, "value": 225000 }
  },
  "promos": {
    "totalCreated": 1700,
    "totalRedeemed": 1330,
    "redemptionRate": 78.2,
    "totalDiscountGiven": 241000,
    "byType": {
      "PERCENTAGE": { "created": 1000, "redeemed": 750, "discount": 125000 },
      "FIXED": { "created": 500, "redeemed": 400, "discount": 80000 },
      "FREE_ITEM": { "created": 200, "redeemed": 180, "discount": 36000 }
    }
  },
  "period": {
    "start": "2026-01-01",
    "end": "2026-01-27"
  }
}
```

#### Transactions Endpoint

**Request:**
```json
GET /api/v1/vouchers/analytics/transactions?limit=10
```

**Response:**
```json
{
  "transactions": [
    {
      "date": "2026-01-27T10:30:00Z",
      "code": "GC12-ABC123XYZ45",
      "type": "GC",
      "amount": 50000,
      "orderId": "ord-001"
    },
    {
      "date": "2026-01-27T10:25:00Z",
      "code": "PR34-PROMO2024AB",
      "type": "PR",
      "discountType": "PERCENTAGE",
      "amount": 10000,
      "orderId": "ord-002"
    }
  ],
  "totalCount": 1250
}
```

#### Export Endpoint

**Request:**
```json
POST /api/v1/vouchers/analytics/export
{
  "format": "csv",
  "dateRange": "last30days",
  "voucherType": "all"
}
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "/api/v1/downloads/analytics-export-abc123.csv",
  "expiresAt": "2026-01-27T11:30:00Z"
}
```

### 5.3 Query Parameters

All endpoints support:
- `dateRange`: 'today' | 'last7days' | 'last30days' | 'custom'
- `startDate`: ISO date (required if dateRange='custom')
- `endDate`: ISO date (required if dateRange='custom')
- `storeId`: UUID (optional, for multi-store)
- `createdBy`: UUID (optional, filter by creator)

---

## 6. Frontend Requirements

### 6.1 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Voucher Analytics                                [📅 Last 30] │
│                                                 [🔄 Refresh]   │
├─────────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Gift Cards   │  │ Promo        │  │ Total        │         │
│  │ Outstanding  │  │ Discount     │  │ Redemptions  │         │
│  │ Rp 1.25M     │  │ Rp 241K      │  │ 1,710        │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Usage Trend (Last 30 Days)                            │  │
│  │  │∿∿∿∿∿\                                                │  │
│  │  └─────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────┐  ┌─────────────────────────┐    │
│  │  Promo Distribution     │  │  Top Performing Promos  │    │
│  │  ┌─────┐               │  │  1. 20% Coffee  - 450   │    │
│  │  │  %  │ 75%           │  │  2. Rp10 Off    - 380   │    │
│  │  │ Free│ 10%           │  │  3. Free Coffee - 180   │    │
│  │  └─────┘               │  │  4. 15% Cake    - 120   │    │
│  └─────────────────────────┘  └─────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Recent Transactions (Top 10)                          │  │
│  │  Date       Code          Type     Amount    Order     │  │
│  │  01/27      GC12-ABC...   GC       Rp 50K    ORD-001   │  │
│  │  01/27      PR34-PROMO... PR       Rp 10K    ORD-002   │  │
│  │  01/26      GC56-DEF...   GC       Rp 25K    ORD-003   │  │
│  │  ...                                                ... │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  [📊 Export CSV]  [📄 Export PDF]                            │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Component Structure

```
src/
├── pages/
│   └── VoucherAnalytics.tsx      # Main dashboard page
├── components/
│   └── analytics/
│       ├── SummaryCards.tsx      # Gift Card, Promo, Total cards
│       ├── UsageTrendChart.tsx   # Line chart
│       ├── PromoDistributionChart.tsx  # Pie chart
│       ├── TopPromosChart.tsx    # Bar chart
│       ├── RecentTransactions.tsx  # Table
│       └── ExportButtons.tsx     # CSV, PDF, Excel buttons
└── services/
    └── analytics.ts              # Analytics API client
```

### 6.3 Charts Library

**Library:** recharts (^3.6.0) - already used in admin dashboard

**Components Used:**
```typescript
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
```

### 6.4 State Management

**Data State:**
```typescript
interface AnalyticsState {
  summary: SummaryMetrics | null;
  giftCards: GiftCardMetrics | null;
  promos: PromoMetrics | null;
  trend: TrendData[];
  topPromos: TopPromo[];
  transactions: Transaction[];
  filters: AnalyticsFilters;
  isLoading: boolean;
  error: string | null;
}
```

---

## 7. User Experience

### 7.1 Happy Path Scenarios

#### Scenario 1: View Gift Card Outstanding Balance

1. Manager navigates to Voucher Analytics
2. Dashboard loads with default "Last 30 days" filter
3. Gift Card Outstanding card shows Rp 1,250,000
4. Manager can see breakdown: Issued (Rp 2.5M), Redeemed (Rp 1.25M)

#### Scenario 2: Analyze Promotional Performance

1. Manager selects "Last 7 days" date range
2. Promo Performance table updates
3. Manager sees "Percentage" promo has 75% redemption rate
4. Manager identifies "Free Item" as top performer (90% redemption)

#### Scenario 3: Export Data for Accounting

1. Manager clicks "Export CSV"
2. System generates CSV with all data matching current filters
3. Download starts automatically
4. Manager receives file with timestamp in filename

### 7.2 Error Handling

| Error | User Message | Resolution |
|-------|--------------|------------|
| API failure | "Failed to load analytics data. Please try again." | Retry or contact admin |
| Empty data | "No voucher data for selected period" | Change date range |
| Export failed | "Export failed. Please try again." | Retry export |
| Permission denied | "You don't have access to analytics" | Contact admin |

### 7.3 Loading States

- **Initial load:** Skeleton cards for all metrics
- **Refreshing:** Subtle loading indicator, keep previous data
- **Exporting:** Show "Generating..." toast notification

---

## 8. Implementation Plan

### Phase 5: Analytics Dashboard

| Task | Description | Effort |
|------|-------------|--------|
| Database Queries | Write optimized queries for all metrics | 0.5 day |
| Analytics API | Implement 7 endpoints | 1 day |
| Dashboard Layout | Frontend page structure | 0.5 day |
| Summary Cards | Implement 4 summary card components | 0.5 day |
| Charts Integration | Line, Pie, Bar charts with recharts | 1 day |
| Recent Transactions | Table with pagination | 0.5 day |
| Export Functionality | CSV, PDF, Excel generation | 0.5 day |
| Testing | Integration tests | 0.5 day |
| **Total** | | **5.5 days** |

### Implementation Order

1. Database queries for metrics
2. API endpoints
3. Frontend page layout
4. Summary cards + transactions table
5. Charts
6. Export functionality
7. Testing

---

## 9. Dependencies

| Dependency | Description | Status |
|------------|-------------|--------|
| **Voucher Core (Phases 1-4)** | Requires vouchers, voucher_transactions, order_vouchers tables | ✅ Complete |
| **recharts (^3.6.0)** | Charts library (existing in admin package) | ✅ Installed |
| **date-fns (^4.1.0)** | Date manipulation (existing) | ✅ Installed |
| **Export Libraries** | csv-stringify, pdfkit, xlsx (to be added if needed) | ⏳ Check |

---

## 10. Out of Scope (MVP)

| Feature | Reason |
|---------|--------|
| Real-time updates | Manual refresh sufficient for MVP |
| Scheduled reports | Email reports for later |
| Advanced analytics | Basic metrics only for MVP |
| Multi-currency | Single currency (IDR) for MVP |
| Comparative reports | Period-over-period for later |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large data sets | Slow query performance | Add pagination, optimize indexes |
| Chart rendering | Performance issues with many data points | Limit chart data points |
| Export timeouts | Large exports fail | Async export with email通知 |
| Permission bypass | Unauthorized access | Server-side role verification |

---

## 12. Acceptance Criteria

### Functional Acceptance Criteria

- [ ] Dashboard accessible by Manager and Admin roles only
- [ ] Summary cards show correct metrics
- [ ] Gift Card refunds shown separately from promo metrics
- [ ] Charts display accurate data based on date filter
- [ ] Filters (date, type, store, status) work correctly
- [ ] Refresh button updates all metrics and charts
- [ ] Recent Transactions table shows maximum 10 rows
- [ ] Export CSV generates valid file with all data
- [ ] Export PDF generates readable report with charts
- [ ] Export includes data matching current filters

### Non-Functional Acceptance Criteria

- [ ] Dashboard load time < 2 seconds
- [ ] Chart rendering < 500ms
- [ ] Export generation < 10 seconds for typical dataset
- [ ] 100% data accuracy for all metrics

### UI Acceptance Criteria

- [ ] Loading states show during data fetch
- [ ] Empty states show when no data available
- [ ] Charts are responsive across screen sizes
- [ ] Error messages are clear and actionable

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Redemption Rate** | Percentage of created vouchers that have been used |
| **Outstanding Balance** | Total remaining value on unredeemed gift cards |
| **Refund-to-Gift Card** | Gift Cards created from customer refunds |
| **AOV** | Average Order Value |
| **Usage Trend** | Daily/weekly pattern of voucher redemptions |

---

## 14. Related Documents

| Document | Description |
|----------|-------------|
| `docs/prd/voucher-payment-prd.md` | Main voucher feature PRD (Phases 1-6) |
| `docs/prd/voucher-payment-phase-2-prd.md` | Customer management & distribution |
| `docs/prd/voucher-payment-phase-2-prd.md#2a` | Phase 5 tracking in phase 2 PRD |

---

## 15. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | POS Team | Initial draft - separated from main voucher-payment-prd.md |
