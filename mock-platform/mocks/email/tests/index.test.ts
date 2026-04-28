import { describe, expect, test } from "bun:test";
import { createEmailApp } from "../src/index";

describe("email mock", () => {
  const app = createEmailApp().app;

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
