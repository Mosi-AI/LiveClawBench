import { describe, expect, test, beforeEach } from "bun:test";
import { createCalendarApp } from "../src/index";
import { getCalendarDb, resetCalendarDb } from "../src/db";
import { seedDatabase } from "../src/seed";

describe("calendar mock", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];

  beforeEach(() => {
    process.env.CALENDAR_DB_PATH = ":memory:";
    app = createCalendarApp().app;
  });

  test("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/calendar returns sentinel", async () => {
    const res = await app.request("/__mock_sentinel__/calendar");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mock).toBe("calendar");
  });

  test("schema creates users and calendar_event tables", () => {
    const db = getCalendarDb({ dbPath: ":memory:" });
    resetCalendarDb(db);
    const tables = db
      .query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'calendar_event')`,
      )
      .all();
    expect(tables.length).toBe(2);
  });

  test("seed creates default user", () => {
    const db = getCalendarDb({ dbPath: ":memory:" });
    resetCalendarDb(db);
    seedDatabase(db);
    const user = db.query("SELECT * FROM users WHERE id = 1").get();
    expect(user).toBeDefined();
    expect((user as any).email).toBe("peter.griffin@work.mosi.inc");
  });
});

describe("calendar events API", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];

  beforeEach(() => {
    process.env.CALENDAR_DB_PATH = ":memory:";
    const mockApp = createCalendarApp();
    app = mockApp.app;
  });

  test("POST /api/events creates an event", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "Blood Test",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Blood Test");
    expect(body.user_id).toBe(1);
  });

  test("POST /api/events rejects invalid time range", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "Bad Event",
        start_time: "2026-05-10T10:00:00Z",
        end_time: "2026-05-10T09:00:00Z",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/events rejects overlapping events", async () => {
    await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "First",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });

    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "Overlap",
        start_time: "2026-05-10T09:30:00Z",
        end_time: "2026-05-10T10:30:00Z",
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("time_overlap");
  });

  test("POST /api/events allows adjacent events", async () => {
    await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "First",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });

    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "Adjacent",
        start_time: "2026-05-10T10:00:00Z",
        end_time: "2026-05-10T11:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Adjacent");
  });

  test("GET /api/events lists events for user", async () => {
    await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "Event A",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });

    const res = await app.request("/api/events?user_id=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events.length).toBe(1);
    expect(body.events[0].title).toBe("Event A");
  });

  test("GET /api/events/:id returns single event", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "Single",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/events/${created.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Single");
  });

  test("DELETE /api/events/:id removes event", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        title: "ToDelete",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    const delRes = await app.request(`/api/events/${created.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(204);

    const getRes = await app.request(`/api/events/${created.id}`);
    expect(getRes.status).toBe(404);
  });
});
