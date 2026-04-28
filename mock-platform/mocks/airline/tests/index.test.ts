import { describe, expect, test } from "bun:test";
import { createAirlineApp } from "../src/index";

describe("airline mock", () => {
  const app = createAirlineApp().app;

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
