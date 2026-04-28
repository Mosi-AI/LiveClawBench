# Mock Platform Full-Stack Improvement Design

**Date:** 2026-04-28
**Scope:** All 7 improvement dimensions identified in the architecture review
**Approach:** Hybrid (Phase C) — global skeleton first, then per-mock refactoring, then outer layer cleanup

---

## 1. Problem Statement

The mock-platform monorepo has accumulated structural debt during its migration from Python Flask to Bun+Hono. Key issues:

- Mock sub-packages **have `package.json` files** (all 5 mocks), but they are inconsistent: some lack formal `tsconfig.json` for IDE support, and `shop/package.json` contains a stale `"react": "^19.2.5"` dependency that is unnecessary (hono/jsx does not need React runtime).
- `MockAppV2` **already defines `seed?: () => unknown`** (`packages/mock-lib/src/openapi/types.ts:60`). The real problem is the **consumption pattern**: `shop` and `doc-search` use unsafe type assertions (`as MockAppV2 & { seed() }`) and then extract seed via `(app as unknown as { seed() }).seed` in the entry point. The `startServer` function already supports seed via `options?.seed` but does not consume `mockApp.seed` directly.
- No per-mock `tsconfig.json` exists; only a single root `tsconfig.json` covers everything. TypeScript Project References are **not viable** with Bun (Bun does not support `references` field, `bun build --compile` compiles from source directly, and `composite: true` with `noEmit` loses the core value of incremental compilation). Instead, we will extend `tsconfig.typecheck.json` with explicit includes for all packages.
- `mocks/shop/src/index.tsx` exceeds 1600 lines with mixed HTML, CSS-in-JS, routing, and data logic.
- Snapshot tests obscure algorithm semantics, especially for array-returning functions (`searchProducts`, `filterAndSortProducts`) where the spec previously only provided scalar examples.
- CLI argument parsing is inconsistent: `doc-search` has its own inline `parseCliArgs()` while other mocks rely on `startServer()`'s `--port` parsing.
- Docker build chain carries regex-based `startup_extra` filtering (migration bridge tech debt). The `shared/entrypoint.sh` lives outside `mock-platform/` and its build-context copying logic must be carefully audited before moving.
- Documentation lacks design principles and onboarding guides for new mock authors.

---

## 2. Goals

1. **Structural integrity**: Every mock's `package.json` is clean, consistent, and declares the correct dependencies. Remove stale deps like `react`.
2. **Type safety**: Remove all `as MockAppV2 & { seed() }` type assertions and `(app as unknown).seed` casts. `startServer` consumes `mockApp.seed` directly.
3. **Code clarity**: No file exceeds 300 lines (soft limit; CSS/JS-in-TSX strings are exempt from line counting); concerns are separated into modules.
4. **Test quality**: Explicit assertions replace snapshots for all algorithm tests. Tests live in `tests/` directory.
5. **Consistency**: All mocks share the same CLI parsing utility from `mock-lib`.
6. **Documentation**: README and DESIGN.md serve as the canonical reference for new mock development.

---

## 3. Architecture Overview

### 3.1 Monorepo Structure (Target)

```
mock-platform/
├── tsconfig.json              # Shared compiler options (single root config)
├── tsconfig.typecheck.json    # CI gate: full type check with explicit includes
├── package.json               # Root workspaces declaration
│
├── packages/
│   └── mock-lib/
│       ├── package.json
│       └── src/
│           ├── index.ts       # Public API exports
│           ├── types.ts       # MockConfig, CreateMockAppOptions, AppEnv
│           ├── create-app.ts  # Factory delegation
│           ├── server.ts      # startServer() — consumes mockApp.seed directly
│           ├── cli.ts         # parseCliArgs(), parseCliPort()
│           ├── auth/          # JWT + middleware
│           ├── db/            # JsonStore + SQLite helpers
│           ├── render/        # Static assets
│           └── openapi/       # Zod-OpenAPI integration
│               ├── types.ts   # MockAppV2 (already has seed), OpenAPIApp, RouteConfig
│               ├── create-app.ts
│               └── schemas.ts
│
├── mocks/
│   ├── shop/
│   │   ├── package.json       # Normalized (remove stale react dep)
│   │   ├── tsconfig.json      # Per-mock config (extends root, not composite)
│   │   ├── src/
│   │   │   ├── index.ts       # Entry point (<=150 lines)
│   │   │   ├── types.ts       # Product, CartItem, OrderItem, Order, PaymentMethod, UserData
│   │   │   ├── data/
│   │   │   │   ├── store.ts   # JsonStore instance + load/save wrappers
│   │   │   │   ├── seed.ts    # seedOrders, seedUser, loadProducts
│   │   │   │   └── defaults.ts  # DEFAULT_USER constant
│   │   │   ├── components/    # TSX page components
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── home-page.tsx
│   │   │   │   ├── results-page.tsx
│   │   │   │   ├── cart-page.tsx
│   │   │   │   ├── profile-page.tsx
│   │   │   │   ├── profile-css.ts    # CSS strings extracted
│   │   │   │   ├── profile-js.ts     # JS strings extracted
│   │   │   │   └── orders-page.tsx
│   │   │   └── routes/        # API route handlers
│   │   │       ├── products.ts
│   │   │       ├── cart.ts
│   │   │       ├── orders.ts
│   │   │       ├── user.ts
│   │   │       └── checkout.ts
│   │   ├── tests/
│   │   │   ├── index.test.ts
│   │   │   ├── search-algorithm.test.ts
│   │   │   └── schemas.test.ts
│   │   └── src/               # (no .test.ts files here anymore)
│   │
│   ├── doc-search/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts       # Entry point (<=150 lines)
│   │   │   ├── types.ts       # Document, SearchResult, Metadata, AccessEvent
│   │   │   ├── db/
│   │   │   │   ├── init.ts    # initDatabase, validateDocumentRow
│   │   │   │   └── config.ts  # loadDynamicConfig
│   │   │   ├── log/
│   │   │   │   └── access.ts  # writeEvent, initAccessLog
│   │   │   ├── render/
│   │   │   │   ├── html.ts    # escHtml, renderPage
│   │   │   │   ├── home.ts
│   │   │   │   ├── search.ts
│   │   │   │   ├── doc.ts
│   │   │   │   └── not-found.ts
│   │   │   └── query/
│   │   │       └── tokenizer.ts
│   │   └── tests/
│   │       └── index.test.ts
│   │
│   ├── airline/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── tests/
│   │       └── index.test.ts  # Baseline: health + sentinel
│   │
│   ├── email/
│   │   └── [same structure as airline]
│   │
│   └── todolist/
│       └── [same structure as airline]
│
├── scripts/
│   ├── build-all.ts
│   ├── build-task-images.ts
│   ├── generate-openapi.ts
│   └── check-openapi-clean.ts
│
├── config/
│   └── task-binary-map.json
│
├── tools/
│   └── create-mock/
│       └── index.ts           # Updated to generate new structure
│
├── docs/
│   ├── shop-internal.md
│   ├── doc-search-internal.md
│   └── tests/
│       └── negative-paths-reference.md
│
├── static/
│   └── shop/
│       ├── css/
│       └── sample_products.json
│
├── shared/
│   └── entrypoint.sh          # Docker entrypoint (stay at repo root, see §4.5.2)
│
├── README.md                  # Updated with Design Principles + onboarding
└── DESIGN.md                  # Architecture reference document
```

### 3.2 Design Principles

All mocks in this platform follow these conventions:

1. **Factory Pattern**: Each mock exports `createXxxApp()` returning `MockAppV2`. No global state, no side effects on import.
2. **Server Startup Guarded**: Entry point uses `if (import.meta.main)` so dynamic imports (e.g., OpenAPI generation) never boot a listener.
3. **Seed Before Listen**: Data initialization goes in `seed()` callback. `startServer()` consumes `mockApp.seed` directly. Seed failures are fatal.
4. **Self-Contained Binary**: Each mock compiles to a standalone binary via `bun build --compile`. No runtime dependency on node_modules.
5. **Zod Schema-First**: All request/response validation uses Zod schemas. OpenAPI specs are generated automatically from route definitions.
6. **Test Isolation**: Tests use `beforeEach` to create fresh app instances. No shared state between tests. Be careful that `seed()` is not inadvertently called multiple times during test setup.

### 3.3 File Size Guidelines

- Entry point (`src/index.ts`): <=150 lines (assembly only)
- Route handler file: <=200 lines
- Component file: <=300 lines (soft limit)
- If a file exceeds these limits after excluding CSS/JS string literals, split it

---

## 4. Detailed Design

### 4.1 Global Skeleton Layer

#### 4.1.1 Workspace Package Normalization

All 5 mock sub-packages **already have `package.json`**. The work is to **normalize** them:

**For `shop/package.json`:**
- Remove stale `"react": "^19.2.5"` dependency (hono/jsx does not use React runtime)
- Ensure `mock-lib: "workspace:*"` is declared (it may already be there)

**For all mock `package.json`:**
- Verify consistency: `name`, `private: true`, `main`, `types`, `dependencies`

**No changes needed to root `package.json` workspaces declaration** — `mocks/*/package.json` already exist and Bun is resolving them.

#### 4.1.2 TypeScript Configuration — Per-Mock tsconfig (NOT Project References)

**Rationale against Project References:**
- Bun does not support `references` field in `tsconfig.json`
- `bun build --compile` compiles directly from TypeScript source; it does not consume `.d.ts` or `.js` outputs
- `composite: true` with `noEmit` only generates `.tsbuildinfo`, losing the core benefit of cross-project incremental compilation
- ROI is too low for the added complexity

**Instead:** Add per-mock `tsconfig.json` files that extend the root config, providing:
- IDE navigation and type checking per package
- Future-proofing if we switch to a build tool that supports references

Root `tsconfig.json` (unchanged structure, continues as the shared config):

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "types": ["@types/bun"]
  },
  "exclude": ["node_modules", "dist"]
}
```

Each mock's `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

**`tsconfig.typecheck.json` (updated for CI):**

```json
{
  "extends": "./tsconfig.json",
  "include": [
    "packages/mock-lib/src/**/*.ts",
    "mocks/shop/src/**/*.ts",
    "mocks/shop/src/**/*.tsx",
    "mocks/shop/tests/**/*.ts",
    "mocks/doc-search/src/**/*.ts",
    "mocks/doc-search/tests/**/*.ts",
    "mocks/airline/src/**/*.ts",
    "mocks/airline/tests/**/*.ts",
    "mocks/email/src/**/*.ts",
    "mocks/email/tests/**/*.ts",
    "mocks/todolist/src/**/*.ts",
    "mocks/todolist/tests/**/*.ts",
    "scripts/**/*.ts",
    "tools/**/*.ts"
  ]
}
```

#### 4.1.3 MockAppV2 Seed Consumption Normalization

**Current state** (`packages/mock-lib/src/openapi/types.ts`):

```typescript
export interface MockAppV2 {
  config: MockConfig;
  app: OpenAPIApp;
  openApiInfo?: { title: string; version: string };
  seed?: () => unknown;  // <-- ALREADY EXISTS
}
```

**The fix is in consumption, not definition.**

**Current anti-pattern in `mocks/shop/src/index.tsx`:**

```typescript
return {
  ...mockApp,
  seed: async () => { ... },
} as MockAppV2 & { seed(): Promise<void> };  // Unsafe assertion
```

**Current anti-pattern in entry point:**

```typescript
startServer(app, {
  seed: (app as unknown as { seed(): Promise<void> }).seed,  // Unsafe cast
});
```

**Current `server.ts` pattern:**

```typescript
export async function startServer(mockApp: MockApp, options?: { seed?, dev? }) {
  if (options?.seed) { await options.seed(); }
}
```

**Target state:**

`packages/mock-lib/src/server.ts` — consume `mockApp.seed` directly:

```typescript
export async function startServer(
  mockApp: MockAppV2,
  options?: { dev?: boolean }
): Promise<ReturnType<typeof Bun.serve>> {
  const dev = options?.dev ?? mockApp.config.dev ?? false;
  mockApp.config.dev = dev;
  const cliPort = parseCliPort();
  const port = cliPort ?? mockApp.config.port ?? 3000;

  if (dev) {
    const { logger } = await import("hono/logger");
    mockApp.app.use("*", logger());
  }

  if (mockApp.seed) {
    try {
      await mockApp.seed();
    } catch (err) {
      console.error(`mock-${mockApp.config.name}: FATAL: seed() failed`, err);
      process.exit(1);
    }
  }

  const server = Bun.serve({ port, fetch: mockApp.app.fetch });
  console.log(`mock-${mockApp.config.name} listening on http://localhost:${port}`);
  return server;
}
```

**Shop factory returns clean `MockAppV2`:**

```typescript
export function createShopApp(): MockAppV2 {
  // ... implementation ...

  return {
    ...mockApp,
    seed: async () => {
      await loadProducts();
      seedUser();
      seedOrders();
    },
  };  // No type assertion needed — MockAppV2 already accepts seed
}
```

**Entry point is simplified:**

```typescript
if (import.meta.main) {
  const app = createShopApp();
  startServer(app);  // No options.seed needed
}
```

Note: The `startServer` signature changes — it no longer accepts `options.seed`. This is a breaking change for any existing callers. Verify that no other code passes `seed` in `options`.

### 4.2 Mock Refactoring Layer

#### 4.2.1 Shop Mock Split

Current `mocks/shop/src/index.tsx` (~1608 lines) splits into:

| File | Lines | Content |
|------|-------|---------|
| `src/index.ts` | ~80 | Factory function, route registration, server guard |
| `src/types.ts` | ~40 | Product, CartItem, OrderItem, Order, PaymentMethod, UserData |
| `src/data/defaults.ts` | ~15 | DEFAULT_USER constant |
| `src/data/store.ts` | ~30 | JsonStore instance + load/save wrappers |
| `src/data/seed.ts` | ~80 | seedOrders, seedUser, loadProducts |
| `src/components/layout.tsx` | ~40 | Layout component |
| `src/components/home-page.tsx` | ~20 | HomePage component |
| `src/components/results-page.tsx` | ~80 | ResultsPage + ProductCard + SORT_LABELS |
| `src/components/cart-page.tsx` | ~80 | CartPage + CartItemComponent |
| `src/components/profile-page.tsx` | ~120 | ProfilePage component (JSX only) |
| `src/components/profile-css.ts` | ~30 | PROFILE_CSS string |
| `src/components/profile-js.ts` | ~40 | PROFILE_JS string |
| `src/components/orders-page.tsx` | ~80 | OrdersPage + ORDERS_JS |
| `src/routes/products.ts` | ~50 | GET /api/products, GET /api/product/{id} |
| `src/routes/cart.ts` | ~120 | POST /api/cart/add, GET /api/cart, DELETE /api/cart/remove, PUT /api/cart/update, POST /api/cart/clear |
| `src/routes/checkout.ts` | ~60 | POST /api/checkout |
| `src/routes/orders.ts` | ~80 | GET /api/orders, POST /api/orders/{id}/return, POST /api/orders/{id}/confirm |
| `src/routes/user.ts` | ~40 | GET /api/user, POST /api/user/update |
| `src/search-algorithm.ts` | ~80 | (existing, unchanged) |
| `src/schemas.ts` | ~60 | (existing, unchanged) |

**CSS-in-JS strategy**: CSS/JS strings are extracted to standalone `.ts` files (`profile-css.ts`, `profile-js.ts`, `orders-page.tsx` contains ORDERS_JS inline since it's shorter). This keeps component files under the soft 300-line limit while avoiding bundler complexity with external CSS files.

#### 4.2.2 Doc-search Mock Split

Current `mocks/doc-search/src/index.ts` (~584 lines) splits into:

| File | Lines | Content |
|------|-------|---------|
| `src/index.ts` | ~60 | Factory, route registration, server guard |
| `src/types.ts` | ~40 | Document, SearchResult, Metadata, AccessEvent types |
| `src/db/init.ts` | ~80 | initDatabase, assertDb, validateDocumentRow |
| `src/db/config.ts` | ~30 | loadDynamicConfig |
| `src/log/access.ts` | ~50 | writeEvent, initAccessLog |
| `src/render/html.ts` | ~20 | escHtml, renderPage |
| `src/render/home.ts` | ~20 | renderHome |
| `src/render/search.ts` | ~40 | renderSearch |
| `src/render/doc.ts` | ~40 | renderDoc |
| `src/render/not-found.ts` | ~10 | renderNotFound |
| `src/query/tokenizer.ts` | ~30 | normalize, tokenize, buildMatchQuery |

Doc-search removes its inline `parseCliArgs()` and uses `mock-lib`'s utility.

#### 4.2.3 Stub Mocks (airline, email, todolist)

These remain minimal but gain:
- `tsconfig.json` (new)
- `tests/index.test.ts` with baseline health + sentinel tests
- `startServer` call updated to not pass `options.seed`

No business logic changes.

### 4.3 Test Strategy Upgrade

#### 4.3.1 Directory Structure

All tests move from `src/*.test.ts` to `tests/*.test.ts`:

```
mocks/shop/
  ├── src/
  └── tests/
      ├── index.test.ts
      ├── search-algorithm.test.ts
      └── schemas.test.ts
```

#### 4.3.2 Snapshot Replacement

**`calculateRelevanceScore` (returns `number`)** — scalar assertions:

```typescript
test("watch: exact title match gets high relevance score", () => {
  const product = PRODUCTS.find(p => p.title.includes("Garmin Forerunner 55"))!;
  const score = calculateRelevanceScore(product, "watch");
  expect(score).toBeGreaterThan(0.8);
  expect(score).toBeLessThanOrEqual(1.0);
});

test("casio: no match returns low score", () => {
  const product = PRODUCTS[0];
  const score = calculateRelevanceScore(product, "casio");
  expect(score).toBeLessThan(0.2);
});
```

**`searchProducts` (returns `[SearchableProduct, score][]`)** — array assertions:

```typescript
test("watch: returns ranked matches in descending score order", () => {
  const results = searchProducts(PRODUCTS, "watch");
  expect(results.length).toBeGreaterThan(0);
  expect(results[0][1]).toBeGreaterThan(results[1]?.[1] ?? 0); // descending score
  expect(results.some(([p]) => p.id === "prod_0068")).toBe(true); // contains expected product
});
```

**`filterAndSortProducts` (returns `SearchableProduct[]`)** — array assertions:

```typescript
test("watch: filters and returns products sorted by criteria", () => {
  const results = filterAndSortProducts(PRODUCTS, {
    query: "watch",
    sortBy: "rating",
    useSearch: true,
  });
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].rating).toBeGreaterThanOrEqual(results[1]?.rating ?? 0);
});
```

Snapshot files (`__snapshots__/`) are removed.

#### 4.3.3 Stub Baseline Tests

Each stub gets:

```typescript
// mocks/airline/tests/index.test.ts
import { describe, expect, test } from "bun:test";
import { createAirlineApp } from "../src/index";

describe("airline mock", () => {
  const app = createAirlineApp().app;

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/airline returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/airline");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

#### 4.3.4 Seed Call Isolation (New Concern)

Verification revealed that `bun test` prints `mock-shop: loaded 91 products...` 20+ times, suggesting `seed()` is called repeatedly during test execution.

**Mitigation strategy:**
- Each test's `beforeEach` creates a fresh app instance; seed should be called once per test case
- Review test setup to ensure `seed()` is not inadvertently triggered by module-level side effects
- Consider memoizing `loadProducts()` or making seed idempotent
- Document in DESIGN.md: "seed() must be idempotent — it may be called multiple times during test execution"

### 4.4 CLI Parameter Parsing Unification

`packages/mock-lib/src/cli.ts` (new file):

```typescript
/**
 * Universal CLI argument parser for mock services.
 * Supports: --key value, --key=value
 *
 * Limitation: Does NOT support boolean flags (e.g., --dev without a value).
 * All current mocks use key-value pairs only (--port, --database, --log).
 */
export function parseCliArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (args[i].startsWith("--") && args[i].includes("=")) {
      const eqIdx = args[i].indexOf("=");
      result[args[i].slice(2, eqIdx)] = args[i].slice(eqIdx + 1);
    }
  }
  return result;
}

/** Parse --port with validation */
export function parseCliPort(): number | undefined {
  const args = parseCliArgs();
  const portStr = args.port;
  if (!portStr) return undefined;
  const port = parseInt(portStr, 10);
  if (!isNaN(port) && port > 0 && port < 65536) return port;
  return undefined;
}
```

Doc-search migration:

```typescript
// Before: inline parseCliArgs in doc-search
// After:
import { parseCliArgs } from "mock-lib";

const cliArgs = parseCliArgs();
const DB_PATH = cliArgs.database ?? process.env.BROWSER_MOCK_DB_PATH ?? defaultDbPath;
const LOG_PATH = cliArgs.log ?? process.env.BROWSER_MOCK_ACCESS_LOG ?? defaultLogPath;
```

### 4.5 Docker Build Chain Cleanup

#### 4.5.1 Regex Filtering Tech Debt

The `generateStartupScript()` function in `scripts/build-task-images.ts` contains regex-based filtering of `startup_extra` content. This is a migration bridge.

**Resolution**: Add explicit TODO comments marking removal conditions:

```typescript
// TODO: Remove this filter block when airline, email, and todolist
// are fully migrated from Python stubs to Bun implementations.
// Condition: all entries in STUB_BINARIES are removed.
const STUB_BINARIES = new Set(["email", "airline", "todolist"]);

// TODO: Remove shop-app block filter when no task uses startup_extra
// that contains "# Start shop-app".
if (implementedBinaries.includes("shop")) { /* ... */ }

// TODO: Remove sqlite bootstrap filter when no task uses startup_extra
// that contains the python3 sqlite bootstrap heredoc.
if (implementedBinaries.includes("doc-search")) { /* ... */ }
```

#### 4.5.2 Entrypoint.sh Location

**Decision: Keep `shared/entrypoint.sh` at the repository root.**

Rationale:
- `build-task-images.ts` copies `entrypoint.sh` into the Docker build context (dist/ directory) at build time (`build-task-images.ts:625-627`)
- Moving the file requires updating: (a) the source path in `build-task-images.ts`, (b) the copy logic that stages it into dist/, (c) any other references
- The benefit of moving (self-containment) does not outweigh the risk of breaking the Docker build pipeline
- Instead, add a comment in `build-task-images.ts` documenting the external dependency:

```typescript
// NOTE: entrypoint.sh lives at repo-root/shared/entrypoint.sh, outside mock-platform/.
// It is copied into the Docker build context (dist/) at build time.
// Do NOT move this file without updating the copy logic below.
const ENTRYPOINT_SRC = join(import.meta.dir, "..", "..", "shared", "entrypoint.sh");
```

### 4.6 Documentation Upgrade

#### 4.6.1 README.md Additions

Append two new sections to existing `mock-platform/README.md`:

**"Design Principles"** section (see §3.2).

**"Adding a New Mock"** section:

```markdown
## Adding a New Mock

```bash
# 1. Scaffold
bun run create-mock <name>

# 2. Implement in mocks/<name>/src/
#    - Export create<PascalCase>App() factory returning MockAppV2
#    - Put seed logic in the seed property of the returned object
#    - Register routes via app.openApiRoute() or app.page()
#    - Put tests in mocks/<name>/tests/

# 3. Validate
bun test                           # Run tests
bun run check-openapi              # Regenerate and verify specs
bun run build                      # Compile all binaries
bun run build:images               # Build per-task Docker images
```

#### 4.6.2 DESIGN.md (New File)

Create `mock-platform/DESIGN.md` as the canonical architecture reference. Contents:

- Monorepo structure diagram (§3.1)
- Mock package structure convention
- `MockAppV2` interface definition (emphasizing seed is already defined)
- File size guidelines (§3.3)
- Testing guidelines (§4.3)
- Build pipeline overview (build-all.ts -> build-task-images.ts)
- Docker image layer architecture (base -> per-task -> task)
- Known limitations (Bun does not support Project References, CLI parser does not support boolean flags)

#### 4.6.3 create-mock Tool Update

Update `tools/create-mock/index.ts` to generate the new structure:

- Include `tsconfig.json` with per-mock includes
- Generate `tests/index.test.ts` with baseline tests
- Update scaffolded `index.ts` to return `MockAppV2` with `seed` property (no type assertion)
- Update scaffolded entry point to use `startServer(app)` (no `options.seed`)

---

## 5. Migration Order

Phase 1 (Global skeleton — no mock logic changes):
1. Audit and normalize all mock `package.json` files (remove stale react dep from shop)
2. Add per-mock `tsconfig.json` files
3. Update `tsconfig.typecheck.json` with explicit includes for all packages and tests
4. Update `MockAppV2` consumption: modify `startServer()` to read `mockApp.seed` directly
5. Add `packages/mock-lib/src/cli.ts` with `parseCliArgs()` and `parseCliPort()`
6. Add `cli` to `packages/mock-lib/src/index.ts` exports

Phase 2 (Stub mocks — establish template):
7. Add `tsconfig.json` and `tests/index.test.ts` to airline, email, todolist
8. Update stub entry points to not pass `options.seed` to `startServer`

Phase 2.5 (Tool update):
9. Update `tools/create-mock/index.ts` to generate the new structure (tsconfig, tests, seed pattern)

Phase 3 (Doc-search refactor):
10. Add `tsconfig.json` to doc-search
11. Split `index.ts` into modules (db/, log/, render/, query/)
12. Migrate to `parseCliArgs` from mock-lib
13. Move tests to `tests/` directory

Phase 4 (Shop refactor — largest change):
14. Add `tsconfig.json` to shop, normalize package.json (remove react)
15. Split `index.tsx` into modules (types, data/, components/, routes/)
16. Extract PROFILE_CSS and PROFILE_JS to standalone files
17. Move tests to `tests/` directory, replace all snapshots with explicit assertions
18. Fix seed call isolation in tests

Phase 5 (Outer layer):
19. Add TODO comments to regex filtering in `build-task-images.ts`
20. Add comment documenting `entrypoint.sh` external dependency
21. Update README.md and create DESIGN.md
22. Run full validation: `bun install`, `bun test`, `bun run check-openapi`, `bun run build`

---

## 6. Validation Checklist

After all changes:

- [ ] `bun install` succeeds (all workspace packages linked)
- [ ] `bun test` passes (all mock tests)
- [ ] `bun run typecheck` passes (no TS errors)
- [ ] `bun run check-openapi` passes (specs up to date)
- [ ] `bun run build` succeeds (all binaries compile)
- [ ] Binary isolation verification passes (sentinel checks)
- [ ] `bun run build:images --dry-run` passes
- [ ] No `src/*.test.ts` files remain (all in `tests/`)
- [ ] No `__snapshots__` directories remain
- [ ] No `toMatchSnapshot()` calls remain in algorithm tests
- [ ] No `as MockAppV2 & { seed() }` type assertions remain
- [ ] No `(app as unknown as { seed() }).seed` casts remain
- [ ] `startServer()` does not accept `options.seed` parameter
- [ ] `shop/package.json` does not contain `react` dependency
- [ ] `DESIGN.md` exists and is up to date
- [ ] `create-mock` tool generates the new structure correctly
