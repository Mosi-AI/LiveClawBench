/**
 * Doc-search mock service — Browser Mock Portal with FTS5 search
 *
 * Port of the Python browser_mock_server.py to Bun + Hono.
 * Provides full-text search over a documents database with FTS5 + BM25,
 * JSONL access logging for verifier scoring (20% weight), and HTML rendering.
 *
 * Endpoints: GET /, GET /health, GET /search, GET /docs/{slug}
 * Database: SQLite with FTS5 (porter unicode61 tokenizer), per-task SQL seeding
 * Access log: JSONL with home/search/click/page events
 */

import { createMockApp, createRoute, startServer, parseCliArgs, err } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { z } from "zod";
import { createDbState, initDatabase, validateDocumentRow } from "./db/init";
import { createConfigState, loadDynamicConfig } from "./db/config";
import { createLogState, writeEvent, initAccessLog } from "./log/access";
import { renderHome } from "./render/home";
import { renderSearch } from "./render/search";
import { renderDoc } from "./render/doc";
import { renderNotFound } from "./render/not-found";
import { tokenize, buildMatchQuery } from "./query/tokenizer";
import type { SearchResult } from "./types";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDocSearchApp(options?: { dbPath?: string; logPath?: string; dataDir?: string }): MockAppV2 {
  const cliArgs = parseCliArgs();
  const OUTPUT_BASE = `${process.env.HOME ?? "/home/node"}/.openclaw/output`;

  const DB_PATH = options?.dbPath ?? cliArgs.database ?? process.env.BROWSER_MOCK_DB_PATH ?? `${OUTPUT_BASE}/browser_mock_documents.sqlite`;
  const LOG_PATH = options?.logPath ?? cliArgs.log ?? process.env.BROWSER_MOCK_ACCESS_LOG ?? `${OUTPUT_BASE}/browser_mock_access.jsonl`;
  const DATA_DIR = options?.dataDir ?? process.env.BROWSER_MOCK_DATA_DIR ?? "/opt/mock/data";
  const SQL_PATH = `${DATA_DIR}/documents.sql`;

  // Per-instance state (isolated across createDocSearchApp() calls)
  const dbState = createDbState(DB_PATH, SQL_PATH);
  const configState = createConfigState();
  const logState = createLogState(LOG_PATH);

  // Session counter (process-local, resets on restart)
  let searchCounter = 0;

  const mockApp = createMockApp({
    name: "doc-search",
    port: 8123,
    openApi: {
      enabled: true,
      title: "Doc Search Mock API",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  // Sentinel route for binary isolation verification
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/doc-search",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.boolean() }),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  // GET / — Home page
  app.page("/", (c) => {
    if (!writeEvent(logState, { event: "home", path: c.req.path })) {
      return c.json(err("access log unavailable"), 500);
    }
    return c.html(renderHome(configState.metadata, configState.queryExamples));
  });

  // GET /search — Search results page
  app.page("/search", (c) => {
    if (!dbState.db) return c.json(err("Service not ready"), 503);
    const query = c.req.query("q") ?? "";
    const path = c.req.path;

    // Tokenize and search
    let results = [];
    const tokens = tokenize(query);

    if (tokens.length > 0) {
      const matchQuery = buildMatchQuery(tokens);
      const stmt = dbState.db.query(`
        SELECT d.*, bm25(documents_fts, 10.0, 6.0, 2.0, 3.0) AS rank_score
        FROM documents_fts
        JOIN documents d ON d.rowid = documents_fts.rowid
        WHERE documents_fts MATCH ?
        ORDER BY rank_score ASC,
                 CASE d.reliability WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                 d.title ASC
        LIMIT 8
      `);
      results = stmt.all(matchQuery).map((row) => validateDocumentRow(row));
    } else {
      // Empty query: return top documents sorted by reliability then title
      const stmt = dbState.db.query(`
        SELECT *
        FROM documents
        ORDER BY CASE reliability WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                 title ASC
        LIMIT 8
      `);
      results = stmt.all().map((row) => validateDocumentRow(row));
    }

    // Generate session ID
    searchCounter++;
    const sid = `search_${String(searchCounter).padStart(4, "0")}`;

    // Build search results for JSONL log
    const logResults: SearchResult[] = results.map((doc, idx) => ({
      rank: idx + 1,
      doc_id: doc.id,
      slug: doc.slug,
    }));

    // Write search event
    if (!writeEvent(logState, {
      event: "search",
      sid,
      path,
      query,
      results: logResults,
    })) {
      return c.json(err("access log unavailable"), 500);
    }

    return c.html(renderSearch(configState.metadata, query, results, sid));
  });

  // GET /docs/:slug — Document page
  app.page("/docs/:slug", (c) => {
    if (!dbState.db) return c.json(err("Service not ready"), 503);
    const slug = c.req.param("slug");
    const sid = c.req.query("sid") ?? "";
    const rank = c.req.query("rank") ?? "";
    const path = c.req.path;

    // Look up document by slug
    const stmt = dbState.db.query("SELECT * FROM documents WHERE slug = ?");
    const rawDoc = stmt.get(slug!);
    const doc = rawDoc ? validateDocumentRow(rawDoc) : undefined;

    if (!doc) {
      return c.html(renderNotFound(configState.metadata), 404);
    }

    // Write click event (only if sid is non-empty)
    if (sid) {
      if (!writeEvent(logState, {
        event: "click",
        sid,
        rank,
        path,
        doc_id: doc.id,
        slug: doc.slug,
      })) {
        return c.json(err("access log unavailable"), 500);
      }
    }

    // Always write page event for successful document views
    if (!writeEvent(logState, {
      event: "page",
      sid,
      rank,
      path,
      doc_id: doc.id,
      slug: doc.slug,
    })) {
      return c.json(err("access log unavailable"), 500);
    }

    return c.html(renderDoc(configState.metadata, doc, sid, rank));
  });

  return {
    ...mockApp,
    seed: async () => {
      await initDatabase(dbState);
      initAccessLog(logState);
      loadDynamicConfig(configState, dbState);
      console.log(`mock-doc-search: DB=${DB_PATH}, LOG=${LOG_PATH}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const app = createDocSearchApp();
  startServer(app);
}
