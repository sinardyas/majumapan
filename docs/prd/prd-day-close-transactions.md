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
| Documentation | 0.5 day | PRD, FSD | ☐ In Progress |
| Implementation | 2-3 days | Code changes | ☐ Pending |
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
