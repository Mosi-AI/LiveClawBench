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
