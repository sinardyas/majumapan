# ADR-0012: REST API Query Parameters vs Body Payload Convention

## Status

Accepted

## Context

During the implementation of the Promotions feature, we encountered an inconsistency in how the API handles `storeId` parameter passing between different HTTP methods:

- **GET requests**: `storeId` was passed via query parameters (`/promotions?storeId=xxx`)
- **POST/PUT requests**: `storeId` was expected in query parameters but the API client's POST/PUT methods do not support query parameter serialization

This inconsistency caused the error "storeId is required" when creating new promotions because:
1. The API client `post()` and `put()` methods only support query parameters for `get()` method
2. Query parameters were being ignored for POST/PUT requests
3. The `storeId` was sent in the request body but the API schema didn't expect it there

### Current API

```typescript
// Client Implementation get() method - correctly handles queryParams
async get<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { skipAuth, skipAuthHandling, queryParams, responseType, ...fetchOptions } = options;
  if (queryParams) {
    // ... builds query string
  }
}

// post() method - does NOT handle queryParams
async post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { skipAuth, skipAuthHandling, responseType, ...fetchOptions } = options;
  // queryParams is NOT destructured - it's lost in fetchOptions
}
```

## Decision

We will follow REST API best practices for parameter passing:

### GET Requests
- Use **query parameters** for filtering, search, and pagination
- Examples: `/promotions?storeId=xxx&activeOnly=true&limit=10`

### POST/PUT Requests
- Use **body payload** for resource identifiers and data
- Query parameters are NOT supported (not a standard practice)
- Examples: `POST /promotions { storeId, name, description, ... }`

### Rationale

1. **REST Best Practices**: Query parameters are conventionally used for filtering GET requests. For mutations (POST/PUT), resource identifiers belong in the URL path or body.

2. **API Client Consistency**: The API client already supports query params for GET. Rather than fix POST/PUT to also support them, we follow the convention.

3. **Security**: Identifiers in body are harder to accidentally log or expose in server access logs compared to query params.

4. **Semantic Clarity**: GET is idempotent and safe - query params make sense. POST/PUT modify state - data belongs in body.

## Implementation

### API Changes

**File**: `apps/api/src/routes/promotions.ts`

```typescript
// Schema now includes storeId
const createPromotionSchema = z.object({
  storeId: z.string().uuid('Invalid store ID'),
  name: z.string().min(1, 'Name is required').max(255),
  // ... other fields
});

// Handler uses body.storeId
promotionsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const storeId = body.storeId || user.storeId;
  // ...
});
```

### Client Changes

**File**: `apps/admin/src/pages/Promotions.tsx`

```typescript
// StoreId in body, not queryParams
const requestData = {
  storeId: data.storeId,  // Now in body
  name: data.name,
  // ... other fields
};
response = await api.post<Promotion> requestData);  // No query('/promotions',Params
```

### Affected Endpoints

| Endpoint | Previous | Current |
|----------|----------|---------|
| POST /promotions | queryParams: { storeId } | Body: { storeId } |
| PUT /promotions/:id | queryParams: { storeId } | Body: { storeId } |
| GET /promotions | queryParams: { storeId } | No change |
| GET /promotions/:id | No storeId | No change |

## Consequences

### Positive

1. **Consistent API Design**: Follows REST conventions
2. **Simpler API Client**: No need to support query params for POST/PUT
3. **Better Security**: Resource IDs in body, not URL logs
4. **Clear Convention**: Developers know where to put each type of data

### Negative

1. **Migration Required**: Existing PUT endpoints need schema updates
2. **Client Updates**: All mutation calls must move storeId to body

## Implementation Tasks

### API Updates Required

| Route | File | Change |
|-------|------|--------|
| POST /promotions | `apps/api/src/routes/promotions.ts` | Add storeId to schema, use body.storeId |
| PUT /promotions/:id | `apps/api/src/routes/promotions.ts` | Add storeId to schema, use body.storeId |
| PUT /discounts/:id | `apps/api/src/routes/discounts.ts` | Review and update if needed |
| PUT /products/:id | `apps/api/src/routes/products.ts` | Review and update if needed |
| PUT /categories/:id | `apps/api/src/routes/categories.ts` | Review and update if needed |

### Client Updates Required

| File | Change |
|------|--------|
| `apps/admin/src/pages/Promotions.tsx` | Move storeId to body, remove queryParams |
| Other admin pages | Review PUT/POST calls for similar patterns |

## Notes

### Alternative Considered

We considered updating the API client to support query parameters for POST/PUT methods. While this would work, it would:
- Go against REST conventions
- Create an inconsistent API design
- Require maintaining duplicate logic

The chosen approach (body-based) is more maintainable and follows industry standards.

### Future Considerations

If we need to pass non-sensitive filtering data to POST endpoints (rare), we can:
1. Add a `filters` object to the request body
2. Use a dedicated search endpoint with GET
