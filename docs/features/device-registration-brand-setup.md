# Functional Specification Document (FSD)

## Device Registration & Brand Setup

**Version:** 1.0  
**Status:** Draft  
**Related PRD:** docs/prd/001-device-registration-brand-setup.md  
**Last Updated:** January 11, 2025

---

## 1. Database Design

### 1.1 New Tables

#### 1.1.1 `companies` Table

Stores brand/company information.

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_companies_email ON companies(email);
CREATE INDEX idx_companies_active ON companies(is_active);
```

**Description:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Company/brand name |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Brand email for OTP |
| logo_url | TEXT | NULL | URL to company logo |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Company active status |
| created_at | TIMESTAMP | NOT NULL | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | Last update timestamp |

#### 1.1.2 `registered_devices` Table

Stores registered device information.

```sql
CREATE TABLE registered_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  store_id UUID REFERENCES stores(id) NOT NULL,
  device_token_hash VARCHAR(255) NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  device_fingerprint TEXT,  -- JSON
  ip_address INET,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_used_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  approved_by_user_id UUID REFERENCES users(id),
  approval_status VARCHAR(20) DEFAULT 'APPROVED' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_registered_devices_company ON registered_devices(company_id);
CREATE INDEX idx_registered_devices_store ON registered_devices(store_id);
CREATE INDEX idx_registered_devices_token ON registered_devices(device_token_hash);
CREATE INDEX idx_registered_devices_active ON registered_devices(is_active);
CREATE INDEX idx_registered_devices_expires ON registered_devices(expires_at);
```

**Description:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| company_id | UUID | REFERENCES companies(id), NOT NULL | Parent company |
| store_id | UUID | REFERENCES stores(id), NOT NULL | Registered store |
| device_token_hash | VARCHAR(255) | NOT NULL | Hash of encrypted token |
| device_name | VARCHAR(100) | NOT NULL | Auto-generated name |
| device_fingerprint | TEXT | NULL | Browser characteristics JSON |
| ip_address | INET | NULL | Registration IP address |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Device active status |
| last_used_at | TIMESTAMP | NOT NULL | Last usage timestamp |
| expires_at | TIMESTAMP | NOT NULL | Token expiration date |
| approved_by_user_id | UUID | REFERENCES users(id), NULL | Approver (NULL for auto-approve) |
| approval_status | VARCHAR(20) | NOT NULL, DEFAULT 'APPROVED' | PENDING/APPROVED/REJECTED |
| created_at | TIMESTAMP | NOT NULL | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | Last update timestamp |

#### 1.1.3 `device_audit_logs` Table

Stores audit trail for device actions.

```sql
CREATE TABLE device_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES registered_devices(id) NOT NULL,
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_device_audit_device ON device_audit_logs(device_id);
CREATE INDEX idx_device_audit_user ON device_audit_logs(user_id);
CREATE INDEX idx_device_audit_action ON device_audit_logs(action);
CREATE INDEX idx_device_audit_created ON device_audit_logs(created_at);
```

**Description:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| device_id | UUID | REFERENCES registered_devices(id), NOT NULL | Related device |
| user_id | UUID | REFERENCES users(id), NULL | User who performed action |
| action | VARCHAR(50) | NOT NULL | Action type |
| details | JSONB | NULL | Additional action details |
| ip_address | INET | NULL | IP address of request |
| created_at | TIMESTAMP | NOT NULL | Action timestamp |

**Audit Actions:**
| Action | Description |
|--------|-------------|
| `REGISTER_INIT` | Device registration initiated |
| `REGISTER_VERIFIED` | OTP verified, registration complete |
| `APPROVED` | Manager approved device |
| `REJECTED` | Manager rejected device |
| `REVOKED` | Manager revoked device |
| `TRANSFERRED` | Device transferred to another store |
| `RENAMED` | Device name changed |
| `EXPIRED` | Device token expired |
| `LOGIN_FAILED_MISMATCH` | User-store mismatch on login |
| `TOKEN_INVALIDATED` | Device token invalidated |

### 1.2 Schema Modifications

#### 1.2.1 Modify `stores` Table

```sql
ALTER TABLE stores ADD COLUMN company_id UUID REFERENCES companies(id);
```

#### 1.2.2 Modify `users` Table

```sql
ALTER TABLE users ADD COLUMN company_id UUID REFERENCES companies(id);
```

### 1.3 New App Settings

```sql
INSERT INTO app_settings (key, value) VALUES
  ('brand_email', ''),
  ('device_token_expiry_days', '30'),
  ('otp_expiry_minutes', '10'),
  ('max_otp_attempts', '5'),
  ('max_pending_devices', '10');
```

---

## 2. API Endpoints

### 2.1 Brand Setup Endpoints

#### 2.1.1 POST /brand/setup

**Purpose:** Initial brand setup (first run only)

**Request:**
```json
{
  "companyName": "My Retail Brand",
  "companyEmail": "ops@mybrand.com",
  "adminName": "John Admin",
  "adminEmail": "admin@mybrand.com",
  "adminPassword": "securepassword123"
}
```

**Validation:**
| Field | Required | Validation |
|-------|----------|------------|
| companyName | Yes | 2-255 characters |
| companyEmail | Yes | Valid email format |
| adminName | Yes | 2-255 characters |
| adminEmail | Yes | Valid email format |
| adminPassword | Yes | Min 8 characters |

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "companyId": "550e8400-e29b-41d4-a716-446655440000",
    "adminUserId": "550e8400-e29b-41d4-a716-446655440001",
    "message": "Brand setup complete. Please login."
  }
}
```

**Response (Error - Brand already exists):**
```json
{
  "success": false,
  "error": "BRAND_ALREADY_EXISTS",
  "message": "Brand has already been configured."
}
```

**Response (Error - Validation):**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [
    { "field": "companyEmail", "message": "Invalid email format" }
  ]
}
```

**Business Logic:**
1. Check if any company exists; if yes, reject
2. Validate all fields
3. Hash admin password with bcrypt
4. Create company record
5. Create admin user with role 'admin'
6. Update all existing stores and users with company_id (migration)

---

#### 2.1.2 GET /brand

**Purpose:** Get brand details (admin only)

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Retail Brand",
    "email": "ops@mybrand.com",
    "logoUrl": null,
    "createdAt": "2025-01-11T00:00:00Z"
  }
}
```

---

#### 2.1.3 PUT /brand

**Purpose:** Update brand details (admin only)

**Request:**
```json
{
  "name": "Updated Brand Name",
  "email": "newemail@mybrand.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated Brand Name",
    "email": "newemail@mybrand.com"
  }
}
```

---

### 2.2 Device Registration Endpoints

#### 2.2.1 POST /devices/register/init

**Purpose:** Initiate device registration by entering store code

**Request:**
```json
{
  "storeCode": "DOWNTOWN-001"
}
```

**Validation:**
| Field | Required | Validation |
|-------|----------|------------|
| storeCode | Yes | Store must exist and be active |

**Response (Success - OTP Required):**
```json
{
  "success": true,
  "data": {
    "requiresOtp": true,
    "message": "OTP sent to brand email",
    "expiresAt": "2025-01-11T10:15:00Z",
    "attemptsRemaining": 5
  }
}
```

**Response (Error - Brand email not configured):**
```json
{
  "success": false,
  "error": "BRAND_EMAIL_NOT_CONFIGURED",
  "message": "Brand email must be configured before device registration. Contact your administrator."
}
```

**Response (Error - Store not found):**
```json
{
  "success": false,
  "error": "STORE_NOT_FOUND",
  "message": "Store not found. Please check the store code."
}
```

**Business Logic:**
1. Check if brand email is configured; if not, return error
2. Validate store code exists
3. Check if device already registered for this store; if yes, return existing device info
4. Generate OTP (6 digits)
5. Send OTP to brand email
6. Store OTP with 10-minute expiry in cache (Redis/memory)
7. Return success with expiry timestamp

**Rate Limiting:**
- Max 5 OTP requests per hour per store code
- Return `attemptsRemaining` in response

---

#### 2.2.2 POST /devices/register/verify

**Purpose:** Verify OTP and complete device registration

**Request:**
```json
{
  "storeCode": "DOWNTOWN-001",
  "otp": "123456",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "screen": "1920x1080",
    "timezone": "America/New_York",
    "language": "en-US",
    "platform": "MacIntel",
    "colorDepth": 24,
    "deviceMemory": 8,
    "hardwareConcurrency": 8
  }
}
```

**Response (Success - First Device Auto-Approved):**
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceToken": "encrypted_token_string",
    "deviceName": "Downtown Store - Chrome - Jan 2026",
    "expiresAt": "2025-02-10T00:00:00Z",
    "isApproved": true,
    "message": "Device registered successfully."
  }
}
```

**Response (Success - Pending Approval):**
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceToken": null,
    "deviceName": "Downtown Store - Safari - Jan 2026",
    "expiresAt": null,
    "isApproved": false,
    "message": "Device registration pending manager approval."
  }
}
```

**Response (Error - Invalid OTP):**
```json
{
  "success": false,
  "error": "INVALID_OTP",
  "message": "Invalid OTP. Please try again.",
  "attemptsRemaining": 3
}
```

**Response (Error - OTP Expired):**
```json
{
  "success": false,
  "error": "OTP_EXPIRED",
  "message": "OTP has expired. Please request a new one."
}
```

**Business Logic:**
1. Validate store code
2. Retrieve OTP from cache
3. If OTP not found or expired, return error
4. Compare OTP; if mismatch, decrement attempts, return error if exhausted
5. If OTP valid:
   - Generate device token (UUID v4)
   - Encrypt token with AES-256
   - Generate device fingerprint hash
   - Check existing device count for store
   - If count == 0: auto-approve, set expiry 30 days
   - If count > 0: set approval_status to PENDING, no token yet
   - Create registered_devices record
   - Create audit log entry
   - Clear OTP from cache
6. Return response with device token (if approved) or pending status

**Device Name Generation:**
```typescript
function generateDeviceName(storeName: string, userAgent: string): string {
  const browser = getBrowserName(userAgent); // 'Chrome', 'Safari', 'Firefox'
  const monthYear = new Date().toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  }); // 'Jan 2026'
  
  return `${storeName} - ${browser} - ${monthYear}`;
}

function getBrowserName(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Browser';
}
```

---

#### 2.2.3 POST /devices/register/resend

**Purpose:** Resend OTP for pending registration

**Request:**
```json
{
  "storeCode": "DOWNTOWN-001"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "OTP resent to brand email",
    "expiresAt": "2025-01-11T10:20:00Z"
  }
}
```

---

### 2.3 Device Approval Endpoints

#### 2.3.1 POST /devices/approve

**Purpose:** Manager approves or rejects pending device

**Headers:**
```
Authorization: Bearer <manager_token>
X-Device-Token: <manager_device_token>
```

**Request:**
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "approve": true
}
```

**Validation:**
- User must have role 'manager' or 'admin'
- User.storeId must match device.storeId
- Manager device must be active and not expired

**Response (Success - Approved):**
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceToken": "encrypted_token_string",
    "deviceName": "Downtown Store - Safari - Jan 2026",
    "expiresAt": "2025-02-10T00:00:00Z",
    "message": "Device approved successfully."
  }
}
```

**Response (Success - Rejected):**
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Device registration rejected."
  }
}
```

**Response (Error - Not Manager):**
```json
{
  "success": false,
  "error": "NOT_AUTHORIZED",
  "message": "Only managers can approve devices."
}
```

**Response (Error - Device Not Found):**
```json
{
  "success": false,
  "error": "DEVICE_NOT_FOUND",
  "message": "Device not found."
}
```

**Response (Error - Not Pending):**
```json
{
  "success": false,
  "error": "NOT_PENDING",
  "message": "Device is not pending approval."
}
```

**Business Logic:**
1. Validate manager authorization
2. Validate device exists and belongs to manager's store
3. Validate device status is PENDING
4. If approve=true:
   - Generate device token
   - Set approval_status to APPROVED
   - Set expires_at to 30 days from now
   - Set approved_by_user_id to current user
   - Return device token
5. If approve=false:
   - Set approval_status to REJECTED
   - Set is_active to false
6. Create audit log entry

---

#### 2.3.2 GET /devices/pending

**Purpose:** Get list of pending devices for manager's store

**Headers:**
```
Authorization: Bearer <manager_token>
X-Device-Token: <manager_device_token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "deviceName": "Downtown Store - Safari - Jan 2026",
      "deviceFingerprint": {
        "userAgent": "...",
        "screen": "1920x1080",
        "timezone": "America/New_York"
      },
      "ipAddress": "192.168.1.100",
      "createdAt": "2025-01-11T00:00:00Z"
    }
  ]
}
```

---

### 2.4 Device Management Endpoints

#### 2.4.1 GET /devices

**Purpose:** Get all registered devices for manager's store

**Headers:**
```
Authorization: Bearer <manager_token>
X-Device-Token: <manager_device_token>
```

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| page | number | Page number | 1 |
| limit | number | Items per page | 20 |
| status | string | Filter by status (active/inactive) | all |
| search | string | Search in device name | - |

**Response (Success):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "deviceName": "Downtown Store - Chrome - Jan 2026",
      "isActive": true,
      "lastUsedAt": "2025-01-11T08:30:00Z",
      "expiresAt": "2025-02-10T00:00:00Z",
      "approvalStatus": "APPROVED",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

#### 2.4.2 GET /devices/:id

**Purpose:** Get device details

**Headers:**
```
Authorization: Bearer <manager_token>
X-Device-Token: <manager_device_token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deviceName": "Downtown Store - Chrome - Jan 2026",
    "deviceFingerprint": { ... },
    "ipAddress": "192.168.1.100",
    "isActive": true,
    "lastUsedAt": "2025-01-11T08:30:00Z",
    "expiresAt": "2025-02-10T00:00:00Z",
    "approvalStatus": "APPROVED",
    "approvedBy": {
      "id": "...",
      "name": "John Manager",
      "email": "john@mybrand.com"
    },
    "createdAt": "2025-01-01T00:00:00Z",
    "auditLog": [
      {
        "action": "REGISTER_VERIFIED",
        "userId": null,
        "createdAt": "2025-01-01T00:00:00Z"
      },
      {
        "action": "LOGIN",
        "userId": "...",
        "createdAt": "2025-01-11T08:30:00Z"
      }
    ]
  }
}
```

---

#### 2.4.3 PUT /devices/:id

**Purpose:** Rename device

**Headers:**
```
Authorization: Bearer <manager_token>
X-Device-Token: <manager_device_token>
```

**Request:**
```json
{
  "deviceName": "POS Terminal 1"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deviceName": "POS Terminal 1"
  }
}
```

---

#### 2.4.4 POST /devices/:id/revoke

**Purpose:** Revoke device access

**Headers:**
```
Authorization: Bearer <manager_token>
X-Device-Token: <manager_device_token>
```

**Request:**
```json
{
  "reason": "Device lost or stolen"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "Device revoked successfully."
  }
}
```

**Business Logic:**
1. Validate manager authorization
2. Validate device exists and belongs to manager's store
3. Set is_active to false
4. Create audit log entry with reason
5. All users on this device will be logged out on next request

---

#### 2.4.5 POST /devices/:id/transfer

**Purpose:** Transfer device to another store

**Headers:**
```
Authorization: Bearer <manager_token>
X-Device-Token: <manager_device_token>
```

**Request:**
```json
{
  "targetStoreId": "550e8400-e29b-41d4-a716-446655440001",
  "confirmPin": "123456"
}
```

**Validation:**
- Manager PIN must be validated
- Target store must exist and belong to same company
- Target store must be active

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "Device transferred to Downtown Store."
  }
}
```

**Business Logic:**
1. Validate manager PIN against user's stored PIN
2. Validate target store exists and belongs to same company
3. Update device.store_id to target store
4. Create audit log entry with transfer details
5. All users must re-login on this device

---

#### 2.4.6 GET /devices/my

**Purpose:** Get current device info (called by device itself)

**Headers:**
```
X-Device-Token: <device_token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceName": "Downtown Store - Chrome - Jan 2026",
    "storeId": "550e8400-e29b-41d4-a716-446655440002",
    "storeName": "Downtown Store",
    "isActive": true,
    "expiresAt": "2025-02-10T00:00:00Z",
    "approvalStatus": "APPROVED"
  }
}
```

**Response (Error - Invalid Token):**
```json
{
  "success": false,
  "error": "INVALID_DEVICE_TOKEN",
  "message": "Device token is invalid or expired."
}
```

---

### 2.5 Updated Auth Endpoints

#### 2.5.1 POST /auth/login

**Updated Behavior:**

1. Validate user credentials
2. Check device token header
3. If no device token:
   - Return error: `DEVICE_NOT_REGISTERED`
4. If device token present:
   - Validate device exists and is active
   - Check device not expired
   - Check user.company_id === device.company_id
   - Check (user.store_id === device.store_id OR user.role === 'admin')
5. If all checks pass:
   - Issue user JWT with deviceId in payload
6. If store mismatch:
   - Return error: `DEVICE_STORE_MISMATCH`

**Updated Response (Error - Device Not Registered):**
```json
{
  "success": false,
  "error": "DEVICE_NOT_REGISTERED",
  "storeCodeRequired": true,
  "message": "This device is not registered to any store. Please register your device first."
}
```

**Updated Response (Error - Store Mismatch):**
```json
{
  "success": false,
  "error": "DEVICE_STORE_MISMATCH",
  "message": "You are assigned to Downtown Store, but this device is registered to Mall Branch. Contact your manager to resolve."
}
```

---

## 3. Middleware

### 3.1 Device Auth Middleware

```typescript
import { createMiddleware } from 'hono/factory';
import { db } from '../db';
import { registeredDevices } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { decryptDeviceToken } from '../utils/encryption';

export const deviceAuth = createMiddleware(async (c, next) => {
  const deviceToken = c.req.header('X-Device-Token');
  
  if (!deviceToken) {
    return c.json({
      success: false,
      error: 'DEVICE_NOT_REGISTERED',
      storeCodeRequired: true
    }, 401);
  }
  
  try {
    const tokenData = decryptDeviceToken(deviceToken);
    const device = await db.query.registeredDevices.findFirst({
      where: and(
        eq(registeredDevices.id, tokenData.deviceId),
        eq(registeredDevices.isActive, true),
        gt(registeredDevices.expiresAt, new Date())
      )
    });
    
    if (!device) {
      return c.json({
        success: false,
        error: 'DEVICE_INVALID_OR_EXPIRED'
      }, 401);
    }
    
    // Update last_used_at
    await db.update(registeredDevices)
      .set({ lastUsedAt: new Date() })
      .where(eq(registeredDevices.id, device.id));
    
    c.set('device', device);
    await next();
  } catch (error) {
    return c.json({
      success: false,
      error: 'INVALID_DEVICE_TOKEN'
    }, 401);
  }
});
```

---

## 4. Frontend Components

### 4.1 Pages

#### 4.1.1 BrandSetup (Route: /brand-setup)

**Purpose:** Initial brand configuration

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Brand Setup                                            │
│  ─────────────                                          │
│                                                         │
│  Company Name                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Brand Email (for OTP)                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Admin Name                                             │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Admin Email                                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Admin Password                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Confirm Password                                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  [Create Brand & Admin Account]                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**State Management:**
```typescript
interface BrandSetupState {
  companyName: string;
  companyEmail: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
  isLoading: boolean;
  error: string | null;
}
```

**Actions:**
- `handleSubmit()`: Validates form, calls API, redirects to login

---

#### 4.1.2 DeviceRegister (Route: /device/register)

**Purpose:** Device registration flow

**Step 1: Enter Store Code**
```
┌─────────────────────────────────────────────────────────┐
│  Device Registration                                     │
│  ──────────────────────                                 │
│                                                         │
│  Enter Store Code                                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  DOWNTOWN-001                                [✓]│    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  [Continue]                                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Step 2: OTP Entry**
```
┌─────────────────────────────────────────────────────────┐
│  Verify with OTP                                        │
│  ─────────────────                                      │
│                                                         │
│  Enter the 6-digit code sent to                         │
│  ops@mybrand.com                                        │
│                                                         │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                  │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │                  │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                  │
│                                                         │
│  Resend OTP (2:30)                                      │
│                                                         │
│  [Verify]                                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Step 3: Registration Complete**
```
┌─────────────────────────────────────────────────────────┐
│  Device Registered                                      │
│  ─────────────────                                      │
│                                                         │
│  ✓ Downtown Store - Chrome - Jan 2026                   │
│    is now registered and ready to use.                  │
│                                                         │
│  [Continue to Login]                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Step 4: Pending Approval**
```
┌─────────────────────────────────────────────────────────┐
│  Registration Pending                                    │
│  ────────────────────                                    │
│                                                         │
│  ⏳ Your device registration is pending                  │
│    approval from a manager.                              │
│                                                         │
│    Downtown Store - Safari - Jan 2026                   │
│                                                         │
│  Please contact your manager to approve                  │
│  your device.                                            │
│                                                         │
│  [Resend Request]                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

#### 4.1.3 DeviceManagement (Route: /settings/devices)

**Purpose:** Manager device management

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Device Management                          [Manage]    │
│  ──────────────────────                                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Search devices...                          [🔍] │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Pending Approvals (2)                          │    │
│  │  ─────────────────────                          │    │
│  │                                                 │    │
│  │  • Mall Branch - Safari - Jan 2026              │    │
│  │    Requested: Jan 10, 2026                      │    │
│  │    [Approve]  [Reject]                          │    │
│  │                                                 │    │
│  │  • Mall Branch - Chrome - Jan 2026              │    │
│  │    Requested: Jan 9, 2026                       │    │
│  │    [Approve]  [Reject]                          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Registered Devices (5)                          │    │
│  │  ──────────────────────                          │    │
│  │                                                 │    │
│  │  • Downtown Store - Chrome - Jan 2026           │    │
│  │    Active  │  Last used: Today  │  Expires:     │    │
│  │    Feb 10                                                 │
│  │    [⋮] → [Rename]  [Transfer]  [Revoke]         │    │
│  │                                                 │    │
│  │  • Downtown Store - Safari - Jan 2026           │    │
│  │    Active  │  Last used: Yesterday              │    │
│  │    [⋮] → [Rename]  [Transfer]  [Revoke]         │    │
│  │                                                 │    │
│  │  • POS Terminal 1                               │    │
│  │    Expired  │  Last used: Jan 5                 │    │
│  │    [⋮] → [Renew]  [Revoke]                      │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  [Export List]                                          │
└─────────────────────────────────────────────────────────┘
```

**Actions:**
- `approveDevice(id)`: Approve pending device
- `rejectDevice(id)`: Reject pending device
- `renameDevice(id, name)`: Rename device
- `revokeDevice(id, reason)`: Revoke device
- `transferDevice(id, targetStoreId, pin)`: Transfer device

---

### 4.2 Store: deviceStore

```typescript
interface DeviceState {
  deviceToken: string | null;
  deviceId: string | null;
  deviceName: string | null;
  storeId: string | null;
  storeName: string | null;
  isRegistered: boolean;
  isPendingApproval: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  isLoading: boolean;
  
  // Actions
  checkDeviceStatus: () => Promise<DeviceStatus>;
  setDeviceToken: (token: string, deviceId: string, deviceName: string, expiresAt: string) => void;
  clearDevice: () => void;
  updateDeviceName: (name: string) => void;
}

interface DeviceStatus {
  isRegistered: boolean;
  isPendingApproval: boolean;
  isExpired: boolean;
  deviceId?: string;
  deviceName?: string;
  storeId?: string;
  storeName?: string;
  expiresAt?: string;
}
```

### 4.3 App Initialization Flow

```typescript
async function initializeApp() {
  // 1. Check if brand exists
  const brandExists = await api.get('/brand').then(r => r.success).catch(() => false);
  
  if (!brandExists) {
    navigate('/brand-setup');
    return;
  }
  
  // 2. Check device registration
  const deviceToken = localStorage.getItem('pos-device-token');
  
  if (!deviceToken) {
    navigate('/device/register');
    return;
  }
  
  // 3. Validate device token
  try {
    const status = await deviceStore.checkDeviceStatus();
    
    if (status.isExpired) {
      showToast('Device registration expired. Please re-register.');
      navigate('/device/register');
      return;
    }
    
    if (status.isPendingApproval) {
      navigate('/device/pending');
      return;
    }
    
    // Device is valid, proceed to login
    navigate('/login');
  } catch (error) {
    localStorage.removeItem('pos-device-token');
    navigate('/device/register');
  }
}
```

---

## 5. Utility Functions

### 5.1 OTP Generation

```typescript
import crypto from 'crypto';

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function verifyOTP(inputOTP: string, storedHash: string): boolean {
  return hashOTP(inputOTP) === storedHash;
}
```

### 5.2 Device Token Encryption

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.DEVICE_ENCRYPTION_KEY!; // 32 bytes
const IV_LENGTH = 16;

interface EncryptedToken {
  iv: string;
  encryptedData: string;
}

function encryptDeviceToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    encryptedData: encrypted
  });
}

function decryptDeviceToken(encryptedString: string): { deviceId: string } {
  const { iv, encryptedData } = JSON.parse(encryptedString);
  
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    Buffer.from(iv, 'hex')
  );
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}
```

### 5.3 Device Fingerprint

```typescript
interface DeviceFingerprint {
  userAgent: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
  colorDepth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

function getDeviceFingerprint(): DeviceFingerprint {
  return {
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    colorDepth: window.screen.colorDepth,
    deviceMemory: (navigator as any).deviceMemory || undefined,
    hardwareConcurrency: navigator.hardwareConcurrency || undefined,
  };
}

function fingerprintToHash(fingerprint: DeviceFingerprint): string {
  const data = JSON.stringify(fingerprint);
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

---

## 6. Error Codes

| Code | HTTP Status | Description | User Message |
|------|-------------|-------------|--------------|
| BRAND_ALREADY_EXISTS | 400 | Brand already configured | Brand has already been set up. |
| BRAND_EMAIL_NOT_CONFIGURED | 400 | Brand email missing | Brand email must be configured first. |
| STORE_NOT_FOUND | 404 | Store code invalid | Store not found. Check your code. |
| INVALID_OTP | 400 | OTP mismatch | Invalid OTP. Try again. |
| OTP_EXPIRED | 400 | OTP past expiry | OTP expired. Request a new one. |
| OTP_ATTEMPTS_EXCEEDED | 429 | Too many OTP attempts | Too many attempts. Try again later. |
| DEVICE_NOT_FOUND | 404 | Device ID invalid | Device not found. |
| DEVICE_INVALID_OR_EXPIRED | 401 | Device token invalid/expired | Device registration expired. Re-register. |
| DEVICE_STORE_MISMATCH | 403 | User store ≠ Device store | Device registered to different store. |
| DEVICE_REVOKED | 401 | Device manually revoked | Device access revoked. Contact manager. |
| NOT_AUTHORIZED | 403 | Insufficient permissions | You don't have permission. |
| NOT_PENDING | 400 | Device not in pending state | Device doesn't require approval. |
| INVALID_PIN | 400 | Manager PIN wrong | Invalid PIN. |
| TARGET_STORE_INVALID | 400 | Target store not found/inactive | Invalid target store. |

---

## 7. Testing Requirements

### 7.1 Unit Tests

| Test | Description |
|------|-------------|
| OTP generation | 6 digits, random |
| OTP hashing | Consistent hash |
| Token encryption/decryption | Symmetric, reversible |
| Device fingerprint | All fields captured |
| Device name generation | Correct format |

### 7.2 Integration Tests

| Test | Steps |
|------|-------|
| Brand setup | POST /brand/setup, verify company + admin created |
| Device registration flow | Init → OTP → Verify → Success |
| Device auto-approval | First device gets APPROVED status |
| Device pending approval | Second device gets PENDING status |
| Manager approval | POST /devices/approve, device becomes active |
| User login with device | Login with valid device token |
| User login mismatch | Login with wrong store → error |
| Device revocation | Revoke device, user gets logged out |

### 7.3 E2E Tests

| Test | Description |
|------|-------------|
| First device registration | Full flow from store code to active device |
| Multi-device approval | Register 2nd device, manager approves, user logs in |
| Device transfer | Transfer device between stores, verify access change |
| Device expiration | Device expires, user forced to re-register |

---

## 8. Security Considerations

### 8.1 Token Storage

- Device tokens encrypted with AES-256 before storing in localStorage
- Encryption key stored in environment variable (not in code)
- Tokens never logged or exposed in error messages

### 8.2 OTP Security

- OTP expires after 10 minutes
- Max 5 attempts per OTP
- Rate limited: 5 OTP requests per hour per store
- OTP sent only to brand email (not user email)

### 8.3 Audit Trail

- All device actions logged with:
  - Timestamp
  - IP address
  - User ID (if authenticated)
  - Device ID
  - Action type
  - Additional details (JSON)

### 8.4 PIN Confirmation

- Device transfer requires manager PIN
- PIN stored as bcrypt hash
- PIN verified on each transfer

---

## 9. Files Reference

### 9.1 New Files

| File | Purpose |
|------|---------|
| `apps/api/src/db/schema/companies.ts` | Companies table |
| `apps/api/src/db/schema/registered_devices.ts` | Registered devices table |
| `apps/api/src/db/schema/device_audit_logs.ts` | Audit logs table |
| `apps/api/src/routes/brand.ts` | Brand setup endpoints |
| `apps/api/src/routes/devices.ts` | Device management endpoints |
| `apps/api/src/middleware/deviceAuth.ts` | Device validation middleware |
| `apps/api/src/utils/otp.ts` | OTP utilities |
| `apps/api/src/utils/encryption.ts` | Token encryption utilities |
| `apps/web/src/pages/BrandSetup.tsx` | Brand setup page |
| `apps/web/src/pages/DeviceRegister.tsx` | Device registration page |
| `apps/web/src/pages/DevicePending.tsx` | Pending approval page |
| `apps/web/src/pages/DeviceManagement.tsx` | Device management page |
| `apps/web/src/stores/deviceStore.ts` | Device state management |

### 9.2 Modified Files

| File | Changes |
|------|---------|
| `apps/api/src/db/schema.ts` | Add tables, modify stores/users |
| `apps/api/src/middleware/auth.ts` | Add device validation |
| `apps/api/src/routes/auth.ts` | Updated login flow |
| `apps/web/src/App.tsx` | Add routes, initialization flow |
| `apps/web/src/stores/authStore.ts` | Add device fields |
| `apps/web/src/pages/Login.tsx` | Handle device registration redirect |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-11 | - | Initial draft |
