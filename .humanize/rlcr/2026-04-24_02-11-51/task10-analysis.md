# Task 10: @hono/zod-openapi 0.18.x Compatibility Analysis

## Version Under Test

- `@hono/zod-openapi`: 0.18.4 (resolved from `^0.18.3`)
- `@hono/zod-validator`: 0.4.3 (transitive dependency)
- `@asteasolutions/zod-to-openapi`: 7.3.4 (transitive dependency)
- `hono`: 4.12.12 (resolved from `^4.8.0`)
- `zod`: 3.25.76 (resolved from `^3.22.0` / `^3.24.0`)

---

## 1. `getOpenAPI31Document()` Behavior

### 1.1 Generation Success

All 5 mocks produce valid OpenAPI 3.1.0 documents:

| Mock | Status | Output Path |
|------|--------|-------------|
| airline | OK | `dist/openapi/airline.json` |
| doc-search | OK | `dist/openapi/doc-search.json` |
| email | OK | `dist/openapi/email.json` |
| shop | OK | `dist/openapi/shop.json` |
| todolist | OK | `dist/openapi/todolist.json` |

The generation script (`scripts/generate-openapi.ts`) dynamically imports each mock's factory, calls `app.getOpenAPI31Document({ openapi: "3.1.0", ... })`, and serializes the result. All 5/5 mocks pass.

### 1.2 Document Structure Validity

Each generated document contains:
- `openapi: "3.1.0"` at the root
- `info` block with title and version
- `components.securitySchemes.bearerAuth` (when `openApi.enabled`)
- `paths` with operation-level schemas
- Auto-injected `400` responses on routes without explicit error definitions

Example (shop `/api/products` GET):
```json
{
  "openapi": "3.1.0",
  "info": { "title": "shop-mosi-backend", "version": "1.0.0" },
  "components": {
    "securitySchemes": { "bearerAuth": { "type": "http", "scheme": "bearer" } },
    "schemas": {},
    "parameters": {}
  },
  "paths": {
    "/api/products": {
      "get": {
        "summary": "List products",
        "parameters": [
          { "name": "q", "in": "query", "schema": { "type": "string", "default": "" } },
          { "name": "sort", "in": "query", "schema": { "type": "string", "enum": ["similarity", "price_asc", "price_desc", "rating"], "default": "similarity" } },
          { "name": "page", "in": "query", "schema": { "type": ["integer", "null"], "minimum": 1 } },
          { "name": "min_price", "in": "query", "schema": { "type": ["number", "null"] } },
          ...
        ],
        "responses": {
          "200": { ... },
          "400": { "description": "Validation error", "content": { "application/json": { "schema": { "type": "object", "properties": { "error": { "type": "string" } }, "required": ["error"] } } } }
        }
      }
    }
  }
}
```

### 1.3 Quirk: `z.preprocess()` Opacity

**Critical finding:** `z.preprocess()` schemas are rendered opaquely in the generated OpenAPI spec.

The `page` parameter uses:
```ts
const coercePage = z.preprocess(
  (val) => {
    if (val === undefined || val === "" || val === null) return 1;
    const n = Number(val);
    if (Number.isNaN(n) || n < 1) return 1;
    return Math.floor(n);
  },
  z.number().int().min(1),
);
```

In the generated spec, this appears as:
```json
{
  "schema": {
    "type": ["integer", "null"],
    "minimum": 1
  }
}
```

The `null` union comes from the preprocess function returning `undefined` (which Zod maps to `null` in OpenAPI). The actual runtime behavior (silent fallback to 1 for invalid input) is **not documented** in the spec. Consumers reading the OpenAPI document will see `type: ["integer", "null"]` and incorrectly assume `null` is an acceptable input, when in fact any non-numeric or out-of-range value is coerced to `1`.

Similarly, `min_price`, `max_price`, and `min_rating` use `z.preprocess()` with strict NaN validation:
```ts
const coerceMinPrice = z.preprocess(
  (val) => { ... return NaN; ... },
  z.number().refine((n) => !Number.isNaN(n), { message: "Invalid min_price" }).optional(),
);
```

Generated spec shows:
```json
{ "schema": { "type": ["number", "null"] } }
```

The `refine()` constraint and the NaN-rejection behavior are **completely invisible** in the OpenAPI output. This is a known limitation of `@asteasolutions/zod-to-openapi` (the underlying converter) — `z.preprocess()` and `z.refine()` metadata do not translate to OpenAPI schema constraints.

**Impact:** Low for internal mock use (agents don't read OpenAPI specs for validation logic), but high if these specs are ever consumed by external code generators or documentation renderers that rely on accurate type information.

---

## 2. Bun Compile Compatibility

### 2.1 Build Status

All 5 mock binaries compile cleanly with `bun build --compile`:

| Mock | Binary | Size |
|------|--------|------|
| mock-airline | `dist/mock-airline` | ~94.4 MB |
| mock-doc-search | `dist/mock-doc-search` | ~94.4 MB |
| mock-email | `dist/mock-email` | ~94.4 MB |
| mock-shop | `dist/mock-shop` | ~94.5 MB |
| mock-todolist | `dist/mock-todolist` | ~94.4 MB |

### 2.2 Isolation Verification

The build pipeline (`scripts/build-all.ts`) performs two-phase binary isolation verification:

1. **Positive control:** Each binary contains its own sentinel route (`/__mock_sentinel__/{mock}`)
2. **Negative control:** No binary contains a foreign sentinel route

All binaries pass isolation. No cross-contamination detected.

### 2.3 `@hono/zod-openapi` in Compiled Binaries

The `@hono/zod-openapi` package and its transitive dependencies (`@asteasolutions/zod-to-openapi`, `@hono/zod-validator`) are fully bundled by Bun's compiler. No runtime `node_modules` resolution is required. The compiled binaries are self-contained.

**Note:** The `--target` flag (e.g., `bun-linux-aarch64`) requires network access on first run to download the Linux runtime bundle. This is a Bun limitation, not specific to `@hono/zod-openapi`.

---

## 3. `defaultHook` Behavior

### 3.1 Implementation

`packages/mock-lib/src/openapi/create-app.ts` lines 32-41:

```ts
const hono = new OpenAPIHono<AppEnv>({
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

### 3.2 Verified Behavior

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Invalid query param (`limit=0` where `min(1)`) | 400 `{ error: string }` | 400 `{ error: "limit: Number must be greater than or equal to 1" }` | Pass |
| Invalid body (`{}` where `name: z.string()`) | 400 `{ error: string }` | 400 `{ error: "name: Required" }` | Pass |
| Valid request | 200, no error | 200, handler executes | Pass |
| Malformed JSON body | 400 `{ error: "Invalid JSON body" }` | 400 `{ error: "Invalid JSON body" }` | Pass |

The `defaultHook` correctly intercepts Zod validation failures before the route handler executes. The response format is consistently `{ error: string }` with HTTP 400.

### 3.3 Auto-Injection of 400 Response

The `openApiRoute()` helper in `create-app.ts` auto-injects a 400 response schema into the OpenAPI document when the original route definition lacks one:

```ts
const has400 = Object.keys(route.responses).some(
  (k) => k === "400" || k === "4XX",
);
if (!has400) {
  mergedRoute.responses = {
    ...mergedRoute.responses,
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: FactoryValidationSchema,  // z.object({ error: z.string() })
        },
      },
    },
  };
}
```

This ensures every typed route documents its validation failure response.

---

## 4. Type Inference Chain

### 4.1 Query Parameter Inference

`mocks/shop/src/index.tsx` line 1011:
```ts
const { q, sort, page, min_price, max_price, min_rating } = c.req.valid("query");
```

The inferred types from `c.req.valid("query")` match the `ListProductsQuerySchema` exactly:

| Field | Inferred Type | Source Schema |
|-------|---------------|---------------|
| `q` | `string` | `z.string().optional().default("")` |
| `sort` | `"similarity" \| "price_asc" \| "price_desc" \| "rating"` | `z.enum([...]).optional().default("similarity")` |
| `page` | `number` | `coercePage` (z.preprocess -> z.number().int().min(1)) |
| `min_price` | `number \| undefined` | `coerceMinPrice` (z.preprocess -> z.number().optional()) |
| `max_price` | `number \| undefined` | `coerceMaxPrice` |
| `min_rating` | `number \| undefined` | `coerceMinRating` |

TypeScript strict mode compiles without errors. The `as FilterOptions["sortBy"]` cast on line 1018 is a deliberate bridge to the legacy search algorithm interface, not a type-system failure.

### 4.2 Body Parameter Inference

`mocks/shop/src/index.tsx` line 1105:
```ts
const { product_id } = c.req.valid("json");
```

Inferred as `{ product_id: string }` from `AddToCartBodySchema` (`z.object({ product_id: z.string().min(1) })`).

Line 1247:
```ts
const { product_id, quantity } = c.req.valid("json");
```

Inferred as `{ product_id: string; quantity: number }` from `UpdateCartBodySchema`.

### 4.3 Path Parameter Inference

Line 1064:
```ts
const { product_id } = c.req.valid("param");
```

Inferred as `{ product_id: string }` from the route's `request.params` schema.

### 4.4 Type Safety Verification

All type inferences are verified at compile time by TypeScript. No `any` types leak from `@hono/zod-openapi`. The `RouteConfig` generic correctly propagates schema types through `createRoute()` -> `app.openApiRoute()` -> handler's `c.req.valid()`.

---

## 5. Known Issues / Quirks in 0.18.x

### 5.1 `z.preprocess()` Opacity (Documented Above)

The underlying `@asteasolutions/zod-to-openapi` converter cannot represent `z.preprocess()` transformation logic in OpenAPI schema output. Preprocess schemas are rendered as their inner type only, losing all transformation semantics.

**Workaround:** None within `@hono/zod-openapi`. Document preprocess behavior in API documentation outside the spec if needed.

### 5.2 `z.refine()` Invisibility

`z.refine()` constraints (e.g., the NaN check in `coerceMinPrice`) do not appear in generated OpenAPI specs. The spec shows `type: "number"` without any mention of the custom validation.

**Workaround:** Use `z.pipe()` with branded types or document constraints externally.

### 5.3 `default` Values in Query Parameters

Default values (`z.string().default("")`, `z.enum([...]).default("similarity")`) are correctly emitted as `"default": ...` in the OpenAPI spec. This is working as expected.

### 5.4 `type: ["integer", "null"]` for Optional Preprocess

When a `z.preprocess()` returns `undefined` for empty/missing input and the inner schema is `.optional()`, the generated OpenAPI shows `type: ["integer", "null"]` (or `["number", "null"]`). This is technically correct per OpenAPI 3.1.0 (JSON Schema) semantics but may confuse consumers expecting `required: false` without the `null` union.

**Note:** This is a `@asteasolutions/zod-to-openapi` behavior, not `@hono/zod-openapi` itself.

### 5.5 `rawOpenApi` Cannot Prevent Auto-Injection

As verified in `create-app.test.ts` (lines 206-241), passing `rawOpenApi: { responses: { 400: ... } }` does **not** prevent the auto-injected 400 response when the original route lacks an explicit 400. The auto-injection logic checks the **original** route object, not the merged result. This is by design (documented in the test).

### 5.6 No Version-Specific Regressions

Between 0.18.3 (declared) and 0.18.4 (resolved), no breaking changes affect this codebase. The migration from the pre-OpenAPI Hono setup to `@hono/zod-openapi` 0.18.x was seamless for all 5 mocks.

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| `getOpenAPI31Document()` | OK | All 5 mocks generate valid 3.1.0 docs |
| Bun compile | OK | All 5 binaries compile, pass isolation |
| `defaultHook` | OK | Correctly returns 400 `{ error: string }` |
| Type inference | OK | `c.req.valid("query"/"json"/"param")` fully typed |
| `z.preprocess()` in spec | Quirk | Transformation logic invisible in OpenAPI output |
| `z.refine()` in spec | Quirk | Custom refinements invisible in OpenAPI output |
| Overall compatibility | OK | 0.18.x is safe for this project |
