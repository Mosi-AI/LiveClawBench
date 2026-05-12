# mock-lib

Shared framework library for LiveClawBench mock services. All mocks import from this package via `mock-lib: "workspace:*"`.

## Overview

`mock-lib` provides a thin layer over [Hono](https://hono.dev/) and [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) that gives every mock:

- A pre-configured OpenAPI-enabled Hono app with `/health` and `/__mock_sentinel__/<name>`
- Runtime Zod validation with automatic 400 error injection
- Build-time OpenAPI 3.1 spec generation (`/openapi.json`)
- JWT signing/verification with per-process random secrets
- SQLite and JSON file persistence helpers
- SPA frontend fallback registration

## Factory

### `createMockApp(options)`

Creates an isolated mock application instance. No global state.

```typescript
import { createMockApp } from "mock-lib";

const mockApp = createMockApp({
  name: "shop",        // Required. Used for sentinel route and logging.
  port: 1234,          // Default port. Overridden by --port CLI flag.
  healthResponse: {    // Optional. Custom /health payload.
    ok: true,
    status: "healthy",
    service: "shop-mosi-backend",
  },
  openApi: {           // Optional. Enable /openapi.json endpoint.
    enabled: true,
    title: "Shop API",
    version: "1.0.0",
  },
});
```

Auto-registered endpoints:

- `GET /health` — returns the health payload (default: `{ status: "healthy", service: <name> }`)
- `GET /__mock_sentinel__/<name>` — harbor readiness probe
- `GET /openapi.json` — when `openApi.enabled` is true

### `registerFrontendFallback(app, frontendDir)`

Registers static file serving + SPA catch-all fallback. **Must be called after all API routes** to prevent the catch-all from swallowing API requests. API paths (`/api/*`, `/health`, `/openapi.json`) are rejected with 404.

```typescript
registerFrontendFallback(mockApp.app, "/opt/mock/static/shop");
```

## Server

### `startServer(mockApp, options?)`

Boots the Bun HTTP server. Uses `--port` CLI flag if present, otherwise `mockApp.config.port`.

```typescript
import { startServer } from "mock-lib";

const server = await startServer(mockApp, { dev: false });
```

Behavior:

- Calls `mockApp.seed()` before binding the HTTP listener. Seed failures are fatal (process exits with code 1).
- In dev mode (`dev: true`), enables Hono logger middleware.
- Returns the Bun server instance for lifecycle management.

## Auth

### `sign(payload)` / `verify(token)`

JWT helpers using HMAC-SHA256 with a per-process random secret (generated once at binary startup via `crypto.getRandomValues()`).

```typescript
import { sign, verify } from "mock-lib";

const token = await sign({ userId: 42 });
const payload = await verify(token); // throws on invalid / expired
```

### `authRequired` / `authOptional`

Middleware factories for protected routes.

```typescript
import { authRequired } from "mock-lib";

app.openApiRoute(route, handler, { auth: "required" });
// or manually:
app.use("/api/protected/*", authRequired);
```

Both set `c.get("userId")` when a valid `Authorization: Bearer <token>` header is present.

## Response Helpers

### `ok(data, message?)` / `err(message)`

Standard API response envelope. All mocks should use these for consistent JSON responses.

```typescript
import { ok, err } from "mock-lib";

// Success
return c.json(ok({ items: [] }, "Loaded successfully"));
// → { success: true, message: "Loaded successfully", data: { items: [] } }

// Error
return c.json(err("Seat already taken"), 409);
// → { success: false, message: "Seat already taken" }
```

Shape:

```typescript
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}
```

## Database

### `getDb(options?)`

Returns a `bun:sqlite` Database instance. Process-level singleton: calling `getDb()` multiple times in the same process returns the same instance.

```typescript
import { getDb } from "mock-lib";

const db = getDb({ path: "/var/lib/mock-data/my-mock/db.sqlite" });
```

For **in-memory databases in tests**, bypass the singleton and instantiate directly:

```typescript
import { Database } from "bun:sqlite";
const db = new Database(":memory:", { create: true });
```

### `migrate(db, sql)`

Executes a raw SQL migration string.

### `resetDb()`

Resets the singleton (useful between tests).

### `JsonStore`

Lightweight JSON file persistence with atomic writes.

```typescript
import { JsonStore } from "mock-lib";

const store = new JsonStore({ dir: "/var/lib/mock-data/my-mock" });
store.set("cart", { items: [] });
const cart = store.get("cart");
```

## OpenAPI

### `createRoute(config)`

Re-exported from `@hono/zod-openapi`. Defines a typed route with request/response Zod schemas.

```typescript
import { createRoute } from "mock-lib";
import { z } from "zod";

const route = createRoute({
  method: "get",
  path: "/api/products",
  request: { query: z.object({ q: z.string().optional() }) },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(ProductSchema) } },
      description: "Product list",
    },
  },
});
```

### `MockAppV2`

The return type of `createMockApp()`.

```typescript
interface MockAppV2 {
  config: MockConfig;
  app: OpenAPIApp;
  openApiInfo?: { title: string; version: string };
  seed?: () => void | Promise<void>;
}
```

### `app.openApiRoute(route, handler, options?)`

Registers a typed API route on the OpenAPI-enabled app. Automatically:

- Injects a 400 validation-error response if not explicitly defined
- Adds Bearer token security when `auth: "required"` is set
- Exposes the route in `/openapi.json`

```typescript
mockApp.app.openApiRoute(route, async (c) => {
  const { q } = c.req.valid("query");
  return c.json({ products: [] });
}, { auth: "required" });
```

### `app.page(path, handler)`

Registers a plain GET route excluded from the OpenAPI document. Use for HTML pages.

```typescript
mockApp.app.page("/", (c) => c.html("<h1>Home</h1>"));
```

## Render

### `registerStaticAssets(app, dir, prefix?)`

Registers static file serving from a directory. Use when the mock serves CSS/JS/images directly (not via SPA fallback).

## Formatting

### `formatDateTime(date)`

Formats a Date to `YYYY-MM-DD HH:MM:SS` in UTC.

## CLI

### `parseCliArgs()`

Parses `--key value` pairs from `process.argv` into a record. Does not support boolean flags.

### `parseCliPort()`

Reads `--port <number>` from CLI args. Returns `number | undefined`.

## Types

Key types exported from `mock-lib`:

| Type | Purpose |
|---|---|
| `MockConfig` | `{ name: string; port?: number; dev?: boolean }` |
| `CreateMockAppOptions` | `MockConfig` + `routes`, `healthResponse`, `openApi` |
| `MockAppV2` | The assembled app object returned by `createMockApp()` |
| `OpenAPIApp` | Extended Hono app with `openApiRoute()` and `page()` |
| `AppEnv` | Hono environment with `Variables.userId` |
| `JwtPayload` | Decoded JWT payload shape |
| `RouteConfig` | Re-exported from `@hono/zod-openapi` |
| `SqliteOptions` | `{ path?: string; autoMigrate?: boolean }` |
| `JsonStoreOptions` | `{ dir?: string }` |
