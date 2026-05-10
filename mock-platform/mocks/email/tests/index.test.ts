import { describe, expect, test, beforeEach } from "bun:test";
import { createEmailApp } from "../src/index";
import { resetEmailDb } from "../src/db";
import type { OpenAPIApp } from "mock-lib";

describe("email mock", () => {
  let app: OpenAPIApp;
  let authToken: string;

  async function loginAsPeter() {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "peter", password: "password123" }),
    });
    const body = await res.json();
    return body.data.access_token as string;
  }

  beforeEach(async () => {
    resetEmailDb();
    app = createEmailApp({ dbPath: ":memory:" }).app;
    authToken = await loginAsPeter();
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

  test("GET /health returns healthy", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("email");
  });

  // --- Auth ---

  test("POST /api/auth/register creates user", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        email: "test@example.com",
        password: "secret123",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.user.username).toBe("testuser");
    expect(body.data.access_token).toBeDefined();
  });

  test("POST /api/auth/login with valid credentials", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "peter", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.username).toBe("peter");
    expect(body.data.access_token).toBeDefined();
  });

  test("POST /api/auth/login with invalid credentials", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "peter", password: "wrong" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBeDefined();
  });

  test("GET /api/auth/me with valid token", async () => {
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "peter", password: "password123" }),
    });
    const { data: loginData } = await loginRes.json();

    const res = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${loginData.access_token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.username).toBe("peter");
  });

  // --- Emails ---

  test("GET /api/emails?folder=inbox returns seeded emails", async () => {
    const res = await app.request("/api/emails?folder=inbox", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.emails.length).toBeGreaterThan(0);
    expect(body.data.count).toBe(body.data.emails.length);
  });

  test("GET /api/emails?folder=sent returns sent emails", async () => {
    const res = await app.request("/api/emails?folder=sent", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.emails.length).toBeGreaterThan(0);
  });

  test("GET /api/emails?folder=drafts returns empty initially", async () => {
    const res = await app.request("/api/emails?folder=drafts", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.emails.length).toBe(0);
  });

  test("GET /api/emails with invalid folder returns 400", async () => {
    const res = await app.request("/api/emails?folder=spam", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/emails creates a draft", async () => {
    const res = await app.request("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        recipient: "test@example.com",
        subject: "Test Draft",
        body: "Hello",
        send_now: false,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.email.folder).toBe("drafts");
  });

  test("POST /api/emails sends an email to internal user", async () => {
    const res = await app.request("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        recipient: "peter.griffin@email.app",
        subject: "Self mail",
        body: "Hi me",
        send_now: true,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.email.folder).toBe("sent");
  });

  test("GET /api/emails/:id returns single email", async () => {
    const listRes = await app.request("/api/emails?folder=inbox", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const { data: listData } = await listRes.json();
    const firstId = listData.emails[0].id;

    const res = await app.request(`/api/emails/${firstId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.email.id).toBe(firstId);
  });

  test("PUT /api/emails/:id/send sends a draft", async () => {
    const draftRes = await app.request("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        recipient: "peter.griffin@email.app",
        subject: "Draft to send",
        body: "Content",
        send_now: false,
      }),
    });
    const { data: draftData } = await draftRes.json();

    const res = await app.request(`/api/emails/${draftData.email.id}/send`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.email.folder).toBe("sent");
  });

  test("DELETE /api/emails/:id moves to trash then permanently deletes", async () => {
    const listRes = await app.request("/api/emails?folder=inbox", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const { data: listData } = await listRes.json();
    const emailId = listData.emails[0].id;

    // Move to trash
    const trashRes = await app.request(`/api/emails/${emailId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(trashRes.status).toBe(200);
    const trashBody = await trashRes.json();
    expect(trashBody.data.email.folder).toBe("trash");

    // Permanent delete
    const delRes = await app.request(`/api/emails/${emailId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(delRes.status).toBe(200);
    expect((await delRes.json()).message).toBe("Email deleted permanently");

    // Verify gone
    const getRes = await app.request(`/api/emails/${emailId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(getRes.status).toBe(404);
  });

  test("PUT /api/emails/:id/read toggles read status", async () => {
    const listRes = await app.request("/api/emails?folder=inbox", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const { data: listData } = await listRes.json();
    const emailId = listData.emails[0].id;

    const res = await app.request(`/api/emails/${emailId}/read`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ is_read: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.email.is_read).toBe(true);
  });

  // --- Attachments ---

  test("POST /api/attachments/upload with no files returns 400", async () => {
    const form = new FormData();
    const res = await app.request("/api/attachments/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /api/attachments/:id with non-existent id returns 404", async () => {
    const res = await app.request("/api/attachments/99999", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(404);
  });

  // --- Users ---

  test("GET /api/users/search?q=peter returns peter", async () => {
    const res = await app.request("/api/users/search?q=peter", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.users.length).toBeGreaterThan(0);
    expect(body.data.users[0].username).toBe("peter");
  });

  test("GET /api/users/search with empty query returns empty list", async () => {
    const res = await app.request("/api/users/search?q=", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.users.length).toBe(0);
  });
});
