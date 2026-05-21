import { describe, expect, test, beforeEach } from "bun:test";
import { createWorkspaceApp } from "../src/index";
import { renderMarkdown, renderPlainText } from "../src/markdown";
import { sign } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";

describe("createWorkspaceApp", () => {
  function unwrap(body: any): any {
    if (body && typeof body === "object" && body.success === true && "data" in body) {
      return body.data;
    }
    return body;
  }

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
    expect(workspace.config.port).toBe(5009);
    expect(typeof workspace.app.page).toBe("function");
    expect(typeof workspace.app.openApiRoute).toBe("function");
  });

  test("factory creates fresh DB per call", async () => {
    const app2 = createWorkspaceApp();
    await app2.seed!();
    const res1 = await app.request("/api/notes", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body1 = unwrap(await res1.json());
    const res2 = await app2.app.request("/api/notes", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body2 = unwrap(await res2.json());
    expect(body1.length).toBe(7);
    expect(body2.length).toBe(7);
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
    const notes = unwrap(await notesRes.json());
    expect(notes.length).toBe(7);

    // Verify note_revision table has 5 initial revisions
    for (const id of [1, 2, 3, 4, 5, 6, 7]) {
      const revRes = await app.request(`/api/notes/${id}/revisions`, {
        headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
      });
      const revs = unwrap(await revRes.json());
      expect(revs.length).toBe(1);
    }

    // brief_entry has 1 row and task_record has 1 row after Phase 2 seed
  });

  test("seed is idempotent", async () => {
    await workspace.seed!();
    await workspace.seed!();
    const res = await app.request("/api/notes?seeded=1", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body = unwrap(await res.json());
    expect(body.length).toBe(7);
  });

  test("unseeded factory yields empty tables", async () => {
    const fresh = createWorkspaceApp();
    const res = await fresh.app.request("/api/notes", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body = unwrap(await res.json());
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

  test("seeded notes have hard-coded ids 1, 2, 3, 4, 5", async () => {
    const res = await app.request("/api/notes?seeded=1", {
      headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
    });
    const body = unwrap(await res.json());
    expect(body.map((n: any) => n.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("each seeded note has exactly one revision", async () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7]) {
      const res = await app.request(`/api/notes/${id}/revisions`, {
        headers: { Authorization: "Bearer " + (await sign({ userId: 1 })) },
      });
      const body = unwrap(await res.json());
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
    const body = unwrap(await res.json());
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
    const body = unwrap(await res.json());
    expect(body.message).toBe("Invalid username or password");
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
    const body = unwrap(await res.json());
    expect(body.message).toBe("Authentication required");
  });

  test("API with invalid token returns 401", async () => {
    const res = await app.request("/api/notes", {
      headers: { Authorization: "Bearer invalid" },
    });
    expect(res.status).toBe(401);
    const body = unwrap(await res.json());
    expect(body.message).toBe("Invalid or expired token");
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
    const body = unwrap(await res.json());
    expect(body.message).toBe("Content-Type must be application/json");
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
    const body = unwrap(await res.json());
    expect(body.title).toBe("Test Note");
    expect(body.content).toBe("Hello world");
    expect(body.save_count).toBe(0);
    expect(body.id).toBeGreaterThan(7);
  });

  test("GET /api/notes returns all notes", async () => {
    const res = await app.request("/api/notes", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.length).toBe(7);
  });

  test("GET /api/notes?seeded=1 returns only seeded notes", async () => {
    await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "New", content: "X", content_type: "plain_text" }),
    });
    const res = await app.request("/api/notes?seeded=1", { headers: await authHeaders() });
    const body = unwrap(await res.json());
    expect(body.length).toBe(7);
    expect(body.every((n: any) => n.is_seeded === 1)).toBe(true);
  });

  test("GET /api/notes/:id returns note detail", async () => {
    const res = await app.request("/api/notes/1", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.id).toBe(1);
    expect(body.title).toBe("Project Kickoff Meeting Notes");
  });

  test("GET /api/notes/:id includes latest_revision metadata after seed", async () => {
    const res = await app.request("/api/notes/1", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
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
    const body = unwrap(await res.json());
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
    const note = unwrap(await createRes.json());
    const res = await app.request(`/api/notes/${note.id}`, { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.latest_revision).toBeNull();
  });

  test("PUT /api/notes/:id updates note and increments save_count", async () => {
    const res = await app.request("/api/notes/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Updated", content: "New content", content_type: "plain_text" }),
    });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());

    const getRes = await app.request("/api/notes/1", { headers: await authHeaders() });
    const note = unwrap(await getRes.json());
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
    const note = unwrap(await createRes.json());

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
    const note = unwrap(await createRes.json());
    expect(note.save_count).toBe(0);

    const revRes = await app.request(`/api/notes/${note.id}/revisions`, { headers: await authHeaders() });
    const revs = unwrap(await revRes.json());
    expect(revs.length).toBe(0);
  });

  test("first PUT creates revision_no=1", async () => {
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Rev Test", content: "Initial", content_type: "plain_text" }),
    });
    const note = unwrap(await createRes.json());

    await app.request(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Rev Test", content: "Updated", content_type: "plain_text" }),
    });

    const getRes = await app.request(`/api/notes/${note.id}`, { headers: await authHeaders() });
    const updated = unwrap(await getRes.json());
    expect(updated.save_count).toBe(1);

    const revRes = await app.request(`/api/notes/${note.id}/revisions`, { headers: await authHeaders() });
    const revs = unwrap(await revRes.json());
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
    const note = unwrap(await createRes.json());

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
    const revs = unwrap(await revRes.json());
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

  test("renderMarkdown does not double-escape ampersands in URLs", () => {
    const input = "[docs](https://example.com/?a=1&b=2)";
    const html = renderMarkdown(input);
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(html).not.toContain("&amp;amp;");
  });

  test("renderMarkdown captures URLs with parentheses", () => {
    const input = "[x](https://en.wikipedia.org/wiki/Function_(computer_science))";
    const html = renderMarkdown(input);
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Function_(computer_science)"');
    expect(html).toContain(">x</a>");
  });

  test("renderMarkdown does not apply emphasis inside link URLs", () => {
    const input = "[x](https://example.com/*star*)";
    const html = renderMarkdown(input);
    expect(html).toContain('href="https://example.com/*star*"');
    expect(html).not.toContain("<em>star</em>");
    expect(html).toContain(">x</a>");
  });

  test("renderMarkdown still applies emphasis inside link text", () => {
    const input = "[**bold link**](https://example.com)";
    const html = renderMarkdown(input);
    expect(html).toContain('<a href="https://example.com">');
    expect(html).toContain("<strong>bold link</strong></a>");
  });

  test("renderMarkdown applies emphasis outside links normally", () => {
    const input = "**outside** [x](https://example.com) **also outside**";
    const html = renderMarkdown(input);
    expect(html).toContain("<strong>outside</strong>");
    expect(html).toContain("<strong>also outside</strong>");
    expect(html).toContain('<a href="https://example.com">x</a>');
  });

  test("renderMarkdown rejects protocol-relative // URLs", () => {
    const input = "[x](//evil.com)";
    const html = renderMarkdown(input);
    expect(html).not.toContain("href=");
    expect(html).toContain("x");
  });

  test("renderMarkdown still accepts site-relative paths", () => {
    const input = "[x](/relative/path)";
    const html = renderMarkdown(input);
    expect(html).toContain('<a href="/relative/path">x</a>');
  });

  test("renderPlainText preserves line breaks", () => {
    const input = "Line 1\n\nLine 2";
    const html = renderPlainText(input);
    expect(html).toContain("<p>Line 1</p>");
    expect(html).toContain("<p>Line 2</p>");
  });

  test("preview text is generated from first 4 non-empty lines", async () => {
    const res = await app.request("/api/notes/1", { headers: await authHeaders() });
    const note = unwrap(await res.json());
    expect(note.preview_text.length).toBeGreaterThan(0);
    expect(note.preview_text.length).toBeLessThanOrEqual(300);
  });

  test("brief content_type falls back to plain-text preview", async () => {
    const res = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Brief Note", content: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5", content_type: "brief" }),
    });
    const note = unwrap(await res.json());
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
    const body = unwrap(await res.json());
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

    const notes1 = unwrap(await res1.json());
    const notes2 = unwrap(await res2.json());

    expect(notes1.length).toBe(7);
    expect(notes1.length).toBe(notes2.length);
    for (let i = 0; i < notes1.length; i++) {
      expect(notes1[i].id).toBe(notes2[i].id);
      expect(notes1[i].title).toBe(notes2[i].title);
      expect(notes1[i].content_type).toBe(notes2[i].content_type);
      expect(notes1[i].content).toBe(notes2[i].content);
    }
  });

  // ---------------------------------------------------------------------------
  // Phase 2: Brief CRUD
  // ---------------------------------------------------------------------------

  test("GET /api/notes/4/brief returns seeded brief with parsed arrays", async () => {
    const res = await app.request("/api/notes/4/brief", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.id).toBe(1);
    expect(body.note_id).toBe(4);
    expect(body.key_updates).toBe("1. Launch mobile app v2. 2. Expand to EU market.");
    expect(Array.isArray(body.evidence_bullets)).toBe(true);
    expect(body.evidence_bullets[0].text).toBe("User surveys show 68% demand mobile");
    expect(body.evidence_bullets[0].source).toBe("document");
    expect(Array.isArray(body.action_items)).toBe(true);
    expect(body.action_items[0].text).toBe("Finalize EU compliance docs");
    expect(body.action_items[0].status).toBe("todo");
    expect(body.action_items[0].priority).toBe("high");
    expect(Array.isArray(body.citations)).toBe(true);
    expect(body.citations[0].title).toBe("Q3 Market Research Report");
    expect(body.citations[0].note).toBe("Internal slide deck");
    expect(body.status).toBe("draft");
  });

  test("GET /api/notes/2/brief returns 404 (no brief)", async () => {
    const res = await app.request("/api/notes/2/brief", { headers: await authHeaders() });
    expect(res.status).toBe(404);
  });

  test("GET /api/notes/9999/brief returns 404 (no note)", async () => {
    const res = await app.request("/api/notes/9999/brief", { headers: await authHeaders() });
    expect(res.status).toBe(404);
  });

  test("PUT /api/notes/4/brief upserts and keeps same id", async () => {
    const res1 = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "Updated key",
        evidence_bullets: [],
        action_items: [],
        citations: [],
        status: "final",
      }),
    });
    expect(res1.status).toBe(200);
    const body1 = unwrap(await res1.json());
    expect(body1.id).toBe(1);
    expect(body1.key_updates).toBe("Updated key");

    const res2 = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "Updated again",
        evidence_bullets: [],
        action_items: [],
        citations: [],
        status: "final",
      }),
    });
    const body2 = unwrap(await res2.json());
    expect(body2.id).toBe(1);
    expect(body2.key_updates).toBe("Updated again");
    expect(new Date(body2.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(body1.updated_at).getTime());
  });

  test("PUT /api/notes/9999/brief returns 404", async () => {
    const res = await app.request("/api/notes/9999/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "X",
        evidence_bullets: [],
        action_items: [],
        citations: [],
      }),
    });
    expect(res.status).toBe(404);
  });

  test("PUT /api/notes/4/brief with invalid body returns 400", async () => {
    const res = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "X",
        evidence_bullets: [{ text: "" }],
        action_items: [],
        citations: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/notes/4/brief with non-JSON Content-Type returns 415", async () => {
    const res = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...(await authHeaders()) },
      body: "key_updates=X",
    });
    expect(res.status).toBe(415);
  });

  test("brief save recomputes preview_text via rule-1 when content_type is brief", async () => {
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Brief Recompute", content: "Some plain content", content_type: "brief" }),
    });
    const note = unwrap(await createRes.json());
    expect(note.preview_text).toContain("Some plain");

    await app.request(`/api/notes/${note.id}/brief`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "Switched to brief preview",
        evidence_bullets: [],
        action_items: [],
        citations: [],
      }),
    });

    const getRes = await app.request(`/api/notes/${note.id}`, { headers: await authHeaders() });
    const updated = unwrap(await getRes.json());
    expect(updated.preview_text).toBe("Switched to brief preview");
  });

  test("PUT /brief does not create note_revision", async () => {
    const revResBefore = await app.request("/api/notes/4/revisions", { headers: await authHeaders() });
    const revsBefore = unwrap(await revResBefore.json());
    const countBefore = revsBefore.length;

    await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "No revision should be created",
        evidence_bullets: [],
        action_items: [],
        citations: [],
      }),
    });

    const revResAfter = await app.request("/api/notes/4/revisions", { headers: await authHeaders() });
    const revsAfter = unwrap(await revResAfter.json());
    expect(revsAfter.length).toBe(countBefore);
  });

  // ---------------------------------------------------------------------------
  // Phase 2: Task Record CRUD
  // ---------------------------------------------------------------------------

  test("GET /api/notes/5/task-record returns null after seed removal", async () => {
    const res = await app.request("/api/notes/5/task-record", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body).toBeNull();
  });

  test("GET /api/notes/2/task-record returns null for valid note without record", async () => {
    const res = await app.request("/api/notes/2/task-record", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body).toBeNull();
  });

  test("GET /api/notes/9999/task-record returns 404", async () => {
    const res = await app.request("/api/notes/9999/task-record", { headers: await authHeaders() });
    expect(res.status).toBe(404);
  });

  test("PUT /api/notes/5/task-record upserts and keeps same id", async () => {
    const res1 = await app.request("/api/notes/5/task-record", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        record_type: "summary",
        source_channel: "manual",
        summary_text: "Updated summary",
        status: "open",
      }),
    });
    expect(res1.status).toBe(200);
    const body1 = unwrap(await res1.json());
    expect(body1.id).toBe(1);
    expect(body1.summary_text).toBe("Updated summary");

    const res2 = await app.request("/api/notes/5/task-record", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        record_type: "communication",
        source_channel: "email",
        summary_text: "Updated again",
        status: "in_progress",
      }),
    });
    const body2 = unwrap(await res2.json());
    expect(body2.id).toBe(1);
    expect(body2.summary_text).toBe("Updated again");
    expect(new Date(body2.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(body1.updated_at).getTime());
  });

  test("PUT /api/notes/5/task-record with invalid enum returns 400", async () => {
    const res = await app.request("/api/notes/5/task-record", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        record_type: "incident",
        source_channel: "manual",
        summary_text: "X",
        status: "open",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/notes/5/task-record with invalid status returns 400", async () => {
    const res = await app.request("/api/notes/5/task-record", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        record_type: "summary",
        source_channel: "manual",
        summary_text: "X",
        status: "invalid_status",
      }),
    });
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // Phase 2: HTML Pages
  // ---------------------------------------------------------------------------

  test("GET /note/5/task-record returns HTML with defaults after seed removal", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/5/task-record", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    // Default values since seed task_record was removed
    expect(text).toContain('value="summary"');
    expect(text).toContain('value="manual"');
    expect(text).toContain('value="open"');
  });

  test("GET /note/2/task-record returns HTML with defaults when no record exists", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/2/task-record", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('value="summary"');
    expect(text).toContain('value="manual"');
    expect(text).toContain('value="open"');
  });

  test("GET /note/9999/task-record returns 404", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/9999/task-record", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(404);
  });

  test("Layout sidebar renders Task Record link on note-context pages", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/1", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('href="/note/1/task-record"');
  });

  test("Layout sidebar does not render Task Record link on /workspace", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/workspace", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("/task-record");
  });

  test("Layout sidebar does not render Task Record link on /note/new", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/new", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("/task-record");
  });

  test("GET /note/4/preview renders structured brief without Phase 1 fallback", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/4/preview", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('class="brief-key-updates"');
    expect(text).toContain('class="brief-evidence"');
    expect(text).toContain('class="brief-action-items"');
    expect(text).toContain('class="brief-citations"');
    expect(text).toContain("User surveys show 68% demand mobile");
    expect(text).toContain("Finalize EU compliance docs");
    expect(text).toContain("Q3 Market Research Report");
    expect(text).not.toContain("Structured brief preview is not available");
  });

  test("GET /note/:id/preview shows fallback for brief note without brief_entry", async () => {
    const token = await sign({ userId: 1 });
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ title: "Orphan Brief", content: "X", content_type: "brief" }),
    });
    const note = unwrap(await createRes.json());

    const res = await app.request(`/note/${note.id}/preview`, {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Structured brief preview is not available because no brief entry exists for this note.");
  });

  test("GET /note/1/preview renders plain_text unchanged", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/1/preview", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Project Kickoff Meeting Notes");
  });

  test("GET /note/4/history returns 200 for brief note", async () => {
    const token = await sign({ userId: 1 });
    const res = await app.request("/note/4/history", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("History:");
  });

  test("PUT /brief on plain_text note leaves preview_text untouched", async () => {
    const getRes = await app.request("/api/notes/1", { headers: await authHeaders() });
    const before = unwrap(await getRes.json());
    const originalPreview = before.preview_text;

    await app.request("/api/notes/1/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "Should not affect preview",
        evidence_bullets: [],
        action_items: [],
        citations: [],
      }),
    });

    const afterRes = await app.request("/api/notes/1", { headers: await authHeaders() });
    const after = unwrap(await afterRes.json());
    expect(after.preview_text).toBe(originalPreview);
  });

  // ---------------------------------------------------------------------------
  // Phase 2: Seed data presence
  // ---------------------------------------------------------------------------

  test("seeded note 4 has content_type brief and is_seeded=1", async () => {
    const res = await app.request("/api/notes/4", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.content_type).toBe("brief");
    expect(body.is_seeded).toBe(1);
  });

  test("seeded note 4 preview_text uses rule-1 from brief_entry", async () => {
    const res = await app.request("/api/notes/4", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.preview_text).toBe("1. Launch mobile app v2. 2. Expand to EU market.");
  });

  test("seeded note 4 revision snapshot matches flattened brief content", async () => {
    const res = await app.request("/api/notes/4/revisions", { headers: await authHeaders() });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.length).toBe(1);
    expect(body[0].revision_no).toBe(1);
    expect(body[0].content_snapshot).toContain("Key Updates:");
    expect(body[0].content_snapshot).toContain("1. Launch mobile app v2. 2. Expand to EU market.");
  });

  test("PUT /api/notes/4 with content creates revision while PUT /brief does not", async () => {
    const revResBefore = await app.request("/api/notes/4/revisions", { headers: await authHeaders() });
    const revsBefore = unwrap(await revResBefore.json());
    const countBefore = revsBefore.length;

    await app.request("/api/notes/4", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Updated", content: "something", content_type: "brief" }),
    });

    const revResAfter = await app.request("/api/notes/4/revisions", { headers: await authHeaders() });
    const revsAfter = unwrap(await revResAfter.json());
    expect(revsAfter.length).toBe(countBefore + 1);
    expect(revsAfter[revsAfter.length - 1].content_snapshot).toBe("something");
  });

  // ---------------------------------------------------------------------------
  // AC-14: Blank-row pruning (server-side contract)
  // ---------------------------------------------------------------------------
  // The NotePage client-side submit handler trims and drops evidence/action/
  // citation rows whose primary text field is empty/whitespace before sending.
  // These tests verify the server schema that makes that pruning necessary.

  test("AC-14: PUT /brief rejects empty evidence text with 400", async () => {
    const res = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "X",
        evidence_bullets: [{ text: "" }],
        action_items: [],
        citations: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("AC-14: PUT /brief rejects empty action text with 400", async () => {
    const res = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "X",
        evidence_bullets: [],
        action_items: [{ text: "", status: "todo", owner: "Alice", priority: "high" }],
        citations: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("AC-14: PUT /brief rejects empty citation title with 400", async () => {
    const res = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "X",
        evidence_bullets: [],
        action_items: [],
        citations: [{ title: "", url: "https://example.com", note: "N" }],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("AC-14: PUT /brief accepts empty arrays (all rows pruned) with 200", async () => {
    const res = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "All blank rows were pruned client-side",
        evidence_bullets: [],
        action_items: [],
        citations: [],
      }),
    });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.key_updates).toBe("All blank rows were pruned client-side");
    expect(body.evidence_bullets).toEqual([]);
    expect(body.action_items).toEqual([]);
    expect(body.citations).toEqual([]);
  });

  test("AC-14: PUT /brief accepts whitespace-only text because server does not trim", async () => {
    // This proves client-side trim() is load-bearing: without it, the server
    // would store a row whose visible text is empty whitespace.
    const res = await app.request("/api/notes/4/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        key_updates: "X",
        evidence_bullets: [{ text: "   " }],
        action_items: [{ text: "  ", status: "todo" }],
        citations: [{ title: " \t", url: "https://example.com" }],
      }),
    });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    expect(body.evidence_bullets[0].text).toBe("   ");
    expect(body.action_items[0].text).toBe("  ");
    expect(body.citations[0].title).toBe(" \t");
  });

  // ---------------------------------------------------------------------------
  // Cross-user ownership boundary
  // ---------------------------------------------------------------------------

  test("user B cannot access note owned by user A", async () => {
    // User A creates a note
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Private", content: "Secret", content_type: "plain_text" }),
    });
    expect(createRes.status).toBe(200);
    const note = unwrap(await createRes.json());

    // User B (userId=2) attempts to access it
    const userBHeaders = { Authorization: "Bearer " + (await sign({ userId: 2 })) };

    const getRes = await app.request(`/api/notes/${note.id}`, { headers: userBHeaders });
    expect(getRes.status).toBe(404);

    const putRes = await app.request(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...userBHeaders },
      body: JSON.stringify({ title: "Hacked", content: "X", content_type: "plain_text" }),
    });
    expect(putRes.status).toBe(404);

    const delRes = await app.request(`/api/notes/${note.id}`, {
      method: "DELETE",
      headers: userBHeaders,
    });
    expect(delRes.status).toBe(404);
  });

  test("user B cannot access brief or task-record on note owned by user A", async () => {
    // Create a brief note as user A
    const createRes = await app.request("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: "Brief Private", content: "B", content_type: "brief" }),
    });
    expect(createRes.status).toBe(200);
    const note = unwrap(await createRes.json());

    const userBHeaders = { Authorization: "Bearer " + (await sign({ userId: 2 })) };

    const briefGetRes = await app.request(`/api/notes/${note.id}/brief`, { headers: userBHeaders });
    expect(briefGetRes.status).toBe(404);

    const briefPutRes = await app.request(`/api/notes/${note.id}/brief`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...userBHeaders },
      body: JSON.stringify({ key_updates: "X", evidence_bullets: [], action_items: [], citations: [], status: "draft" }),
    });
    expect(briefPutRes.status).toBe(404);

    const trGetRes = await app.request(`/api/notes/${note.id}/task-record`, { headers: userBHeaders });
    expect(trGetRes.status).toBe(404);

    const trPutRes = await app.request(`/api/notes/${note.id}/task-record`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...userBHeaders },
      body: JSON.stringify({ record_type: "summary", source_channel: "manual", summary_text: "X", status: "open" }),
    });
    expect(trPutRes.status).toBe(404);
  });

  test("user B's note list does not include user A's notes", async () => {
    const userBHeaders = { Authorization: "Bearer " + (await sign({ userId: 2 })) };
    const res = await app.request("/api/notes", { headers: userBHeaders });
    expect(res.status).toBe(200);
    const body = unwrap(await res.json());
    // User B has no notes; all seeded notes belong to user 1
    expect(body.length).toBe(0);
  });
});
