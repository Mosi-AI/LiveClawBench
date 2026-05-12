import { describe, expect, test, beforeEach } from "bun:test";
import { createTodolistApp } from "../src/index";
import { resetTodolistDb } from "../src/db";
import type { OpenAPIApp } from "mock-lib";

describe("todolist mock", () => {
  let app: OpenAPIApp;

  beforeEach(() => {
    resetTodolistDb();
    app = createTodolistApp({ dbPath: ":memory:" }).app;
  });

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/todolist returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/todolist");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("GET /health returns healthy", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("todolist");
  });

  // --- Todos CRUD ---

  test("GET /api/todos returns seeded todos", async () => {
    const res = await app.request("/api/todos");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("GET /api/todos?month= returns todos for month", async () => {
    const res = await app.request("/api/todos?month=2026-03");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("GET /api/todos?month= with invalid format returns 400", async () => {
    const res = await app.request("/api/todos?month=invalid");
    expect(res.status).toBe(400);
  });

  test("GET /api/todos?start_date=&end_date= returns range", async () => {
    const res = await app.request("/api/todos?start_date=2026-03-01&end_date=2026-03-31");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("GET /api/todos/:date returns todos for date", async () => {
    const res = await app.request("/api/todos/2026-03-10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /api/todos/:date with invalid format returns 400", async () => {
    const res = await app.request("/api/todos/bad-date");
    expect(res.status).toBe(400);
  });

  test("GET /api/todos/item/:id returns single todo", async () => {
    const listRes = await app.request("/api/todos");
    const listBody = await listRes.json();
    const firstId = listBody.data[0].id;

    const res = await app.request(`/api/todos/item/${firstId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(firstId);
  });

  test("GET /api/todos/item/:id with non-existent id returns 404", async () => {
    const res = await app.request("/api/todos/item/99999");
    expect(res.status).toBe(404);
  });

  test("POST /api/todos creates a todo", async () => {
    const res = await app.request("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Todo",
        date: "2026-05-01",
        time: "14:00",
        location: "Office",
        person: "Team",
        description: "Test description",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("New Todo");
    expect(body.data.date).toBe("2026-05-01");
    expect(body.data.time).toBe("14:00");
  });

  test("POST /api/todos with missing title returns 400", async () => {
    const res = await app.request("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-05-01" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/todos with invalid date returns 400", async () => {
    const res = await app.request("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "X", date: "bad" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/todos with malformed time returns 400", async () => {
    const res = await app.request("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "X", date: "2026-05-01", time: "not-a-time" }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/todos/:id updates a todo", async () => {
    const listRes = await app.request("/api/todos");
    const listBody = await listRes.json();
    const firstId = listBody.data[0].id;

    const res = await app.request(`/api/todos/${firstId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Updated Title");
  });

  test("PUT /api/todos/:id with empty title returns 400", async () => {
    const listRes = await app.request("/api/todos");
    const listBody = await listRes.json();
    const firstId = listBody.data[0].id;

    const res = await app.request(`/api/todos/${firstId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/todos/:id with non-existent id returns 404", async () => {
    const res = await app.request("/api/todos/99999", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "X" }),
    });
    expect(res.status).toBe(404);
  });

  test("DELETE /api/todos/:id deletes a todo", async () => {
    const listRes = await app.request("/api/todos");
    const listBody = await listRes.json();
    const firstId = listBody.data[0].id;

    const delRes = await app.request(`/api/todos/${firstId}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    const getRes = await app.request(`/api/todos/item/${firstId}`);
    expect(getRes.status).toBe(404);
  });

  test("DELETE /api/todos/:id with non-existent id returns 404", async () => {
    const res = await app.request("/api/todos/99999", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  // --- Summary ---

  test("GET /api/summary/:month returns summary", async () => {
    const res = await app.request("/api/summary/2026-03");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data).toBe("object");
    expect(Object.keys(body.data).length).toBeGreaterThan(0);
  });

  test("GET /api/summary/:month with invalid format returns 400", async () => {
    const res = await app.request("/api/summary/bad");
    expect(res.status).toBe(400);
  });

  // --- Task-specific seed parity ---

  test("schedule-change-request seeds 3 next-Sunday todos", async () => {
    resetTodolistDb();
    const taskApp = createTodolistApp({ dbPath: ":memory:", taskName: "schedule-change-request" }).app;
    const res = await taskApp.request("/api/todos");
    expect(res.status).toBe(200);
    const body = await res.json();
    const todos = body.data;
    const sundayTodos = todos.filter((t: Record<string, unknown>) =>
      String(t.title).includes("Game party") ||
      String(t.title).includes("Morning run") ||
      String(t.title).includes("Book club meeting")
    );
    expect(sundayTodos.length).toBe(3);
    expect(String(sundayTodos[0].description)).toContain("@");
  });

  test("flight-info-change-notice seeds 1 today+2 todo", async () => {
    resetTodolistDb();
    const taskApp = createTodolistApp({ dbPath: ":memory:", taskName: "flight-info-change-notice" }).app;
    const res = await taskApp.request("/api/todos");
    expect(res.status).toBe(200);
    const body = await res.json();
    const todos = body.data;
    const partyTodos = todos.filter((t: Record<string, unknown>) =>
      String(t.title).includes("Game party")
    );
    expect(partyTodos.length).toBe(1);
    expect(String(partyTodos[0].description)).toContain("marytheshot@gmail.com");
  });
});
