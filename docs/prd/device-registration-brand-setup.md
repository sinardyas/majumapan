# Product Requirements Document (PRD)

## Device Registration & Brand Setup

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** January 11, 2025

---

## 1. Executive Summary

This document outlines the requirements for implementing a device registration system and brand setup flow for the Point of Sale (POS) application. The system ensures that POS devices are securely registered to specific stores within a brand, preventing unauthorized device usage and maintaining proper audit trails.

### 1.1 Goals

- Secure device-to-store binding with brand-level authorization
- Prevent unauthorized device claiming through OTP verification
- Enable multi-device support per store with proper management
- Maintain audit trail of all device registrations and transfers
- Ensure brand email is configured for OTP delivery

### 1.2 Scope

**In Scope:**
- Brand initial setup flow
- Device registration with OTP verification
- Device approval workflow (2nd+ devices)
- Device management (view, rename, revoke, transfer)
- Device token lifecycle (30-day expiration)
- Admin panel settings for brand email configuration

**Out of Scope:**
- Hardware device registration (physical terminals)
- Mobile app device registration
- Biometric authentication
- SSO integration
- Device geo-fencing

---

## 2. Background & Business Context

### 2.1 Problem Statement

Currently, the POS system lacks device-level security. Any device accessing the application can log in with any valid user credentials, creating the following risks:

- Unauthorized devices accessing store data
- No audit trail of which devices processed transactions
- No way to revoke access from a specific device
- Store transfers between devices require no verification

### 2.2 Target Users

| User Type | Description |
|-----------|-------------|
| **System Admin** | Sets up the brand during initial deployment |
| **Brand Manager** | Manages company settings (brand email) |
| **Store Manager** | Manages devices registered to their store |
| **Cashier** | Logs in from registered devices to process transactions |

### 2.3 Business Value

- **Security**: Only authorized devices can access store data
- **Compliance**: Audit trail for regulatory requirements
- **Operational Control**: Managers can revoke compromised devices
- **Multi-location Support**: One brand, multiple stores, multiple devices

---

## 3. Definitions & Terminology

| Term | Definition |
|------|------------|
| **Brand (Company)** | The top-level organization entity owning multiple stores |
| **Store** | A physical retail location belonging to a brand |
| **Registered Device** | A browser/device that has been authorized for a specific store |
| **Device Token** | Encrypted token stored on device identifying it to the system |
| **Device Fingerprint** | Browser characteristics used to identify the device |
| **Store Code** | Unique identifier for a store (e.g., "DOWNTOWN-001") |
| **OTP (One-Time Password)** | 6-digit code sent to brand email for verification |
| **Pending Approval** | Device registration awaiting manager approval |
| **Device Transfer** | Moving a device from one store to another |

---

## 4. User Stories

### 4.1 Brand Setup

| ID | Story | Priority |
|----|-------|----------|
| BS-01 | As a system admin, I want to set up the brand with name and email during first run, so that the system can send OTPs | Must Have |
| BS-02 | As a brand manager, I want to update the brand email in settings, so that OTPs are sent to the correct address | Must Have |
| BS-03 | As a system admin, I want to create the first admin user during brand setup, so that someone can manage the system | Must Have |

### 4.2 Device Registration

| ID | Story | Priority |
|----|-------|----------|
| DR-01 | As a device user, I want to enter a store code to start device registration, so that I can register my device | Must Have |
| DR-02 | As a device user, I want to receive an OTP at the brand email for the first device, so that my device is verified | Must Have |
| DR-03 | As a device user, I want my device to be automatically approved for the first registration, so that I can start using the POS quickly | Must Have |
| DR-04 | As a device user, I want to see my device registration pending for 2nd+ devices, so that I know it requires approval | Must Have |
| DR-05 | As a device user, I want to see a countdown timer for OTP expiration, so that I know when to request a new one | Should Have |

### 4.3 Device Approval

| ID | Story | Priority |
|----|-------|----------|
| DA-01 | As a store manager, I want to see pending device registrations, so that I can approve or reject them | Must Have |
| DA-02 | As a store manager, I want to approve a pending device, so that it can be used for transactions | Must Have |
| DA-03 | As a store manager, I want to reject a pending device, so that unauthorized devices cannot access the store | Must Have |
| DA-04 | As a store manager, I want to see device details before approving, so that I can verify it's legitimate | Should Have |

### 4.4 Device Management

| ID | Story | Priority |
|----|-------|----------|
| DM-01 | As a store manager, I want to view all registered devices, so that I can monitor device usage | Must Have |
| DM-02 | As a store manager, I want to rename a device, so that it's easily identifiable | Should Have |
| DM-03 | As a store manager, I want to revoke a device, so that it can no longer access the store | Must Have |
| DM-04 | As a store manager, I want to transfer a device to another store, so that devices can be reassigned | Must Have |
| DM-05 | As a store manager, I want to see when a device was last used, so that I can identify inactive devices | Should Have |

### 4.5 User Login

| ID | Story | Priority |
|----|-------|----------|
| UL-01 | As a user, I want to see the login page when my device is registered, so that I can log in normally | Must Have |
| UL-02 | As a user, I want to be redirected to device registration if my device is not registered, so that I can register it | Must Have |
| UL-03 | As a user, I want to see an error if I'm assigned to a different store than the device, so that I know there's a mismatch | Must Have |
| UL-04 | As a user, I want to be logged out if my device token expires, so that unauthorized access is prevented | Must Have |

### 4.6 Security

| ID | Story | Priority |
|----|-------|----------|
| SC-01 | As a security officer, I want device tokens to expire after 30 days, so that inactive devices are automatically revoked | Must Have |
| SC-02 | As a security officer, I want all device registrations logged with timestamp and IP, so that there's an audit trail | Must Have |
| SC-03 | As a security officer, I want device tokens encrypted in localStorage, so that they cannot be stolen easily | Must Have |
| SC-04 | As a security officer, I want rate limiting on OTP requests, so that brute force attacks are prevented | Must Have |

---

## 5. Requirements

### 5.1 Functional Requirements

#### 5.1.1 Brand Setup

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| BR-01 | System must detect if brand is configured on first run | Must Have |
| BR-02 | System must redirect to brand setup page if brand not configured | Must Have |
| BR-03 | Brand setup must create: company record, admin user | Must Have |
| BR-04 | Brand email must be configurable in admin settings | Must Have |
| BR-05 | Brand email must be validated before device registration | Must Have |

#### 5.1.2 Device Registration

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| DR-01 | Device registration must start with store code entry | Must Have |
| DR-02 | First device registration must send OTP to brand email | Must Have |
| DR-03 | OTP must be 6 digits, valid for 10 minutes | Must Have |
| DR-04 | Device registration must capture device fingerprint | Must Have |
| DR-05 | Device name must be auto-generated: "[Store] - [Browser] - [Month Year]" | Should Have |
| DR-06 | First device must be auto-approved without manager action | Must Have |
| DR-07 | 2nd+ devices must require manager approval | Must Have |
| DR-08 | Device token must expire after 30 days | Must Have |
| DR-09 | Device token must be encrypted before storing in localStorage | Must Have |

#### 5.1.3 Device Approval

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| DA-01 | Store managers must see pending device registrations | Must Have |
| DA-02 | Managers must be able to approve or reject pending devices | Must Have |
| DA-03 | Approval must generate device token for the device | Must Have |
| DA-04 | Rejection must notify device (show message) | Must Have |
| DA-05 | Audit trail must record approval/rejection action | Must Have |

#### 5.1.4 Device Management

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| DM-01 | Managers must see list of all registered devices | Must Have |
| DM-02 | Device list must show: name, status, last used, expiry | Must Have |
| DM-03 | Managers must be able to rename devices | Should Have |
| DM-04 | Managers must be able to revoke devices | Must Have |
| DM-05 | Revoked devices must be logged out immediately | Must Have |
| DM-06 | Managers must be able to transfer devices to other stores | Must Have |
| DM-07 | Transfer must require manager PIN confirmation | Must Have |
| DM-08 | Transfer must create audit trail entry | Must Have |

#### 5.1.5 User Authentication

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| UL-01 | Login must validate user.storeId matches device.storeId | Must Have |
| UL-02 | Login must fail with clear message if store mismatch | Must Have |
| UL-03 | Login must fail if device not registered | Must Have |
| UL-04 | Login must fail if device token expired | Must Have |
| UL-05 | User must be logged out if device revoked | Must Have |
| UL-06 | User logout must clear device token | Must Have |

#### 5.1.6 Rate Limiting & Security

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| RS-01 | OTP requests must be limited to 5 per hour per store | Must Have |
| RS-02 | Login attempts must be rate limited | Must Have |
| RS-03 | Device fingerprint must be validated on each request | Should Have |
| RS-04 | All device actions must be logged with IP and timestamp | Must Have |

### 5.2 Non-Functional Requirements

#### 5.2.1 Performance

| Req ID | Requirement | Target |
|--------|-------------|--------|
| NP-01 | Device registration must complete in under 2 seconds | < 2s |
| NP-02 | Device list must load in under 1 second | < 1s |
| NP-03 | API must handle 100 concurrent device registrations | 100 concurrent |

#### 5.2.2 Security

| Req ID | Requirement |
|--------|-------------|
| NS-01 | Device tokens must be encrypted with AES-256 |
| NS-02 | OTP must be cryptographically random |
| NS-03 | All API endpoints must validate device tokens |
| NS-04 | Sensitive operations must require authentication |

#### 5.2.3 Availability

| Req ID | Requirement |
|--------|-------------|
| NA-01 | System must support offline device registration queue (future) |
| NA-02 | Device registration must not block other operations |

#### 5.2.4 Scalability

| Req ID | Requirement |
|--------|-------------|
| NS-01 | Must support up to 1000 registered devices per store |
| NS-02 | Device list pagination must be supported |

### 5.3 Data Requirements

#### 5.3.1 Data Retention

| Data Type | Retention | Justification |
|-----------|-----------|---------------|
| Device registrations | Indefinite | Business requirement |
| Audit logs | 2 years | Compliance |
| OTP records | 24 hours | Security |
| Expired device tokens | 30 days | Grace period for re-registration |

#### 5.3.2 Data Privacy

- Device fingerprint does not contain PII
- Device token encryption key stored in environment variable
- Brand email used only for OTP delivery, not for marketing

---

## 6. Design Considerations

### 6.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        POS Architecture                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Web App   │     │   Admin App │     │    API      │       │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘       │
│         │                   │                   │               │
│         └───────────────────┴───────────────────┘               │
│                             │                                   │
│                      ┌──────┴──────┐                           │
│                      │   Database  │                           │
│                      │             │                           │
│                      │  companies  │                           │
│                      │  stores     │                           │
│                      │  users      │                           │
│                      │  registered_devices │                   │
│                      │  audit_logs │                           │
│                      └─────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    Device State Machine                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UNLOCKED ──────► [Enter Store Code] ─────► PENDING_OTP        │
│       ↑                                                    │     │
│       │                                                    ▼     │
│       │                                            OTP_SENT ────┐
│       │                                                 │       │
│       │                              OTP_VALID ──────────┤       │
│       │                                   │             │       │
│       │                                   ▼             │       │
│       │                              PENDING_APPROVAL───┘       │
│       │                                   │                     │
│       │                    APPROVED ──────┤                     │
│       │                         │         │                     │
│       │                         ▼         │                     │
│       │                   REGISTERED ─────┘                     │
│       │                         │                               │
│       │                         │  EXPIRED / REVOKED            │
│       │                         ▼         │                     │
│       │                   ┌──────────┐    │                     │
│       │                   │ LOCKED   │◄───┘                     │
│       │                   │ (to      │                          │
│       │                   │  Store)  │                          │
│       │                   └────┬─────┘                          │
│       │                        │                                │
│       │                        │  TRANSFERRED                   │
│       │                        ▼                                │
│       │                   (new store)                           │
│       │                        │                                │
│       └────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Layers                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Brand Setup                                           │
│  ├── Brand email configured                                     │
│  └── Admin user created                                         │
│                                                                 │
│  Layer 2: Device Registration                                   │
│  ├── Store code validation                                      │
│  ├── OTP verification (brand email)                             │
│  ├── Device fingerprint capture                                 │
│  └── Manager approval (2nd+ devices)                            │
│                                                                 │
│  Layer 3: Token Management                                      │
│  ├── Device token encryption (AES-256)                          │
│  ├── Token expiration (30 days)                                 │
│  └── Token validation on every request                          │
│                                                                 │
│  Layer 4: Access Control                                        │
│  ├── User.storeId === Device.storeId                           │
│  ├── Role-based permissions                                     │
│  └── Device status validation (active, not revoked)             │
│                                                                 │
│  Layer 5: Audit & Monitoring                                    │
│  ├── All device actions logged                                  │
│  ├── IP address recorded                                        │
│  └── Rate limiting enforced                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Dependencies

### 7.1 External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| PostgreSQL | 14+ | Database |
| bcrypt | ^5.1.0 | Password hashing |

### 7.2 Internal Dependencies

| Dependency | Purpose |
|------------|---------|
| authStore.ts | Authentication state management |
| cartStore.ts | Cart persistence |
| Existing User/Store models | Data structures |

### 7.3 Pre-requisites

- PostgreSQL database with existing tables
- Environment variables configured
- Email service configured for OTP delivery

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Brand email not configured | High | Low | Block device registration until configured |
| Device token encryption key lost | High | Low | Key stored in env var, backup procedure |
| OTP brute force | Medium | Medium | Rate limiting, account lockout |
| Manager credentials compromised | High | Low | Audit trail, PIN confirmation for transfers |
| Database migration failure | High | Low | Backup before migration, rollback script |
| Large number of pending devices | Low | Medium | Pagination, auto-expire old requests |

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Device registration success rate | > 95% | (Successful registrations / Total attempts) × 100 |
| Average registration time | < 30s | Time from store code entry to registration complete |
| Device-related support tickets | < 5% | (Device-related tickets / Total tickets) |
| Unauthorized access incidents | 0 | Count of incidents per quarter |

---

## 10. Appendix

### 10.1 Glossary

See Section 3: Definitions & Terminology

### 10.2 Related Documents

| Document | Location |
|----------|----------|
| FSD (Functional Specification) | docs/fsd/001-device-registration.md |
| API Documentation | docs/api/devices.md |
| Database Schema | apps/api/src/db/schema.ts |

### 10.3 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-11 | - | Initial draft |

---

## 11. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Engineering Lead | | | |
| Security Lead | | | |
