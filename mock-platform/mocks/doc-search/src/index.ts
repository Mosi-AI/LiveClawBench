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

import { createMockApp, createRoute, startServer } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { Database } from "bun:sqlite";
import { mkdirSync, unlinkSync, appendFileSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface SearchResult {
  rank: number;
  doc_id: string;
  slug: string;
}

interface Metadata {
  site_title: string;
  home_title: string;
  home_description: string;
  search_placeholder: string;
}

// JSONL event types
interface HomeEvent {
  event: "home";
  path: string;
}

interface SearchEvent {
  event: "search";
  sid: string;
  path: string;
  query: string;
  results: SearchResult[];
}

interface ClickEvent {
  event: "click";
  sid: string;
  rank: string;
  path: string;
  doc_id: string;
  slug: string;
}

interface PageEvent {
  event: "page";
  sid: string;
  rank: string;
  path: string;
  doc_id: string;
  slug: string;
}

type AccessEvent = HomeEvent | SearchEvent | ClickEvent | PageEvent;

// ---------------------------------------------------------------------------
// Configuration — CLI args override env vars override defaults
// ---------------------------------------------------------------------------

function parseCliArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      const key = args[i].slice(2);
      result[key] = args[i + 1];
      i++;
    } else if (args[i].includes("=")) {
      const eqIdx = args[i].indexOf("=");
      const key = args[i].slice(2, eqIdx);
      result[key] = args[i].slice(eqIdx + 1);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Query helpers — faithful ports of Python normalize/tokenize/build_match_query
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(text: string): string[] {
  const normalized = normalize(text);
  if (!normalized) return [];
  return normalized.split(" ").filter((t) => t.length > 0);
}

function buildMatchQuery(tokens: string[]): string {
  // Deduplicate while preserving first occurrence order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }
  // Render each token as "token"* (wildcard suffix)
  return unique.map((t) => `"${t}"*`).join(" OR ");
}

// ---------------------------------------------------------------------------
// HTML rendering — faithful port of Python page() and render_* functions
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderPage(metadata: Metadata, title: string, bodyContent: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escHtml(title)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.meta { color: #666; font-size: 0.9em; margin: 4px 0; }
.pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; margin: 2px; background: #e8e8e8; }
.summary { color: #444; font-style: italic; }
.doc-card { border: 1px solid #ddd; padding: 12px; margin: 8px 0; border-radius: 6px; }
.result-title { margin: 4px 0; }
.open-link { color: #0066cc; }
.doc-body p { line-height: 1.6; }
form { margin: 16px 0; }
input[type=text] { padding: 6px; width: 60%; }
button { padding: 6px 14px; }
</style>
</head>
<body>
<p class="meta">${escHtml(metadata.site_title)}</p>
${bodyContent}
</body>
</html>`;
}

function renderHome(metadata: Metadata, queryExamples: string[]): string {
  const queryListHtml = queryExamples.map((q) => `<li><code>${escHtml(q)}</code></li>`).join("\n");

  return renderPage(metadata, metadata.home_title, `
<h1>${escHtml(metadata.home_title)}</h1>
<p>${escHtml(metadata.home_description)}</p>
<form action="/search" method="get">
<input type="text" name="q" placeholder="${escHtml(metadata.search_placeholder)}">
<button type="submit">Search</button>
</form>
<p>Use the search page, inspect result cards, and open result links to review individual pages.</p>
<h2>Suggested queries</h2>
<ul>
${queryListHtml}
</ul>`);
}

function renderSearch(metadata: Metadata, query: string, results: Array<Document & { rank_score?: number }>, sid: string): string {
  const resultCards = results.map((doc, idx) => {
    const rank = idx + 1;
    const pills = [
      `<span class="pill">${escHtml(doc.status)}</span>`,
      `<span class="pill">${escHtml(doc.reliability)}</span>`,
      `<span class="pill">${escHtml(doc.kind)}</span>`,
      `<span class="pill">${escHtml(doc.updated_at)}</span>`,
    ].join(" ");

    return `<div class="doc-card">
<p class="meta">Result ${rank}</p>
<h2 class="result-title">${escHtml(doc.title)}</h2>
${pills}
<p class="summary">${escHtml(doc.summary)}</p>
<a class="open-link" href="/docs/${encodeURIComponent(doc.slug)}?sid=${encodeURIComponent(sid)}&rank=${rank}">Open result</a>
</div>`;
  }).join("\n");

  return renderPage(metadata, `Search: ${query}`, `
<h1>Search Results</h1>
<p class="meta">Query: <code>${escHtml(query)}</code></p>
<p class="meta">Search session: <code>${escHtml(sid)}</code></p>
<form action="/search" method="get">
<input type="text" name="q" value="${escHtml(query)}">
<button type="submit">Search</button>
</form>
${results.length > 0 ? resultCards : "<p>No documents matched this query.</p>"}
<p><a href="/">Back to home</a></p>`);
}

function renderDoc(metadata: Metadata, doc: Document, sid: string, rank: string): string {
  const pills = [
    `source: ${escHtml(doc.id)}`,
    `status: ${escHtml(doc.status)}`,
    `reliability: ${escHtml(doc.reliability)}`,
    `kind: ${escHtml(doc.kind)}`,
    `updated: ${escHtml(doc.updated_at)}`,
    `owner: ${escHtml(doc.owner)}`,
  ].map((p) => `<span class="pill">${p}</span>`).join("\n");

  let sessionRow = "";
  if (sid) {
    sessionRow = `<p class="meta">search session: ${escHtml(sid)}</p>
<p class="meta">rank: ${escHtml(rank || "?")}</p>`;
  }

  // Split body on double newlines into paragraphs
  // SQL seeds store literal \n\n escapes — normalize before splitting
  const normalizedBody = doc.body.replace(/\\n/g, "\n");
  const paragraphs = normalizedBody.split("\n\n").map((p) => `<p>${escHtml(p.trim())}</p>`).join("\n");

  // Split tags on pipe
  const tagPills = doc.tags.split("|").map((t) => t.trim()).filter((t) => t).map((t) => `<span class="pill">${escHtml(t)}</span>`).join(" ");

  return renderPage(metadata, doc.title, `
<h1 class="doc-title">${escHtml(doc.title)}</h1>
${pills}
${sessionRow}
<p class="summary"><strong>Summary:</strong> ${escHtml(doc.summary)}</p>
<div class="doc-body">
${paragraphs}
</div>
<p class="meta">Tags: ${tagPills}</p>
<p><a href="/">Back to home</a></p>`);
}

function renderNotFound(metadata: Metadata): string {
  return renderPage(metadata, "Not Found", "<h1>Not Found</h1>");
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDocSearchApp(): MockAppV2 {
  const cliArgs = parseCliArgs();
  const OUTPUT_BASE = `${process.env.HOME ?? "/home/node"}/.openclaw/output`;

  const DB_PATH = cliArgs.database ?? process.env.BROWSER_MOCK_DB_PATH ?? `${OUTPUT_BASE}/browser_mock_documents.sqlite`;
  const LOG_PATH = cliArgs.log ?? process.env.BROWSER_MOCK_ACCESS_LOG ?? `${OUTPUT_BASE}/browser_mock_access.jsonl`;
  const DATA_DIR = process.env.BROWSER_MOCK_DATA_DIR ?? "/opt/mock/data";
  const SQL_PATH = `${DATA_DIR}/documents.sql`;

  // Session counter (process-local, resets on restart)
  let searchCounter = 0;

  // Dynamic config loaded from DB at startup
  let metadata: Metadata = {
    site_title: "Browser Portal",
    home_title: "Browser Portal",
    home_description: "Search this portal for documents.",
    search_placeholder: "Search for documents",
  };
  let queryExamples: string[] = [];

  // SQLite database (opened once, reused)
  let db: Database | null = null;

  // ---------------------------------------------------------------------------
  // Database initialization
  // ---------------------------------------------------------------------------

  function initDatabase(): void {
    // Ensure output directory exists
    const outputDir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.error(`mock-doc-search: FATAL: cannot create database directory: ${outputDir}`, err);
      process.exit(1);
    }

    // Delete existing DB to start fresh (matches Python behavior)
    try {
      unlinkSync(DB_PATH);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        console.error(`mock-doc-search: FATAL: cannot remove stale database: ${DB_PATH}`, err);
        process.exit(1);
      }
    }

    db = new Database(DB_PATH, { create: true });

    // Load and execute SQL seed file — fail fast if missing
    if (!existsSync(SQL_PATH)) {
      console.error(`mock-doc-search: FATAL: SQL seed file not found at ${SQL_PATH}`);
      console.error(`mock-doc-search: Ensure the per-task asset (documents.sql) is staged at /opt/mock/data/`);
      process.exit(1);
    }
    const sql = readFileSync(SQL_PATH, "utf-8");
    db.exec(sql);
    console.log(`mock-doc-search: initialized DB from ${SQL_PATH}`);

    // Load dynamic configuration from metadata and query_examples tables
    loadDynamicConfig();
  }

  function assertDb(): Database {
    if (!db) {
      throw new Error("Database not initialized");
    }
    return db;
  }

  function validateDocumentRow(row: unknown): Document {
    if (!row || typeof row !== "object") {
      throw new Error("Invalid document row: expected object");
    }
    const r = row as Record<string, unknown>;
    const required = ["id", "slug", "title", "kind", "status", "reliability", "updated_at", "owner", "summary", "body", "tags"] as const;
    for (const key of required) {
      if (typeof r[key] !== "string") {
        throw new Error(`Document row missing required field "${key}"`);
      }
    }
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      kind: r.kind as string,
      status: r.status as string,
      reliability: r.reliability as string,
      updated_at: r.updated_at as string,
      owner: r.owner as string,
      summary: r.summary as string,
      body: r.body as string,
      tags: r.tags as string,
    };
  }

  function loadDynamicConfig(): void {
    const database = assertDb();
    try {
      const metaRows = database.query("SELECT key, value FROM metadata").all() as Array<{ key: string; value: string }>;
      const metaMap = new Map(metaRows.map((r) => [r.key, r.value]));
      metadata = {
        site_title: metaMap.get("site_title") ?? metadata.site_title,
        home_title: metaMap.get("home_title") ?? metadata.home_title,
        home_description: metaMap.get("home_description") ?? metadata.home_description,
        search_placeholder: metaMap.get("search_placeholder") ?? metadata.search_placeholder,
      };

      const exampleRows = database.query("SELECT query FROM query_examples ORDER BY position ASC").all() as Array<{ query: string }>;
      queryExamples = exampleRows.map((r) => r.query);
    } catch (err) {
      console.error("mock-doc-search: FATAL: failed to load dynamic config from database", err);
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // JSONL access log
  // ---------------------------------------------------------------------------

  /** Set to true after the first disk write failure; skips subsequent write attempts. */
  let logDiskDegraded = false;

  function writeEvent(event: AccessEvent): boolean {
    if (logDiskDegraded) return false;
    const line = JSON.stringify(event) + "\n";
    try {
      appendFileSync(LOG_PATH, line);
      return true;
    } catch (err) {
      console.error("mock-doc-search: access log write failed, entering degraded mode", err);
      logDiskDegraded = true;
      return false;
    }
  }

  function initAccessLog(): void {
    const logDir = LOG_PATH.substring(0, LOG_PATH.lastIndexOf("/"));
    try {
      mkdirSync(logDir, { recursive: true });
    } catch (err) {
      console.error(`mock-doc-search: FATAL: cannot create access-log directory: ${logDir}`, err);
      process.exit(1);
    }
    // Truncate/create the log file (matches Python `: > "$BROWSER_MOCK_LOG"`)
    try {
      writeFileSync(LOG_PATH, "");
    } catch (err) {
      console.error(`mock-doc-search: FATAL: cannot create access log file: ${LOG_PATH}`, err);
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // App creation
  // ---------------------------------------------------------------------------

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
    if (!writeEvent({ event: "home", path: c.req.path })) {
      return c.json({ error: "access log unavailable" }, 500);
    }
    return c.html(renderHome(metadata, queryExamples));
  });

  // GET /search — Search results page
  app.page("/search", (c) => {
    if (!db) return c.json({ error: "Service not ready" }, 503);
    const query = c.req.query("q") ?? "";
    const path = c.req.path + (c.req.url.includes("?") ? "?" + c.req.url.split("?")[1] : "");

    // Tokenize and search
    let results: Array<Document & { rank_score?: number }> = [];
    const tokens = tokenize(query);

    if (tokens.length > 0) {
      const matchQuery = buildMatchQuery(tokens);
      const stmt = db.query(`
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
      const stmt = db.query(`
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
    if (!writeEvent({
      event: "search",
      sid,
      path,
      query,
      results: logResults,
    })) {
      return c.json({ error: "access log unavailable" }, 500);
    }

    return c.html(renderSearch(metadata, query, results, sid));
  });

  // GET /docs/:slug — Document page
  app.page("/docs/:slug", (c) => {
    if (!db) return c.json({ error: "Service not ready" }, 503);
    const slug = c.req.param("slug");
    const sid = c.req.query("sid") ?? "";
    const rank = c.req.query("rank") ?? "";
    const path = c.req.path + (c.req.url.includes("?") ? "?" + c.req.url.split("?")[1] : "");

    // Look up document by slug
    const stmt = db.query("SELECT * FROM documents WHERE slug = ?");
    const rawDoc = stmt.get(slug!);
    const doc = rawDoc ? validateDocumentRow(rawDoc) : undefined;

    if (!doc) {
      return c.html(renderNotFound(metadata), 404);
    }

    // Write click event (only if sid is non-empty)
    if (sid) {
      if (!writeEvent({
        event: "click",
        sid,
        rank,
        path,
        doc_id: doc.id,
        slug: doc.slug,
      })) {
        return c.json({ error: "access log unavailable" }, 500);
      }
    }

    // Always write page event for successful document views
    if (!writeEvent({
      event: "page",
      sid,
      rank,
      path,
      doc_id: doc.id,
      slug: doc.slug,
    })) {
      return c.json({ error: "access log unavailable" }, 500);
    }

    return c.html(renderDoc(metadata, doc, sid, rank));
  });

  return {
    ...mockApp,
    seed: () => {
      initAccessLog();
      initDatabase();
      console.log(`mock-doc-search: DB=${DB_PATH}, LOG=${LOG_PATH}`);
    },
  } as MockAppV2 & { seed(): void };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const app = createDocSearchApp();
  startServer(app, {
    seed: (app as unknown as { seed(): void }).seed,
  });
}
