# Mock Platform

Bun+Hono mock services that simulate real-world APIs inside task containers. Each mock compiles to a standalone binary via `bun build --compile`.

## Architecture

```
mock-platform/
├── packages/mock-lib/         # Shared library
├── mocks/                     # Per-service implementations
│   ├── shop/
│   ├── doc-search/
│   ├── airline/
│   ├── email/
│   └── todolist/
├── scripts/                   # Build & image tools
├── config/                    # Task-to-binary mapping
└── docs/                      # API docs & test references
```

### Shared Library (`packages/mock-lib/`)

| Module | Purpose |
|--------|---------|
| `create-app.ts` | Hono app factory; registers `/health` endpoint |
| `server.ts` | `startServer()` — Bun HTTP server with `--port` CLI override, dev logger, seed callback |
| `json-store.ts` | JSON file persistence layer with atomic write |
| `static-assets.ts` | Static file serving from `/opt/mock/static/` |
| `types.ts` | Shared TypeScript interfaces |
| `openapi.ts` | Zod schema + `@hono/zod-openapi` integration; auto-generates OpenAPI 3.1 specs |

> **Full conventions and detailed guidelines** are documented in [`docs/mock-conventions.md`](docs/mock-conventions.md). This README provides an overview; refer to that document for implementation rules (factory pattern, response wrappers, auth, database seeding, testing, etc.).

All mock services use `createMockApp()` which automatically exposes:

- `GET /health` — returns `{ ok: true, status: "healthy", service: <name> }`
- `GET /__mock_sentinel__/<name>` — internal harbor readiness probe

### Migration Verification

Search parity between the legacy Python mock implementations and the current Bun+Hono versions was confirmed with 38/38 golden queries matching. FTS5/BM25 equivalence is inherent because both `bun:sqlite` and Python `sqlite3` bind the same system SQLite library with the FTS5 extension.

## Mock Services

| Service | Directory | Binary | Route Style | Description |
|---------|-----------|--------|-------------|-------------|
| Shop | `mocks/shop/` | `mock-shop` | Zod OpenAPI | E-commerce: products, cart, orders, user profile, search |
| Doc-search | `mocks/doc-search/` | `mock-doc-search` | Zod OpenAPI | FTS5 full-text search with BM25 ranking, JSONL access logging |
| Airline | `mocks/airline/` | `mock-airline` | Zod OpenAPI | Flight booking, seat selection, check-in, baggage, claims |
| Email | `mocks/email/` | `mock-email` | Zod OpenAPI | Email inbox, compose, reply, drafts, attachments |
| Todolist | `mocks/todolist/` | `mock-todolist` | Zod OpenAPI | Task management with date/month filtering |

API documentation is auto-generated as OpenAPI 3.1 specs in `dist/openapi/*.json`. Run `bun run generate-openapi` to regenerate after route changes.

### Internal Documentation

Internal docs capture domain-specific behaviors not exposed in the OpenAPI specs:

| Document | Covered Behaviors |
|---|---|
| `docs/shop-internal.md` | Search algorithm, product/cart/order data types |
| `docs/doc-search-internal.md` | FTS5 schema, BM25 ranking, JSONL access log format |
| `docs/airline-internal.md` | Seat generation, claiming/upgrades, booking lifecycle, task fixtures |
| `docs/email-internal.md` | Seed injection, compose/reply/draft flow, Werkzeug hash compatibility |
| `docs/todolist-internal.md` | Date filtering, month boundaries, `getNextSunday` fix, task fixtures |

## Build Commands

```bash
# Build all mock binaries → dist/
bun run build

# Build per-task Docker images (requires base image first)
bun run build:images

# Run Layer 1 unit tests
bun test
```

## OpenAPI 3.1 Schema Generation

Mock routes declare request/response schemas via Zod. `@hono/zod-openapi` generates OpenAPI 3.1 specs at build time, producing `dist/openapi/*.json`.

### Design Decisions

**Why Zod + `@hono/zod-openapi`?**

- Single source of truth: route handlers and API docs share the same Zod schema. Changing validation rules updates the spec automatically.
- Type inference: `z.infer<typeof Schema>` gives TypeScript types without manual duplication.
- Hono-native: `@hono/zod-openapi` is a first-party Hono package, so middleware composition and type narrowing work out of the box.

**Schema registration pattern**

Each mock defines routes with `createRoute()` from `@hono/zod-openapi`, then registers them on the Hono app instance. Example:

```typescript
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "zod";

const route = createRoute({
  method: "get",
  path: "/api/products",
  request: { query: z.object({ q: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(ProductSchema) } }, description: "Product list" },
  },
});

app.openapi(route, (c) => { ... });
```

**Security scheme**

All protected routes use a Bearer token scheme (`Authorization: Bearer <jwt>`). The JWT secret is generated in-memory via `crypto.getRandomValues()` at binary startup — no `.env` file, no env var, no command-line arg.

**Validation error injection**

A middleware catches Zod validation errors and returns structured `400` responses with field-level detail, making it easy for both agents and verifiers to diagnose malformed requests.

**Regeneration**

```bash
# Rebuild all OpenAPI specs after route changes
bun run generate-openapi

# Verify specs are up to date (CI gate)
bun run check-openapi
```

## Configuration

- `config/task-binary-map.json` — Maps each task to its required mock binaries (stub vs implemented)
- `scripts/build-all.ts` — Builds all mock binaries
- `scripts/build-task-images.ts` — Creates per-task Docker images with correct binary set

## Development

Mock services read environment variables for data paths:

| Service | Variable | Default | Purpose |
|---------|----------|---------|---------|
| Shop | `MOCK_PRODUCTS_PATH` | `/opt/mock/static/shop/products.json` | Product catalog JSON |
| Shop | `MOCK_DATA_DIR` | — | Directory for runtime data (orders, cart, user profile) |
| Doc-search | `BROWSER_MOCK_DATA_DIR` | — | Directory containing `documents.sql` for FTS5 seeding |

**Data injection in task containers:** The per-task Docker layer (see `config/task-binary-map.json`) copies task-specific assets into `/opt/mock/static/` and `/opt/mock/data/` at image build time. Mocks read these paths at startup. When running locally for development, set the relevant variable to the task's data file:

```bash
# Run shop mock with a specific task's product catalog
MOCK_PRODUCTS_PATH=tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json \
  bun run mocks/shop/src/index.tsx --port 3000

# Run doc-search mock with a specific task's documents
BROWSER_MOCK_DATA_DIR=tasks/mixed-tool-memory/environment \
  bun run mocks/doc-search/src/index.ts --port 3001
```

**Usage notes:**
- Shop writes order/cart state to a JSON file under `MOCK_DATA_DIR` (atomic write via `json-store.ts`). If the directory does not exist, the mock creates it.
- Doc-search seeds its SQLite FTS5 index from `documents.sql` on first startup; subsequent restarts reuse the existing database unless the file is deleted.
- All mocks expose `GET /health` and `GET /__mock_sentinel__/<name>` for orchestration health checks.

## Negative-Path Testing

The Layer 2 test specification in `docs/tests/negative-paths-reference.md` documents 16 targeted fail-fast checks against shop and doc-search. Layer 1 `bun:test` suites already provide executable negative-path coverage: shop has 39 tests in `mocks/shop/src/index.test.ts` and doc-search has 18 tests in `mocks/doc-search/src/index.test.ts`. Run them with `bun test`.

## Design Principles (Summary)

All mocks follow these conventions. See [`docs/mock-conventions.md`](docs/mock-conventions.md) for the full specification with examples.

1. **Factory Pattern**: Each mock exports `createXxxApp()` returning `MockAppV2`. No global state, no side effects on import.
2. **Server Startup Guarded**: Entry point uses `if (import.meta.main)` so dynamic imports never boot a listener.
3. **Seed Before Listen**: Data initialization goes in `seed()` callback. `startServer()` consumes `mockApp.seed` directly. Seed failures are fatal.
4. **Self-Contained Binary**: Each mock compiles to a standalone binary via `bun build --compile`. No runtime dependency on node_modules.
5. **Zod Schema-First**: All API routes use `createRoute()` + Zod schema, registered via `app.openApiRoute()`. OpenAPI 3.1 specs are generated automatically.
6. **Test Isolation**: Tests use `beforeEach` to create fresh app instances. No shared state between tests. `seed()` must be idempotent.

## Response Wrapper Patterns

Mocks standardize on the `ok()`/`err()` envelope pattern. See [`docs/mock-conventions.md`](docs/mock-conventions.md#response-wrappers) for the full specification and examples.

## Auth Patterns

All mocks use `mock-lib`'s `sign()`/`verify()` for JWT (HMAC-SHA256, per-process random secret) and Werkzeug-compatible PBKDF2 for password hashing. See [`docs/mock-conventions.md`](docs/mock-conventions.md#authentication) for the full auth specification.

## Adding a New Mock

```bash
# 1. Scaffold
bun run create-mock <name>
```

### 2. Implement in `mocks/<name>/src/`

- Export `create<PascalCase>App()` factory returning `MockAppV2`
- Put seed logic in the `seed` property of the returned object
- Register routes via `app.openApiRoute()` or `app.page()`
- Put tests in `mocks/<name>/tests/`

### 3. Register in the build system

| Step | File | What to add |
|------|------|-------------|
| Port | `scripts/build-task-images.ts` — `BINARY_PORTS` | Assign a unique port (e.g., `myMock: 5010`) |
| Sentinel | `scripts/build-all.ts` — `verifyIsolation()` | Add sentinel route pattern `\/__mock_sentinel__\/${name}` |
| Binary map | `config/task-binary-map.json` | Add name to top-level `binaries` array |
| Tasks | `config/task-binary-map.json` — `tasks` | For each task using this mock, add it to the task's `binaries` list; add `assets` / `frontends` if needed |
| Verifier bridge | `mocks/<name>/python_compat/` (if needed) | If Python verifier scripts need SQLAlchemy model imports from the mock DB, create a compatibility bridge |

### 4. Validate

```bash
bun test                           # Run Layer 1 tests
bun run check-openapi              # Regenerate and verify specs are committed
bun run build                      # Compile all binaries (validates sentinel isolation)
bun run build:images               # Build per-task Docker images
```
