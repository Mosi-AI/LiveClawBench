import { describe, expect, test, beforeEach } from "bun:test";
import { createAirlineApp } from "../src/index";
import { resetAirlineDb } from "../src/db";
import type { OpenAPIApp } from "mock-lib";

describe("airline mock", () => {
  let app: OpenAPIApp;

  beforeEach(() => {
    resetAirlineDb();
    app = createAirlineApp({ dbPath: ":memory:" }).app;
  });

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/airline returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/airline");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
