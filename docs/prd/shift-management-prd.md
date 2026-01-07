# Shift Management PRD

## 1. Overview

### 1.1 Purpose
Enable cashiers to open and close their work shifts with proper cash float management, authorization controls, and end-of-shift reporting.

### 1.2 Scope
- Shift opening/closing workflows
- Cash float reconciliation
- Supervisor-only authorization for large discrepancies
- Shift summary reports
- Offline-first with scheduler sync

---

## 2. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | Cashier | Open my shift with a starting float | I can begin serving customers |
| US-02 | Cashier | Close my shift with ending cash count | My accountability is recorded |
| US-03 | Cashier | View my shift summary at day end | I know my performance |
| US-04 | Supervisor | Open/close any cashier's shift | I can handle handover scenarios |
| US-05 | Supervisor | Approve shift discrepancies >$5 | Large variances are reviewed |
| US-06 | System | Log all shift activities | Audit trail is maintained |
| US-07 | System | Sync shift data when offline | No data is lost |

---

## 3. Functional Requirements

### 3.1 Shift Opening

#### 3.1.1 Pre-conditions
- User must be authenticated
- User must have supervisor role OR no active shift exists
- System must be online or using offline mode with scheduler

#### 3.1.2 Data Collected
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| floatAmount | number | Yes | Starting cash in drawer |
| openingNote | string | No | Any observations at shift start |
| openingImage | image | No | Photo of cash count (optional) |

#### 3.1.3 Workflow
```
1. Cashier taps "Start Shift"
2. System validates user has no active shift
3. Cashier enters float amount
4. (Optional) Adds opening note
5. System records:
   - shiftId (UUID)
   - cashierId
   - storeId
   - openingFloat
   - openingTimestamp
   - openingNote
6. Shift status: ACTIVE
7. Cashier can now process transactions
```

#### 3.1.4 Offline Behavior
- Store shift opening locally in IndexedDB
- Mark with `syncStatus: 'pending'`
- Sync via scheduler when online

---

### 3.2 Shift Closing

#### 3.2.1 Pre-conditions
- User must have an ACTIVE shift
- All pending transactions must be completed

#### 3.2.2 Data Collected
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| endingCash | number | Yes | Actual cash in drawer |
| endingNote | string | No | Any observations at shift end |
| signature | boolean | Yes | Digital acknowledgment |

#### 3.2.3 Workflow
```
1. Cashier taps "End Shift"
2. System calculates:
   - expectedCash = openingFloat + cashSales - cashRefunds - paidOuts
   - variance = endingCash - expectedCash
3. Cashier counts and enters endingCash
4. System displays:
   - Expected: $XXX.XX
   - Actual: $XXX.XX
   - Variance: +$X.XX / -$X.XX
5. Cashier adds optional note
6. Cashier confirms with signature
7. If variance > $5:
   - Supervisor PIN required
   - Reason must be entered
8. System records:
   - closingTimestamp
   - endingCash
   - variance
   - varianceApprovedBy (if applicable)
   - varianceReason (if applicable)
9. Shift status: CLOSED
10. Shift summary generated
```

#### 3.2.4 Variance Handling
| Variance Range | Action Required | Block Closing? |
|----------------|-----------------|----------------|
| ±$0.01 - $0.99 | Log only | No |
| ±$1.00 - $5.00 | Comment required | No |
| ±$5.00+ | Supervisor PIN + Reason | Yes, until approved |

---

### 3.3 Shift Summary Report

Generated at shift close, accessible anytime for closed shifts.

#### 3.3.1 Report Contents
```
┌─────────────────────────────────────────┐
│           SHIFT SUMMARY                  │
├─────────────────────────────────────────┤
│ Cashier: John Doe                        │
│ Date: Jan 7, 2025                        │
│ Status: Closed                           │
├─────────────────────────────────────────┤
│ OPENING                                  │
│ Float:           $100.00                 │
│ Note: All counts verified                │
├─────────────────────────────────────────┤
│ TRANSACTIONS                             │
│ Total Sales:     $523.45                 │
│ Cash Sales:      $178.00                 │
│ Card Sales:      $345.45                 │
│ Refunds:         $12.50                  │
│ Paid Out:        $20.00                  │
├─────────────────────────────────────────┤
│ CLOSING                                  │
│ Expected:        $257.50                 │
│ Actual:          $256.80                 │
│ Variance:        -$0.70                  │
│ Status: Forgiven                        │
├─────────────────────────────────────────┤
│ SUMMARY                                  │
│ Transactions:  42                       │
│ Items Sold:    67                        │
│ Avg Transaction: $12.46                  │
├─────────────────────────────────────────┤
│                                         │
│ Signed: Jan 7, 2025 2:30 PM              │
└─────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 Shifts Table
```typescript
interface Shift {
  id: string;
  cashierId: string;
  storeId: string;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  
  // Opening
  openingFloat: number;
  openingNote?: string;
  openingImage?: string;
  openingTimestamp: string;
  
  // Closing
  endingCash?: number;
  endingNote?: string;
  closingTimestamp?: string;
  
  // Variance
  variance?: number;
  varianceReason?: string;
  varianceApprovedBy?: string;
  varianceApprovedAt?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
}
```

### 4.2 Shift Transactions (Optional Tracking)
```typescript
interface ShiftTransaction {
  id: string;
  shiftId: string;
  transactionId: string;
  type: 'SALE' | 'REFUND' | 'PAID_OUT';
  cashAmount: number;
  cardAmount: number;
  timestamp: string;
}
```

---

## 5. API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/shifts/open` | Open a new shift | Cashier |
| POST | `/api/shifts/close` | Close active shift | Cashier |
| POST | `/api/shifts/close-approve` | Approve large variance | Supervisor |
| GET | `/api/shifts/active` | Get current active shift | Cashier |
| GET | `/api/shifts/:id` | Get shift details | Cashier |
| GET | `/api/shifts/:id/report` | Get shift summary PDF | Cashier |
| GET | `/api/shifts` | List shifts (with filters) | Supervisor |

---

## 6. Authorization Matrix

| Action | Cashier | Supervisor | Admin |
|--------|---------|------------|-------|
| View own active shift | ✅ | ✅ | ✅ |
| View own shift history | ✅ | ✅ | ✅ |
| View others' shifts | ❌ | ✅ | ✅ |
| Open shift | ✅ | ✅ | ✅ |
| Close shift (variance <$5) | ✅ | ✅ | ✅ |
| Close shift (variance >$5) | ❌ | ✅ | ✅ |
| Approve variance | ❌ | ✅ | ✅ |
| Delete/cancel shift | ❌ | ❌ | ✅ |

---

## 7. Offline Behavior

### 7.1 When Offline
- Store shift open/close locally in IndexedDB
- Mark with `syncStatus: 'pending'`
- Show offline indicator on shift screen

### 7.2 Sync Strategy
- Use existing scheduler (runs every 5 min when online)
- Priority: HIGH (shifts are financial records)
- Retry logic: 3 attempts, then flag for manual review

---

## 8. UI Mockups

### 8.1 Open Shift Screen
```
┌────────────────────────────────────────┐
│         START YOUR SHIFT               │
├────────────────────────────────────────┤
│                                        │
│  Float Amount                          │
│  ┌────────────────────────────────┐    │
│  │ $100.00                       │    │
│  └────────────────────────────────┘    │
│                                        │
│  Opening Note (optional)               │
│  ┌────────────────────────────────┐    │
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
│  [ START SHIFT ]                       │
│                                        │
└────────────────────────────────────────┘
```

### 8.2 Close Shift Screen
```
┌────────────────────────────────────────┐
│           END YOUR SHIFT               │
├────────────────────────────────────────┤
│                                        │
│  💰 CASH RECONCILIATION                │
│                                        │
│  Expected Cash:        $257.50         │
│  ┌────────────────────────────────┐    │
│  │ Count & Enter:  $256.80        │    │
│  └────────────────────────────────┘    │
│                                        │
│  Variance: -$0.70 ✓                    │
│                                        │
│  [ END SHIFT & SIGN ]                  │
│                                        │
└────────────────────────────────────────┘
```

### 8.3 Large Variance Warning
```
┌────────────────────────────────────────┐
│         ⚠️ LARGE VARIANCE             │
├────────────────────────────────────────┤
│                                        │
│  Expected:          $257.50            │
│  Entered:           $245.00            │
│  Variance:         -$12.50 ❌          │
│                                        │
│  🔒 Supervisor PIN Required            │
│  ┌────────────────────────────────┐    │
│  │ ●●●●                          │    │
│  └────────────────────────────────┘    │
│                                        │
│  Reason for variance:                  │
│  ┌────────────────────────────────┐    │
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
│  [ APPROVE & CLOSE ]                   │
│                                        │
└────────────────────────────────────────┘
```

---

## 9. Non-Functional Requirements

### 9.1 Performance
- Shift open/close: <2 seconds online, <500ms offline
- Report generation: <3 seconds

### 9.2 Security
- All shift actions logged to audit trail
- Supervisor PIN verification via API
- Digital signature capture

### 9.3 Reliability
- 99.9% uptime for shift operations
- Auto-sync with retry logic
- Data validation on both client and server

---

## 10. Testing Strategy

| Test Case | Description |
|-----------|-------------|
| TC-01 | Cashier opens shift successfully |
| TC-02 | Cashier closes shift with no variance |
| TC-03 | Cashier closes shift with small variance (<$1) |
| TC-04 | Cashier closes shift with medium variance ($1-$5) |
| TC-05 | Cashier closes shift with large variance ($5+) - blocked |
| TC-06 | Supervisor approves large variance |
| TC-07 | Offline shift open/close syncs when online |
| TC-08 | Customer Display updates correctly |

---

## 11. Future Enhancements (Out of Scope)

- Multiple float types (petty cash, change fund)
- Multi-terminal shift handoff
- Cash drawer assignment by terminal
- AI-powered anomaly detection
- Integration with accounting software

---

## 12. Dependencies

| Dependency | Description |
|------------|-------------|
| Authentication System | Existing auth middleware |
| Audit Logging | Existing audit trail feature |
| Scheduler | Existing offline sync scheduler |
| Supervisor Authentication | New PIN verification endpoint |

---

## 13. Estimated Effort

| Phase | Effort |
|-------|--------|
| Database & API | 3 days |
| Shift Open/Close UI | 2 days |
| Variance Handling | 1 day |
| Shift Report | 2 days |
| Testing & Bug Fixes | 2 days |
| **Total** | **~10 days** |

---

## 14. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 7, 2025 | - | Initial version |
