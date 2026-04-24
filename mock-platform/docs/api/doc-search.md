# Doc-Search API Documentation

Full-text search mock service (`mock-doc-search`). Provides FTS5 search over a documents database with BM25 ranking and JSONL access logging.

> **Auto-generated OpenAPI spec:** `dist/openapi/doc-search.json` (produced by `bun run scripts/generate-openapi.ts`).
> The generated spec covers the sentinel route; HTML pages are intentionally excluded from OpenAPI documentation.

> **Note:** `GET /health` is inherited from `mock-lib` and returns `{ ok: true, status: "healthy", service: "doc-search" }`.

For implementation details (JSONL schema, database schema, search algorithm, configuration), see `docs/doc-search-internal.md`.
