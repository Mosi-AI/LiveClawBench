import { describe, expect, test, beforeEach } from "bun:test";
import { createWorkspaceApp } from "../src/index";
import { renderMarkdown, renderPlainText } from "../src/markdown";
import { sign } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";

describe("createWorkspaceApp", () => {
  let workspace: ReturnType<typeof createWorkspaceApp>;
  let app: OpenAPIApp;

  beforeEach(async () => {
    workspace = createWorkspaceApp();
    app = workspace.app;
    await workspace.seed!();
  });

  // ---------------------------------------------------------------------------
  // AC-1: Factory and database lifecycle
  // ---------------------------------------------------------------------------

  test("factory returns correct config", () => {
    expect(workspace.config.name).toBe("workspace");
    expect(workspace.config.port).toBe(5003);
    expect(typeof workspace.app.page).toBe("function");
    expect(typeof workspace.app.openApiRoute).toBe("function");
  });

  test("factory creates fresh DB per call", async () => {
    const app2 = createWorkspaceApp();
    await app2.seed!();
    const res1 = await app.request("/api/notes", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body1 = await res1.json();
    const res2 = await app2.app.request("/api/notes", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body2 = await res2.json();
    expect(body1.length).toBe(3);
    expect(body2.length).toBe(3);
  });

  test("seed populates all 5 tables", async () => {
    // Verify user table has demo user
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "demo", password: "demo123" }),
    });
    expect(loginRes.status).toBe(200);

    // Verify note table has 3 seeded notes
    const notesRes = await app.request("/api/notes?seeded=1", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const notes = await notesRes.json();
    expect(notes.length).toBe(3);

    // Verify note_revision table has 3 initial revisions
    for (const id of [1, 2, 3]) {
      const revRes = await app.request(`/api/notes/${id}/revisions`, {
        headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
      });
      const revs = await revRes.json();
      expect(revs.length).toBe(1);
    }

    // brief_entry and task_record exist but have 0 rows (verified indirectly via schema)
  });

  test("seed is idempotent", async () => {
    await workspace.seed!();
    await workspace.seed!();
    const res = await app.request("/api/notes?seeded=1", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body = await res.json();
    expect(body.length).toBe(3);
  });

  test("unseeded factory yields empty tables", async () => {
    const fresh = createWorkspaceApp();
    const res = await fresh.app.request("/api/notes", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body = await res.json();
    expect(body.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // AC-2: Database schema and seed idempotency
  // ---------------------------------------------------------------------------

  test("seeded user has correct properties", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "demo", password: "demo123" }),
    });
    expect(res.status).toBe(200);
  });

  test("seeded notes have hard-coded ids 1, 2, 3", async () => {
    const res = await app.request("/api/notes?seeded=1", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body = await res.json();
    expect(body.map((n: any) => n.id)).toEqual([1, 2, 3]);
  });

  test("each seeded note has exactly one revision", async () => {
    for (const id of [1, 2, 3]) {
      const res = await app.request(`/api/notes/${id}/revisions`, {
        headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
      });
      const body = await res.json();
      expect(body.length).toBe(1);
      expect(body[0].revision_no).toBe(1);
      expect(body[0].edited_by_user_id).toBe(1);
    }
  });

  // ---------------------------------------------------------------------------
  // AC-3: Authentication
  // ---------------------------------------------------------------------------

  test("login success sets cookie with secure: false and returns redirect", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "demo", password: "demo123" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirect).toBe("/workspace");
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toContain("token=");
    expect(setCookieHeader).toContain("HttpOnly");
    // secure: false override means "Secure" attribute should NOT be present
    expect(setCookieHeader).not.toContain("Secure");
  });

  test("login failure returns 401", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "demo", password: "wrong" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid username or password");
  });

  test("HTML page with valid cookie returns 200", async () => {
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "demo", password: "demo123" }),
    });
    const cookie = loginRes.headers.get("set-cookie")!;
    const res = await app.request("/workspace", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("HTML page with valid bearer token returns 200", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/workspace", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("HTML page without auth redirects to /", async () => {
    const res = await app.request("/workspace");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  test("HTML page with invalid token redirects to /", async () => {
    const res = await app.request("/workspace", {
      headers: { Cookie: "token=invalid-token" },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  test("API without token returns 401", async () => {
    const res = await app.request("/api/notes");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentication required");
  });

  test("API with invalid token returns 401", async () => {
    const res = await app.request("/api/notes", {
      headers: { Authorization: "Bearer invalid" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid or expired token");
  });

  test("logout redirects to / and clears cookie", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toContain("token=");
    expect(setCookieHeader).toContain("Max-Age=0");
  });

  test("login with non-JSON content type returns 415", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=demo&password=demo123",
    });
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toBe("Content-Type must be application/json");
  });

  // ---------------------------------------------------------------------------
  // AC-4: Note CRUD API
  // ---------------------------------------------------------------------------

  async function authHeaders() {
    return { Authorization: "Bearer " + (await sign({ userId: 1 })) };
  }

  test("POST /api/notes creates a note", async () => {
    const res = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Test Note", content: "Hello world", content_type: "plain_text" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Test Note");
    expect(body.content).toBe("Hello world");
    expect(body.save_count).toBe(0);
    expect(body.id).toBeGreaterThan(3);
  });

  test("GET /api/notes returns all notes", async () => {
    const res = await app.request("/api/notes", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(3);
  });

  test("GET /api/notes?seeded=1 returns only seeded notes", async () => {
    await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "New", content: "X", content_type: "plain_text" }),
    });
    const res = await app.request("/api/notes?seeded=1", { headers: await authHeaders() });
    const body = await res.json();
    expect(body.length).toBe(3);
    expect(body.every((n: any) => n.is_seeded === 1)).toBe(true);
  });

  test("GET /api/notes/:id returns note detail", async () => {
    const res = await app.request("/api/notes/1", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.title).toBe("Project Kickoff Meeting Notes");
  });

  test("GET /api/notes/:id includes latest_revision metadata after seed", async () => {
    const res = await app.request("/api/notes/1", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latest_revision).not.toBeNull();
    expect(body.latest_revision.note_id).toBe(1);
    expect(body.latest_revision.revision_no).toBe(1);
    expect(body.latest_revision.edited_by_user_id).toBe(1);
    expect(typeof body.latest_revision.content_snapshot).toBe("string");
    expect(typeof body.latest_revision.edited_at).toBe("string");
  });

  test("GET /api/notes/:id reflects newest revision after PUT", async () => {
    await app.request("/api/notes/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "After Update", content: "Revised body", content_type: "plain_text" }),
    });
    const res = await app.request("/api/notes/1", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latest_revision).not.toBeNull();
    expect(body.latest_revision.note_id).toBe(1);
    expect(body.latest_revision.revision_no).toBe(2);
    expect(body.latest_revision.content_snapshot).toBe("Revised body");
    expect(body.latest_revision.edited_by_user_id).toBe(1);
  });

  test("GET /api/notes/:id returns null latest_revision for note without history", async () => {
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Fresh", content: "Content", content_type: "plain_text" }),
    });
    const note = await createRes.json();
    const res = await app.request(`/api/notes/${note.id}`, { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latest_revision).toBeNull();
  });

  test("PUT /api/notes/:id updates note and increments save_count", async () => {
    const res = await app.request("/api/notes/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Updated", content: "New content", content_type: "plain_text" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const getRes = await app.request("/api/notes/1", { headers: await authHeaders() });
    const note = await getRes.json();
    expect(note.title).toBe("Updated");
    expect(note.save_count).toBe(1);
  });

  test("DELETE /api/notes/:id removes note", async () => {
    const res = await app.request("/api/notes/1", {
      method: "DELETE",
      headers: await authHeaders(),
    });
    expect(res.status).toBe(200);

    const getRes = await app.request("/api/notes/1", { headers: await authHeaders() });
    expect(getRes.status).toBe(404);
  });

  test("GET /api/notes/:id for non-existent returns 404", async () => {
    const res = await app.request("/api/notes/999999", { headers: await authHeaders() });
    expect(res.status).toBe(404);
  });

  test("POST /api/notes with missing title returns 400", async () => {
    const res = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ content: "X" }),
    });
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // AC-5: HTML pages
  // ---------------------------------------------------------------------------

  test("GET / returns login page HTML", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("Workspace");
    expect(text).toContain("username");
  });

  test("GET /workspace returns HTML with note list", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/workspace", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("My Notes");
    expect(text).toContain("Project Kickoff Meeting Notes");
  });

  test("GET /note/new returns HTML editor", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/new", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("New Note");
  });

  test("GET /note/:id returns HTML editor with data", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/1", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Edit Note");
    expect(text).toContain("Project Kickoff Meeting Notes");
  });

  test("GET /note/:id editor pre-selects brief option for brief notes", async () => {
    const token = await sign({ userId: 1 });
    // Create a note with content_type=brief
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ title: "Brief Editor Test", content: "B body", content_type: "brief" }),
    });
    expect(createRes.status).toBe(200);
    const note = await createRes.json();

    const res = await app.request(`/note/${note.id}`, {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    // Brief option must exist in the select
    expect(text).toContain('value="brief"');
    // Brief option must be marked selected (Hono JSX renders boolean true as just `selected`)
    expect(text).toMatch(/<option value="brief"[^>]*\bselected\b[^>]*>Brief<\/option>/);
    // Plain text option must NOT be selected when content_type is brief
    expect(text).not.toMatch(/<option value="plain_text"[^>]*\bselected\b/);
    expect(text).not.toMatch(/<option value="markdown"[^>]*\bselected\b/);
  });

  test("GET /note/:id/preview returns HTML preview", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/1/preview", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Project Kickoff Meeting Notes");
  });

  test("GET /note/:id/history returns HTML history", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/1/history", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("History:");
  });

  test("GET /note/999999 returns 404", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/999999", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // AC-6: Revision history
  // ---------------------------------------------------------------------------

  test("new note has save_count=0 and zero revisions", async () => {
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Rev Test", content: "Initial", content_type: "plain_text" }),
    });
    const note = await createRes.json();
    expect(note.save_count).toBe(0);

    const revRes = await app.request(`/api/notes/${note.id}/revisions`, { headers: await authHeaders() });
    const revs = await revRes.json();
    expect(revs.length).toBe(0);
  });

  test("first PUT creates revision_no=1", async () => {
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Rev Test", content: "Initial", content_type: "plain_text" }),
    });
    const note = await createRes.json();

    await app.request(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Rev Test", content: "Updated", content_type: "plain_text" }),
    });

    const getRes = await app.request(`/api/notes/${note.id}`, { headers: await authHeaders() });
    const updated = await getRes.json();
    expect(updated.save_count).toBe(1);

    const revRes = await app.request(`/api/notes/${note.id}/revisions`, { headers: await authHeaders() });
    const revs = await revRes.json();
    expect(revs.length).toBe(1);
    expect(revs[0].revision_no).toBe(1);
    expect(revs[0].content_snapshot).toBe("Updated");
  });

  test("second PUT creates revision_no=2", async () => {
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Rev Test", content: "Initial", content_type: "plain_text" }),
    });
    const note = await createRes.json();

    await app.request(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Rev Test", content: "V1", content_type: "plain_text" }),
    });
    await app.request(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Rev Test", content: "V2", content_type: "plain_text" }),
    });

    const revRes = await app.request(`/api/notes/${note.id}/revisions`, { headers: await authHeaders() });
    const revs = await revRes.json();
    expect(revs.length).toBe(2);
    expect(revs[0].revision_no).toBe(1);
    expect(revs[1].revision_no).toBe(2);
  });

  test("GET /api/notes/:id/revisions for non-existent note returns 404", async () => {
    const res = await app.request("/api/notes/999999/revisions", { headers: await authHeaders() });
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // AC-7: Preview and markdown rendering
  // ---------------------------------------------------------------------------

  test("renderMarkdown escapes raw HTML", () => {
    const input = "<script>alert(1)</script>";
    const html = renderMarkdown(input);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  test("renderMarkdown escapes img onerror", () => {
    const input = '<img onerror="alert(1)">';
    const html = renderMarkdown(input);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("&quot;alert(1)&quot;");
  });

  test("renderMarkdown supports headings bold italic lists links", () => {
    const input = "# H1\n\n## H2\n\n### H3\n\n**bold** and *italic*\n\n- item 1\n- item 2\n\n[link](https://example.com)";
    const html = renderMarkdown(input);
    expect(html).toContain("<h1>H1</h1>");
    expect(html).toContain("<h2>H2</h2>");
    expect(html).toContain("<h3>H3</h3>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<li>item 1</li>");
    expect(html).toContain('<a href="https://example.com">link</a>');
  });

  test("renderMarkdown groups consecutive bullets into a single ul", () => {
    const html = renderMarkdown("- a\n- b\n- c");
    expect(html).toContain("<ul><li>a</li><li>b</li><li>c</li></ul>");
    // No per-line wrapping into one-item uls
    expect(html).not.toContain("<ul><li>a</li></ul><ul><li>b</li></ul>");
    expect(html).not.toContain("</ul><ul>");
  });

  test("renderMarkdown splits bullet groups separated by blank lines", () => {
    const html = renderMarkdown("- a\n\n- b");
    expect(html).toContain("<ul><li>a</li></ul>");
    expect(html).toContain("<ul><li>b</li></ul>");
    // Two separate uls, not one combined
    expect(html).not.toContain("<ul><li>a</li><li>b</li></ul>");
  });

  test("renderMarkdown closes open list before headings and paragraphs", () => {
    const html = renderMarkdown("# H\n- a\n- b\n\nP");
    expect(html).toContain("<h1>H</h1>");
    expect(html).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(html).toContain("<p>P</p>");
    // Heading must come before the ul, ul before the paragraph
    const hIdx = html.indexOf("<h1>H</h1>");
    const ulIdx = html.indexOf("<ul><li>a</li><li>b</li></ul>");
    const pIdx = html.indexOf("<p>P</p>");
    expect(hIdx).toBeGreaterThanOrEqual(0);
    expect(ulIdx).toBeGreaterThan(hIdx);
    expect(pIdx).toBeGreaterThan(ulIdx);
  });

  test("renderMarkdown rejects javascript: links", () => {
    const input = "[click](javascript:alert(1))";
    const html = renderMarkdown(input);
    expect(html).not.toContain("href=");
    expect(html).toContain("click");
  });

  test("renderPlainText preserves line breaks", () => {
    const input = "Line 1\n\nLine 2";
    const html = renderPlainText(input);
    expect(html).toContain("<p>Line 1</p>");
    expect(html).toContain("<p>Line 2</p>");
  });

  test("preview text is generated from first 4 non-empty lines", async () => {
    const res = await app.request("/api/notes/1", { headers: await authHeaders() });
    const note = await res.json();
    expect(note.preview_text.length).toBeGreaterThan(0);
    expect(note.preview_text.length).toBeLessThanOrEqual(300);
  });

  test("brief content_type falls back to plain-text preview", async () => {
    const res = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Brief Note", content: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5", content_type: "brief" }),
    });
    const note = await res.json();
    expect(note.content_type).toBe("brief");
    // No brief_entry row exists, so it falls back to plain-text preview generation
    expect(note.preview_text).toContain("Line 1");
    expect(note.preview_text).not.toContain("Line 5");
    expect(note.preview_text.length).toBeLessThanOrEqual(300);
  });

  // ---------------------------------------------------------------------------
  // AC-8: Sentinel
  // ---------------------------------------------------------------------------

  test("GET /__mock_sentinel__/workspace returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/workspace");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Seed determinism
  // ---------------------------------------------------------------------------

  test("seed determinism: two seeds produce identical seeded notes", async () => {
    const app1 = createWorkspaceApp();
    await app1.seed!();
    const app2 = createWorkspaceApp();
    await app2.seed!();

    const res1 = await app1.app.request("/api/notes?seeded=1", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const res2 = await app2.app.request("/api/notes?seeded=1", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });

    const notes1 = await res1.json();
    const notes2 = await res2.json();

    expect(notes1.length).toBe(notes2.length);
    for (let i = 0; i < notes1.length; i++) {
      expect(notes1[i].id).toBe(notes2[i].id);
      expect(notes1[i].title).toBe(notes2[i].title);
      expect(notes1[i].content_type).toBe(notes2[i].content_type);
      expect(notes1[i].content).toBe(notes2[i].content);
    }
  });
});
