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

All mock services use `createMockApp()` which automatically exposes:

- `GET /health` — returns `{ ok: true, status: "healthy", service: <name> }`
- `GET /__mock_sentinel__/<name>` — internal harbor readiness probe

### Migration Verification

Search parity between the legacy Python mock implementations and the current Bun+Hono versions was confirmed with 38/38 golden queries matching. FTS5/BM25 equivalence is inherent because both `bun:sqlite` and Python `sqlite3` bind the same system SQLite library with the FTS5 extension.

## Mock Services

| Service | Directory | Binary | Description |
|---------|-----------|--------|-------------|
| Shop | `mocks/shop/` | `mock-shop` | E-commerce: products, cart, orders, user profile, search |
| Doc-search | `mocks/doc-search/` | `mock-doc-search` | FTS5 full-text search with BM25 ranking, JSONL access logging |
| Airline | `mocks/airline/` | `mock-airline` | Flight booking, seat selection, baggage tracking |
| Email | `mocks/email/` | `mock-email` | Email inbox, compose, reply |
| Todolist | `mocks/todolist/` | `mock-todolist` | Task management |

See `docs/api/shop.md` and `docs/api/doc-search.md` for full endpoint documentation.

## Build Commands

```bash
# Build all mock binaries → dist/
bun run build

# Build per-task Docker images (requires base image first)
bun run build:images

# Run Layer 1 unit tests
bun test
```

## Configuration

- `config/task-binary-map.json` — Maps each task to its required mock binaries (stub vs implemented)
- `scripts/build-all.ts` — Builds all mock binaries
- `scripts/build-task-images.ts` — Creates per-task Docker images with correct binary set

## Development

Mock services read environment variables for data paths:

- Shop: `MOCK_PRODUCTS_PATH` (defaults to `/opt/mock/static/shop/products.json`), `MOCK_DATA_DIR`
- Doc-search: `BROWSER_MOCK_DATA_DIR`

Run a mock directly for local debugging:

```bash
bun run mocks/shop/src/index.tsx --port 3000
bun run mocks/doc-search/src/index.ts --port 3001
```

## Negative-Path Testing

The Layer 2 test specification in `docs/tests/negative-paths-reference.md` documents 16 targeted fail-fast checks against shop and doc-search. It is not executable and should be formalized into `bun:test` in a future PR.
