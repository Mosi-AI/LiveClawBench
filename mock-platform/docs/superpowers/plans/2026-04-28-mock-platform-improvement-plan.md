# Mock Platform Full-Stack Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically refactor the mock-platform monorepo to eliminate structural debt, normalize type safety, split oversized files, replace snapshot tests with explicit assertions, unify CLI parsing, and establish canonical documentation for future mock development.

**Architecture:** Five ordered phases — (1) global skeleton changes with no mock logic changes, (2) stub mock template establishment, (2.5) scaffolding tool update, (3) doc-search modularization, (4) shop modularization (largest change), (5) outer-layer cleanup (Docker comments, docs). Each phase is self-contained and testable.

**Tech Stack:** Bun 1.3+, TypeScript 5.9, Hono 4.12, Zod 3.24, `@hono/zod-openapi`, `bun:test`

**Worktree:** `/Users/swordfaith/Documents/workspace/ClawBench/LiveClawBench/.claude/worktrees/mock-platform-improvements/mock-platform/`

---

## File Structure (Target)

```
mock-platform/
├── tsconfig.json                    # Shared compiler options (unchanged)
├── tsconfig.typecheck.json          # CI gate: full type check with explicit includes
├── package.json                     # Root workspaces declaration (unchanged)
│
├── packages/mock-lib/
│   └── src/
│       ├── index.ts                 # Add `cli` re-exports
│       ├── server.ts                # Consume mockApp.seed directly (drop options.seed)
│       ├── cli.ts                   # NEW: parseCliArgs(), parseCliPort()
│       └── types.ts                 # Mark MockApp @deprecated
│
├── mocks/shop/
│   ├── package.json                 # Remove stale react dep
│   ├── tsconfig.json                # NEW
│   ├── src/
│   │   ├── index.ts                 # Entry point (<=150 lines)
│   │   ├── types.ts                 # Product, CartItem, OrderItem, Order, etc.
│   │   ├── data/
│   │   │   ├── defaults.ts          # DEFAULT_USER
│   │   │   ├── store.ts             # JsonStore instances
│   │   │   └── seed.ts              # loadProducts, seedUser, seedOrders
│   │   ├── components/
│   │   │   ├── layout.tsx
│   │   │   ├── home-page.tsx
│   │   │   ├── results-page.tsx
│   │   │   ├── cart-page.tsx
│   │   │   ├── profile-page.tsx
│   │   │   ├── profile-css.ts
│   │   │   ├── profile-js.ts
│   │   │   └── orders-page.tsx
│   │   ├── routes/
│   │   │   ├── products.ts
│   │   │   ├── cart.ts
│   │   │   ├── orders.ts
│   │   │   ├── user.ts
│   │   │   └── checkout.ts
│   │   ├── search-algorithm.ts      # (unchanged)
│   │   └── schemas.ts               # (unchanged)
│   └── tests/                       # MOVED from src/
│       ├── index.test.ts
│       └── search-algorithm.test.ts
│
├── mocks/doc-search/
│   ├── tsconfig.json                # NEW
│   ├── src/
│   │   ├── index.ts                 # Entry point (<=150 lines)
│   │   ├── types.ts                 # Document, SearchResult, Metadata, AccessEvent
│   │   ├── db/
│   │   │   ├── init.ts
│   │   │   └── config.ts
│   │   ├── log/
│   │   │   └── access.ts
│   │   ├── render/
│   │   │   ├── html.ts
│   │   │   ├── home.ts
│   │   │   ├── search.ts
│   │   │   ├── doc.ts
│   │   │   └── not-found.ts
│   │   └── query/
│   │       └── tokenizer.ts
│   └── tests/                       # MOVED from src/
│       └── index.test.ts
│
├── mocks/airline/                   # NEW: tsconfig.json, tests/index.test.ts
├── mocks/email/                     # NEW: tsconfig.json, tests/index.test.ts
├── mocks/todolist/                  # NEW: tsconfig.json, tests/index.test.ts
│
├── scripts/build-task-images.ts     # Add TODO comments + entrypoint dependency note
├── tools/create-mock/index.ts       # Update scaffold (tsconfig, tests, seed pattern)
├── README.md                        # Add Design Principles + Adding a New Mock sections
└── DESIGN.md                        # NEW: Architecture reference document
```

---

## Phase 1: Global Skeleton

No mock business logic changes in this phase. Only structural and type-system changes.

---

### Task 1.1: Normalize shop/package.json (remove stale react dep)

**Files:**
- Modify: `mocks/shop/package.json`

- [ ] **Step 1: Edit package.json**

```json
{
  "name": "@mock/shop",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "hono": "^4.8.0",
    "mock-lib": "workspace:*",
    "zod": "^3.22.0"
  }
}
```

- [ ] **Step 2: Verify install still works**

Run: `bun install`
Expected: No errors, react removed from lockfile

- [ ] **Step 3: Commit**

```bash
git add mocks/shop/package.json
git commit -m "chore(shop): remove stale react dependency"
```

---

### Task 1.2: Add per-mock tsconfig.json files

**Files:**
- Create: `mocks/shop/tsconfig.json`
- Create: `mocks/doc-search/tsconfig.json`
- Create: `mocks/airline/tsconfig.json`
- Create: `mocks/email/tsconfig.json`
- Create: `mocks/todolist/tsconfig.json`

- [ ] **Step 1: Write shop tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 2: Write doc-search tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write airline tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Write email tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 5: Write todolist tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 6: Commit**

```bash
git add mocks/*/tsconfig.json
git commit -m "chore: add per-mock tsconfig.json files"
```

---

### Task 1.3: Update tsconfig.typecheck.json with explicit includes

**Files:**
- Modify: `tsconfig.typecheck.json`

- [ ] **Step 1: Replace content**

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
  ],
  "exclude": []
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: No errors (some files may not exist yet — that's OK, they will in later phases)

- [ ] **Step 3: Commit**

```bash
git add tsconfig.typecheck.json
git commit -m "chore: expand tsconfig.typecheck.json includes for all mocks and tests"
```

---

### Task 1.4: Add mock-lib/src/cli.ts with unified CLI parsers

**Files:**
- Create: `packages/mock-lib/src/cli.ts`
- Modify: `packages/mock-lib/src/index.ts`
- Modify: `packages/mock-lib/src/server.ts`

- [ ] **Step 1: Write cli.ts**

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
    if (
      args[i].startsWith("--") &&
      i + 1 < args.length &&
      !args[i + 1].startsWith("--")
    ) {
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

- [ ] **Step 2: Add cli exports to index.ts**

Modify `packages/mock-lib/src/index.ts`, add after the OpenAPI section:

```typescript
// CLI
export { parseCliArgs, parseCliPort } from "./cli";
```

- [ ] **Step 3: Update server.ts to import MockAppV2 and use cli.parseCliPort**

Replace the top of `packages/mock-lib/src/server.ts`:

```typescript
import type { MockAppV2 } from "./openapi/types";
import { parseCliPort } from "./cli";

/**
 * Start the mock HTTP server using Bun's native HTTP server.
 *
 * - Uses --port CLI flag if provided, otherwise falls back to config.port
 * - In dev mode: enables Hono logger middleware
 * - Calls mockApp.seed() directly if present
 * - Seed failures are fatal: the process exits with code 1
 */
export async function startServer(
  mockApp: MockAppV2,
  options?: {
    /** Dev mode: enable Hono logger. Defaults to mockApp.config.dev */
    dev?: boolean;
  },
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

  const server = Bun.serve({
    port,
    fetch: mockApp.app.fetch,
  });

  console.log(
    `mock-${mockApp.config.name} listening on http://localhost:${port}`,
  );

  return server;
}
```

- [ ] **Step 4: Mark MockApp @deprecated in types.ts**

In `packages/mock-lib/src/types.ts`, add JSDoc to the `MockApp` interface:

```typescript
/**
 * Legacy mock application interface.
 * @deprecated Use MockAppV2 from `./openapi/types` for all new code.
 */
export interface MockApp {
  config: MockConfig;
  app: Hono<AppEnv>;
}
```

- [ ] **Step 5: Verify tests pass**

Run: `bun test`
Expected: 165 pass, 0 fail

- [ ] **Step 6: Commit**

```bash
git add packages/mock-lib/src/cli.ts packages/mock-lib/src/index.ts packages/mock-lib/src/server.ts packages/mock-lib/src/types.ts
git commit -m "feat(mock-lib): unified CLI parsing, startServer consumes MockAppV2.seed"
```

---

## Phase 2: Stub Mocks (Establish Template)

Update the three stub mocks (airline, email, todolist) with tsconfig, tests, and corrected startServer calls.

---

### Task 2.1: Add baseline tests to airline, email, todolist

**Files:**
- Create: `mocks/airline/tests/index.test.ts`
- Create: `mocks/email/tests/index.test.ts`
- Create: `mocks/todolist/tests/index.test.ts`

- [ ] **Step 1: Write airline test**

```typescript
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

- [ ] **Step 2: Write email test**

```typescript
import { describe, expect, test } from "bun:test";
import { createEmailApp } from "../src/index";

describe("email mock", () => {
  const app = createEmailApp().app;

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/email returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/email");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Write todolist test**

```typescript
import { describe, expect, test } from "bun:test";
import { createTodolistApp } from "../src/index";

describe("todolist mock", () => {
  const app = createTodolistApp().app;

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/todolist returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/todolist");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 4: Verify tests pass**

Run: `bun test`
Expected: 171+ pass (165 existing + 6 new), 0 fail

- [ ] **Step 5: Commit**

```bash
git add mocks/airline/tests/ mocks/email/tests/ mocks/todolist/tests/
git commit -m "test: add baseline health + sentinel tests for stub mocks"
```

---

## Phase 2.5: Tool Update

---

### Task 2.5: Update create-mock scaffolding tool

**Files:**
- Modify: `tools/create-mock/index.ts`

- [ ] **Step 1: Add tsconfig.json generation**

After the `packageJson` block, add:

```typescript
  // Write tsconfig.json
  const tsconfigJson = {
    extends: "../../tsconfig.json",
    compilerOptions: {
      baseUrl: ".",
    },
    include: ["src/**/*", "tests/**/*"],
  };
  await writeFile(
    join(mockDir, "tsconfig.json"),
    JSON.stringify(tsconfigJson, null, 2) + "\n",
  );
```

- [ ] **Step 2: Update entry point template to use seed-on-MockAppV2 pattern**

Replace the `entryContent` template in `tools/create-mock/index.ts`:

```typescript
  const entryContent = `import { z } from "zod";
import { createMockApp, createRoute, startServer } from "mock-lib";
import type { MockAppV2 } from "mock-lib";

export function ${factoryName}(): MockAppV2 {
  const mockApp = createMockApp({
    name: "${kebab}",
    openApi: {
      enabled: true,
      title: "${pascal} Mock API",
      version: "1.0.0",
    },
  });

  // Sentinel route for isolation verification.
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/${kebab}",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              mock: z.literal("${kebab}"),
              sentinel: z.literal(true),
            }),
          },
        },
        description: "OK",
      },
    },
  });

  mockApp.app.openApiRoute(sentinelRoute, (c) =>
    c.json({ mock: "${kebab}" as const, sentinel: true as const }),
  );

  return {
    ...mockApp,
    seed: () => {
      // Initialize mock data here (databases, fixtures, etc.)
    },
  };
}

if (import.meta.main) {
  const app = ${factoryName}();
  startServer(app);
}
`;
```

- [ ] **Step 3: Add tests directory generation**

After the `entryContent` write, add:

```typescript
  // Write baseline tests
  const testsDir = join(mockDir, "tests");
  await mkdir(testsDir, { recursive: true });

  const testContent = `import { describe, expect, test } from "bun:test";
import { ${factoryName} } from "../src/index";

describe("${kebab} mock", () => {
  const app = ${factoryName}().app;

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/${kebab} returns sentinel", async () => {
    const res = await app.request("/__mock_sentinel__/${kebab}");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mock).toBe("${kebab}");
    expect(body.sentinel).toBe(true);
  });
});
`;
  await writeFile(join(testsDir, "index.test.ts"), testContent);
```

- [ ] **Step 4: Update console output**

Replace the console.log block:

```typescript
  console.log(`Created mock package: mocks/${kebab}/`);
  console.log(`  - mocks/${kebab}/package.json`);
  console.log(`  - mocks/${kebab}/tsconfig.json`);
  console.log(`  - mocks/${kebab}/src/index.ts (exports ${factoryName})`);
  console.log(`  - mocks/${kebab}/tests/index.test.ts`);
  console.log(`\nNext steps:`);
  console.log(`  1. Run 'bun install' to link the new package.`);
  console.log(
    `  2. Run 'bun run check-openapi' from mock-platform/ to regenerate specs ` +
      `and verify the new mock integrates cleanly.`,
  );
```

- [ ] **Step 5: Verify by creating a test mock**

Run: `cd mock-platform && bun run create-mock test-mock && ls mocks/test-mock/`
Expected: Shows `package.json`, `tsconfig.json`, `src/index.ts`, `tests/index.test.ts`

- [ ] **Step 6: Clean up test mock**

Run: `rm -rf mocks/test-mock`

- [ ] **Step 7: Commit**

```bash
git add tools/create-mock/index.ts
git commit -m "feat(create-mock): generate tsconfig, tests, and seed-on-MockAppV2 pattern"
```

---

## Phase 3: Doc-Search Refactor

---

### Task 3.1: Split doc-search/index.ts into modules

**Files:**
- Create: `mocks/doc-search/src/types.ts`
- Create: `mocks/doc-search/src/db/init.ts`
- Create: `mocks/doc-search/src/db/config.ts`
- Create: `mocks/doc-search/src/log/access.ts`
- Create: `mocks/doc-search/src/render/html.ts`
- Create: `mocks/doc-search/src/render/home.ts`
- Create: `mocks/doc-search/src/render/search.ts`
- Create: `mocks/doc-search/src/render/doc.ts`
- Create: `mocks/doc-search/src/render/not-found.ts`
- Create: `mocks/doc-search/src/query/tokenizer.ts`
- Modify: `mocks/doc-search/src/index.ts` (rewrite as <=150 line entry point)

> **Note:** This task requires reading the full current `mocks/doc-search/src/index.ts` and extracting each section into its own file. The target code for each module is the extracted content from the original file, with appropriate imports.

- [ ] **Step 1: Extract types to src/types.ts**

Move all interfaces (`Document`, `SearchResult`, `Metadata`, `HomeEvent`, `SearchEvent`, `ClickEvent`, `PageEvent`, `AccessEvent`) to `src/types.ts` and export them.

- [ ] **Step 2: Extract DB logic to src/db/init.ts**

Move `initDatabase()`, `assertDb()`, `validateDocumentRow()` and related constants to `src/db/init.ts`.

- [ ] **Step 3: Extract config loading to src/db/config.ts**

Move `loadDynamicConfig()` to `src/db/config.ts`.

- [ ] **Step 4: Extract access logging to src/log/access.ts**

Move `writeEvent()`, `initAccessLog()`, and logging-related state to `src/log/access.ts`.

- [ ] **Step 5: Extract render functions to src/render/*.ts**

Move `escHtml()`, `renderPage()`, `renderHome()`, `renderSearch()`, `renderDoc()`, `renderNotFound()` each to their respective files.

- [ ] **Step 6: Extract query tokenizer to src/query/tokenizer.ts**

Move `normalize()`, `tokenize()`, `buildMatchQuery()` to `src/query/tokenizer.ts`.

- [ ] **Step 7: Rewrite src/index.ts as entry point**

The new `src/index.ts` should:
- Import from the new modules
- Define `createDocSearchApp()` factory
- Return `MockAppV2` with `seed` property (no type assertion)
- Use `startServer(app)` in `import.meta.main` guard (no `options.seed`)
- Use `parseCliArgs` from `mock-lib` instead of inline parser

- [ ] **Step 8: Verify tests pass**

Run: `bun test`
Expected: All existing doc-search tests pass

- [ ] **Step 9: Commit**

```bash
git add mocks/doc-search/src/
git commit -m "refactor(doc-search): split 583-line index.ts into modules"
```

---

### Task 3.2: Move doc-search tests to tests/ directory

**Files:**
- Move: `mocks/doc-search/src/index.test.ts` -> `mocks/doc-search/tests/index.test.ts`

- [ ] **Step 1: Move the file and update imports**

Update the import path in the moved file:
```typescript
import { createDocSearchApp } from "../src/index";
```

- [ ] **Step 2: Verify tests pass**

Run: `bun test mocks/doc-search/tests/index.test.ts`
Expected: All doc-search tests pass

- [ ] **Step 3: Commit**

```bash
git add mocks/doc-search/src/index.test.ts mocks/doc-search/tests/
git commit -m "test(doc-search): move tests from src/ to tests/"
```

---

## Phase 4: Shop Refactor (Largest Change)

---

### Task 4.1: Split shop/index.tsx into modules

**Files:**
- Create: `mocks/shop/src/types.ts`
- Create: `mocks/shop/src/data/defaults.ts`
- Create: `mocks/shop/src/data/store.ts`
- Create: `mocks/shop/src/data/seed.ts`
- Create: `mocks/shop/src/components/layout.tsx`
- Create: `mocks/shop/src/components/home-page.tsx`
- Create: `mocks/shop/src/components/results-page.tsx`
- Create: `mocks/shop/src/components/cart-page.tsx`
- Create: `mocks/shop/src/components/profile-page.tsx`
- Create: `mocks/shop/src/components/profile-css.ts`
- Create: `mocks/shop/src/components/profile-js.ts`
- Create: `mocks/shop/src/components/orders-page.tsx`
- Create: `mocks/shop/src/routes/products.ts`
- Create: `mocks/shop/src/routes/cart.ts`
- Create: `mocks/shop/src/routes/orders.ts`
- Create: `mocks/shop/src/routes/user.ts`
- Create: `mocks/shop/src/routes/checkout.ts`
- Modify: `mocks/shop/src/index.tsx` -> `mocks/shop/src/index.ts` (rewrite as <=150 line entry point)

> **Note:** This is the largest mechanical task. The current `mocks/shop/src/index.tsx` is 1607 lines. Each section must be extracted into its own file with appropriate imports. The target structure is defined in the design spec §4.2.1.
>
> **CSS/JS extraction rule:** PROFILE_CSS (~30 lines) and PROFILE_JS (~160 lines) are extracted to standalone `.ts` files because ProfilePage would exceed 300 lines otherwise. ORDERS_JS (~30 lines) stays inline in `orders-page.tsx` because OrdersPage stays under 300 lines with it inline.
>
> **Factory pattern:** `createShopApp()` returns `MockAppV2` with `seed` property — no `as MockAppV2 & { seed() }` assertion. Entry point uses `startServer(app)` with no `options.seed`.

- [ ] **Step 1: Extract types to src/types.ts**

Move interfaces (`Product`, `CartItem`, `OrderItem`, `Order`, `PaymentMethod`, `UserData`) and any standalone type aliases.

- [ ] **Step 2: Extract data layer**

- `src/data/defaults.ts`: `DEFAULT_USER` constant
- `src/data/store.ts`: `JsonStore` instances (`productsStore`, `cartStore`, `ordersStore`, `userStore`)
- `src/data/seed.ts`: `loadProducts()`, `seedUser()`, `seedOrders()`

- [ ] **Step 3: Extract components**

Each TSX component to its own file. Extract PROFILE_CSS and PROFILE_JS to standalone `.ts` files. Keep ORDERS_JS inline.

- [ ] **Step 4: Extract routes**

Each route handler group to its own file under `src/routes/`:
- `products.ts`: GET /api/products, GET /api/product/{id}
- `cart.ts`: POST /api/cart/add, GET /api/cart, DELETE /api/cart/remove, PUT /api/cart/update, POST /api/cart/clear
- `checkout.ts`: POST /api/checkout
- `orders.ts`: GET /api/orders, POST /api/orders/{id}/return, POST /api/orders/{id}/confirm
- `user.ts`: GET /api/user, POST /api/user/update

- [ ] **Step 5: Rewrite entry point**

`src/index.ts` (not .tsx):
- Import all modules
- Define `createShopApp(): MockAppV2`
- Register all routes
- Return `{ ...mockApp, seed: async () => { ... } }` (no type assertion)
- `import.meta.main` guard calls `startServer(app)` (no `options.seed`)

- [ ] **Step 6: Verify tests pass**

Run: `bun test`
Expected: All shop tests pass

- [ ] **Step 7: Commit**

```bash
git add mocks/shop/src/
git commit -m "refactor(shop): split 1607-line index.tsx into modular structure"
```

---

### Task 4.2: Move shop tests and replace snapshots

**Files:**
- Move: `mocks/shop/src/index.test.ts` -> `mocks/shop/tests/index.test.ts`
- Move: `mocks/shop/src/search-algorithm.test.ts` -> `mocks/shop/tests/search-algorithm.test.ts`
- Delete: `mocks/shop/src/__snapshots__/` (entire directory)
- Create: `mocks/shop/tests/` directory structure

- [ ] **Step 1: Move test files and update imports**

Update import paths:
- `../src/index` instead of `./index`
- `../src/search-algorithm` instead of `./search-algorithm`

- [ ] **Step 2: Replace snapshot assertions in search-algorithm.test.ts**

Replace all `toMatchSnapshot()` calls with explicit assertions:

For `calculateRelevanceScore`:
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

For `searchProducts`:
```typescript
test("watch: returns ranked matches in descending score order", () => {
  const results = searchProducts(PRODUCTS, "watch");
  expect(results.length).toBeGreaterThan(0);
  expect(results[0][1]).toBeGreaterThan(results[1]?.[1] ?? 0);
  expect(results.some(([p]) => p.id === "prod_0068")).toBe(true);
});
```

For `filterAndSortProducts`:
```typescript
test("watch with similarity sort", () => {
  const results = filterAndSortProducts(PRODUCTS, {
    query: "watch",
    sortBy: "similarity",
    useSearch: true,
  });
  expect(results.length).toBeGreaterThan(0);
  // Results should contain expected products
  expect(results.some(p => p.title.includes("Garmin"))).toBe(true);
});
```

- [ ] **Step 3: Delete snapshot files**

Run: `rm -rf mocks/shop/src/__snapshots__`

- [ ] **Step 4: Verify tests pass**

Run: `bun test mocks/shop/tests/`
Expected: All tests pass, no snapshot warnings

- [ ] **Step 5: Commit**

```bash
git add mocks/shop/tests/ mocks/shop/src/
git commit -m "test(shop): move tests to tests/, replace snapshots with explicit assertions"
```

---

## Phase 5: Outer Layer

---

### Task 5.1: Add TODO comments to build-task-images.ts

**Files:**
- Modify: `scripts/build-task-images.ts`

- [ ] **Step 1: Add TODO comment above STUB_BINARIES**

```typescript
// TODO: Remove this filter block when airline, email, and todolist
// are fully migrated from Python stubs to Bun implementations.
// Condition: all entries in STUB_BINARIES are removed.
const STUB_BINARIES = new Set(["email", "airline", "todolist"]);
```

- [ ] **Step 2: Add TODO comment above shop-app block filter**

```typescript
// TODO: Remove shop-app block filter when no task uses startup_extra
// that contains "# Start shop-app". This filter strips legacy Python
// shop-app startup lines when the Bun mock-shop binary is present.
if (implementedBinaries.includes("shop")) {
```

- [ ] **Step 3: Add TODO comment above sqlite bootstrap filter**

```typescript
// TODO: Remove sqlite bootstrap filter when no task uses startup_extra
// that contains the python3 sqlite bootstrap heredoc.
if (implementedBinaries.includes("doc-search")) {
```

- [ ] **Step 4: Add NOTE comment above ENTRYPOINT_SRC**

```typescript
// NOTE: entrypoint.sh lives at repo-root/shared/entrypoint.sh, outside mock-platform/.
// It is copied into the Docker build context (dist/) at build time.
// Do NOT move this file without updating the copy logic below.
const ENTRYPOINT_SRC = join(import.meta.dir, "..", "..", "shared", "entrypoint.sh");
```

- [ ] **Step 5: Commit**

```bash
git add scripts/build-task-images.ts
git commit -m "docs(build): add TODO comments for migration bridge tech debt"
```

---

### Task 5.2: Update README.md and create DESIGN.md

**Files:**
- Modify: `README.md`
- Create: `DESIGN.md`

- [ ] **Step 1: Append "Design Principles" section to README.md**

Append to the end of `mock-platform/README.md`:

```markdown
## Design Principles

All mocks in this platform follow these conventions:

1. **Factory Pattern**: Each mock exports `createXxxApp()` returning `MockAppV2`. No global state, no side effects on import.
2. **Server Startup Guarded**: Entry point uses `if (import.meta.main)` so dynamic imports (e.g., OpenAPI generation) never boot a listener.
3. **Seed Before Listen**: Data initialization goes in `seed()` callback. `startServer()` consumes `mockApp.seed` directly. Seed failures are fatal.
4. **Self-Contained Binary**: Each mock compiles to a standalone binary via `bun build --compile`. No runtime dependency on node_modules.
5. **Zod Schema-First**: All request/response validation uses Zod schemas. OpenAPI specs are generated automatically from route definitions.
6. **Test Isolation**: Tests use `beforeEach` to create fresh app instances. No shared state between tests. `seed()` must be idempotent.

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
```

- [ ] **Step 2: Create DESIGN.md**

```markdown
# Mock Platform Design Document

## Monorepo Structure

```
mock-platform/
├── packages/mock-lib/     # Shared framework library
├── mocks/                 # Per-service mock implementations
├── scripts/               # Build and verification scripts
├── tools/                 # Developer tooling (create-mock)
├── config/                # Task-to-binary mappings
└── docs/                  # Internal documentation
```

## Mock Package Convention

Each mock is a Bun workspace package with:
- `package.json` — declares `mock-lib: "workspace:*"` and runtime deps
- `tsconfig.json` — extends root config, includes `src/` and `tests/`
- `src/index.ts` — entry point exporting factory + server guard
- `src/types.ts` — domain types
- `src/data/` — storage and seed logic
- `src/components/` — TSX page components (HTML-rendered mocks)
- `src/routes/` — API route handlers
- `tests/` — `bun:test` test suite

## MockAppV2 Interface

```typescript
interface MockAppV2 {
  config: MockConfig;
  app: OpenAPIApp;
  openApiInfo?: { title: string; version: string };
  seed?: () => unknown;
}
```

The `seed` property is optional. When present, `startServer()` calls it before booting the HTTP listener. Seed failures are fatal (process exits with code 1).

## File Size Guidelines

- Entry point (`src/index.ts`): <=150 lines (assembly only)
- Route handler file: <=200 lines
- Component file: <=300 lines (soft limit; CSS/JS string literals exempt)

## Testing Guidelines

- Tests live in `mocks/<name>/tests/`, not in `src/`
- Use explicit assertions, not snapshots, for algorithm tests
- Each test gets a fresh app instance via factory call
- Call `seed()` explicitly in test setup when needed
- `seed()` must be idempotent

## Build Pipeline

1. `bun run build` (`scripts/build-all.ts`) — compiles each mock to standalone binary
2. `bun run check-openapi` — regenerates OpenAPI specs and verifies they are committed
3. `bun run build:images` (`scripts/build-task-images.ts`) — builds per-task Docker images

## Docker Image Layers

1. **Base** (`liveclawbench-base:latest`) — shared runtime (Python, Bun, Playwright)
2. **Per-task** (`liveclawbench-{task}-base:latest`) — task-specific mock binaries + startup scripts
3. **Task** — task-specific apps and environment

## Known Limitations

- Bun does not support TypeScript Project References (`references` field)
- `parseCliArgs()` does not support boolean flags (only key-value pairs)
```

- [ ] **Step 3: Commit**

```bash
git add README.md DESIGN.md
git commit -m "docs: add Design Principles, onboarding guide, and DESIGN.md"
```

---

## Final Validation

After all tasks complete, run the full validation checklist:

- [ ] `bun install` succeeds
- [ ] `bun test` passes (all mocks)
- [ ] `bun run typecheck` passes
- [ ] `bun run check-openapi` passes
- [ ] `bun run build` succeeds
- [ ] No `mocks/*/src/*.test.ts` files remain
- [ ] No `__snapshots__` directories remain
- [ ] No `toMatchSnapshot()` in algorithm tests
- [ ] No `as MockAppV2 & { seed() }` assertions remain
- [ ] No `(app as unknown).seed` casts remain
- [ ] `startServer()` does not accept `options.seed`
- [ ] `shop/package.json` has no `react` dependency
- [ ] `DESIGN.md` exists

---

## Spec Coverage Checklist

| Spec Section | Plan Task |
|---|---|
| 4.1.1 Workspace Package Normalization | Task 1.1 |
| 4.1.2 TypeScript Configuration | Tasks 1.2, 1.3 |
| 4.1.3 MockAppV2 Seed Consumption | Task 1.4 |
| 4.2.1 Shop Mock Split | Task 4.1 |
| 4.2.2 Doc-search Mock Split | Task 3.1 |
| 4.2.3 Stub Mocks | Task 2.1 |
| 4.3.1 Directory Structure | Tasks 3.2, 4.2 |
| 4.3.2 Snapshot Replacement | Task 4.2 |
| 4.3.3 Stub Baseline Tests | Task 2.1 |
| 4.4 CLI Unification | Task 1.4 |
| 4.5.1 Regex Filtering TODOs | Task 5.1 |
| 4.5.2 Entrypoint.sh Note | Task 5.1 |
| 4.6.1 README Additions | Task 5.2 |
| 4.6.2 DESIGN.md | Task 5.2 |
| 4.6.3 create-mock Update | Task 2.5 |
