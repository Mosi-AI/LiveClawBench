# Doc-Search Internal Documentation

This document covers implementation details of the `mock-doc-search` service that are not part of the public API surface. For API routes and request/response schemas, see the auto-generated OpenAPI spec at `dist/openapi/doc-search.json`.

---

## JSONL Access Log Schema

Every user interaction is appended to a JSONL file (`BROWSER_MOCK_ACCESS_LOG`, default `~/.openclaw/output/browser_mock_access.jsonl`).

### Event Types

#### `home`
Recorded on every visit to `GET /`.

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Event type — always `"home"` |
| `path` | string | Request path |

```json
{ "event": "home", "path": "/" }
```

#### `search`
Recorded on every `GET /search` request.

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Event type — always `"search"` |
| `sid` | string | Search session ID (e.g. `search_0001`) |
| `path` | string | Full request path including query string |
| `query` | string | Raw search query |
| `results` | `SearchResult[]` | Ranked result list |

`SearchResult` fields:

| Field | Type | Description |
|-------|------|-------------|
| `rank` | number | 1-based position in result list |
| `doc_id` | string | Document `id` |
| `slug` | string | Document `slug` |

```json
{
  "event": "search",
  "sid": "search_0001",
  "path": "/search?q=fts5",
  "query": "fts5",
  "results": [
    { "rank": 1, "doc_id": "doc_001", "slug": "intro-to-fts5" },
    { "rank": 2, "doc_id": "doc_002", "slug": "bm25-scoring" }
  ]
}
```

#### `click`
Recorded when a user clicks a search result link (non-empty `sid`).

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Event type — always `"click"` |
| `sid` | string | Search session ID |
| `rank` | string | Result rank as a string (from query param) |
| `path` | string | Full request path including query string |
| `doc_id` | string | Document `id` |
| `slug` | string | Document `slug` |

```json
{
  "event": "click",
  "sid": "search_0001",
  "rank": "2",
  "path": "/docs/bm25-scoring?sid=search_0001&rank=2",
  "doc_id": "doc_002",
  "slug": "bm25-scoring"
}
```

#### `page`
Recorded on every successful `GET /docs/:slug` view.

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Event type — always `"page"` |
| `sid` | string | Search session ID (empty if direct navigation) |
| `rank` | string | Result rank as a string (empty if direct navigation) |
| `path` | string | Full request path including query string |
| `doc_id` | string | Document `id` |
| `slug` | string | Document `slug` |

```json
{
  "event": "page",
  "sid": "search_0001",
  "rank": "2",
  "path": "/docs/bm25-scoring?sid=search_0001&rank=2",
  "doc_id": "doc_002",
  "slug": "bm25-scoring"
}
```

---

## Database Schema

### documents

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  reliability TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  owner TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL
);
```

### documents_fts (FTS5 virtual table)

```sql
CREATE VIRTUAL TABLE documents_fts USING fts5(
  title, body, summary, tags,
  content='documents',
  content_rowid='rowid',
  tokenize='porter unicode61'
);
```

### metadata

```sql
CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### query_examples

```sql
CREATE TABLE query_examples (
  query TEXT NOT NULL,
  position INTEGER NOT NULL
);
```

---

## Search Algorithm

### BM25 Ranking

The FTS5 query uses BM25 with the following column weights:

| Column | Weight |
|--------|--------|
| `title` | `10.0` |
| `body` | `6.0` |
| `summary` | `2.0` |
| `tags` | `3.0` |

```sql
SELECT d.*, bm25(documents_fts, 10.0, 6.0, 2.0, 3.0) AS rank_score
FROM documents_fts
JOIN documents d ON d.rowid = documents_fts.rowid
WHERE documents_fts MATCH ?
ORDER BY rank_score ASC,
         CASE d.reliability WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         d.title ASC
LIMIT 8
```

> Lower `rank_score` = more relevant (BM25 ascending).

### Match Query Construction

Query text is normalized (lowercase, alphanumeric-only), tokenized on whitespace, deduplicated, and rendered as:

```
"token1"* OR "token2"* OR ...
```

Wildcard suffix (`*`) enables prefix matching on each token.

### Reliability Tie-Breaker

When BM25 scores are equal or the query is empty, results are sorted by:
1. `reliability`: `high` → `medium` → everything else
2. `title`: alphabetical ascending

---

## Configuration

CLI arguments take precedence over environment variables, which take precedence over defaults.

### CLI Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--database <path>` | SQLite database file path | see below |
| `--log <path>` | JSONL access log file path | see below |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_MOCK_DB_PATH` | `~/.openclaw/output/browser_mock_documents.sqlite` | SQLite database path |
| `BROWSER_MOCK_ACCESS_LOG` | `~/.openclaw/output/browser_mock_access.jsonl` | JSONL access log path |
| `BROWSER_MOCK_DATA_DIR` | `/opt/mock/data` | Directory containing `documents.sql` seed file |

### Precedence

1. `--database <path>` / `--log <path>` (CLI argument)
2. `BROWSER_MOCK_DB_PATH` / `BROWSER_MOCK_ACCESS_LOG` (environment variable)
3. `~/.openclaw/output/browser_mock_documents.sqlite` / `~/.openclaw/output/browser_mock_access.jsonl` (default)

---

## Data Types

### Document

```typescript
interface Document {
  id: string;
  slug: string;
  title: string;
  kind: string;
  status: string;
  reliability: string;
  updated_at: string;
  owner: string;
  summary: string;
  body: string;
  tags: string;
}
```

### SearchResult (in JSONL log)

```typescript
interface SearchResult {
  rank: number;
  doc_id: string;
  slug: string;
}
```
