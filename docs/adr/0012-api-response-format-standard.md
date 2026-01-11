# ADR-0012: API Response Format Standard

## Status

Accepted

## Date

2026-01-09

## Context

On 2026-01-09, a bug was discovered in the Shift Management API where the `POST /shifts/open` endpoint returned HTTP 200 with a valid shift object, but the frontend displayed "Failed to open shift" despite the operation succeeding.

### Root Cause

The API returned:
```json
{ "shift": { "id": "...", "shiftNumber": "..." } }
```

But the frontend expected (based on the ApiClient pattern):
```json
{ "success": true, "data": { "shift": { "id": "...", "shiftNumber": "..." } } }
```

The frontend code checks `if (response.success && response.data?.shift)` before treating the response as successful. Since `response.success` was `undefined` (falsy), the code fell to the error branch.

### Audit Findings

After auditing all API routes, the following inconsistencies were found:

| Route File | Issues Found |
|------------|--------------|
| `shifts.ts` | 14 responses missing `success` field or `data` wrapper |
| `auth.ts` (verify-pin) | Correct format - use as reference |

Most routes follow the standard correctly, but the `shifts.ts` routes were added later and did not follow the established pattern.

### Existing Pattern Across Codebase

The majority of endpoints follow this standard (confirmed in `auth.ts`, `products.ts`, `transactions.ts`, `discounts.ts`, `categories.ts`, `users.ts`, `stores.ts`, `stock.ts`, `reports.ts`, `sync.ts`, `settings.ts`, `data.ts`, `audit-logs.ts`):

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Decision

We will standardize all API responses to follow a consistent envelope format. This ensures frontend code can reliably check `response.success` before processing data.

### Standard Response Envelope

#### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message?: "optional status message"
}
```

- `success`: Must be `true`
- `data`: Contains the response payload (never at root level)
- `message`: Optional, for additional context (e.g., "User created successfully")

#### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details?: { ... }
}
```

- `success`: Must be `false`
- `error`: Human-readable error message
- `details`: Optional, for validation errors or additional context

### HTTP Status Code Policy

We maintain the current pattern of using HTTP 200 for all responses, with `success: false` in the body for business logic errors.

**Examples:**
- Validation error: `200` with `{ success: false, error: "Invalid input" }`
- Not found: `200` with `{ success: false, error: "Resource not found" }`
- Unauthorized: `200` with `{ success: false, error: "Unauthorized" }`
- Server error: `200` with `{ success: false, error: "Internal server error" }`

This simplifies frontend error handling by always checking the `success` field.

### Implementation Guidelines

#### Backend (Hono Routes)

```typescript
// ✅ CORRECT: Success response with data wrapper
return c.json({
  success: true,
  data: { shift: newShift },
});

// ✅ CORRECT: Error response
return c.json({
  success: false,
  error: 'Shift not found',
}, 400);

// ❌ INCORRECT: Missing success field
return c.json({ shift: newShift });

// ❌ INCORRECT: Data at root level
return c.json({ success: true, shift: newShift });

// ❌ INCORRECT: Error with success: true
return c.json({ success: true, error: 'Error' });
```

#### Frontend (ApiClient)

```typescript
// Check response format
if (response.success && response.data?.entity) {
  // Handle success
  const entity = response.data.entity;
}

if (!response.success) {
  // Handle error
  console.error(response.error);
}
```

### Response Formats by Endpoint Type

#### Single Entity Endpoints (GET, POST, PUT, DELETE)

```json
// Success
{ "success": true, "data": { "entity": { "id": "...", "name": "..." } } }

// Error
{ "success": false, "error": "Entity not found" }
```

#### List Endpoints (GET with pagination)

```json
// Success
{
  "success": true,
  data: {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### Action Endpoints (POST for actions)

```json
// Success
{ "success": true, "message": "Action completed successfully" }

// Error
{ "success": false, "error": "Action could not be completed" }
```

### Routes Audit Checklist

The following routes were audited and fixed to comply with this standard:

#### `apps/api/src/routes/shifts.ts`

| Endpoint | Status | Fixed |
|----------|--------|-------|
| POST /shifts/open | Non-compliant | ✅ |
| POST /shifts/close | Non-compliant | ✅ |
| GET /shifts/active | Non-compliant | ✅ |
| GET /shifts/:id | Non-compliant | ✅ |
| GET /shifts | Non-compliant | ✅ |
| POST /shifts/sync | Non-compliant | ✅ |

#### Reference: Correctly Implemented Routes

| Route File | Status |
|------------|--------|
| `auth.ts` | ✅ Compliant |
| `products.ts` | ✅ Compliant |
| `transactions.ts` | ✅ Compliant |
| `discounts.ts` | ✅ Compliant |
| `categories.ts` | ✅ Compliant |
| `users.ts` | ✅ Compliant |
| `stores.ts` | ✅ Compliant |
| `stock.ts` | ✅ Compliant |
| `reports.ts` | ✅ Compliant |
| `sync.ts` | ✅ Compliant |
| `settings.ts` | ✅ Compliant |
| `data.ts` | ✅ Compliant |
| `audit-logs.ts` | ✅ Compliant |

### Code Review Checklist

When reviewing new API routes, verify:

1. **Success responses** include `success: true`
2. **Success responses** wrap data in `data` field
3. **Error responses** include `success: false`
4. **Error responses** include `error` field with message
5. **No responses** have data at root level alongside `success`

### Enforcement

This standard is enforced through:

1. **Code review** - Reviewers must verify response format
2. **Frontend tests** - ApiClient tests verify response handling
3. **Integration tests** - API endpoint tests verify response format
4. **Documentation** - This ADR serves as reference

### References

- [ADR-0007: Shared API Client Package](/docs/adr/0007-shared-api-client.md) - Defines `ApiResponse<T>` type
- `packages/api-client/src/types.ts` - TypeScript interface for response format
- `packages/api-client/src/apiClient.ts` - Frontend response handling logic

## Consequences

### Positive

- Consistent API response format across all endpoints
- Reliable frontend response handling
- Easier to debug API issues
- Clear pattern for new developers

### Negative

- Requires migration of existing non-compliant routes
- Must update API documentation and examples

## Implementation Notes

When adding new routes, copy the pattern from existing compliant routes:

```typescript
import auth from './auth';

// Example from auth.ts - use as template
auth.post('/login', async (c) => {
  // ... logic ...

  return c.json({
    success: true,
    data: { /* payload */ },
  });
});
```
