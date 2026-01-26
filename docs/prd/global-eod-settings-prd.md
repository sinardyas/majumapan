# Product Requirements Document (PRD)

## Merge EOD Settings into Global Settings

| Document Info | |
|---------------|--|
| **Project** | Majumapan POS |
| **Feature** | Global EOD Settings |
| **Version** | 1.0 |
| **Status** | Draft |
| **Created** | 2026-01-26 |
| **Owner** | Platform Team |

---

## 1. Overview

### 1.1 Background

Currently, End of Day (EOD) settings are configured per-store in the `stores` table. This requires administrators to configure EOD settings separately for each store, which is redundant when all stores should follow the same operational procedures.

### 1.2 Problem Statement

- EOD settings are stored as columns in the `stores` table (`operational_day_start_hour`, `allow_auto_day_transition`, `eod_notification_emails`)
- Administrators must configure the same EOD settings for every store
- Settings UI is split between Global Settings page and EOD Settings page
- No technical benefit to per-store EOD configuration

### 1.3 Proposed Solution

Move EOD settings from per-store configuration to global configuration in the `app_settings` table, making EOD settings apply to all stores uniformly.

### 1.4 Goals

- Eliminate redundant EOD configuration across stores
- Simplify settings management for administrators
- Consolidate all settings into a single Settings page
- Reduce database schema complexity

### 1.5 Out of Scope

- Store-specific pricing or product configurations
- Store-specific user management
- Multi-tenant or franchise-specific configurations
- EOD report customization per store

---

## 2. Business Requirements

### 2.1 User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-1 | Admin | Configure EOD settings once for all stores | I don't have to repeat the same configuration |
| US-2 | Admin | See all settings in one place | Settings management is simplified |
| US-3 | Store Manager | All stores follow the same operational procedures | Consistency across locations |
| US-4 | Developer | Clean up redundant settings code | Easier maintenance |

### 2.2 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Settings pages consolidated | 1 page (from 2) | UI audit |
| EOD settings queries reduced | 50% fewer queries | Database query analysis |
| Admin configuration time | 50% reduction | User feedback |

---

## 3. Functional Requirements

### 3.1 Settings to Migrate

| Setting | Key | Type | Default | Description |
|---------|-----|------|---------|-------------|
| Operational Day Start Hour | `eod_operational_day_start_hour` | integer (0-23) | `6` | Hour when new operational day begins |
| Auto Day Transition | `eod_allow_auto_transition` | boolean | `true` | Auto-advance to next day after EOD |
| Notification Emails | `eod_notification_emails` | string (comma-separated) | `""` | Email addresses for EOD notifications |

### 3.2 Requirements

#### REQ-001: Global EOD Settings Storage
EOD settings must be stored in the `app_settings` table as key-value pairs.

#### REQ-002: Settings Apply to All Stores
All stores must use the same EOD settings from global configuration.

#### REQ-003: Admin UI Consolidation
EOD settings must be configurable from the Global Settings page.

#### REQ-004: Backward Compatibility
Existing per-store EOD settings in the `stores` table must be ignored after migration.

#### REQ-005: Email Notifications
EOD completion notifications must be sent to globally configured email addresses.

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Settings fetch must complete in < 100ms
- No additional database queries per EOD operation

### 4.2 Security
- Only admins can modify global settings (existing requirement)
- Settings changes must be logged in audit log

### 4.3 Compatibility
- Existing API consumers must not break
- Existing POS terminals must continue to work

### 4.4 Data Integrity
- No data loss during migration
- Rollback capability if issues arise

---

## 5. Dependencies

| Dependency | Description | Status |
|------------|-------------|--------|
| `app_settings` table | | Ready |
| Existing key-value storage Settings API | Existing REST endpoints | Ready |
| Admin Settings UI | Existing settings page | Ready |

---

## 6. Constraints & Assumptions

### 6.1 Constraints
- No schema change required for `app_settings` (already key-value)
- Must maintain backward compatibility during transition

### 6.2 Assumptions
- All stores should have identical EOD configuration
- Email notifications are sent globally, not per-store
- Admins have access to modify global settings

---

## 7. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Existing stores have different EOD settings | Medium | Low | Use most common value or default during migration |
| API consumers depend on store-level EOD settings | Medium | Low | Document deprecation, maintain old endpoints temporarily |
| Frontend caching of settings | Low | Medium | Clear cache on deployment |

---

## 8. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Documentation | 1 day | PRD, FSD |
| Implementation | 2-3 days | Code changes |
| Testing | 1 day | QA, UAT |
| Deployment | 0.5 day | Migration, release |

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
