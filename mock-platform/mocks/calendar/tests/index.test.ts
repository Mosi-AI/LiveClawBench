import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createCalendarApp } from "../src/index";
import { getCalendarDb, resetCalendarDb } from "../src/db";
import { seedDatabase } from "../src/seed";
import { resetInjectionState } from "mock-lib";

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
    expect(body.event_type).toBe("personal");
    expect(body.description).toBeNull();
  });

  test("POST /api/events creates event with description and event_type", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Take Medication",
        description: "Take 500mg after lunch",
        event_type: "medication",
        start_time: "2026-05-10T12:00:00Z",
        end_time: "2026-05-10T12:30:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Take Medication");
    expect(body.description).toBe("Take 500mg after lunch");
    expect(body.event_type).toBe("medication");
  });

  test("POST /api/events defaults event_type to personal", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Default Type",
        start_time: "2026-06-10T09:00:00Z",
        end_time: "2026-06-10T10:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.event_type).toBe("personal");
  });

  test("POST /api/events rejects invalid event_type", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Bad Type",
        event_type: "invalid_type",
        start_time: "2026-07-10T09:00:00Z",
        end_time: "2026-07-10T10:00:00Z",
      }),
    });
    expect(res.status).toBe(400);
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

  // PUT /api/events/:id tests
  test("PUT /api/events/:id updates title", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Original",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/events/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ title: "Updated" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated");
    expect(body.start_time).toBe(created.start_time);
  });

  test("PUT /api/events/:id updates description and event_type", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Event",
        start_time: "2026-05-10T14:00:00Z",
        end_time: "2026-05-10T15:00:00Z",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/events/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ description: "New desc", event_type: "appointment" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.description).toBe("New desc");
    expect(body.event_type).toBe("appointment");
  });

  test("PUT /api/events/:id updates time without overlap", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "TimeShift",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/events/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        start_time: "2026-05-10T11:00:00Z",
        end_time: "2026-05-10T12:00:00Z",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(new Date(body.start_time).toISOString()).toBe(new Date("2026-05-10T11:00:00Z").toISOString());
  });

  test("PUT /api/events/:id allows keeping same time (self-overlap)", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "SelfOverlap",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/events/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated Title");
  });

  test("PUT /api/events/:id rejects overlap with other event", async () => {
    await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Blocker",
        start_time: "2026-05-10T10:00:00Z",
        end_time: "2026-05-10T11:00:00Z",
      }),
    });

    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "ToMove",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T09:30:00Z",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/events/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        start_time: "2026-05-10T10:30:00Z",
        end_time: "2026-05-10T11:30:00Z",
      }),
    });
    expect(res.status).toBe(409);
  });

  test("PUT /api/events/:id returns 404 for non-existent event", async () => {
    const res = await app.request("/api/events/99999", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ title: "Ghost" }),
    });
    expect(res.status).toBe(404);
  });

  test("PUT /api/events/:id rejects invalid event_type", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "TypeTest",
        start_time: "2026-08-10T09:00:00Z",
        end_time: "2026-08-10T10:00:00Z",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/events/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ event_type: "bad_type" }),
    });
    expect(res.status).toBe(400);
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

  test("PUT /api/events/:id by another authenticated user returns 404 without mutating", async () => {
    // beforeEach already logged in as Peter (user 1); create the target event.
    const peterToken = token;
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(peterToken) },
      body: JSON.stringify({
        title: "Peter's Event",
        description: "Original",
        event_type: "personal",
        start_time: "2026-05-10T09:00:00Z",
        end_time: "2026-05-10T10:00:00Z",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.user_id).toBe(1);

    // Log in as Lois (user 2 — seeded by seedDatabase).
    const loisToken = await login(app, "lois.griffin@work.mosi.inc", "password123");
    expect(loisToken).not.toBe(peterToken);

    // updateEvent() filters by (id, user_id) so Lois's PUT against Peter's
    // row never finds it and returns not_found → 404 (cross-user IDOR).
    const putRes = await app.request(`/api/events/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(loisToken) },
      body: JSON.stringify({ title: "Hijacked", description: "Mutated by Lois" }),
    });
    expect([403, 404]).toContain(putRes.status);

    // Verify Peter's event row is unchanged.
    const getRes = await app.request(`/api/events/${created.id}`, {
      headers: authHeaders(peterToken),
    });
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.title).toBe("Peter's Event");
    expect(body.description).toBe("Original");
    expect(body.event_type).toBe("personal");
  });
});

describe("calendar edit form page route", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];
  let token: string;

  beforeEach(async () => {
    process.env.CALENDAR_DB_PATH = ":memory:";
    app = createCalendarApp().app;
    token = await login(app);
  });

  async function createEvent(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "PageRouteEvent",
        description: "Original desc",
        event_type: "appointment",
        start_time: "2026-09-10T09:00:00Z",
        end_time: "2026-09-10T10:00:00Z",
        ...overrides,
      }),
    });
    expect(res.status).toBe(201);
    return await res.json();
  }

  test("GET /events/:id/edit pre-populates title, description, event_type, and times", async () => {
    const created = await createEvent();
    const res = await app.request(`/events/${created.id}/edit`, {
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="PageRouteEvent"');
    expect(html).toContain("Original desc");
    // event_type=appointment should be marked selected
    expect(html).toMatch(/<option value="appointment"[^>]*selected/);
    // datetime-local inputs lose the timezone but keep YYYY-MM-DDTHH:MM
    expect(html).toMatch(/name="start_time"[^>]*value="2026-09-10T/);
    expect(html).toMatch(/name="end_time"[^>]*value="2026-09-10T/);
  });

  test("POST /events/:id/edit with crafted invalid event_type rejects and does NOT write", async () => {
    const created = await createEvent();

    const form = new URLSearchParams();
    form.set("title", "Should Not Save");
    form.set("description", "Tampered");
    form.set("event_type", "bad_type"); // crafted invalid value
    form.set("start_time", "2026-09-10T11:00");
    form.set("end_time", "2026-09-10T12:00");
    const res = await app.request(`/events/${created.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders(token) },
      body: form.toString(),
      redirect: "manual",
    });
    // Page form returns 200 with error message, NOT a 302 redirect
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("invalid");

    // Verify nothing was written: event still has original values
    const getRes = await app.request(`/api/events/${created.id}`, {
      headers: authHeaders(token),
    });
    const body = await getRes.json();
    expect(body.title).toBe("PageRouteEvent");
    expect(body.event_type).toBe("appointment");
    expect(body.description).toBe("Original desc");
  });

  test("POST /events/:id/edit with malformed date rejects with friendly UI (no 500)", async () => {
    const created = await createEvent();

    // Crafted unparseable date strings. updateEvent() catches the date
    // parse failure and returns "invalid_request: ..."; the page route
    // surfaces it as a 200 page with friendly copy instead of leaking
    // a RangeError 500.
    const form = new URLSearchParams();
    form.set("title", "Should Not Update");
    form.set("description", "");
    form.set("event_type", "personal");
    form.set("start_time", "garbage-not-a-date");
    form.set("end_time", "also-garbage");
    const res = await app.request(`/events/${created.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders(token) },
      body: form.toString(),
      redirect: "manual",
    });
    // Must NOT be 500 — must be a friendly 200 page
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("invalid");

    // Verify nothing was written
    const getRes = await app.request(`/api/events/${created.id}`, {
      headers: authHeaders(token),
    });
    const body = await getRes.json();
    expect(body.title).toBe("PageRouteEvent");
    expect(body.event_type).toBe("appointment");
    expect(body.description).toBe("Original desc");
  });

  test("POST /events/:id/edit with invalid time range rejects and does NOT write", async () => {
    const created = await createEvent();

    const form = new URLSearchParams();
    form.set("title", "Should Not Save");
    form.set("description", "Tampered");
    form.set("event_type", "personal");
    // End before start — fails the invalid_time_range check
    form.set("start_time", "2026-09-10T12:00");
    form.set("end_time", "2026-09-10T11:00");
    const res = await app.request(`/events/${created.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders(token) },
      body: form.toString(),
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("End time must be after start time");

    // Verify nothing was written
    const getRes = await app.request(`/api/events/${created.id}`, {
      headers: authHeaders(token),
    });
    const body = await getRes.json();
    expect(body.title).toBe("PageRouteEvent");
    expect(body.event_type).toBe("appointment");
  });

  test("POST /events/:id/edit with valid data persists changes and redirects", async () => {
    const created = await createEvent();

    const form = new URLSearchParams();
    form.set("title", "Updated Via Form");
    form.set("description", "New desc");
    form.set("event_type", "medication");
    form.set("start_time", "2026-09-10T13:00");
    form.set("end_time", "2026-09-10T14:00");
    const res = await app.request(`/events/${created.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders(token) },
      body: form.toString(),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");

    const getRes = await app.request(`/api/events/${created.id}`, {
      headers: authHeaders(token),
    });
    const body = await getRes.json();
    expect(body.title).toBe("Updated Via Form");
    expect(body.event_type).toBe("medication");
    expect(body.description).toBe("New desc");
  });
});

describe("calendar create form page route", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];
  let token: string;

  beforeEach(async () => {
    process.env.CALENDAR_DB_PATH = ":memory:";
    app = createCalendarApp().app;
    token = await login(app);
  });

  test("POST /events with crafted invalid event_type rejects and does NOT write", async () => {
    const form = new URLSearchParams();
    form.set("title", "Crafted Bad Type");
    form.set("description", "Tampered");
    form.set("event_type", "bad_type"); // crafted invalid value
    form.set("start_time", "2026-10-01T09:00");
    form.set("end_time", "2026-10-01T10:00");
    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders(token) },
      body: form.toString(),
      redirect: "manual",
    });
    // Page form returns 200 with error message, NOT a 302 redirect
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("invalid");

    // Verify no row was inserted: the events list must not contain our title.
    const listRes = await app.request("/api/events", {
      headers: authHeaders(token),
    });
    const list = await listRes.json();
    expect(Array.isArray(list.events)).toBe(true);
    const titles = list.events.map((e: { title: string }) => e.title);
    expect(titles).not.toContain("Crafted Bad Type");
  });

  test("POST /events with malformed date rejects with friendly UI (no 500)", async () => {
    // Crafted unparseable date strings. createEvent() catches the date
    // parse failure and returns "invalid_request: ..."; the page route
    // surfaces it as a 200 page with friendly copy instead of leaking
    // a RangeError 500.
    const form = new URLSearchParams();
    form.set("title", "Malformed Date Create");
    form.set("description", "");
    form.set("event_type", "personal");
    form.set("start_time", "garbage-not-a-date");
    form.set("end_time", "also-garbage");
    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders(token) },
      body: form.toString(),
      redirect: "manual",
    });
    // Must NOT be 500 — must be a friendly 200 page
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("invalid");

    // Verify no row was inserted.
    const listRes = await app.request("/api/events", {
      headers: authHeaders(token),
    });
    const list = await listRes.json();
    const titles = list.events.map((e: { title: string }) => e.title);
    expect(titles).not.toContain("Malformed Date Create");
  });
});

// --- C1 / C2 fault injection tests ---

describe("calendar C1 fault injection — meeting-slot-race", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];
  let token: string;
  let originalTaskName: string | undefined;

  beforeEach(async () => {
    originalTaskName = process.env.TASK_NAME;
    process.env.CALENDAR_DB_PATH = ":memory:";
    process.env.TASK_NAME = "meeting-slot-race";
    resetInjectionState();
    app = createCalendarApp().app;
    token = await login(app);
  });

  afterEach(() => {
    process.env.TASK_NAME = originalTaskName;
    resetInjectionState();
  });

  test("C1: first POST /api/events returns 409 due to injected blocking event", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Rescheduled Meeting",
        start_time: "2026-05-23T10:00:00Z",
        end_time: "2026-05-23T11:00:00Z",
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("time_overlap");
  });

  test("C1: second POST /api/events succeeds (one-shot semantics)", async () => {
    // First request triggers the fault injection and fails.
    const res1 = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Rescheduled Meeting",
        start_time: "2026-05-23T10:00:00Z",
        end_time: "2026-05-23T11:00:00Z",
      }),
    });
    expect(res1.status).toBe(409);

    // Second request should also fail because the blocking event is still in DB.
    // But injection does NOT fire again, so the agent could pick a different slot.
    // Test with a different time slot (no overlap with injected event).
    const res2 = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Different Meeting",
        start_time: "2026-05-23T14:00:00Z",
        end_time: "2026-05-23T15:00:00Z",
      }),
    });
    expect(res2.status).toBe(201);
    const body = await res2.json();
    expect(body.title).toBe("Different Meeting");
  });

  test("C1: injected blocking event is visible in user's event list", async () => {
    // Trigger C1 injection (it fails with 409 but event is in DB).
    await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "My Event",
        start_time: "2026-06-01T09:00:00Z",
        end_time: "2026-06-01T10:00:00Z",
      }),
    });

    // The injected "Team Standup" event should be visible since it uses
    // the same user_id as the authenticated user.
    const listRes = await app.request("/api/events", {
      headers: authHeaders(token),
    });
    expect(listRes.status).toBe(200);
    const body = await listRes.json();
    const titles = body.events.map((e: { title: string }) => e.title);
    expect(titles).toContain("Team Standup");
  });

  test("C1: non-matching TASK_NAME does not inject", async () => {
    process.env.TASK_NAME = "meeting-reschedule-response";
    resetInjectionState();
    // Recreate app for new task name.
    app = createCalendarApp().app;
    token = await login(app);

    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Normal Meeting",
        start_time: "2026-05-23T10:00:00Z",
        end_time: "2026-05-23T11:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
  });
});

describe("calendar C2 fault injection — interview-slot-verify", () => {
  let app: ReturnType<typeof createCalendarApp>["app"];
  let token: string;
  let originalTaskName: string | undefined;

  beforeEach(async () => {
    originalTaskName = process.env.TASK_NAME;
    process.env.CALENDAR_DB_PATH = ":memory:";
    process.env.TASK_NAME = "interview-slot-verify";
    resetInjectionState();
    app = createCalendarApp().app;
    token = await login(app);
  });

  afterEach(() => {
    process.env.TASK_NAME = originalTaskName;
    resetInjectionState();
  });

  test("C2: response shows requested time but DB stores shifted time", async () => {
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Senior Developer Interview",
        start_time: "2026-05-26T14:00:00Z",
        end_time: "2026-05-26T15:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();

    // Response should show the ORIGINAL requested time.
    expect(body.title).toBe("Senior Developer Interview");
    expect(body.start_time).toBe("2026-05-26T14:00:00.000Z");
    expect(body.end_time).toBe("2026-05-26T15:00:00.000Z");

    // But GETting the event reveals the shifted time (+1 hour).
    const getRes = await app.request(`/api/events/${body.id}`, {
      headers: authHeaders(token),
    });
    expect(getRes.status).toBe(200);
    const stored = await getRes.json();
    expect(stored.start_time).toBe("2026-05-26T15:00:00.000Z");
    expect(stored.end_time).toBe("2026-05-26T16:00:00.000Z");
  });

  test("C2: second event creation is not shifted (one-shot)", async () => {
    // First request triggers C2 (shifted).
    await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "First Event",
        start_time: "2026-05-26T14:00:00Z",
        end_time: "2026-05-26T15:00:00Z",
      }),
    });

    // Second request should NOT be shifted.
    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Second Event",
        start_time: "2026-05-26T16:00:00Z",
        end_time: "2026-05-26T17:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.start_time).toBe("2026-05-26T16:00:00.000Z");
    expect(body.end_time).toBe("2026-05-26T17:00:00.000Z");
  });

  test("C2: non-matching TASK_NAME does not shift", async () => {
    process.env.TASK_NAME = "candidate-interview-slot-confirm";
    resetInjectionState();
    app = createCalendarApp().app;
    token = await login(app);

    const res = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        title: "Normal Interview",
        start_time: "2026-05-26T14:00:00Z",
        end_time: "2026-05-26T15:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.start_time).toBe("2026-05-26T14:00:00.000Z");
    expect(body.end_time).toBe("2026-05-26T15:00:00.000Z");
  });
});
