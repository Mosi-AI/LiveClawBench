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

API documentation is auto-generated as OpenAPI 3.1 specs in `dist/openapi/*.json`. Run `bun run generate-openapi` to regenerate after route changes.

### Why only shop and doc-search have internal docs

`docs/shop-internal.md` and `docs/doc-search-internal.md` document implementation details that are not captured by the OpenAPI spec (e.g., search algorithm behavior, FTS5 schema, JSONL access log format). The other three mocks — airline, email, and todolist — are currently **stubs** that expose only the sentinel route (`/__mock_sentinel__/<name>`) and `GET /health`. They exist in the binary map so that multi-service tasks can reference them, but they have no business logic worth documenting beyond the auto-generated spec.

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
BROWSER_MOCK_DATA_DIR=tasks/mixed-tool-memory/environment/browser_mock_sidecar \
  bun run mocks/doc-search/src/index.ts --port 3001
```

**Usage notes:**
- Shop writes order/cart state to a JSON file under `MOCK_DATA_DIR` (atomic write via `json-store.ts`). If the directory does not exist, the mock creates it.
- Doc-search seeds its SQLite FTS5 index from `documents.sql` on first startup; subsequent restarts reuse the existing database unless the file is deleted.
- All mocks expose `GET /health` and `GET /__mock_sentinel__/<name>` for orchestration health checks.

## Negative-Path Testing

The Layer 2 test specification in `docs/tests/negative-paths-reference.md` documents 16 targeted fail-fast checks against shop and doc-search. Layer 1 `bun:test` suites already provide executable negative-path coverage: shop has 39 tests in `mocks/shop/src/index.test.ts` and doc-search has 18 tests in `mocks/doc-search/src/index.test.ts`. Run them with `bun test`.
