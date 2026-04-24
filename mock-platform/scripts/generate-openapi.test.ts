import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const MOCKS_DIR = join(import.meta.dir, "..", "mocks");

const factoryNames: Record<string, string> = {
  airline: "createAirlineApp",
  email: "createEmailApp",
  todolist: "createTodolistApp",
  "doc-search": "createDocSearchApp",
  shop: "createShopApp",
};

async function generateForMock(name: string): Promise<{ document?: object; error?: string }> {
  const tsPath = join(MOCKS_DIR, name, "src", "index.ts");
  const tsxPath = join(MOCKS_DIR, name, "src", "index.tsx");
  const entryPoint = existsSync(tsxPath) ? tsxPath : tsPath;

  try {
    const mockModule = await import(entryPoint);
    const factoryName = factoryNames[name];
    if (!factoryName) return { error: `No factory mapping for ${name}` };

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

describe("OpenAPI generation — all mocks", () => {
  test("airline generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("airline");
    expect(error).toBeUndefined();
    expect(document).toBeDefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/airline");
  });

  test("email generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("email");
    expect(error).toBeUndefined();
    expect(document).toBeDefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/email");
  });

  test("todolist generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("todolist");
    expect(error).toBeUndefined();
    expect(document).toBeDefined();
    const paths = (document as any).paths;
    expect(paths).toHaveProperty("/__mock_sentinel__/todolist");
  });

  test("doc-search generates valid spec with sentinel", async () => {
    const { document, error } = await generateForMock("doc-search");
    expect(error).toBeUndefined();
    expect(document).toBeDefined();
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
    expect(document).toBeDefined();
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
});
