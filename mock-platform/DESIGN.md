# Mock Platform Design Document

> This document covers architecture, interfaces, and build layering. For implementation conventions (factory pattern, response wrappers, auth, testing, etc.), see [`docs/mock-conventions.md`](docs/mock-conventions.md).

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
- `src/seed.ts` — storage and seed logic (idempotent)
- `src/db.ts` or `src/db/` — database initialization and schema
- `src/components/` — TSX page components (HTML-rendered mocks)
- `src/routes/` — API route handlers
- `src/helpers.ts` — optional shared helpers (ok/err/paginate, etc.)
- `tests/` — `bun:test` test suite

## MockAppV2 Interface

```typescript
interface MockAppV2 {
  config: MockConfig;
  app: OpenAPIApp;
  openApiInfo?: { title: string; version: string };
  seed?: () => void | Promise<void>;
}
```

The `seed` property is optional. When present, `startServer()` calls it before booting the HTTP listener. Seed failures are fatal (process exits with code 1).

## File Size Guidelines (Soft Limits)

These are targets, not hard rules. If a file exceeds the limit, split by domain or resource.

- Entry point (`src/index.ts`): <=150 lines (aim for it; pure assembly code should not bloat)
- Route handler file: <=200 lines (split by resource, e.g., `bookings.ts` + `checkin.ts`)
- Seed file: <=300 lines (split seed data from seed logic if larger)
- Component file: <=300 lines (soft limit; CSS/JS string literals exempt)

Previously exceeded limits (resolved in commit `33615d9`):
- `airline/src/seed.ts`: was ~901 lines, split into `seed/*.ts` (now ~124 lines)
- `email/src/routes/emails.ts`: was ~339 lines, split into `emails-read.ts`, `emails-compose.ts`, `emails-actions.ts` (now ~11 lines each)
- `todolist/src/routes/todos.ts`: was ~255 lines, now within limit

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

## Seed Pattern

Two seed patterns exist. New mocks must use the preferred one.

- **Preferred**: Return an async `seed` callback in the `MockAppV2` object. `startServer()` calls it before booting the HTTP listener.
  ```typescript
  return { ...mockApp, seed: () => seedDatabase(db) };
  ```
- **Legacy**: Call `seedDatabase(db)` synchronously inside the factory body. This bypasses `startServer()` control and makes explicit test seeding harder.
  ```typescript
  seedDatabase(db);        // legacy — do not use
  return { ...mockApp };
  ```

Current legacy users: airline, email, todolist.

## Health Endpoints

`createMockApp()` automatically registers `GET /health` with the response:
```json
{ "ok": true, "status": "healthy", "service": "<name>" }
```

Pass `healthResponse` to `createMockApp()` for a custom payload (e.g., `{ status: "healthy", service: "shop-mosi-backend" }`).

**Do NOT manually register `/health` or `/api/health`** in individual mocks — it creates duplicate endpoints.

## Historical Pattern Violations

All known pattern violations from the PR #41 migration (email, todolist, airline → Bun+TypeScript) have been resolved. Key fixes:

- In-factory seeding → all mocks now return a `seed` callback in `MockAppV2`
- Duplicate `/health` endpoints → removed manual `/api/health`; all mocks rely on auto-registered `/health`
- Missing `healthResponse` → all mocks pass a custom health payload to `createMockApp()`
- Plaintext passwords + fake JWT → migrated to `mock-lib` `sign/verify` + Werkzeug PBKDF2 (commit `33615d9`)
- File size violations → split into smaller modules (commit `33615d9`)
- Dual error shapes → framework-injected errors unified to `err()` shape `{ success: false, message }`

See commits `2606119`, `3881fe5`, `6cca7aa`, `7db3dcd`, `33615d9` for the full history.

## Known Limitations

- Bun does not support TypeScript Project References (`references` field)
- `parseCliArgs()` does not support boolean flags (only key-value pairs)
