import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, mkdirSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocSearchApp } from "./index";
import type { OpenAPIApp } from "mock-lib";

// Path to the checked-in SQL seed fixture
const SQL_PATH = join(
  import.meta.dir,
  "../../../../tasks/mixed-tool-memory/environment/documents.sql",
);

describe("createDocSearchApp — Layer 1 route tests", () => {
  let tmpDir: string;
  let dataDir: string;
  let outputDir: string;
  let docSearch: ReturnType<typeof createDocSearchApp>;
  let app: OpenAPIApp;

  beforeEach(() => {
    // Create fresh temp directories for each test
    tmpDir = mkdtempSync(join(tmpdir(), "doc-search-test-"));
    dataDir = join(tmpDir, "data");
    outputDir = join(tmpDir, "output");
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    // Copy SQL seed to data dir
    const sqlContent = readFileSync(SQL_PATH, "utf-8");
    Bun.write(join(dataDir, "documents.sql"), sqlContent);

    // Set env vars BEFORE creating the app
    process.env.HOME = tmpDir;
    process.env.BROWSER_MOCK_DB_PATH = join(outputDir, "browser_mock_documents.sqlite");
    process.env.BROWSER_MOCK_ACCESS_LOG = join(outputDir, "browser_mock_access.jsonl");
    process.env.BROWSER_MOCK_DATA_DIR = dataDir;

    docSearch = createDocSearchApp();
    app = docSearch.app;
    docSearch.seed!();
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    delete process.env.HOME;
    delete process.env.BROWSER_MOCK_DB_PATH;
    delete process.env.BROWSER_MOCK_ACCESS_LOG;
    delete process.env.BROWSER_MOCK_DATA_DIR;
  });

  // ---------------------------------------------------------------------------
  // Sentinel
  // ---------------------------------------------------------------------------

  test("GET /__mock_sentinel__/doc-search returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/doc-search");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Home page
  // ---------------------------------------------------------------------------

  test("GET / returns HTML home page", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("Speculative Decoding Reference Portal");
    expect(text).toContain("Search");
  });

  test("GET / records home event in JSONL log", async () => {
    await app.request("/");

    const logContent = readFileSync(process.env.BROWSER_MOCK_ACCESS_LOG!, "utf-8");
    const lines = logContent.trim().split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);

    const event = JSON.parse(lines[lines.length - 1]);
    expect(event.event).toBe("home");
    expect(event.path).toBe("/");
  });

  // ---------------------------------------------------------------------------
  // Search page
  // ---------------------------------------------------------------------------

  test("GET /search?q=fts5 returns HTML search results", async () => {
    const res = await app.request("/search?q=fts5");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("Search Results");
    expect(text).toContain("Query:");
  });

  test("GET /search (empty q) returns HTML with top documents", async () => {
    const res = await app.request("/search");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("Search Results");
    // Empty query should still show documents sorted by reliability
    expect(text).toContain("Result 1");
  });

  test("GET /search?q=test records search event with sid and results", async () => {
    await app.request("/search?q=speculative");

    const logContent = readFileSync(process.env.BROWSER_MOCK_ACCESS_LOG!, "utf-8");
    const lines = logContent.trim().split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);

    const event = JSON.parse(lines[lines.length - 1]);
    expect(event.event).toBe("search");
    expect(event).toHaveProperty("sid");
    expect(event.sid).toMatch(/^search_\d{4}$/);
    expect(event.query).toBe("speculative");
    expect(event).toHaveProperty("results");
    expect(Array.isArray(event.results)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Document page
  // ---------------------------------------------------------------------------

  test("GET /docs/:slug returns HTML doc page for valid slug", async () => {
    const res = await app.request("/docs/speculative-decoding-exactness-note");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("Exactness Comes From Target Verification");
  });

  test("GET /docs/unknown-slug returns 404 HTML", async () => {
    const res = await app.request("/docs/unknown-slug");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("Not Found");
  });

  test("GET /docs/:slug?sid=xxx&rank=1 records click and page events", async () => {
    await app.request("/docs/speculative-decoding-exactness-note?sid=search_0001&rank=1");

    const logContent = readFileSync(process.env.BROWSER_MOCK_ACCESS_LOG!, "utf-8");
    const lines = logContent.trim().split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // Should have both click and page events
    const events = lines.map((l) => JSON.parse(l));
    const clickEvent = events.find((e) => e.event === "click");
    const pageEvent = events.find((e) => e.event === "page");

    expect(clickEvent).toBeDefined();
    expect(clickEvent.sid).toBe("search_0001");
    expect(clickEvent.rank).toBe("1");
    expect(clickEvent.slug).toBe("speculative-decoding-exactness-note");

    expect(pageEvent).toBeDefined();
    expect(pageEvent.sid).toBe("search_0001");
    expect(pageEvent.rank).toBe("1");
    expect(pageEvent.slug).toBe("speculative-decoding-exactness-note");
  });

  test("GET /docs/:slug without sid records only page event", async () => {
    await app.request("/docs/speculative-decoding-exactness-note");

    const logContent = readFileSync(process.env.BROWSER_MOCK_ACCESS_LOG!, "utf-8");
    const lines = logContent.trim().split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);

    const events = lines.map((l) => JSON.parse(l));
    const pageEvent = events.find((e) => e.event === "page");
    const clickEvent = events.find((e) => e.event === "click");

    expect(pageEvent).toBeDefined();
    expect(clickEvent).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 503 behavior when DB not initialized
  // ---------------------------------------------------------------------------

  test("GET /search returns 503 when DB is not initialized", async () => {
    // Create a new app without calling seed()
    const freshTmpDir = mkdtempSync(join(tmpdir(), "doc-search-no-seed-"));
    const freshDataDir = join(freshTmpDir, "data");
    const freshOutputDir = join(freshTmpDir, "output");
    mkdirSync(freshDataDir, { recursive: true });
    mkdirSync(freshOutputDir, { recursive: true });

    const oldHome = process.env.HOME;
    const oldDb = process.env.BROWSER_MOCK_DB_PATH;
    const oldLog = process.env.BROWSER_MOCK_ACCESS_LOG;
    const oldData = process.env.BROWSER_MOCK_DATA_DIR;

    process.env.HOME = freshTmpDir;
    process.env.BROWSER_MOCK_DB_PATH = join(freshOutputDir, "browser_mock_documents.sqlite");
    process.env.BROWSER_MOCK_ACCESS_LOG = join(freshOutputDir, "browser_mock_access.jsonl");
    process.env.BROWSER_MOCK_DATA_DIR = freshDataDir;

    const freshApp = createDocSearchApp();
    // Do NOT call seed() — db is null

    const res = await freshApp.app.request("/search?q=test");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "Service not ready" });

    const docRes = await freshApp.app.request("/docs/some-slug");
    expect(docRes.status).toBe(503);
    const docBody = await docRes.json();
    expect(docBody).toEqual({ error: "Service not ready" });

    // Home page should still work (does not need DB)
    const homeRes = await freshApp.app.request("/");
    expect(homeRes.status).toBe(200);

    // Cleanup
    try {
      rmSync(freshTmpDir, { recursive: true, force: true });
    } catch {}

    process.env.HOME = oldHome;
    process.env.BROWSER_MOCK_DB_PATH = oldDb;
    process.env.BROWSER_MOCK_ACCESS_LOG = oldLog;
    process.env.BROWSER_MOCK_DATA_DIR = oldData;
  });

  // ---------------------------------------------------------------------------
  // Degraded log handling
  // ---------------------------------------------------------------------------

  test("degraded log handling — returns 500 when log file is replaced by a directory", async () => {
    // Create a new app, seed it with a valid log file, then replace the
    // log file with a directory. appendFileSync to a directory path fails
    // with EISDIR, which triggers the degraded mode.
    const badTmpDir = mkdtempSync(join(tmpdir(), "doc-search-bad-"));
    const badDataDir = join(badTmpDir, "data");
    const badOutputDir = join(badTmpDir, "output");
    mkdirSync(badDataDir, { recursive: true });
    mkdirSync(badOutputDir, { recursive: true });

    // Copy SQL seed
    const sqlContent = readFileSync(SQL_PATH, "utf-8");
    Bun.write(join(badDataDir, "documents.sql"), sqlContent);

    const oldHome = process.env.HOME;
    const oldDb = process.env.BROWSER_MOCK_DB_PATH;
    const oldLog = process.env.BROWSER_MOCK_ACCESS_LOG;
    const oldData = process.env.BROWSER_MOCK_DATA_DIR;

    process.env.HOME = badTmpDir;
    process.env.BROWSER_MOCK_DB_PATH = join(badOutputDir, "browser_mock_documents.sqlite");
    const validLogPath = join(badOutputDir, "browser_mock_access.jsonl");
    process.env.BROWSER_MOCK_ACCESS_LOG = validLogPath;
    process.env.BROWSER_MOCK_DATA_DIR = badDataDir;

    // Create app and seed with valid log path
    const badApp = createDocSearchApp();
    badApp.seed!();

    // Verify the app works before breaking the log
    const okRes = await badApp.app.request("/");
    expect(okRes.status).toBe(200);

    // Now replace the log file with a directory — appendFileSync to a dir fails
    rmSync(validLogPath, { force: true });
    mkdirSync(validLogPath, { recursive: true });

    const res = await badApp.app.request("/");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "access log unavailable" });

    try {
      rmSync(badTmpDir, { recursive: true, force: true });
    } catch {}

    process.env.HOME = oldHome;
    process.env.BROWSER_MOCK_DB_PATH = oldDb;
    process.env.BROWSER_MOCK_ACCESS_LOG = oldLog;
    process.env.BROWSER_MOCK_DATA_DIR = oldData;
  });

  // ---------------------------------------------------------------------------
  // Search functionality
  // ---------------------------------------------------------------------------

  test("GET /search?q=exactness returns matching documents", async () => {
    const res = await app.request("/search?q=exactness");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Exactness Comes From Target Verification");
    expect(text).toContain("Search session:");
  });

  test("GET /search?q=nonexistent returns no results message", async () => {
    const res = await app.request("/search?q=xyznonexistent123");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("No documents matched this query");
  });

  // ---------------------------------------------------------------------------
  // Document content rendering
  // ---------------------------------------------------------------------------

  test("GET /docs/:slug renders document body and metadata", async () => {
    const res = await app.request("/docs/self-speculative-decoding-definition");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Self-Speculative Decoding Definition");
    expect(text).toContain("validated");
    expect(text).toContain("high");
    expect(text).toContain("inference-research");
    expect(text).toContain("Tags:");
  });

  test("GET /docs/:slug with sid and rank renders session info", async () => {
    const res = await app.request("/docs/speculative-decoding-speedup-rule?sid=search_0001&rank=2");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("search session: search_0001");
    expect(text).toContain("rank: 2");
  });

  // ---------------------------------------------------------------------------
  // Multiple sequential requests
  // ---------------------------------------------------------------------------

  test("sequential requests generate incrementing search session IDs", async () => {
    await app.request("/search?q=test1");
    await app.request("/search?q=test2");
    await app.request("/search?q=test3");

    const logContent = readFileSync(process.env.BROWSER_MOCK_ACCESS_LOG!, "utf-8");
    const lines = logContent.trim().split("\n").filter((l) => l.length > 0);
    const searchEvents = lines
      .map((l) => JSON.parse(l))
      .filter((e) => e.event === "search");

    expect(searchEvents.length).toBe(3);
    expect(searchEvents[0].sid).toBe("search_0001");
    expect(searchEvents[1].sid).toBe("search_0002");
    expect(searchEvents[2].sid).toBe("search_0003");
  });

  // ---------------------------------------------------------------------------
  // Health endpoint (from mock-lib)
  // ---------------------------------------------------------------------------

  test("GET /health returns healthy status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "healthy");
    expect(body).toHaveProperty("service", "doc-search");
  });
});
