# mock-platform: hono-openapi + Zod Route Refactor Design

**Date:** 2026-04-22
**Status:** Draft (incremental — sections will be added as design discussions progress)
**Approach:** B — mock-lib `route()` factory with OpenAPIHono integration
**Reviewed:** 2026-04-22 — §1–4 review incorporated; 2026-04-23 — §3/§5 type-safety + preprocess review incorporated (see Review Log at bottom)

## 1. Background & Motivation

mock-platform currently has 5 mock services (shop, doc-search, airline, email, todolist) built on Hono v4.8.0 + Bun. All runtime validation is manual `if` checks; API documentation is hand-written markdown (~800 lines total across shop.md and doc-search.md). Three of the five services (airline, email, todolist) are stubs with only a sentinel route.

**Goals:**

- Replace manual validation with Zod schemas as single source of truth
- Auto-generate OpenAPI spec from route definitions (eliminate hand-written API endpoint docs)
- Improve developer experience for building new mock services
- Unify patterns across all 5 mocks (including stubs)

**Non-goals:**

- Serving OpenAPI docs to agents inside task containers (not evaluation-driven; `/openapi.json` is dev-only, disabled in production builds)
- Migrating off Hono or Bun
- Supporting OpenAPI 2.x / 3.0 (target: OpenAPI 3.1)
- Full TypeScript type inference on `c.req.valid()` return values (v1 accepts `any`; may add generic inference later)

## 2. Architecture Overview

### Layering

```
┌─────────────────────────────────────────────────────────────┐
│                    Mock Service (per-task)                   │
│  ┌──────────────┐  ┌──────────────────────────────────────┐ │
│  │  HTML Routes │  │           API Routes                 │ │
│  │  app.page()  │  │  app.openapiRoute(def)                │ │
│  │              │  │                                      │ │
│  │  /, /cart,   │  │  /api/products, /api/cart/add, ...  │ │
│  │  /search ... │  │                                      │ │
│  └──────────────┘  └──────────────────────────────────────┘ │
│                        │                                      │
│              ┌─────────┴──────────┐                          │
│              │   route() Factory   │  ← mock-lib/openapi     │
│              │  (OpenAPIHono       │                          │
│              │   wrapper)          │                          │
│              └─────────┬──────────┘                          │
│                        │                                      │
│              ┌─────────┴──────────┐                          │
│              │  @hono/zod-openapi  │  ← official library     │
│              │  (OpenAPIHono +     │                          │
│              │   createRoute)      │                          │
│              └─────────┬──────────┘                          │
│                        │                                      │
│              ┌─────────┴──────────┐                          │
│              │      Hono Core      │  ← existing foundation  │
│              └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Runtime  │   │ Buildtime│   │  Test    │
        │ /openapi │   │ generate-│   │ snapshot │
        │ .json    │   │ openapi  │   │  diff    │
        │(dev only)│   │          │   │          │
        └──────────┘   └──────────┘   └──────────┘
```

> **Registry decision:** v1 uses `OpenAPIHono`'s built-in registry directly (`app.getOpenAPI31Document()`).
> If the built-in API proves insufficient for build-time traversal or snapshot testing,
> a thin abstraction layer will be added in v2. No premature abstraction.
>
> **defaultHook hierarchy caveat:** `@hono/zod-openapi` has a known issue where `defaultHook`
> does **not** propagate through `app.route()` sub-routers ([honojs/middleware#708](https://github.com/honojs/middleware/issues/708)).
> The factory avoids this by registering all routes on a single `OpenAPIHono` instance — no sub-routers.

### Data Flow

1. **Development time:** Developer defines `schema` + `handler` in mock service, calls `app.openapiRoute()` → factory registers on OpenAPIHono
2. **Runtime (dev mode only):** Hono serves requests normally; `/openapi.json` endpoint (via `app.doc()`) generates full OpenAPI Document. **Disabled when `openApi.enabled` is `false`** (production builds).
3. **Build time:** `scripts/generate-openapi.ts` imports each mock's app instance via `import.meta.main` guard, calls `getOpenAPI31Document()`, outputs static `openapi.json` to `dist/`
4. **Test time:** Snapshot tests verify "every API route has a schema definition"

### Design Principles

| Principle | Description |
|-----------|-------------|
| Factory wraps, doesn't reinvent | `app.openapiRoute()` delegates to `OpenAPIHono.openapi()`; no separate registry layer |
| HTML/API split | Page routes via `app.page()` (no OpenAPI metadata), API routes via `app.openapiRoute()` (OpenAPI-registered) |
| OpenAPIHono is source of truth | Runtime and build-time both read from `OpenAPIHono`'s built-in document generator |
| Stub-friendly | New mocks only need `createMockApp()` + a few `app.openapiRoute()` calls for full schema + docs |
| Middleware order: Auth → Zod | Auth middleware registered globally before routes; Zod validation runs per-route after auth context is established |
| Dev-only OpenAPI endpoint | `/openapi.json` is only registered when `openApi.enabled` is `true`; production builds disable it |

## 3. Factory API Design

### Types

> **Design decision (R38):** `openApiRoute` uses a two-argument signature instead of a single
> `RouteDef` object. This preserves `@hono/zod-openapi`'s generic type inference chain:
> `createRoute()` → typed `RouteConfig` → `ComputeInput<R>` → `c.req.valid()` returns the
> correct `z.infer` type instead of `any`. A single-object API breaks this chain because
> TypeScript cannot infer from `def.schema.query` to `def.handler` within the same object
> literal. See Review Log R38 for details.

```typescript
// packages/mock-lib/src/openapi/types.ts
import { OpenAPIHono, createRoute, type RouteConfig } from "@hono/zod-openapi";
import type { Handler, Context } from "hono";

interface OpenAPIApp extends OpenAPIHono<AppEnv> {
  // HTML page routes — not in OpenAPI spec
  // Supports Hono path parameters (e.g., "/docs/:slug") — parsed via c.req.param()
  // GET-only by convention; if a POST form page is ever needed, use app.openApiRoute()
  page<P extends string>(
    path: P,
    handler: (c: Context<AppEnv>) => Response | Promise<Response>
  ): void;

  // API routes — two-argument signature preserves full type inference.
  // route: createRoute() return value, carries Zod schema type information.
  // handler: receives typed Context; c.req.valid("query"/"json"/"param") returns z.infer<>.
  // options: factory extensions (auth, rawOpenApi) orthogonal to RouteConfig.
  openApiRoute<R extends RouteConfig>(
    route: R,
    handler: Handler<
      AppEnv,
      ConvertPath<R["path"]>,
      ComputeInput<R>,
      Response
    >,
    options?: RouteOptions,
  ): void;

  // Generate OpenAPI 3.1 Document (build-time and dev runtime use)
  // Uses @hono/zod-openapi's getOpenAPI31Document() — requires 0.18.x API
  getOpenAPI31Document(): Record<string, unknown>;
}

// Factory extension options — orthogonal to createRoute()'s RouteConfig.
// These control factory-level behavior that createRoute() doesn't handle.
interface RouteOptions {
  // Auth control: "optional" (default) or "required". "required" generates
  // `security: [{ bearerAuth: [] }]` in the OpenAPI spec.
  auth?: "optional" | "required";
  // Escape hatch: merged over auto-generated OpenAPI operation object.
  // Merging strategy: { ...autoGenerated, ...rawOpenApi } — rawOpenApi wins key conflicts.
  // Use for non-standard fields (e.g., custom parameters, deprecated flag) that the
  // factory does not auto-generate. Prefer `auth: "required"` for bearer security.
  rawOpenApi?: Record<string, unknown>;
}

// mock-lib re-exports createRoute and RouteConfig so mocks don't need direct dependency.
// Usage: import { createRoute } from "@liveclaw/mock-lib";
export { createRoute, type RouteConfig } from "@hono/zod-openapi";

// createMockApp returns { config, app } — same shape as current MockApp
// `app` is now an OpenAPIApp instead of plain Hono
interface MockAppV2 {
  config: MockConfig;
  app: OpenAPIApp;
}
```

### `createMockApp` Return Type

`createMockApp()` returns `{ config, app: OpenAPIApp }` — **not** a bare `OpenAPIApp`.

Rationale:
- `startServer()` consumes `MockApp` (unchanged API)
- `config` remains explicitly accessible (port, name, dev)
- Minimal diff from current `MockApp` type (only `app` field changes from `Hono` to `OpenAPIApp`)

### Usage Example: shop mock

```typescript
// mocks/shop/src/index.tsx
import { createMockApp, startServer, createRoute } from "@liveclaw/mock-lib";
import { z } from "zod";

export function createShopApp() {
  const { config, app } = createMockApp({
    name: "shop",
    port: 1234,
    openApi: {
      enabled: true,  // false in production builds — disables /openapi.json endpoint
      info: { title: "Shop Mock API", version: "1.0.0" },
      servers: [{ url: "http://localhost:1234" }],
    },
  });

  // ── HTML page routes (not in OpenAPI spec) ──
  app.page("/", (c) => {
    return c.html(<HomePage products={products} />);
  });

  app.page("/cart", (c) => {
    return c.html(<CartPage cart={cart} />);
  });

  app.page("/docs/:slug", (c) => {
    const slug = c.req.param("slug");
    return c.html(<DocPage slug={slug} />);
  });

  // ── API routes (OpenAPI-registered, type-safe) ──
  // createRoute() produces a typed RouteConfig; the handler receives
  // full type inference on c.req.valid() calls.

  const listProductsRoute = createRoute({
    method: "get",
    path: "/api/products",
    tags: ["Products"],
    summary: "List products",
    request: {
      query: z.object({ q: z.string().optional() }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.array(ProductSchema) } },
        description: "Product list",
      },
    },
  });

  app.openApiRoute(listProductsRoute, (c) => {
    const { q } = c.req.valid("query");  // ✅ typed: { q?: string }
    const results = q ? search(products, q) : products;
    return c.json(results);
  });

  // Example with path params — `request.params` schema maps to c.req.valid("param")
  const getProductRoute = createRoute({
    method: "get",
    path: "/api/product/{product_id}",
    tags: ["Products"],
    summary: "Get product by ID",
    request: {
      params: z.object({ product_id: z.string().min(1) }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: ProductSchema } },
        description: "Product details",
      },
      404: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Product not found",
      },
    },
  });

  app.openApiRoute(getProductRoute, (c) => {
    const { product_id } = c.req.valid("param");  // ✅ typed: { product_id: string }
    const product = allProducts.find((p) => p.id === product_id);
    if (!product) return c.json({ error: "Product not found" }, 404);
    return c.json(product);
  });

  // Example with request body — `request.json` schema maps to c.req.valid("json")
  const addToCartRoute = createRoute({
    method: "post",
    path: "/api/cart/add",
    tags: ["Cart"],
    summary: "Add item to cart",
    request: {
      json: z.object({ product_id: z.string() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), cart: z.array(CartItemSchema) }),
          },
        },
        description: "Item added",
      },
    },
  });

  app.openApiRoute(addToCartRoute, (c) => {
    const { product_id } = c.req.valid("json");  // ✅ typed: { product_id: string }
    // ...
  });

  // Example with auth: "required" via RouteOptions
  const getUserRoute = createRoute({
    method: "get",
    path: "/api/user",
    responses: {
      200: {
        content: { "application/json": { schema: UserDataSchema } },
        description: "User profile",
      },
    },
  });

  app.openApiRoute(getUserRoute, (c) => {
    return c.json(loadUser());
  }, { auth: "required" });

  // Sentinel route (stubs use same pattern)
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/shop",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  return { config, app };
}

if (import.meta.main) {
  const { config, app } = createShopApp();
  startServer({ config, app }, { seed() { seedUser(); seedOrders(); } });
}
```

### Escape Hatch

For routes needing non-standard OpenAPI fields, pass `rawOpenApi` in `RouteOptions`:

```typescript
app.openApiRoute(adminOrdersRoute, (c) => {
  return c.json({ orders: [] });
}, {
  rawOpenApi: {
    parameters: [{ $ref: "#/components/parameters/X-Request-ID" }],
  },
});
```

Factory deep-merges `rawOpenApi` over auto-generated metadata. Prefer `auth: "required"` over manual `security` in `rawOpenApi`.

### Key API Decisions

| Decision | Rationale |
|----------|-----------|
| `app.page()` is GET-only, no method arg | HTML page routes are GET-only by convention; signature is `page(path, handler)` for brevity. Supports Hono path params (`/docs/:slug`). **Pre-migration audit required** for Phase 3 (shop): if any HTML route uses POST (legacy form submission), refactor to JS-driven API call or use `app.openApiRoute()`. |
| Two-arg `openApiRoute(route, handler, options?)` | Preserves `@hono/zod-openapi`'s generic type inference chain: `createRoute()` → typed `RouteConfig` → `ComputeInput<R>` → `c.req.valid()` returns `z.infer<>`. A single-object API breaks this chain. |
| `createRoute()` for route config | Direct use of `@hono/zod-openapi`'s standard API; no custom `RouteDef` wrapper. Mock-lib re-exports `createRoute` so mocks don't need direct dependency on `@hono/zod-openapi`. |
| `request.query` / `request.json` / `request.params` | Aligns with `@hono/zod-openapi`'s `RouteConfig` naming; `json` in config → `valid("json")` in handler |
| `RouteOptions` as third arg | Auth and rawOpenApi are factory-level concerns, orthogonal to `RouteConfig`. Separated to avoid polluting the typed route definition. |
| Auth middleware registered before routes | Global `app.use("*", authOptional)` runs first, establishing `userId` before Zod validation |
| `openApi.enabled` flag | `/openapi.json` endpoint only registered in dev mode; production builds skip it |

## 4. File Change Summary

### Phase 0: Infrastructure (no mock changes)

| File/Directory | Action | Description |
|----------------|--------|-------------|
| `packages/mock-lib/src/openapi/` | **New** | Factory core: `openApiRoute()` (two-arg), `page()`, `createOpenAPIApp()`; re-exports `createRoute` from `@hono/zod-openapi` |
| `packages/mock-lib/src/openapi/schemas.ts` | **New** | Shared schemas: `PaginationQuerySchema`, `ErrorResponseSchema`, etc. |
| `packages/mock-lib/src/types.ts` | **Modify** | Add `OpenApiConfig` to `CreateMockAppOptions`; `MockAppV2` return type |
| `packages/mock-lib/src/create-app.ts` | **Modify** | Return `MockAppV2` with `app: OpenAPIApp` instead of `app: Hono` |
| `scripts/generate-openapi.ts` | **New** | Build-time: import app → `getOpenAPI31Document()` → static JSON |

### Phase 1: Stub migration (airline → email → todolist)

| File/Directory | Action | Description |
|----------------|--------|-------------|
| `mocks/airline/src/index.ts` | **Rewrite** | Sentinel route → `app.openapiRoute()`, add `import.meta.main` guard |
| `mocks/email/src/index.ts` | **Rewrite** | Same pattern |
| `mocks/todolist/src/index.ts` | **Rewrite** | Same pattern |

### Phase 2: doc-search migration

| File/Directory | Action | Description |
|----------------|--------|-------------|
| `mocks/doc-search/src/schemas.ts` | **New** | Extract API schemas from inline types |
| `mocks/doc-search/src/index.ts` | **Rewrite** | API routes → `app.openapiRoute()`, HTML routes → `app.page()` (including `/docs/:slug`) |

### Phase 3: shop migration (most complex)

| File/Directory | Action | Description |
|----------------|--------|-------------|
| `mocks/shop/src/schemas.ts` | **New** | Extract all API schemas from inline types |
| `mocks/shop/src/index.tsx` | **Rewrite** | ~14 API routes + 5 HTML pages migrated to new factory API |

### Phase 4: Documentation cleanup

| File/Directory | Action | Description |
|----------------|--------|-------------|
| `docs/api/shop.md` | **Migrate + Delete** | Non-API content (Data Types, Search Algorithm) → `docs/shop-internal.md`; API endpoint docs deleted |
| `docs/api/doc-search.md` | **Migrate + Delete** | Non-API content (Database Schema, JSONL format, Configuration) → `docs/doc-search-internal.md`; API endpoint docs deleted |

### Bundle Size Impact

Empirically measured: `@hono/zod-openapi` + `zod` + `openapi3-ts` adds **+0.5 MB** to compiled binary (+0.58% from 95 MB baseline). Bun tree-shaking reduces 6.7 MB on-disk to 0.5 MB in binary. Negligible.

---

## 5. Zod Schema Design

> **Status:** Reviewed — §5 review incorporated (see Review Log at bottom)

### Core Decision: Zod Schema as Single Source of Truth

All API boundary types are derived from Zod schemas via `z.infer`. Manual interfaces at the API
boundary are deleted.

Internal-only types (search algorithm, JSONL event logging, computation intermediates) remain as
plain TypeScript interfaces.

### Schema Naming Principle: Faithful to Reality

Schema field names **must match** the actual API contract exactly — including inconsistencies.
This is a benchmark mock platform: the schema's job is to describe what the API actually does,
not to idealize it.

Concrete implications:
- `ProductSchema.id` is `id` (response field), but `AddToCartBodySchema.product_id` is
  `product_id` (request field) — same logical entity, different field names in different contexts
- `rating_count` is `z.string()` (e.g., `"41,607 ratings"`) — a display string, not a number
- `OrderItem` has both `id?: string` and `product_id: string` — both fields are preserved

### File Organization

```
mock-platform/
├── packages/mock-lib/src/openapi/
│   └── schemas.ts              # Shared utility schemas (error only; pagination deferred)
├── mocks/shop/src/
│   ├── schemas.ts               # All shop schemas (~200-250 lines)
│   ├── index.tsx                # Route definitions (imports schemas)
│   └── search-algorithm.ts      # Retains SearchableProduct/FilterOptions interfaces
├── mocks/doc-search/src/
│   ├── schemas.ts               # All doc-search schemas
│   └── index.ts                 # Route definitions (imports schemas)
```

Each mock uses a **single `schemas.ts` file**. If a mock grows beyond ~400 lines of schemas,
split into a `schemas/` directory at that point. Premature splitting adds overhead for stubs.

### Shared Schemas (mock-lib)

```typescript
// packages/mock-lib/src/openapi/schemas.ts
import { z } from "zod";

// Generic error response — used by all mocks for business logic errors
// (e.g., { error: "Product not found" }, { error: "Cart is empty" })
export const ErrorResponseSchema = z.object({
  error: z.string(),
});

// Factory validation error — returned by the custom defaultHook when Zod validation fails.
// This schema exists for OpenAPI spec generation: it describes the 400 response shape that
// the factory's hook returns, so the auto-generated OpenAPI spec correctly documents it.
// Runtime behavior: the factory's defaultHook formats ZodError into this shape.
export const FactoryValidationSchema = z.object({
  error: z.string(),
});
```

**Why no shared `PaginationQuerySchema`?**

Shop's `/api/products` uses `page` but hardcodes `limit` to `PRODUCTS_PER_PAGE = 30`. Doc-search
has no pagination (fixed LIMIT 8). Airline/email/todolist are stubs. No current mock shares a
common pagination pattern. If future mocks converge, extract to mock-lib then.

### Shop Schemas (per-mock example)

```typescript
// mocks/shop/src/schemas.ts
import { z } from "zod";
import { ErrorResponseSchema, FactoryValidationSchema } from "@liveclaw/mock-lib";

// ── Entity schemas (match current interfaces exactly) ──

// Product as returned by GET /api/products and GET /api/product/:product_id
// Note: "id" in responses, "product_id" in request bodies — faithful to current API
export const ProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  rating: z.number(),
  // Display string: "41,607 ratings", "1,006 ratings" — not a numeric count
  rating_count: z.string(),
  image_url: z.string(),
  sponsored: z.boolean().optional(),
  best_seller: z.boolean().optional(),
  overall_pick: z.boolean().optional(),
  limited_time: z.boolean().optional(),
  discounted: z.boolean().optional(),
  low_stock: z.boolean().optional(),
  stock_quantity: z.number().nullable().optional(),
});

// CartItem as returned by GET /api/cart
export const CartItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  rating: z.number(),
  image_url: z.string(),
  quantity: z.number().int().min(1),
});

// OrderItem as nested inside Order — has both id and product_id
export const OrderItemSchema = z.object({
  product_id: z.string(),
  id: z.string().optional(),
  title: z.string(),
  price: z.number(),
  quantity: z.number(),
  image_url: z.string(),
});

// Order as returned by GET /api/orders
export const OrderSchema = z.object({
  order_id: z.string(),
  user_id: z.string(),
  items: z.array(OrderItemSchema),
  total_amount: z.number(),
  status: z.string(),
  create_time: z.string(),
  shipping_address: z.string(),
});

// PaymentMethod nested inside UserData
export const PaymentMethodSchema = z.object({
  type: z.string(),
  account: z.string(),
  balance: z.string().optional(),
});

// UserData as returned by GET /api/user
export const UserDataSchema = z.object({
  username: z.string(),
  gender: z.string(),
  address: z.string(),
  email: z.string(),
  phone: z.string(),
  payment_methods: z.array(PaymentMethodSchema).optional(),
});

// ── Request schemas ──

export const ListProductsQuerySchema = z.object({
  q: z.string().optional(),
  sort: z.enum(["similarity", "price_asc", "price_desc", "rating"]).default("similarity"),
  // Silent fallback for page: NaN, empty, negative, non-integer → 1
  // Matches current shop mock behavior (parseInt() || 1, Math.max(1, ...))
  page: z.preprocess(
    (val) => {
      if (val == null || val === "") return 1;
      const n = Number(val);
      return Number.isNaN(n) ? 1 : Math.max(1, Math.floor(n));
    },
    z.number().int().min(1),
  ),
  // Strict mode for optional filters: NaN → preserves raw value → z.number() fails → 400
  // Empty string → undefined (treated as "not provided" — intentional change from current
  // parseFloat("") behavior which returns NaN/400; empty form fields should not cause errors)
  min_price: z.preprocess(
    (val) => {
      if (val == null || val === "") return undefined;
      const n = Number(val);
      return Number.isNaN(n) ? val : n;
    },
    z.number().min(0).optional(),
  ),
  max_price: z.preprocess(
    (val) => {
      if (val == null || val === "") return undefined;
      const n = Number(val);
      return Number.isNaN(n) ? val : n;
    },
    z.number().min(0).optional(),
  ),
  min_rating: z.preprocess(
    (val) => {
      if (val == null || val === "") return undefined;
      const n = Number(val);
      return Number.isNaN(n) ? val : n;
    },
    z.number().min(0).max(5).optional(),
  ),
});

export const AddToCartBodySchema = z.object({
  product_id: z.string().min(1),
});

export const UpdateCartBodySchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().min(0),
});

export const UpdateUserBodySchema = z.object({
  field: z.enum(["username", "gender", "email", "phone", "address"]),
  value: z.string().min(1),
});

// ── Response wrapper schemas ──

// GET /api/products
export const ListProductsResponseSchema = z.object({
  products: z.array(ProductSchema),
  total_products: z.number(),
  total_pages: z.number(),
  current_page: z.number(),
  products_per_page: z.number(),
});

// GET /api/cart
export const CartResponseSchema = z.object({
  items: z.array(CartItemSchema),
  total: z.number(),
  count: z.number(),
});

// POST /api/cart/add, PUT /api/cart/update, DELETE /api/cart/remove/:id, POST /api/cart/clear
export const CartMutationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  cart_count: z.number().optional(),
});

// POST /api/checkout
export const CheckoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  order_id: z.string().optional(),
});

// GET /api/orders
export const ListOrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
  total: z.number(),
});

// POST /api/user/update, POST /api/orders/:id/return, POST /api/orders/:id/confirm
export const GenericSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
```

### Validation Error Handling

The factory configures a **custom `defaultHook`** on `OpenAPIHono` that transforms Zod
validation errors into `{ error: string }` format — matching the existing mock API contract.

```typescript
// In factory setup (mock-lib/src/openapi/)
const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return c.json({ error: message }, 400);
    }
  },
});
```

**Behavioral change:** Error messages shift from hand-written strings
(e.g., `"product_id required"`) to Zod-generated messages (e.g., `"product_id: Too small"`).
This is acceptable for a mock platform — agents should handle any 400 response.

**JSON parse errors are NOT caught by `defaultHook`.** When `c.req.json()` fails (malformed
request body), Hono throws a `SyntaxError` before Zod validation runs. This is handled by a
global `app.onError()` middleware that returns `{ error: "Invalid JSON body" }`. See §7 Error
Handling & Middleware for the full error handling architecture.

**`FactoryValidationSchema` is auto-injected into every route.** The factory automatically adds
`400: FactoryValidationSchema` to the `response` map of every `openapiRoute()` before registering
it with `OpenAPIHono`. This guarantees the generated OpenAPI document always documents the 400
validation-failure response, without requiring developers to manually repeat it in every route.

> **Layer 0 test:** `expect(spec.paths["/api/test"].get.responses["400"]).toBeDefined()`.
>
> If a route explicitly defines its own `400` response (e.g., a custom business-logic error shape),
> the factory **does not override** it — explicit `400` wins over the auto-injected default.

### `z.preprocess` Behavior: Silent Fallback vs. Strict Validation

Query parameters arrive as strings. The schemas use `z.preprocess` to handle type coercion with
two different strategies depending on the parameter's role:

**Silent fallback (`page`):** Invalid values silently fall back to a sensible default (1).
This matches the current shop mock behavior where `parseInt("abc") || 1` and `Math.max(1, -1)`
never produce errors — the user always lands on a valid page.

| Input | Current code | `z.preprocess` result | Match |
|-------|-------------|----------------------|-------|
| `?page=2` | `2` | `2` | ✅ |
| `?page=abc` | `parseInt("abc") \|\| 1` → `1` | `NaN → 1` | ✅ |
| `?page=-1` | `Math.max(1, -1)` → `1` | `Math.max(1, -1)` → `1` | ✅ |
| `?page=` | `parseInt("") \|\| 1` → `1` | `"" → 1` | ✅ |
| `?page=3.7` | `Math.max(1, parseInt("3.7"))` → `3` | `Math.floor(3.7)` → `3` | ✅ |
| (missing) | `?? "1"` → `1` | `null → 1` | ✅ |

**Strict validation (`min_price`, `max_price`, `min_rating`):** Invalid values preserve the raw
input, causing `z.number()` to fail and trigger the `defaultHook` → `{ error: "..." }` response.
Empty strings are treated as "not provided" (→ `undefined`) — an intentional improvement over the
current `parseFloat("")` → NaN → 400 behavior, since empty form fields should not cause errors.

| Input | Current code | `z.preprocess` result | Match |
|-------|-------------|----------------------|-------|
| `?min_price=10` | `10` | `10` | ✅ |
| `?min_price=abc` | 400 `"Invalid numeric filter parameter"` | `"abc"` → z.number() fails → 400 | ✅ |
| `?min_price=` | 400 (parseFloat("") → NaN) | `"" → undefined` → OK | ⚠️ Intentional improvement |
| (missing) | undefined → skip filter | `undefined → undefined` → skip filter | ✅ |

### Migration Strategy: interface → Zod

| Type category | Strategy |
|---------------|----------|
| API response entities (`Product`, `CartItem`, `OrderItem`, `Order`, `PaymentMethod`, `UserData`) | Migrate to Zod schema, delete interface |
| API response wrappers (`CartResponse`, `ListProductsResponse`, etc.) | New Zod schemas (currently implicit in handler return values) |
| API request bodies (`AddToCartBody`, `UpdateCartBody`, `UpdateUserBody`) | New Zod schemas (currently inline `c.req.json<T>()`) |
| API request query strings (`ListProductsQuery`) | New Zod schema (currently manual `c.req.query()` parsing) |
| API route parameters (`product_id`, `order_id`) | Define in `schema.params` |
| Type aliases (`UserField`, `SortBy`) | Replace with `z.enum()` — inlined in request schemas |
| Internal computation types (`SearchableProduct`, `FilterOptions`) | **Keep as TypeScript interface** |
| JSONL event types (`AccessEvent`, discriminated union) | **Keep as TypeScript interface** |

**Retention criteria** — keep as plain TS interface if ALL of:
1. Does not appear in any API request/response
2. Used only for internal computation or logging
3. Does not need runtime validation

### Future Considerations

- **Discriminated unions:** No current API response uses `z.discriminatedUnion()`. If future
  mocks (e.g., airline flight status) need them, note that `z.discriminatedUnion()` generates
  OpenAPI `oneOf` + `discriminator`, while `z.enum()` generates `enum`.
- **Shared pagination:** If 2+ mocks converge on the same pagination pattern, extract a
  `createPaginationSchema({ maxLimit })` factory function to mock-lib.
- **Schema file splitting:** If any mock's `schemas.ts` exceeds ~400 lines, split into
  `schemas/{domain}.ts` + `schemas/index.ts` barrel re-export.

## 6. Registry & Build-time Generation

### Decision: Use OpenAPIHono Built-in (No Custom Registry)

v1 uses `OpenAPIHono`'s built-in `getOpenAPI31Document()` directly. No separate `RouteRegistry` class.

Rationale:
- `OpenAPIHono` already maintains an internal registry of all routes registered via `openapiRoute()`
- `app.getOpenAPI31Document()` returns a complete OpenAPI 3.1 spec
- Adding a custom registry layer would duplicate what `OpenAPIHono` already does
- If the built-in API proves insufficient for build-time traversal or snapshot testing, a thin abstraction layer will be added in v2

### Generation: Reuse Official Library (Method A)

Both runtime and build-time generation use the same path: `OpenAPIHono`'s built-in document generator. This guarantees runtime and build-time output are **identical** — no risk of schema-to-JSON-Schema conversion differences.

### Runtime Generation

```typescript
// In createMockApp() — only when openApi.enabled is true
if (options.openApi?.enabled) {
  // Register the Bearer security scheme once, so auth-required routes can reference it
  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: options.openApi.info,
    servers: options.openApi.servers,
  });
}
```

Production builds set `openApi.enabled: false` → endpoint not registered → no spec leak to evaluated agents.

> **Security scheme registration** happens inside the `enabled` guard because the generated spec
> only needs `bearerAuth` when OpenAPI output is actually produced. The factory's `auth: "required"`
> flag translates to `security: [{ bearerAuth: [] }]` on the route level; `registerComponent`
> ensures the `components.securitySchemes.bearerAuth` definition exists in the final document.

### Build-time Generation

```typescript
// scripts/generate-openapi.ts
// Imports each mock's app via import.meta.main guard, calls getOpenAPI31Document()

import { createShopApp } from "../mocks/shop/src/index";
import { createDocSearchApp } from "../mocks/doc-search/src/index";
// ... other mocks

const mocks = [
  { name: "shop", createApp: createShopApp },
  { name: "doc-search", createApp: createDocSearchApp },
  // ...
];

for (const mock of mocks) {
  const { app } = mock.createApp();
  const spec = app.getOpenAPI31Document();
  const outPath = `dist/openapi/${mock.name}.json`;
  Bun.write(outPath, JSON.stringify(spec, null, 2));
  console.log(`Generated ${outPath}`);
}
```

Each mock must export a factory function guarded by `import.meta.main` — build scripts import without starting the HTTP server.

### Build Pipeline Integration

```json
{
  "scripts": {
    "build": "bun run generate-openapi && bun run build:mocks && bun run build:images",
    "build:mocks": "bun scripts/build-all.ts",
    "generate-openapi": "bun scripts/generate-openapi.ts",
    "build:images": "bun scripts/build-task-images.ts"
  }
}
```

Order: `generate-openapi` → `build:mocks` → `build:images`.

Rationale: `generate-openapi` imports `.ts` source directly and is the fastest step; if it fails (e.g., schema error), we fail fast before compiling binaries or building Docker images.

### OpenAPI File Uses

Generated `dist/openapi/{mock-name}.json`:
- **Git-committed**: Machine-readable API documentation
- **CI validation**: `git diff --exit-code dist/openapi/` detects route changes without doc updates
- **Replaces `docs/api/*.md`**: Hand-written markdown → auto-generated from spec

### Git Management & Developer Workflow

`dist/openapi/` is **not** in `.gitignore` — generated specs are committed so that reviewers can see API changes in diffs.

Developer responsibility after modifying any route or schema:
1. Run `bun run generate-openapi`
2. Stage the updated `dist/openapi/*.json` alongside code changes
3. Commit both

To prevent accidental omissions, add `generate-openapi` to a Git pre-commit hook or CI check:

```bash
# .git/hooks/pre-commit (local developer hook)
bun run generate-openapi
git diff --exit-code dist/openapi/ || {
  echo "OpenAPI spec is stale. Run 'bun run generate-openapi' and commit the changes."
  exit 1
}
```

> This repo currently has **no** pre-commit framework (e.g., Husky, pre-commit) configured.
> The example above is a plain Git hook for local use. A CI step (`git diff --exit-code dist/openapi/`)
> is the canonical enforcement mechanism.

## 7. Error Handling & Middleware

### Error Handling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Request                                                    │
│     │                                                       │
│     ▼                                                       │
│  ┌─────────────────┐  Auth middleware (global)              │
│  │ app.use("*")    │  → sets c.get("userId") / 401          │
│  └─────────────────┘                                       │
│     │                                                       │
│     ▼                                                       │
│  ┌─────────────────┐  Zod validation (per-route)            │
│  │ OpenAPIHono     │  → c.req.valid("json") / "query"       │
│  │ defaultHook     │  → failure: { error: string } 400      │
│  └─────────────────┘                                       │
│     │                                                       │
│     ▼                                                       │
│  ┌─────────────────┐  Route handler                         │
│  │ Business logic  │  → c.json({ error: "Not found" }, 404) │
│  └─────────────────┘                                       │
│     │                                                       │
│     ▼                                                       │
│  ┌─────────────────┐  Global fallback                       │
│  │ app.onError()   │  → SyntaxError: 400, Others: 500       │
│  └─────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### `app.onError()` — Global Fallback

Catches errors that escape route handlers and Zod validation:

| Error type | Response | Example cause |
|------------|----------|---------------|
| `SyntaxError` | `{ error: "Invalid JSON body" }` 400 | Malformed JSON in POST body |
| Any other `Error` | `{ error: "Internal server error" }` 500 | Unhandled exception in handler |

```typescript
app.onError((err, c) => {
  if (err instanceof SyntaxError && err.message.toLowerCase().includes("json")) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});
```

> **Known limitation:** `instanceof SyntaxError` may theoretically miss cross-Realm errors, but within a single Bun process this is not a practical concern. The `message.includes("json")` guard reduces the risk of catching unrelated syntax errors (e.g., from a broken import).

### `defaultHook` — Zod Validation Errors

Configured on `OpenAPIHono` construction. Transforms `ZodError` into `{ error: string }`:

```typescript
const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return c.json({ error: message }, 400);
    }
  },
});
```

**⚠️ Known limitation:** `defaultHook` does **not** propagate through `app.route()` sub-routers ([honojs/middleware#708](https://github.com/honojs/middleware/issues/708)). The factory mitigates this by registering all routes on a single `OpenAPIHono` instance — no sub-routers are used.

### Business Logic Errors

Handled inside individual route handlers (unchanged from current pattern):

```typescript
if (!product) {
  return c.json({ error: "Product not found" }, 404);
}
```

### Auth Middleware

Registered globally before any routes. Two variants:

- `authOptional` — sets `userId` if session valid, continues regardless
- `authRequired` — returns 401 if no valid session

Execution order is guaranteed by Hono's middleware chain: global `app.use()` runs before route-specific handlers.

### Decision: No `strictResponse`

`@hono/zod-openapi` supports `strictResponse: true` to enforce response schema validation at runtime, but [middleware#913](https://github.com/honojs/middleware/issues/913) reports it is unreliable with `.strict()` and `.omit()` schemas. For a mock platform, response validation is unnecessary overhead — the schema's purpose is documentation and request validation. **Not enabled.**

## 8. Testing Strategy

### Layered Test Architecture

| Layer | Scope | Tool | Target |
|-------|-------|------|--------|
| **Layer 0** | mock-lib factory | `bun:test` | `openApiRoute()` registers on OpenAPIHono; `page()` excluded from spec; `auth: "required"` generates `security` field |
| **Layer 1** | Per-mock route behavior | `bun:test` + in-memory requests | Schema validation (valid/invalid input), HTTP status codes match spec |
| **Layer 2** | OpenAPI generation | `bun:test` | `generate-openapi.ts` produces valid OpenAPI 3.1 JSON for all mocks |

### Layer 0: Factory Unit Tests

```typescript
// packages/mock-lib/src/openapi/create-app.test.ts
import { describe, it, expect } from "bun:test";
import { createMockApp, createRoute } from "../create-app";
import { z } from "zod";

describe("createMockApp", () => {
  it("registers API routes in OpenAPIHono", () => {
    const { app } = createMockApp({
      name: "test",
      openApi: { enabled: true, info: { title: "Test", version: "1.0" } }
    });
    const testRoute = createRoute({
      method: "get",
      path: "/api/test",
      responses: {
        200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "OK" },
      },
    });
    app.openApiRoute(testRoute, (c) => c.json({ ok: true }));

    const spec = app.getOpenAPI31Document();
    expect(spec.paths["/api/test"]).toBeDefined();
  });

  it("excludes page routes from OpenAPI spec", () => {
    const { app } = createMockApp({
      name: "test",
      openApi: { enabled: true, info: { title: "Test", version: "1.0" } }
    });
    app.page("/", (c) => c.html("hi"));

    const spec = app.getOpenAPI31Document();
    expect(spec.paths["/"]).toBeUndefined();
  });

  it("generates security field for auth-required routes", () => {
    const { app } = createMockApp({
      name: "test",
      openApi: { enabled: true, info: { title: "Test", version: "1.0" } }
    });
    const protectedRoute = createRoute({
      method: "get",
      path: "/api/protected",
      responses: {
        200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "OK" },
      },
    });
    app.openApiRoute(protectedRoute, (c) => c.json({ ok: true }), { auth: "required" });

    const spec = app.getOpenAPI31Document();
    expect(spec.paths["/api/protected"].get.security).toEqual([{ bearerAuth: [] }]);
  });

  // Auto-injection tests (方案 B — validation 400 auto-injected)
  it("auto-injects 400 response when not explicitly declared", () => {
    const { app } = createMockApp({
      name: "test",
      openApi: { enabled: true, info: { title: "Test", version: "1.0" } }
    });
    const testRoute = createRoute({
      method: "get",
      path: "/api/test",
      responses: {
        200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "OK" },
      },
    });
    app.openApiRoute(testRoute, (c) => c.json({ ok: true }));
    const spec = app.getOpenAPI31Document();
    expect(spec.paths["/api/test"].get.responses["400"]).toBeDefined();
  });

  it("preserves explicit 400 over auto-injected default", () => {
    const { app } = createMockApp({
      name: "test",
      openApi: { enabled: true, info: { title: "Test", version: "1.0" } }
    });
    const cartEmptySchema = z.object({ error: z.literal("Cart is empty") });
    const checkoutRoute = createRoute({
      method: "post",
      path: "/api/checkout",
      responses: {
        200: { content: { "application/json": { schema: z.object({ success: z.boolean() }) } }, description: "OK" },
        400: { content: { "application/json": { schema: cartEmptySchema } }, description: "Cart is empty" },
      },
    });
    app.openApiRoute(checkoutRoute, (c) => c.json({ success: true }));
    const spec = app.getOpenAPI31Document();
    expect(spec.paths["/api/checkout"].post.responses["400"].description).toBe("Cart is empty");
  });
});
```

### Layer 0.5: Type Inference Compile Test

```typescript
// packages/mock-lib/src/openapi/type-inference.test.ts
// This is a TypeScript compile-time test — if it compiles, the type inference works.
// Run via `tsc --noEmit` or `bun build --no-bundle`.
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

const testRoute = createRoute({
  method: "get",
  path: "/api/products",
  request: {
    query: z.object({
      q: z.string().optional(),
      page: z.preprocess(
        (val) => {
          if (val == null || val === "") return 1;
          const n = Number(val);
          return Number.isNaN(n) ? 1 : Math.max(1, Math.floor(n));
        },
        z.number().int().min(1),
      ),
    }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ products: z.array(z.object({ id: z.string() })) }) } }, description: "OK" },
  },
});

// If c.req.valid("query") returns `any`, this line compiles without error but
// the types are wrong. The test asserts that destructured fields are typed.
type QueryType = typeof testRoute extends { request: { query: infer Q } } ? z.infer<Q> : never;
// QueryType should be { q?: string; page: number } — not `any`
```

### Layer 1: Per-Mock Route Tests

```typescript
// mocks/shop/src/index.test.ts (new)
import { describe, it, expect } from "bun:test";
import { createShopApp } from "./index";

describe("GET /api/products", () => {
  it("returns products with valid query", async () => {
    const { app } = createShopApp();
    const res = await app.request("/api/products?q=watch");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products).toBeArray();
  });

  it("silently falls back invalid page param to 1", async () => {
    const { app } = createShopApp();
    const res = await app.request("/api/products?page=abc");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current_page).toBe(1);
  });

  it("rejects invalid min_price filter", async () => {
    const { app } = createShopApp();
    const res = await app.request("/api/products?min_price=abc");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("page");
  });
});
```

### Layer 2: OpenAPI Generation Verification

```typescript
// scripts/generate-openapi.test.ts (new)
import { describe, it, expect } from "bun:test";
import { $ } from "bun";

describe("generate-openapi", () => {
  it("produces valid OpenAPI 3.1 JSON for all mocks", async () => {
    await $`bun run generate-openapi`;

    for (const name of ["shop", "doc-search", "airline", "email", "todolist"]) {
      const spec = await Bun.file(`dist/openapi/${name}.json`).json();
      expect(spec.openapi).toBe("3.1.0");
      expect(spec.info.title).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    }
  });
});
```

### Layer 3: Verifier Regression Tests

Before declaring any Phase complete, run the actual harbor evaluation pipeline against tasks that use the migrated mock:

```bash
# Example: shop mock after Phase 3
harbor run -p tasks/watch-shop -a openclaw -m custom/test-model \
  -n 1 -o jobs --debug

cat jobs/*/watch-shop/*/verifier/reward.txt  # expect 1.0
```

| Task | Phase to run | Purpose |
|------|--------------|---------|
| `watch-shop` | Phase 3 | Cart + search flow |
| `washer-shop` | Phase 3 | Product listing + search |
| `email-washer-change` | Phase 3 | Cross-service (shop + email) |
| `live-web-research-sqlite-fts5` | Phase 2 | Doc-search FTS5 queries |

If any reward drops below 1.0, investigate whether the change is:
- **Acceptable**: verifier handles any 400 string (e.g., Zod error message changed)
- **Bug**: response shape or status code changed unintentionally → fix before merging

### Existing Test Preservation

- `mocks/shop/src/search-algorithm.test.ts` — **unchanged**, search algorithm is decoupled from routing layer
- `docs/tests/negative-paths-reference.md` — update to reference auto-generated OpenAPI spec for test case generation

## 9. Migration Path

### Phase 0: Infrastructure (no mock changes)

1. Install deps: `bun add zod @hono/zod-openapi` (root + mock-lib)
2. Create `packages/mock-lib/src/openapi/`: `types.ts`, `create-app.ts`, `schemas.ts`
3. Modify `packages/mock-lib/src/create-app.ts`: return `MockAppV2`
4. Create `scripts/generate-openapi.ts`
5. **Validation**: Layer 0 tests pass, no mock changes

### Phase 1: Stub Migration (airline → email → todolist)

Each stub migrated in ~20 lines:

```typescript
// mocks/airline/src/index.ts (after)
import { createMockApp, startServer } from "@liveclaw/mock-lib";
import { z } from "zod";

export function createAirlineApp() {
  const { config, app } = createMockApp({
    name: "airline",
    port: 5000,
    openApi: {
      enabled: true,
      info: { title: "Airline Mock API", version: "1.0.0" },
      servers: [{ url: "http://localhost:5000" }]
    }
  });

  app.openapiRoute({
    method: "get",
    path: "/__mock_sentinel__/airline",
    summary: "Binary isolation probe",
    schema: { response: { 200: z.object({ ok: z.boolean() }) } },
    handler: (c) => c.json({ ok: true }),
  });

  return { config, app };
}

if (import.meta.main) {
  const { config, app } = createAirlineApp();
  startServer({ config, app });
}
```

### Phase 2: doc-search Migration

1. Create `mocks/doc-search/src/schemas.ts`
2. Rewrite `mocks/doc-search/src/index.ts`: `app.page()` for HTML, `app.openapiRoute()` for API
3. Export `createDocSearchApp()`

### Phase 3: shop Migration (most complex)

1. Create `mocks/shop/src/schemas.ts` (~20 schemas)
2. Rewrite `mocks/shop/src/index.tsx` (~19 routes migrated)
3. Export `createShopApp()`
4. **Critical validation**: existing functionality unchanged (search, cart, checkout)
5. Run `search-algorithm.test.ts` to verify search logic unaffected

### Phase 4: Documentation Cleanup

1. `docs/api/shop.md` → extract non-API content → `docs/shop-internal.md`, delete API endpoint docs
2. `docs/api/doc-search.md` → extract non-API content → `docs/doc-search-internal.md`, delete API endpoint docs
3. `bun run generate-openapi` → commit `dist/openapi/*.json`

### Rollback Strategy

- **Branch isolation**: Each Phase is a separate PR; no Phase merges to `main` until its Layer 0–2 tests **and** Layer 3 verifier regression tests pass.
- **Shop backup**: Before Phase 3, tag the pre-migration shop state (`git tag shop-pre-openapi`). If regression tests fail, revert the Phase 3 PR and restore from tag.
- **Staged merge order**: Phase 0 → 1 → 2 → 3 → 4. A failure in later Phases does not require rolling back earlier ones (they are additive or touch disjoint files).
- **Feature flag**: `openApi.enabled` acts as an implicit flag — if a critical issue is found post-merge, set `enabled: false` in the mock config to disable the `/openapi.json` endpoint without reverting code.

## Appendix A: Route Inventory

> Verified against current source (`mocks/shop/src/index.tsx`, `mocks/doc-search/src/index.ts`).
> This inventory serves as the acceptance checklist for Phase 2 and Phase 3.

### A.1 Shop Mock (`mocks/shop/src/index.tsx`)

| # | Type | Method | Route | Current Validation | Target Schema |
|---|------|--------|-------|-------------------|---------------|
| 1 | HTML | GET | `/` | — | `app.page()` |
| 2 | HTML | GET | `/search` | Manual `c.req.query()` parsing | `app.page()` |
| 3 | HTML | GET | `/cart` | — | `app.page()` |
| 4 | HTML | GET | `/profile` | — | `app.page()` |
| 5 | HTML | GET | `/orders` | — | `app.page()` |
| 6 | API | GET | `/api/products` | Manual query parse + `isSortBy()` | `ListProductsQuerySchema` |
| 7 | API | GET | `/api/product/:product_id` | `c.req.param("product_id")` | `z.object({ product_id: z.string() })` |
| 8 | API | POST | `/api/cart/add` | Manual JSON parse + `if (!productId)` | `AddToCartBodySchema` |
| 9 | API | GET | `/api/cart` | — | — |
| 10 | API | DELETE | `/api/cart/remove/:product_id` | `c.req.param("product_id")` | `z.object({ product_id: z.string() })` |
| 11 | API | PUT | `/api/cart/update` | Manual JSON parse + type checks | `UpdateCartBodySchema` |
| 12 | API | POST | `/api/cart/clear` | — | — |
| 13 | API | POST | `/api/checkout` | `if (!cart.length)` (business logic) | — |
| 14 | API | GET | `/api/user` | — | — |
| 15 | API | POST | `/api/user/update` | Manual JSON parse + `isUserField()` | `UpdateUserBodySchema` |
| 16 | API | GET | `/api/orders` | — | — |
| 17 | API | POST | `/api/orders/:order_id/return` | `c.req.param("order_id")` + status check | `z.object({ order_id: z.string() })` |
| 18 | API | POST | `/api/orders/:order_id/confirm` | `c.req.param("order_id")` + status check | `z.object({ order_id: z.string() })` |
| 19 | Sentinel | GET | `/__mock_sentinel__/shop` | — | `z.object({ ok: z.boolean() })` |

**Notes:**
- Routes 6–8, 10–11, 15 require request schema validation (query or body).
- Routes 7, 10, 17–18 require `params` schema validation.
- Routes 9, 12–14, 16 have no request inputs; only response schemas are needed.
- The `/search` HTML page receives query params but renders HTML; validation is optional at the page level (Zod could be used internally, but `app.page()` does not register OpenAPI metadata).

### A.2 Doc-Search Mock (`mocks/doc-search/src/index.ts`)

| # | Type | Method | Route | Current Validation | Target Schema |
|---|------|--------|-------|-------------------|---------------|
| 1 | HTML | GET | `/` | — | `app.page()` |
| 2 | HTML | GET | `/search` | `c.req.query("q")` (optional, empty OK) | `app.page()` |
| 3 | HTML | GET | `/docs/:slug` | `c.req.param("slug")` + DB lookup | `app.page()` |
| 4 | Sentinel | GET | `/__mock_sentinel__/doc-search` | — | `z.object({ ok: z.boolean() })` |

**Notes:**
- Doc-search is currently HTML-only (no JSON API routes). All three page routes use `app.page()`.
- The `q` and `sid`/`rank` query parameters are consumed for rendering and logging, but they do not need to appear in an OpenAPI spec since `app.page()` excludes routes from the spec.

## 10. Dependency Changes

### New Dependencies (mock-lib)

```json
{
  "dependencies": {
    "hono": "^4.8.0",
    "@hono/zod-openapi": "^0.18.3",
    "zod": "^3.22.0"
  }
}
```

| Package | Version | Role | Notes |
|---------|---------|------|-------|
| `@hono/zod-openapi` | `^0.18.3` | Core — `OpenAPIHono`, `createRoute`, `z` re-export | **Pinned to 0.x line** — Zod 3 compatible. 1.x requires Zod 4 which has ecosystem compatibility issues (see §10.1). |
| `zod` | `^3.22.0` | Schema definition | Zod 3 is stable and sufficient for mock platform needs. No Zod 4 features (e.g., `z.interface()`, template literals) are required. |

`openapi3-ts` is **not** added as a direct dependency — it is a transitive dependency of `@hono/zod-openapi` and not imported directly by mock-lib code.

### Why Zod 3 + `@hono/zod-openapi` 0.18.x?

**Zod 4 risks:**
- `@hono/zod-openapi` 1.x requires `zod ^4.0.0`; 0.x and 1.x are mutually incompatible due to Zod 4's rewritten internal class generics ([honojs/middleware#1177](https://github.com/honojs/middleware/issues/1177))
- Zod 4 generates JSON Schema features (e.g., `propertyNames`) that break OpenAPI 3.0 compatibility ([colinhacks/zod#4841](https://github.com/colinhacks/zod/issues/4841))
- The Zod 4 ecosystem is still stabilizing; many libraries have not yet published compatible versions

**Migration path to Zod 4 (future):**
If Zod 4 matures and we need its features, the migration is a coordinated version bump of both packages. No code changes required beyond dependency versions — our schemas use core Zod 3 APIs that are forward-compatible.

### Per-Mock Dependency Impact

Mocks only need `zod` for schema definitions (imported from `schemas.ts`). All OpenAPI infrastructure stays in `mock-lib`:

```typescript
// mocks/shop/src/schemas.ts
import { z } from "zod";                    // ← peer dependency
import { ErrorResponseSchema } from "@liveclaw/mock-lib";  // ← shared schema
```

Since `mock-lib` already declares `zod` in its `dependencies`, workspace resolution ensures mocks get it transitively. No changes to mock `package.json` files.

### Bundle Size Impact (Reconfirmed)

| Component | Size |
|-----------|------|
| `@hono/zod-openapi` + `zod` + transitive deps | ~6.7 MB on disk |
| **In compiled binary** (Bun `--compile`) | **~0.5 MB** |
| Baseline shop binary | ~95 MB |
| **Net increase** | **+0.5 MB (+0.58%)** |

Tree-shaking eliminates unused Zod internals. Negligible impact.

---

## Review Log

### 2026-04-23: §3/§5 Review — Type Safety, Auto-injection, Silent Fallback (incorporated)

**Decisions made:**

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| R38 | `openApiRoute` API design | Two-arg `openApiRoute(route, handler, options?)` replacing single-object `RouteDef` | `@hono/zod-openapi`'s type inference chain requires `createRoute()` → `app.openapi()` generics to flow through. Single-object API blocks this chain because TypeScript cannot infer from `def.schema.query` to `def.handler` within the same object literal ([honojs/middleware#637](https://github.com/honojs/middleware/issues/637)). Two-arg design preserves full `z.infer<>` typing on `c.req.valid()`. |
| R39 | `RouteDef` interface | Deleted | Replaced by standard `createRoute()` from `@hono/zod-openapi`, re-exported via mock-lib. No custom wrapper. |
| R40 | Auto-injection strategy | Keep auto-inject `400: FactoryValidationSchema` + Layer 0 tests (方案 B) | Mock OpenAPI spec is dev-only (disabled in production). Both validation 400 and business 400 share `{ error: string }` shape — structurally accurate. Layer 0 tests detect missing business 400 declarations. Explicit 400 on a route wins over auto-injected default. |
| R41 | `page` parameter behavior | Silent fallback via `z.preprocess` (NaN/empty/negative → 1) | Matches current shop mock behavior (`parseInt() \|\| 1`, `Math.max(1, ...)`). No breaking change from current runtime behavior. |
| R42 | Optional filter NaN behavior | Strict: `z.preprocess` preserves raw value on NaN → `z.number()` fails → 400 | Agent actively chose to send the filter; invalid values should produce an error. Empty string → `undefined` (intentional improvement over `parseFloat("") → NaN → 400`). |

### 2026-04-23: §7 Error Handling & §10 Dependencies Review (incorporated)

**Decisions made:**

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| R23 | `@hono/zod-openapi` version | Pin `^0.18.3` | Zod 3 compatible; 1.x requires Zod 4 which has ecosystem compatibility issues |
| R24 | `zod` version | Pin `^3.22.0` | Stable, sufficient for mock needs; no Zod 4 features required |
| R25 | `openapi3-ts` direct dep | Not added | Transitive dependency of `@hono/zod-openapi`; not imported by mock-lib |
| R26 | OpenAPI 3.1 API | Use `getOpenAPI31Document()` / `doc31()` | `@hono/zod-openapi` 0.18.x specific methods; spec previously used generic name |
| R27 | `defaultHook` hierarchy | Documented risk; factory uses single instance | [middleware#708](https://github.com/honojs/middleware/issues/708): hook doesn't propagate through `app.route()`; we avoid sub-routers |
| R28 | `strictResponse` | Not enabled | [middleware#913](https://github.com/honojs/middleware/issues/913) reports unreliable behavior; mock platform doesn't need runtime response validation |
| R29 | Error handling architecture | Three-layer: `app.onError()` → `defaultHook` → handler business logic | Clear separation of concerns; each layer handles one error category |

### 2026-04-23: §5 Zod Schema Design Review (incorporated)

**Decisions made:**

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| R12 | Schema field naming | Faithful to current API contract | Mock platform describes reality; `id` in response, `product_id` in request |
| R13 | `rating_count: z.string()` | Intentional — display string like `"41,607 ratings"` | Data source format; not a numeric count |
| R14 | Missing schemas | All entities + request + response wrappers defined | ~20 schemas total for shop; completeness for OpenAPI spec |
| R15 | `PaginationQuerySchema` | Removed from mock-lib (no shared consumer) | Shop hardcodes limit; doc-search has no pagination; extract when pattern converges |
| R16 | `ValidationErrorSchema` → `FactoryValidationSchema` | For OpenAPI spec only; describes hook output shape | Not for runtime — `defaultHook` handles actual formatting |
| R17 | Error message format change | Accept Zod-generated messages replacing hand-written ones | Agents handle any 400; format consistency through `defaultHook` |
| R18 | Custom `defaultHook` | Returns `{ error: string }` matching existing API contract | Preserves verifier compatibility |
| R19 | JSON parse errors | `app.onError()` catches `SyntaxError` → `{ error: "Invalid JSON body" }` | `defaultHook` only handles Zod errors; Hono-level errors need separate handler (§7) |
| R20 | Schema file organization | Single `schemas.ts` per mock; split at ~400 lines | Stub mocks need minimal schemas; premature splitting adds overhead |
| R21 | Discriminated unions | Not needed currently; note for future | No API response uses discriminated union; JSONL events stay as TS interfaces |
| R22 | `z.coerce.number()` | Replaces manual `parseFloat()` + `Number.isNaN()` | Same behavior (reject invalid numerics), simpler code |

### 2026-04-23: §3–9 Review (incorporated)

**Decisions made:**

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| R30 | `FactoryValidationSchema` injection | Factory auto-injects `400: FactoryValidationSchema` into every `openapiRoute()` | `@hono/zod-openapi` `defaultHook` does not auto-document 400 responses; manual per-route repetition is error-prone. Explicit `400` on a route wins over auto-injected default. |
| R31 | `bearerAuth` security scheme | Auto-registered via `app.openAPIRegistry.registerComponent()` inside `createMockApp()` when `openApi.enabled` | `auth: "required"` generates `security: [{ bearerAuth: [] }]`, but the scheme must exist in `components.securitySchemes` or the spec is invalid. |
| R32 | `app.page()` signature | Drop redundant `method: "get"` argument → `page(path, handler)` | GET-only by convention; simpler API. If POST pages are ever needed, use `openapiRoute()` or revisit. |
| R33 | `rawOpenApi` merge semantics | `{ ...autoGenerated, ...rawOpenApi }` — `rawOpenApi` wins key conflicts | Documented explicitly so developers know escape-hatch behavior without reading factory source. |
| R34 | `params` schema example | Added to Usage Example (`GET /api/product/:product_id`) | `schema.params` was typed but never demonstrated; needed for path-param validation parity with query/body. |
| R35 | Route inventory appendix | Added Appendix A with exact shop (19 routes) and doc-search (4 routes) inventory | Prevents missed routes during Phase 2/3 migration; verified against current source. |
| R36 | Pre-commit hook clarification | Plain Git hook example + note that repo has no pre-commit framework | Avoids confusion with Python `pre-commit` tool; CI `git diff --exit-code` is canonical enforcement. |
| R37 | TSX + Zod cohabitation | Confirmed safe — Bun handles `.tsx` importing `.ts` with Zod types without friction | Shop is the only TSX mock; no special build configuration needed. |

### 2026-04-22: §1–4 Review (incorporated)

**Decisions made:**

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| R1 | `createMockApp` return type | Keep `{ config, app }` shape | Minimal API change; `startServer()` unchanged |
| R2 | Custom Registry | Deferred — use OpenAPIHono built-in | Avoid premature abstraction; add thin layer if built-in proves insufficient |
| R3 | `app.page()` path params | Supported (`/docs/:slug` works) | Zero-cost — Hono handles `:param` natively; doc-search needs it |
| R4 | `/openapi.json` runtime | Dev-only via `openApi.enabled` flag | Prevents API spec leak to evaluated agents |
| R5 | Middleware order | Auth → Zod validation | 401 before 400 (semantic correctness); auth context available to Zod |
| R6 | Type inference on `c.req.valid()` | v1: accept `any` | Mock services are internal tools; inference ROI is low; may revisit |
| R7 | Migration strategy | Phased: stubs → doc-search → shop | Lowest-risk-first; each phase validated before proceeding |
| R8 | `import.meta.main` guard | Required | Build-time import must not start HTTP server |
| R9 | `docs/api/*.md` | Migrate non-API content then delete | Data Types, Search Algorithm, DB Schema → separate docs under `docs/` |
| R10 | Bundle size | +0.5 MB (+0.58%) — acceptable | Empirically measured; Bun tree-shaking is effective |
| R11 | Method naming | `openApiRoute()` instead of `route()` | Avoids collision with Hono's built-in `app.route()` |
