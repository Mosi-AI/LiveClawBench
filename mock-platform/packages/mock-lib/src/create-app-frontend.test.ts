import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createMockApp } from "./index";
import type { MockAppV2 } from "./index";

const TMP_DIR = join(import.meta.dir, ".tmp-frontend-test");

function setupFrontendDir(files: Record<string, string>): string {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const filePath = join(TMP_DIR, name);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, content);
  }
  return TMP_DIR;
}

afterAll(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
});

describe("createMockApp — frontendDir SPA serving", () => {
  test("serves index.html at root path", async () => {
    const frontendDir = setupFrontendDir({
      "index.html": "<html><body>SPA Root</body></html>",
    });

    const mockApp = createMockApp({
      name: "spa-test",
      frontendDir,
    });

    const res = await mockApp.app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("SPA Root");
  });

  test("serves static assets from frontendDir", async () => {
    const frontendDir = setupFrontendDir({
      "index.html": "<html><body>Root</body></html>",
      "assets/main.js": "console.log('app')",
    });

    const mockApp = createMockApp({
      name: "spa-test",
      frontendDir,
    });

    const res = await mockApp.app.request("/assets/main.js");
    expect(res.status).toBe(200);
    const js = await res.text();
    expect(js).toContain("console.log('app')");
  });

  test("SPA fallback serves index.html for deep links", async () => {
    const frontendDir = setupFrontendDir({
      "index.html": "<html><body>SPA Fallback</body></html>",
    });

    const mockApp = createMockApp({
      name: "spa-test",
      frontendDir,
    });

    const res = await mockApp.app.request("/search?query=test");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("SPA Fallback");
  });

  test("API routes take precedence over SPA fallback", async () => {
    const frontendDir = setupFrontendDir({
      "index.html": "<html><body>SPA</body></html>",
    });

    const mockApp = createMockApp({
      name: "spa-test",
      frontendDir,
      routes: (app) => {
        app.get("/api/data", (c) => c.json({ success: true, data: { value: 42 } }));
      },
    });

    // API route should return JSON, not index.html
    const apiRes = await mockApp.app.request("/api/data");
    expect(apiRes.status).toBe(200);
    const json = await apiRes.json();
    expect(json.success).toBe(true);
    expect(json.data.value).toBe(42);

    // Non-API route should return SPA index.html
    const spaRes = await mockApp.app.request("/some/deep/link");
    expect(spaRes.status).toBe(200);
    const html = await spaRes.text();
    expect(html).toContain("SPA");
  });

  test("/health endpoint takes precedence over SPA fallback", async () => {
    const frontendDir = setupFrontendDir({
      "index.html": "<html><body>SPA</body></html>",
    });

    const mockApp = createMockApp({
      name: "spa-test",
      frontendDir,
      healthResponse: { status: "healthy", service: "spa-test" },
    });

    const res = await mockApp.app.request("/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("healthy");
  });

  test("works without frontendDir (no SPA serving)", async () => {
    const mockApp = createMockApp({
      name: "no-frontend-test",
      routes: (app) => {
        app.get("/api/test", (c) => c.json({ ok: true }));
      },
    });

    const apiRes = await mockApp.app.request("/api/test");
    expect(apiRes.status).toBe(200);

    // Non-API route without frontend should 404
    const res = await mockApp.app.request("/some/path");
    expect(res.status).toBe(404);
  });
});
