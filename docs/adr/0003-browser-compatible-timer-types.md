# ADR-0003: Browser-Compatible Timer Types for Web Application

## Status

Accepted

## Date

2024-12-29

## Context

The POS web application is a React-based PWA that runs exclusively in browser environments. During Docker build, TypeScript compilation failed with the following errors:

```
src/hooks/useBarcode.ts(12,29): error TS2503: Cannot find namespace 'NodeJS'.
src/hooks/useSync.ts(45,30): error TS2503: Cannot find namespace 'NodeJS'.
```

### Problem Discovered

The hooks used `NodeJS.Timeout` type for `setTimeout` and `setInterval` return values:

```typescript
// useBarcode.ts
const timeoutRef = useRef<NodeJS.Timeout | null>(null);

// useSync.ts
const intervalRef = useRef<NodeJS.Timeout | null>(null);
```

This worked locally because:
1. The local development environment had `@types/node` installed (possibly hoisted from another package or globally available)
2. The IDE/editor provided the types

However, in the Docker container with a clean install, `@types/node` was not available, causing the build to fail.

### Root Cause Analysis

#### The `NodeJS` Namespace

The `NodeJS.Timeout` type comes from `@types/node`, which provides TypeScript definitions for Node.js runtime. This package is:
- **Not installed** in the web app (`apps/web/package.json`)
- **Not appropriate** for a browser-only application
- **Different from browser behavior**: In Node.js, `setTimeout` returns a `Timeout` object; in browsers, it returns a `number`

#### Environment Differences

| Environment | `setTimeout` Return Type | `@types/node` Available |
|-------------|-------------------------|------------------------|
| Node.js | `Timeout` object | Yes (if installed) |
| Browser | `number` | No (not applicable) |
| Docker build | N/A (compile-time) | No |

## Decision

We will use **`ReturnType<typeof setTimeout>`** and **`ReturnType<typeof setInterval>`** instead of `NodeJS.Timeout`. This approach:

1. Works in both Node.js and browser environments
2. Requires no additional dependencies
3. Is type-safe and idiomatic TypeScript
4. Automatically resolves to the correct type based on the runtime environment

### Implementation

#### Before (Broken)

```typescript
const timeoutRef = useRef<NodeJS.Timeout | null>(null);
const intervalRef = useRef<NodeJS.Timeout | null>(null);
```

#### After (Fixed)

```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

### How It Works

TypeScript's `ReturnType<T>` utility type extracts the return type of a function type `T`. When applied to `typeof setTimeout`:

- **In browser context**: Resolves to `number`
- **In Node.js context** (with `@types/node`): Resolves to `NodeJS.Timeout`

This makes the code portable across environments without hardcoding either type.

## Consequences

### Positive

- **Build succeeds in Docker**: No missing type dependencies
- **Environment-agnostic**: Works in browser, Node.js, and any build environment
- **No additional dependencies**: No need to add `@types/node` to a browser app
- **Type-safe**: Maintains full TypeScript type checking
- **Idiomatic**: Uses standard TypeScript utility types

### Negative

- **Slightly more verbose**: `ReturnType<typeof setTimeout>` is longer than `NodeJS.Timeout`
- **Less immediately readable**: Developers unfamiliar with `ReturnType` may need to look it up

### Trade-offs Accepted

The verbosity trade-off is acceptable because:
1. It's a well-known TypeScript pattern
2. It only appears in type annotations, not runtime code
3. It prevents environment-specific bugs

## Alternatives Considered

### Alternative A: Add `@types/node` as a devDependency

Install `@types/node` in the web app:

```json
"devDependencies": {
  "@types/node": "^20.0.0"
}
```

**Rejected because:**
- Adds unnecessary Node.js types to a browser-only application
- Could cause type conflicts or confusion
- Pollutes the type namespace with irrelevant Node.js APIs
- Increases bundle size (types are stripped, but adds maintenance burden)

### Alternative B: Use `number` type directly

```typescript
const timeoutRef = useRef<number | null>(null);
```

**Rejected because:**
- Technically incorrect for Node.js environments (if code is ever shared)
- Would require type assertions when using with `clearTimeout`
- Less portable than `ReturnType` approach

### Alternative C: Use `any` type

```typescript
const timeoutRef = useRef<any>(null);
```

**Rejected because:**
- Defeats the purpose of TypeScript
- Loses type safety entirely
- Bad practice

### Alternative D: Create a custom type alias

```typescript
type TimerId = ReturnType<typeof setTimeout>;
const timeoutRef = useRef<TimerId | null>(null);
```

**Considered but not implemented:**
- Valid approach for projects with many timer references
- Adds indirection
- For only 2 occurrences, inline `ReturnType` is sufficient

## Files Changed

- `apps/web/src/hooks/useBarcode.ts` - Line 12: Changed timer ref type
- `apps/web/src/hooks/useSync.ts` - Line 45: Changed interval ref type

## Pattern for Future Use

When working with timer functions in TypeScript, use:

```typescript
// For setTimeout
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// For setInterval
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// Usage remains the same
timeoutRef.current = setTimeout(() => { ... }, 1000);
clearTimeout(timeoutRef.current);

intervalRef.current = setInterval(() => { ... }, 5000);
clearInterval(intervalRef.current);
```

## References

- [TypeScript ReturnType Utility](https://www.typescriptlang.org/docs/handbook/utility-types.html#returntypetype)
- [MDN setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout)
- [Node.js Timers](https://nodejs.org/api/timers.html)

## Lessons Learned

1. **Avoid Node.js types in browser apps**: Don't rely on `@types/node` in frontend code
2. **Test builds in clean environments**: Docker builds catch dependency issues that local development misses
3. **Use environment-agnostic patterns**: `ReturnType<typeof fn>` is more portable than environment-specific types
4. **Local environment can hide issues**: Hoisted dependencies or global types may mask missing dependencies
