# Task List: Device Registration & Brand Setup

## Overview

This document contains the implementation task breakdown for the Device Registration & Brand Setup feature.

**Related Documents:**
- PRD: `docs/prd/001-device-registration-brand-setup.md`
- FSD: `docs/features/001-device-registration-brand-setup.md`

---

## Phase 1: Database & Configuration (Fundamental) ✅ COMPLETED

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 1.1 | Create `companies` table schema file | ✅ | `apps/api/src/db/schema/companies.ts` |
| 1.2 | Create `registered_devices` table schema file | ✅ | `apps/api/src/db/schema/registered_devices.ts` |
| 1.3 | Create `device_audit_logs` table schema file | ✅ | `apps/api/src/db/schema/device_audit_logs.ts` |
| 1.4 | Add `company_id` column to `stores` table | ✅ | Added to main schema.ts |
| 1.5 | Add `company_id` column to `users` table | ✅ | Added to main schema.ts |
| 1.6 | Add new app settings | ✅ | Added to seed.ts and migration script |
| 1.7 | Write database migration script | ✅ | `apps/api/src/db/migrate-device-registration.ts` |

**Dependencies:** None (Foundational)

**Files Created/Modified:**
- `apps/api/src/db/schema/companies.ts` (new)
- `apps/api/src/db/schema/registered_devices.ts` (new)
- `apps/api/src/db/schema/device_audit_logs.ts` (new)
- `apps/api/src/db/schema.ts` (modified - added company_id columns)
- `apps/api/src/db/seed.ts` (modified - added new app settings)
- `apps/api/src/db/migrate-device-registration.ts` (new)

---

## Phase 2: Backend Utilities ✅ COMPLETED

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 2.1 | Implement OTP utilities | ✅ | `generateOTP`, `hashOTP`, `verifyOTP`, OTP cache management |
| 2.2 | Implement device token encryption | ✅ | `encryptDeviceToken`, `decryptDeviceToken` using AES-256 |
| 2.3 | Implement device fingerprint utilities | ✅ | `getDeviceFingerprint`, `fingerprintToHash`, `generateDeviceName` |

**Dependencies:** Phase 1 ✅

**Files Created:**
- `apps/api/src/utils/otp.ts` - OTP generation, hashing, verification, and caching
- `apps/api/src/utils/encryption.ts` - Device token encryption/decryption
- `apps/api/src/utils/deviceFingerprint.ts` - Device fingerprint utilities

---

## Phase 3: Backend Routes - Brand ✅ COMPLETED

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 3.1 | Implement `POST /brand/setup` | ✅ | First-run brand setup, creates company + admin |
| 3.2 | Implement `GET /brand` | ✅ | Get brand details |
| 3.3 | Implement `PUT /brand` | ✅ | Update brand details |
| 3.4 | Implement `GET /brand/check` | ✅ | Check if brand is configured (public) |

**Dependencies:** Phase 2 ✅

**Files Created/Modified:**
- `apps/api/src/routes/brand.ts` (new)
- `apps/api/src/routes/index.ts` (modified - added brand route mount)

---

## Phase 4: Backend Routes - Devices ✅ COMPLETED

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 4.1 | `POST /devices/register/init` | ✅ | Initiate registration, send OTP to brand email |
| 4.2 | `POST /devices/register/verify` | ✅ | Verify OTP, create pending device registration |
| 4.3 | `POST /devices/register/resend` | ✅ | Resend OTP for pending registration |
| 4.4 | `POST /devices/approve` | ✅ | Manager approves/rejects pending device |
| 4.5 | `GET /devices/pending` | ✅ | List pending devices for manager's store |
| 4.6 | `GET /devices` | ✅ | List all registered devices (paginated) |
| 4.7 | `GET /devices/:id` | ✅ | Get device details with audit log |
| 4.8 | `PUT /devices/:id` | ✅ | Rename device |
| 4.9 | `POST /devices/:id/revoke` | ✅ | Revoke device access |
| 4.10 | `POST /devices/:id/transfer` | ✅ | Transfer device to another store |
| 4.11 | `GET /devices/my` | ✅ | Get current device status |

**Dependencies:** Phase 2, Phase 3 ✅

**Files Created/Modified:**
- `apps/api/src/routes/devices.ts` (new - 11 endpoints)
- `apps/api/src/routes/index.ts` (modified - added devices route mount)

---

## Phase 5: Backend Middleware

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 5.1 | Implement `deviceAuth` middleware | ⏳ | Validate device token, check approval status |
| 5.2 | Update `auth` middleware | ⏳ | Include device validation in login flow |

**Dependencies:** Phase 4

---

## Phase 6: Backend - Auth Endpoint Updates

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 6.1 | Update `POST /auth/login` | ⏳ | Validate device token, check store matching, approval status |

**Dependencies:** Phase 5

---

## Phase 7: Frontend - State Management

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 7.1 | Create `deviceStore.ts` | ⏳ | Device state management (deviceToken, status, actions) |
| 7.2 | Update `authStore.ts` | ⏳ | Add device fields (deviceToken, deviceId) |

**Dependencies:** Phase 6 (API contracts must be defined)

---

## Phase 8: Frontend - App Initialization

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 8.1 | Update `App.tsx` initialization | ⏳ | Check brand existence, check device registration |
| 8.2 | Add routes | ⏳ | `/brand-setup`, `/device/register`, `/settings/devices` |

**Dependencies:** Phase 7

---

## Phase 9: Frontend - Pages

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 9.1 | Create `BrandSetup.tsx` | ⏳ | Initial brand configuration page |
| 9.2 | Create `DeviceRegister.tsx` | ⏳ | Store code entry → OTP → Pending approval UI |
| 9.3 | Create `DeviceManagement.tsx` | ⏳ | Manager device list, pending approvals, actions |
| 9.4 | Update `Login.tsx` | ⏳ | Handle device registration redirect, show device errors |

**Dependencies:** Phase 7, Phase 8

---

## Phase 10: Admin Panel - Settings

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 10.1 | Brand email configuration | ⏳ | Add brand email field in Admin Settings |
| 10.2 | Device management UI | ⏳ | Add device management section in Admin Panel |

**Dependencies:** Phase 9 (reuse DeviceManagement component)

---

## Phase 11: Testing

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 11.1 | Unit tests - OTP utilities | ⏳ | Test OTP generation, hashing, verification |
| 11.2 | Unit tests - Encryption | ⏳ | Test encryption/decryption roundtrip |
| 11.3 | Integration - Registration | ⏳ | Test full device registration flow |
| 11.4 | Integration - Approval | ⏳ | Test manager approval/rejection flow |
| 11.5 | Integration - Login | ⏳ | Test login with device validation |
| 11.6 | Integration - Transfer | ⏳ | Test device transfer between stores |
| 11.7 | E2E - Full flow | ⏳ | Test complete user journey |

**Dependencies:** Phase 6 (backend complete)

---

## Phase 12: Documentation

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 12.1 | Update README | ⏳ | Document new setup flow |
| 12.2 | API documentation | ⏳ | Add device endpoints to API docs |

**Dependencies:** All phases complete

---

## Execution Order Summary

```
Phase 1: Database & Configuration
    ↓
Phase 2: Backend Utilities
    ↓
Phase 3-6: Backend Routes & Middleware
    ↓
Phase 7-9: Frontend
    ↓
Phase 10: Admin Panel
    ↓
Phase 11: Testing
    ↓
Phase 12: Documentation
```

---

## Total Tasks: 47

| Phase | Tasks |
|-------|-------|
| Phase 1 | 7 |
| Phase 2 | 3 |
| Phase 3 | 3 |
| Phase 4 | 11 |
| Phase 5 | 2 |
| Phase 6 | 1 |
| Phase 7 | 2 |
| Phase 8 | 2 |
| Phase 9 | 4 |
| Phase 10 | 2 |
| Phase 11 | 7 |
| Phase 12 | 2 |

---

## Notes

1. **Database migrations should be reversible** - Include rollback scripts
2. **API contracts should be finalized** before frontend implementation
3. **Device token encryption key** must be set in environment variables before deployment
4. **Email service** must be configured for OTP delivery
5. **Testing should cover** both happy path and error scenarios
6. **All security-sensitive operations** should be logged in `device_audit_logs`

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-11 | - | Initial task list |
| 1.1 | 2025-01-11 | - | Phase 1 completed: Database schema and migration script |
| 1.2 | 2025-01-11 | - | Phase 2 completed: Backend utilities (OTP, encryption, fingerprint) |
| 1.3 | 2025-01-11 | - | Phase 3 completed: Brand endpoints (/brand/setup, /brand, /brand/check) |
| 1.4 | 2025-01-11 | - | Phase 4 completed: Device endpoints (11 endpoints for registration, approval, management)
