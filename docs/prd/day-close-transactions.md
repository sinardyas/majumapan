# Product Requirements Document (PRD)

## View Transaction Details in Day Close History

| Document Info | |
|---------------|--|
| **Project** | Majumapan POS |
| **Feature** | Day Close Transaction Details |
| **Version** | 1.0 |
| **Status** | Draft |
| **Created** | 2026-01-26 |
| **Owner** | Platform Team |

---

## 1. Overview

### 1.1 Background

Currently, the Day Close History allows admins to view summary information and reports for each store's daily operations. However, admins cannot see individual transaction details within a day close, limiting their ability to analyze performance at a granular level.

### 1.2 Problem Statement

- Day Close Detail page has 5 tabs (Sales, Cash, Inventory, Audit, Shifts)
- The "Audit" tab only shows the first 20 transactions
- No ability to view individual transaction line items (products purchased)
- Admins cannot drill down into specific transactions for analysis
- Transaction data is not easily accessible for performance review

### 1.3 Proposed Solution

Add a new "Transactions" tab to the Day Close Detail page that displays:
- Complete list of all transactions for the day (paginated)
- Voided transactions shown prominently with visual distinction
- Expandable transaction rows showing line items (paginated at 20 items per page)
- Transaction totals, payment method, and status
- Filtering and search capabilities

### 1.4 Goals

- Enable admins to review individual transactions within any day close
- Provide granular analysis capabilities for store performance
- Improve visibility into transaction-level data
- Support audit and compliance requirements
- Maintain performance with pagination for large transaction counts

### 1.5 Out of Scope

- Real-time transaction monitoring (separate feature)
- Transaction editing/voiding from this view
- Advanced analytics beyond basic listing
- Customer-level transaction history
- Adding transactions to CSV export (existing exports sufficient)

---

## 2. Business Requirements

### 2.1 User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-1 | Admin | View all transactions for a specific day close | I can verify transaction accuracy |
| US-2 | Admin | See voided transactions prominently displayed | I can investigate anomalies quickly |
| US-3 | Admin | Expand a transaction to see line items | I can understand what products were sold |
| US-4 | Admin | Search/filter transactions by amount or payment method | I can find specific transactions quickly |
| US-5 | Manager | Review voided transactions in a day close | I can investigate anomalies |
| US-6 | Admin | Navigate through paginated transactions | I can browse large transaction sets efficiently |
| US-7 | Admin | View line items paginated for large transactions | I can analyze detailed purchases without performance issues |

### 2.2 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Transaction detail access time | < 3 seconds | Load time |
| Transaction list completeness | 100% (all transactions) | Data validation |
| Voided transaction visibility | Prominently marked | UI audit |
| Line items pagination | 20 items per page | Performance |
| User satisfaction | Positive feedback | User survey |

---

## 3. Functional Requirements

### 3.1 New "Transactions" Tab

**Location:** Day Close Detail page (`/admin/day-close/:id`)

**Tab Content:**
1. Transaction summary header (total count, completed, voided, total amount, total refunds)
2. Filter controls (status, payment method, search)
3. Paginated transaction list (25 per page)
4. Expandable transaction rows with:
   - Transaction header (number, time, status, cashier)
   - Line items (paginated at 20 items per page)
   - Payment details (method, amount, change)
   - Discount applied (if any)

### 3.2 Voided Transaction Display

Voided transactions must be shown prominently with:
- Red background or border
- "VOIDED" badge
- Void reason if available
- All line items still visible

### 3.3 Data to Display Per Transaction

| Field | Source | Display |
|-------|--------|---------|
| Transaction Number | `transactions.transaction_number` | Yes |
| Timestamp | `transactions.created_at` | Yes |
| Cashier | `transactions.cashier_id` → users.name | Yes |
| Items Count | COUNT(transaction_items) | Yes |
| Subtotal | `transactions.subtotal` | Yes |
| Tax | `transactions.tax_amount` | Yes |
| Discount | `transactions.discount_amount` | Yes |
| Total | `transactions.total` | Yes |
| Payment Method | `transactions.payment_method` | Yes |
| Status | `transactions.status` | Yes (with visual distinction) |

### 3.4 Line Items to Display Per Transaction

| Field | Source | Display |
|-------|--------|---------|
| Product Name | `transaction_items.product_name` | Yes |
| SKU | `transaction_items.product_sku` | Yes |
| Quantity | `transaction_items.quantity` | Yes |
| Unit Price | `transaction_items.unit_price` | Yes |
| Discount | `transaction_items.discount_value` | Yes |
| Subtotal | `transaction_items.subtotal` | Yes |

### 3.5 Line Items Pagination

- Paginate at 20 items per page
- Previous/Next navigation within line items
- "Items X-Y of Z" indicator

### 3.6 Filtering Requirements

| Filter | Options | Default |
|--------|---------|---------|
| Status | All, Completed, Voided, Pending Sync | All |
| Payment Method | All, Cash, Card | All |
| Search | Transaction number, cashier name | Empty |

### 3.7 Transaction List Pagination

- Page size: 25 transactions per page
- Navigation: Page numbers (1, 2, 3...), Previous/Next
- "Showing X-Y of Z transactions" indicator
- Total count display

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Transaction list loads in < 3 seconds for up to 500 transactions
- Expand/collapse animation: < 200ms
- Filter/search response: < 500ms
- Line items pagination for transactions with 20+ items

### 4.2 Security
- Same role requirements as existing Day Close (admin, manager)
- No sensitive data exposure
- Audit logging of access

### 4.3 Compatibility
- Works on desktop and tablet
- Responsive design
- Accessible (keyboard navigation, screen reader support)

### 4.4 Data Integrity
- Transactions queried by time period (existing pattern)
- No direct foreign key to day close (uses period_start/period_end)
- Line items loaded on-demand for expanded rows

---

## 5. Dependencies

| Dependency | Description | Status |
|------------|-------------|--------|
| transactions table | Existing - primary data source | Ready |
| transaction_items table | Existing - line items | Ready |
| transaction_payments table | Existing - payment details | Ready |
| users table | Existing - cashier names | Ready |
| Day Close Detail page | Existing - UI container | Ready |
| Day Close API endpoints | Existing - data access | Ready |

---

## 6. Constraints & Assumptions

### 6.1 Constraints
- Must use existing database schema (no schema changes)
- Must integrate with existing Day Close Detail page structure
- Must follow existing UI patterns in admin portal
- Must not add transactions to CSV export
- Must use pagination for both transaction list and line items

### 6.2 Assumptions
- Average store has < 500 transactions per day
- Maximum transaction line items < 100 per transaction
- Transaction data is not modified after day close
- Admins have permission to view all store data
- Pagination of 25 transactions and 20 line items is acceptable

---

## 7. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Large transaction lists cause performance issues | Medium | Low | Implement pagination (25/page), lazy loading |
| Transaction data not linked to day close | Medium | Low | Use time-period queries (existing pattern) |
| UI complexity increases | Low | Medium | Follow existing tab patterns, keep clean |
| Voided transactions not noticeable | Medium | Low | Use red background/border, "VOIDED" badge |

---

## 8. Timeline

| Phase | Duration | Deliverables | Status |
|-------|----------|--------------|--------|
| Documentation | 0.5 day | PRD, FSD | ✅ Complete |
| Implementation | 2-3 days | Code changes | ✅ Complete |
| Testing | 1 day | QA, UAT | ☐ Pending |
| Deployment | 0.5 day | Release | ☐ Pending |

**Total Estimated Time: 4-5 days**

---

## 9. Approval

| Role | Name | Status | Date |
|------|------|--------|------|
| Product Owner | TBD | ☐ | |
| Engineering Lead | TBD | ☐ | |
| QA Lead | TBD | ☐ | |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Platform Team | Initial draft |
| 1.1 | 2026-01-27 | Platform Team | Implementation complete - Enhanced Audit tab with pagination, filters, expandable rows, and line items |
| 1.2 | 2026-01-27 | Platform Team | Fixed navigation path from /admin/day-close/ to /eod/day-close/ |
| 1.3 | 2026-01-27 | Platform Team | Fixed time period filters in Sales, Cash, Inventory, Audit tabs |
| 1.4 | 2026-01-27 | Platform Team | Fixed shift breakdown - overlapping shifts query, cashier name lookup, auto-close active shifts |
| 1.6-01-5 | 20227 | Platform Team | Fixed back button navigation path |

---

## 11. Future Enhancement: PDF Export for Day Close Reports

### 11.1 Overview

Add PDF export capability for Day Close History and Day Close Detail pages, enabling users to download comprehensive PDF reports with all sales, cash, inventory, audit, and shift data.

### 11.2 Requirements

| Requirement | Description |
|-------------|-------------|
| 11.2.1 | PDF export from Day Close History page |
| 11.2.2 | PDF export from Day Close Detail page |
| 11.2.3 | Email report includes PDF attachment |
| 11.2.4 | Comprehensive PDF content (all 5 reports + full transaction list) |

### 11.3 PDF Content Layout

```
┌─────────────────────────────────────────────────────┐
│  MAJUMAPAN - DAY CLOSE REPORT                       │
│  Date: January 27, 2026                             │
│  Store: Main Store                                  │
│  Day Close #: DC-20260127-001                       │
├─────────────────────────────────────────────────────┤
│  SUMMARY                                            │
│  ─────────────────────────────────────────────────  │
│  Total Sales: $12,345.67                            │
│  Transactions: 156                                  │
│  Cash Revenue: $8,234.50                            │
│  Card Revenue: $4,111.17                            │
├─────────────────────────────────────────────────────┤
│  CASH RECONCILIATION                                │
│  ─────────────────────────────────────────────────  │
│  Opening Float: $500.00                             │
│  Cash Sales: $8,234.50                              │
│  Expected Cash: $8,734.50                           │
│  Total Variance: $12.50                             │
├─────────────────────────────────────────────────────┤
│  INVENTORY MOVEMENT                                 │
│  ─────────────────────────────────────────────────  │
│  Top Products Sold:                                 │
│  - Coffee: 245 sold                                 │
│  - Tea: 189 sold                                    │
│  Low Stock Alerts: 3 items                          │
├─────────────────────────────────────────────────────┤
│  TRANSACTIONS (Full List)                           │
│  ─────────────────────────────────────────────────  │
│  #001  09:15  John    $45.00  Cash  ✓               │
│  #002  09:30  Jane    $82.50  Card ✓                │
│  ... (all transactions with line items)             │
├─────────────────────────────────────────────────────┤
│  SHIFT BREAKDOWN                                    │
│  ─────────────────────────────────────────────────  │
│  John: Opening $200, Closing $445, Variance $0      │
│  Jane: Opening $300, Closing $580, Variance -$5     │
├─────────────────────────────────────────────────────┤
│  Generated: January 27, 2026 14:30                  │
│  Closed By: Admin User                              │
└─────────────────────────────────────────────────────┘
```

### 11.4 Technical Implementation

#### 11.4.1 Backend

| Component | Technology | Description |
|-----------|------------|-------------|
| PDF Library | pdfkit ^0.15.0 | Generate PDF documents |
| Export Service | `pdf-export-service.ts` | New service for PDF generation |
| API Endpoint | `GET /day-close/:id/export/pdf/all` | Download PDF endpoint |
| Email Service | Update `sendEODNotification()` | Support PDF attachment |

#### 11.4.2 Frontend

| Component | Description |
|-----------|-------------|
| Download Button | Add PDF button in Day Close History actions column |
| Download Handler | `handleDownloadPDF()` function |
| Icon | FileText icon from lucide-react |

### 11.5 File Changes

| File | Action |
|------|--------|
| `apps/api/package.json` | Add `pdfkit: ^0.15.0` |
| `apps/api/src/services/pdf-export-service.ts` | Create new file |
| `apps/api/src/routes/day-close.ts` | Add PDF endpoint, modify email endpoint |
| `apps/api/src/services/email-service.ts` | Support PDF attachment |
| `apps/admin/src/pages/DayCloseHistory.tsx` | Add PDF download button |
| `apps/admin/src/pages/DayCloseDetail.tsx` | Add PDF download button |

### 11.6 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/day-close/:id/export/pdf/all` | Download comprehensive PDF report |
| POST | `/day-close/:id/email` | Send email with PDF attachment |

### 11.7 Estimated Effort

| Phase | Tasks | Time |
|-------|-------|------|
| Backend PDF Service | Create pdf-export-service.ts with all report sections | 2-3 hours |
| Backend Endpoint | Add PDF export endpoint | 30 minutes |
| Frontend UI | Add PDF download button | 30 minutes |
| Email Integration | Update email to attach PDF | 1 hour |
| Testing | Manual testing and fixes | 30 minutes |
| **Total** | | **4-5 hours** |

### 11.8 Dependencies

```json
// apps/api/package.json
{
  "dependencies": {
    "pdfkit": "^0.15.0"
  }
}
```

### 11.9 PDF Sections

| Section | Content |
|---------|---------|
| Cover Page | Store name, day close number, date, operational date |
| Summary | Total sales, transactions, cash/card revenue, status |
| Daily Sales | Top products, sales by hour |
| Cash Reconciliation | Opening float, cash sales, expected cash, variance, shift breakdown |
| Inventory Movement | Items sold, low stock alerts, reorder recommendations |
| Transactions | Full list with transaction number, time, cashier, items, total, payment, status |
| Shifts | Shift aggregation with variance per cashier |

### 11.10 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Platform Team | Initial draft |
| 1.1 | 2026-01-27 | Platform Team | Implementation complete - Enhanced Audit tab |
| 1.2 | 2026-01-27 | Platform Team | Fixed navigation paths and time period filters |
| 1.3 | 2026-01-27 | Platform Team | Fixed shift breakdown issues |
| 1.4 | 2026-01-27 | Platform Team | Fixed back button navigation |
| 1.5 | 2026-01-27 | Platform Team | Added PDF Export feature plan |
