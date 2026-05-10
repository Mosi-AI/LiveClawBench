# Mock Service Conventions

This document defines the patterns and conventions for mock services in the mock-platform. Following these conventions ensures consistency across mocks and makes the platform easier to maintain.

---

## Factory Pattern

Every mock must export a factory function:

```typescript
export function createXxxApp(options?: { dbPath?: string }): MockAppV2 {
  // ...
}
```

Rules:
- Return `{ ...mockApp, seed: () => void | Promise<void> }`. The `seed` callback is consumed by `startServer()` before the HTTP listener boots.
- Use `if (import.meta.main)` guard to prevent accidental server startup on dynamic import.

**Preferred** (shop, doc-search):
```typescript
export function createShopApp(): MockAppV2 {
  const mockApp = createMockApp({ name: "shop", port: 1234 });
  // ... register routes ...
  return {
    ...mockApp,
    seed: async () => {
      await loadProducts();
      seedUser();
    },
  };
}
```

**Transitional** (airline, email, todolist): These mocks call `seedDatabase()` synchronously in the factory body for backward compatibility with existing tests, while also returning the `seed` property so `startServer()` can invoke it. Since seed functions are idempotent, the double call is harmless.

---

## Route Registration

Priority order for registering routes:

1. **API routes** — `createRoute()` + `app.openApiRoute()`
   - Generates OpenAPI 3.1 spec automatically
   - Zod validation with automatic 400 error injection
   - Optional bearer-auth security per route
   - Used by: shop, doc-search

2. **HTML pages** — `app.page()`
   - Excluded from OpenAPI docs
   - Used by: shop (TSX rendering)

3. **Legacy fallback** — raw `app.get()` / `app.post()`
   - Only acceptable for simple mocks or遗留 (legacy) Flask migrations
   - Used by: (none — all services migrated to Zod schema-first)

**New mocks must** use option 1 for all API routes.

---

## Response Wrappers

Use the standard envelope from `mock-lib`:

```typescript
import { ok, err } from "mock-lib";

return c.json(ok({ items: [] }));           // { success: true, data: { items: [] } }
return c.json(err("Not found"), 404);       // { success: false, message: "Not found" }
```

Shape:

```typescript
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}
```

Current state:
- **airline**: uses `ok()`/`err()` from `mock-lib` (migrated)
- **email**: uses `ok()`/`err()` from `mock-lib` via re-export (migrated)
- **todolist**: uses `ok()`/`err()` from `mock-lib` (migrated)
- **shop**: uses `ok()`/`err()` from `mock-lib` (migrated)
- **doc-search**: uses `err()` from `mock-lib` for error responses (migrated)

**New mocks must** import `ok`/`err` from `mock-lib` and use them for all JSON responses.

### Error Response Shapes

All error responses — whether from business logic, Zod validation failures, auth middleware, or global error handling — use the same `err()` shape:

```typescript
{ success: false, message: string }
```

This is enforced at two levels:
1. **Framework level**: `mock-lib`'s `openApiRoute()` auto-injects validation errors (400), auth errors (401), and content-type errors (415) using `err()`. The global error handler also uses `err()`.
2. **Business logic level**: Route handlers use `err()` for application errors.

The `ErrorResponseSchema` (used in OpenAPI specs for auto-injected 400/401/415) and `ErrSchema` (used in route-specific error responses) both define `{ success: false, message: string }`.

---

## Authentication

### JWT

- **Required**: use `sign()` / `verify()` from `mock-lib`
- Proper HMAC-SHA256 with per-process random secret
- **Forbidden**: fake signatures like `.mock-signature`

Example:
```typescript
import { sign, verify } from "mock-lib";

const accessToken = await sign({ userId });
const payload = await verify(token); // throws on invalid
```

### Passwords

- **Required**: hash passwords before storage
- Options:
  - Werkzeug-compatible PBKDF2: `generateWerkzeugHashSync()` / `verifyWerkzeugHash()` (from email helpers)
  - bcryptjs
- **Forbidden**: plaintext storage or plaintext comparison

> **Note**: `mock-lib` exports `authRequired` / `authOptional` middleware for services that need Bearer auth enforcement via `openApiRoute`'s auth option. Services without auth requirements (airline, todolist) or with custom auth logic (email's manual header parsing via `getAuthUserId()`) may skip it. This middleware is optional, not mandatory.

> **Note**: `airline` has a backward-compatible plaintext fallback (`password_hash === password`) for legacy seed data that predates the Werkzeug migration. New registrations and password changes use PBKDF2. This fallback must NOT be extended to new mocks.

---

## Database & Seeding

### Database choice

- SQL mocks: `bun:sqlite`
  - File DB via `mock-lib`'s `getDb()` helper
  - In-memory for tests: `new Database(":memory:")`
- JSON mocks: `mock-lib`'s `JsonStore`

### Seeding rules

- Seed must be **idempotent** — check existing data before inserting
- Seed callback must be **async** and returned as `mockApp.seed`
- Task-specific seed injection (e.g., `TASK_NAME` env var) should be handled inside the seed callback

Example:
```typescript
export function seedDatabase(db: Database): void {
  const existing = db.query("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (existing.count > 0) return; // idempotent

  // ... insert seed data ...
}
```

---

## Health Endpoints

`createMockApp()` automatically registers `GET /health`. Do NOT manually add `/health` routes.

Custom health payload:
```typescript
const mockApp = createMockApp({
  name: "shop",
  port: 1234,
  healthResponse: { ok: true, status: "healthy", service: "shop-mosi-backend" },
});
```

Note: If your mock already exposes `/api/health` and tests depend on it, keep it. New mocks should rely solely on the auto-registered `/health`.

---

## File Size Guidelines

Soft limits — exceed only when splitting would hurt readability:

| File type | Target | Action if exceeded |
|-----------|--------|-------------------|
| Entry point (`index.ts`) | <=150 | Extract route registration into `routes/*.ts` |
| Route handler | <=200 | Split by resource (e.g., `bookings.ts` + `checkin.ts`) |
| Seed file | <=300 | Split seed data from seed logic |
| Component | <=300 | Extract sub-components |

---

## Testing

- Test files live in `mocks/<name>/tests/`
- Use `bun:test`
- Fresh app instance per test via factory call
- Call `seed()` explicitly in `beforeEach` when needed
- Use explicit assertions; avoid snapshots (except algorithmic tests where the output is deterministic)

Example test skeleton:
```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { createShopApp } from "../src/index";

describe("shop routes", () => {
  let app: MockAppV2;

  beforeEach(async () => {
    app = createShopApp();
    await app.seed?.();
  });

  it("returns products", async () => {
    const res = await app.app.request("/api/products");
    expect(res.status).toBe(200);
  });
});
```

---

## PR #41 Review Verification

PR #41 migrated Email, TodoList, and Airline from Python Flask to Bun+TypeScript. The following issues were verified:

### Confirmed Fixed

| Issue | Commit | Evidence |
|-------|--------|----------|
| `lastInsertRowid` instead of `SELECT last_insert_rowid()` | 3881fe5 | email `attachments.ts`, `seed.ts`; todolist `todos.ts` |
| `existsSync` guards for frontend fallback | 2606119 | email/todolist `index.ts` |
| Removed dead `chat_sessions.booking_id` | 2606119 | airline `seed.ts` |
| `passengers.seat_id` NULL clearing on cancel | a79bff0 | airline `bookings.ts:195` |
| FK chain cleanup in seed data | 2606119 | airline `seed.ts` |
| Atomic seat claiming with `changes === 0` | a79bff0 | airline `bookings.ts:167` |
| TOCTOU fix for seat availability | a79bff0 | `UPDATE seats SET is_available = 0 WHERE id = ? AND is_available = 1` |
| `is_read` boolean validation | 6cca7aa | email `emails.ts` |
| LIKE escaping | 6cca7aa | email `emails.ts` escapes `%` and `_` |
| `getNextSunday` boundary fix | 6cca7aa | todolist `seed.ts` handles Sunday correctly |

### Still Present (Documented)

None. All issues from PR #41 have been resolved.

### Historical Notes

- File size soft-limit violations (`airline/src/seed.ts` ~901 lines, `email/src/routes/emails.ts` ~339 lines) were resolved in commit `33615d9` by splitting into smaller modules.

### Fixed in This Pass

| Issue | Location | Fix |
|-------|----------|-----|
| No `seed` callback | airline/email/todolist `index.ts` | Added `seed` property while retaining sync call for backward compatibility |
| Duplicate `/health` | email/todolist `index.ts` | Removed manual `/api/health`; tests use auto-registered `/health` |
| Missing `healthResponse` | airline/email/todolist `index.ts` | Added `{ ok: true, status, service }` to `createMockApp()` |
