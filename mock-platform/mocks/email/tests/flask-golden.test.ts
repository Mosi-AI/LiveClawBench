import { describe, expect, test, beforeEach } from "bun:test";
import { createEmailApp } from "../src/index";
import { resetEmailDb } from "../src/db";
import type { OpenAPIApp } from "mock-lib";

// ---------------------------------------------------------------------------
// Helpers: extract JSON shape (keys + types) for structural diff
// ---------------------------------------------------------------------------

type JsonShape =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | { array: JsonShape }
  | { object: Record<string, JsonShape> };

function shapeOf(value: unknown): JsonShape {
  if (value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) {
    if (value.length === 0) return { array: "null" };
    return { array: shapeOf(value[0]) };
  }
  if (typeof value === "object") {
    const obj: Record<string, JsonShape> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      obj[key] = shapeOf((value as Record<string, unknown>)[key]);
    }
    return { object: obj };
  }
  return "string";
}

function shapeToString(shape: JsonShape): string {
  if (typeof shape === "string") return shape;
  if ("array" in shape) return `[${shapeToString(shape.array)}]`;
  if ("object" in shape) {
    const entries = Object.entries(shape.object)
      .map(([k, v]) => `"${k}":${shapeToString(v)}`)
      .join(",");
    return `{${entries}}`;
  }
  return "unknown";
}

function normalizeVolatile(value: unknown, key?: string): unknown {
  if (typeof value === "string" && /^eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*/.test(value)) {
    return "<JWT_TOKEN>";
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return "<TIMESTAMP>";
  }
  // Normalize IDs: any numeric id field becomes a placeholder
  if (key === "id" && typeof value === "number") {
    return "<ID>";
  }
  if (typeof value === "string" && /^\d+$/.test(value) && value.length > 3) {
    return "<ID>";
  }
  // Normalize is_read: SQLite returns 0/1, Flask returns false/true
  if (key === "is_read" && (typeof value === "number" || typeof value === "boolean")) {
    return "<BOOL>";
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeVolatile(v));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeVolatile(v, k);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Test: Bun email responses match Flask golden-response structure
// ---------------------------------------------------------------------------

describe("Flask golden response contract", () => {
  let app: OpenAPIApp;
  let token: string;

  beforeEach(async () => {
    resetEmailDb();
    app = createEmailApp({ dbPath: ":memory:" }).app;

    // Login to get a token for subsequent requests
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "peter", password: "password123" }),
    });
    const loginBody = await loginRes.json();
    token = loginBody.data.access_token;
  });

  async function loadGolden(name: string): Promise<unknown> {
    const path = `${import.meta.dir}/../test/fixtures/flask-golden/${name}.json`;
    const text = await Bun.file(path).text();
    return JSON.parse(text);
  }

  function assertShapeMatch(actual: unknown, golden: unknown, label: string) {
    const normActual = normalizeVolatile(actual);
    const normGolden = normalizeVolatile(golden);
    const actualShape = shapeOf(normActual);
    const goldenShape = shapeOf(normGolden);
    const actualStr = shapeToString(actualShape);
    const goldenStr = shapeToString(goldenShape);
    expect(actualStr).toBe(goldenStr);
  }

  test("login response shape matches Flask golden", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "peter", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    assertShapeMatch(body, await loadGolden("login"), "login");
  });

  test("inbox list response shape matches Flask golden", async () => {
    const res = await app.request("/api/emails?folder=inbox", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    assertShapeMatch(body, await loadGolden("inbox-list"), "inbox-list");
  });

  test("single email response shape matches Flask golden", async () => {
    const listRes = await app.request("/api/emails?folder=inbox", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { data: listData } = await listRes.json();
    const firstId = listData.emails[0].id;

    const res = await app.request(`/api/emails/${firstId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    assertShapeMatch(body, await loadGolden("single-email"), "single-email");
  });

  test("user search response shape matches Flask golden", async () => {
    const res = await app.request("/api/users/search?q=mary", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    assertShapeMatch(body, await loadGolden("user-search"), "user-search");
  });

  test("draft creation response shape matches Flask golden", async () => {
    const res = await app.request("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recipient: "peter.griffin@email.app",
        subject: "Draft Subject",
        body: "Draft body content",
        send_now: false,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    assertShapeMatch(body, await loadGolden("draft-creation"), "draft-creation");
  });

  test("draft send response shape matches Flask golden", async () => {
    const draftRes = await app.request("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recipient: "peter.griffin@email.app",
        subject: "Draft Subject",
        body: "Draft body content",
        send_now: false,
      }),
    });
    const { data: draftData } = await draftRes.json();

    const res = await app.request(`/api/emails/${draftData.email.id}/send`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    assertShapeMatch(body, await loadGolden("draft-send"), "draft-send");
  });
});
