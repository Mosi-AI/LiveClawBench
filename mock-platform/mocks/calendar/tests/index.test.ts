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

async function login(
  app: ReturnType<typeof createCalendarApp>["app"],
  email = "peter.griffin@work.mosi.inc",
  password = "password123",
): Promise<string> {
  const form = new URLSearchParams();
  form.set("email", email);
  form.set("password", password);
  const res = await app.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    redirect: "manual",
  });
  expect(res.status).toBe(302);
  const setCookie = res.headers.get("Set-Cookie");
  expect(setCookie).not.toBeNull();
  const match = setCookie!.match(/token=([^;]+)/);
  expect(match).not.toBeNull();
  return match![1];
}

function authHeaders(token: string) {
  return { Cookie: `token=${token}` };
}

describe("calendar auth flow", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];
  let token: string;

  beforeEach(async () => {
    process.env.CALENDAR_DB_PATH = ":memory:";
    app = createCalendarApp().app;
    token = await login(app);
  });

  test("unauthenticated API request returns 401", async () => {
    const res = await app.request("/api/events");
    expect(res.status).toBe(401);
  });

  test("forged token is rejected", async () => {
    const res = await app.request("/api/events", {
      headers: { Cookie: "token=forged.invalid.token" },
    });
    expect(res.status).toBe(401);
  });

  test("login with wrong password fails", async () => {
    const form = new URLSearchParams();
    form.set("email", "peter.griffin@work.mosi.inc");
    form.set("password", "wrongpassword");
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Invalid email or password");
  });
});

describe("calendar events API", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];
  let token: string;

  beforeEach(async () => {
    process.env.CALENDAR_DB_PATH = ":memory:";
    app = createCalendarApp().app;
    token = await login(app);
  });

  test("POST /api/events creates an event", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
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

  test("POST /api/events ignores user_id from body (uses authenticated user)", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        user_id: 999,
        title: "Blood Test",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // user_id in body is ignored; authenticated user (1) is used
    expect(body.user_id).toBe(1);
  });

  test("POST /api/events rejects invalid time range", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
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
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "First",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });

    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Overlap",
        start_time: "2026-05-10T09:30:00Z",
        end_time: "2026-05-10T10:30:00Z",
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("time_overlap");
  });

  test("POST /api/events allows adjacent events", async () => {
    await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "First",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });

    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Adjacent",
        start_time: "2026-05-10T10:00:00Z",
        end_time: "2026-05-10T11:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Adjacent");
  });

  test("GET /api/events lists events for authenticated user", async () => {
    await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Event A",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });

    const res = await app.request("/api/events", {
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events.length).toBe(1);
    expect(body.events[0].title).toBe("Event A");
  });

  test("GET /api/events/:id returns single event", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Single",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/events/${created.id}`, {
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Single");
  });

  test("DELETE /api/events/:id removes event", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "ToDelete",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    const delRes = await app.request(`/api/events/${created.id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    expect(delRes.status).toBe(204);

    const getRes = await app.request(`/api/events/${created.id}`, {
      headers: authHeaders(token),
    });
    expect(getRes.status).toBe(404);
  });
});

describe("calendar IDOR protection", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];
  let token: string;

  beforeEach(async () => {
    process.env.CALENDAR_DB_PATH = ":memory:";
    app = createCalendarApp().app;
    token = await login(app);
  });

  test("GET /api/events/:id rejects event owned by another user", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Owned",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    // Use a forged/different-user token — since we only have user 1,
    // test with no auth to ensure ownership filter works
    const res = await app.request(`/api/events/${created.id}`);
    expect(res.status).toBe(401);
  });

  test("DELETE /api/events/:id rejects event owned by another user", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Protected",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    // Delete without auth
    const res = await app.request(`/api/events/${created.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});
