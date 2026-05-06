import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { factoryNameFor, discoverMocks } from "./generate-openapi";

const MOCKS_DIR = join(import.meta.dir, "..", "mocks");

async function generateForMock(name: string): Promise<{ document?: object; error?: string }> {
  const tsPath = join(MOCKS_DIR, name, "src", "index.ts");
  const tsxPath = join(MOCKS_DIR, name, "src", "index.tsx");
  const entryPoint = existsSync(tsxPath) ? tsxPath : tsPath;

  if (!existsSync(entryPoint)) {
    return { error: `Entry point not found: ${entryPoint}` };
  }

  try {
    const mockModule = await import(entryPoint);
    const factoryName = factoryNameFor(name);

    const createApp = mockModule[factoryName];
    if (typeof createApp !== "function") {
      return { error: `No exported '${factoryName}' function` };
    }

    const mockApp = createApp();
    if (!mockApp?.app) {
      return { error: `${factoryName}() did not return a valid MockAppV2` };
    }

    const app = mockApp.app;
    if (typeof app.getOpenAPI31Document !== "function") {
      return { error: `App does not have getOpenAPI31Document()` };
    }

    const document = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: mockApp.config.name, version: "1.0.0" },
    });

    return { document };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

describe("OpenAPI generation — discovery", () => {
  test("all discovered mocks generate valid specs", async () => {
    const mocks = await discoverMocks();
    expect(mocks.length).toBeGreaterThanOrEqual(5);

    const results: { name: string; document?: object; error?: string }[] = [];
    for (const name of mocks) {
      results.push({ name, ...(await generateForMock(name)) });
    }

    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      const details = failed.map((f) => `${f.name}: ${f.error}`).join("\n  ");
      expect(failed.length, `Failed mocks:\n  ${details}`).toBe(0);
    }

    // Every discovered mock must produce a document with at least a sentinel route
    for (const r of results) {
      const doc = r.document as any;
      expect(doc.paths).toBeDefined();
      expect(
        Object.keys(doc.paths).length,
        `${r.name} should have at least one path`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("OpenAPI generation — per-mock assertions", () => {
  test("airline generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("airline");
    expect(error).toBeUndefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/airline");
  });

  test("email generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("email");
    expect(error).toBeUndefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/email");
  });

  test("todolist generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("todolist");
    expect(error).toBeUndefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/todolist");
  });

  test("doc-search generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("doc-search");
    expect(error).toBeUndefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/doc-search");
    // HTML pages should NOT appear in the spec
    expect(paths).not.toHaveProperty("/");
    expect(paths).not.toHaveProperty("/search");
    expect(paths).not.toHaveProperty("/docs/{slug}");
  });

  test("shop generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("shop");
    expect(error).toBeUndefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/shop");
    expect(paths).toHaveProperty("/api/products");
    expect(paths).toHaveProperty("/api/cart/add");
    expect(paths).toHaveProperty("/api/checkout");
    // HTML pages should NOT appear in the spec
    expect(paths).not.toHaveProperty("/");
    expect(paths).not.toHaveProperty("/search");
    expect(paths).not.toHaveProperty("/cart");
    expect(paths).not.toHaveProperty("/profile");
    expect(paths).not.toHaveProperty("/orders");
  });

  test("insurance generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("insurance");
    expect(error).toBeUndefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/insurance");
    expect(paths).toHaveProperty("/api/auth/login");
    expect(paths).toHaveProperty("/api/claims");
    expect(paths).toHaveProperty("/api/plans");
    // HTML pages should NOT appear in the spec
    expect(paths).not.toHaveProperty("/login");
    expect(paths).not.toHaveProperty("/claims");
    expect(paths).not.toHaveProperty("/claims/new");
    expect(paths).not.toHaveProperty("/claims/{id}");
    expect(paths).not.toHaveProperty("/appointments/search");
    expect(paths).not.toHaveProperty("/appointments/providers/{id}");
    expect(paths).not.toHaveProperty("/plans");
    expect(paths).not.toHaveProperty("/plans/current");
    expect(paths).not.toHaveProperty("/plans/select");
  });

  test("calendar generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("calendar");
    expect(error).toBeUndefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/calendar");
    expect(paths).toHaveProperty("/api/events");
    expect(paths).toHaveProperty("/api/events/{id}");
    // HTML pages should NOT appear in the spec
    expect(paths).not.toHaveProperty("/");
  });
});
