# Task 10b: Doc-Search API & Access Log Schema Reference

## API Endpoints

### GET /

Home page with search form and suggested queries.

**Response**: HTML page with metadata-driven title, description, search placeholder.

**JSONL Event**:
```json
{"event": "home", "path": "/"}
```

### GET /health

Health check endpoint (provided by mock-lib default).

**Response**:
```json
{"status": "healthy", "service": "doc-search"}
```

### GET /search?q={query}

Full-text search using FTS5 + BM25 ranking.

**Query Parameters**: `q` (search query string)

**Response**: HTML results page with ranked document cards.

**JSONL Event**:
```json
{
  "event": "search",
  "sid": "search_0001",
  "path": "/search?q=example",
  "query": "example",
  "results": [
    {"rank": 1, "doc_id": "doc-001", "slug": "example-doc"},
    {"rank": 2, "doc_id": "doc-002", "slug": "another-doc"}
  ]
}
```

### GET /docs/{slug}?sid={sid}&rank={rank}

Document detail page.

**Path Parameters**: `slug` (document slug)
**Query Parameters**: `sid` (search session ID), `rank` (result rank number)

**Response**: HTML document page with metadata pills, body paragraphs, and tags.

**JSONL Events**:
1. Click event (only when sid is non-empty):
```json
{
  "event": "click",
  "sid": "search_0001",
  "rank": "1",
  "path": "/docs/example-doc?sid=search_0001&rank=1",
  "doc_id": "doc-001",
  "slug": "example-doc"
}
```

2. Page event (always):
```json
{
  "event": "page",
  "sid": "search_0001",
  "rank": "1",
  "path": "/docs/example-doc?sid=search_0001&rank=1",
  "doc_id": "doc-001",
  "slug": "example-doc"
}
```

## JSONL Access Log Schema

### File Location
Configured via CLI `--log`, env `BROWSER_MOCK_ACCESS_LOG`, or default
`${HOME}/.openclaw/output/browser_mock_access.jsonl`.

### Event Types

| Event | When | Required Fields |
|-------|------|----------------|
| `home` | User visits `/` | `event`, `path` |
| `search` | User searches | `event`, `sid`, `path`, `query`, `results` |
| `click` | User clicks result link | `event`, `sid`, `rank`, `path`, `doc_id`, `slug` |
| `page` | Document page rendered | `event`, `sid`, `rank`, `path`, `doc_id`, `slug` |

### Session ID Format
`search_XXXX` — 4-digit zero-padded incrementing counter (process-local, resets on restart).

Generated via: `search_${String(++searchCounter).padStart(4, "0")}`

### Verifier Dependency

The `browser_trace_score()` function in `deterministic_checks.py` reads the JSONL log and:
1. Checks for `event == "search"` entries (must exist)
2. Checks for `event in {"click", "page"}` with matching `doc_id`
3. Scores as: `browser_trace: 0.20` weight in overall task score

## Database Schema

### FTS5 Index
```sql
CREATE VIRTUAL TABLE documents_fts USING fts5(
  title, summary, body, tags,
  content='documents',
  tokenize='porter unicode61'
);
```

### BM25 Weights
```sql
bm25(documents_fts, 10.0, 6.0, 2.0, 3.0)
-- title=10.0, summary=6.0, body=2.0, tags=3.0
```

### Dynamic Configuration Tables
- `metadata`: key-value pairs (site_title, home_title, home_description, search_placeholder)
- `query_examples`: ordered list of suggested queries (position ASC)

## Per-Task SQL Sidecars

Each doc-search task has its own `documents.sql` with different data:

| Task | Site Title | Documents |
|------|-----------|-----------|
| `conflict-repair-acb` | "Speculative Decoding Research Hub" | Custom research docs |
| `mixed-tool-memory` | Different title | Different documents |

The SQL file is staged at `/opt/mock/data/documents.sql` via Dockerfile COPY.
The binary reads this file at startup (`initDatabase()`) and fails fast with `process.exit(1)` if missing.

## CLI Arguments

| Flag | Env Var | Default | Purpose |
|------|---------|---------|---------|
| `--port` | `PORT` | 8123 | Server port |
| `--database` | `BROWSER_MOCK_DB_PATH` | `${HOME}/.openclaw/output/browser_mock_documents.sqlite` | SQLite database path |
| `--log` | `BROWSER_MOCK_ACCESS_LOG` | `${HOME}/.openclaw/output/browser_mock_access.jsonl` | JSONL access log path |
