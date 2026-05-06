import { describe, expect, test, beforeEach } from "bun:test";
import { createEmailApp } from "../src/index";
import type { OpenAPIApp } from "mock-lib";

describe("email mock", () => {
  let app: OpenAPIApp;

  beforeEach(() => {
    app = createEmailApp().app;
  });

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/email returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/email");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
