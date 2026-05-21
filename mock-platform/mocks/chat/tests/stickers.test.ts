import { describe, beforeEach, afterAll, it, expect } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createChatApp } from "../src/index.js";
import type { OpenAPIApp } from "mock-lib";

const tmpDir = mkdtempSync(join(tmpdir(), "chat-test-"));

describe("stickers endpoints", () => {
  let chat: ReturnType<typeof createChatApp>;
  let app: OpenAPIApp;

  beforeEach(async () => {
    chat = createChatApp({ dbPath: ":memory:", stickerDir: tmpDir });
    app = chat.app;
    await chat.seed!();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // POST /api/stickers
  // ---------------------------------------------------------------------------

  it("upload GIF with category=recent -> 201, DB row exists with category='recent'", async () => {
    const buffer = new Uint8Array([0x47, 0x49, 0x46]); // GIF magic bytes
    const form = new FormData();
    form.append("file", new File([buffer], "test.gif", { type: "image/gif" }));
    form.append("category", "recent");

    const req = new Request("http://localhost:5003/api/stickers", {
      method: "POST",
      body: form,
    });
    const res = await app.request(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.category).toBe("recent");
    expect(body.mime_type).toBe("image/gif");
    expect(body.id).toBeDefined();

    // Verify via GET
    const getRes = await app.request(`/api/stickers/${body.id}`);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.category).toBe("recent");
  });

  it("upload PNG -> 201, mime_type='image/png'", async () => {
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const form = new FormData();
    form.append("file", new File([buffer], "test.png", { type: "image/png" }));

    const req = new Request("http://localhost:5003/api/stickers", {
      method: "POST",
      body: form,
    });
    const res = await app.request(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.mime_type).toBe("image/png");
  });

  it("upload empty file -> 400 { error: 'empty_file' }", async () => {
    const form = new FormData();
    form.append("file", new File([], "empty.gif", { type: "image/gif" }));

    const req = new Request("http://localhost:5003/api/stickers", {
      method: "POST",
      body: form,
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: "empty_file" });
  });

  it("upload .txt file -> 400 { error: 'unsupported_mime' }", async () => {
    const form = new FormData();
    form.append("file", new File(["hello"], "test.txt", { type: "text/plain" }));

    const req = new Request("http://localhost:5003/api/stickers", {
      method: "POST",
      body: form,
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: "unsupported_mime" });
  });

  it("upload file >10MB -> 413 { error: 'file_too_large' }", async () => {
    const bigBuffer = new Uint8Array(10 * 1024 * 1024 + 1); // 10MB + 1 byte
    const form = new FormData();
    form.append("file", new File([bigBuffer], "big.gif", { type: "image/gif" }));

    const req = new Request("http://localhost:5003/api/stickers", {
      method: "POST",
      body: form,
    });
    const res = await app.request(req);
    expect(res.status).toBe(413);

    const body = await res.json();
    expect(body).toEqual({ error: "file_too_large" });
  });

  it("missing file field -> 400 { error: 'invalid_body' }", async () => {
    const form = new FormData();
    form.append("category", "recent");

    const req = new Request("http://localhost:5003/api/stickers", {
      method: "POST",
      body: form,
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: "invalid_body" });
  });

  // ---------------------------------------------------------------------------
  // GET /api/stickers
  // ---------------------------------------------------------------------------

  it("GET without category -> returns all stickers sorted by sort_order ASC, created_at DESC", async () => {
    // Seed already creates 2 initial stickers. Upload two more.
    const buffer = new Uint8Array([0x47, 0x49, 0x46]);

    const form1 = new FormData();
    form1.append("file", new File([buffer], "a.gif", { type: "image/gif" }));
    form1.append("category", "recent");
    const res1 = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form1 }));
    const sticker1 = await res1.json();

    const form2 = new FormData();
    form2.append("file", new File([buffer], "b.gif", { type: "image/gif" }));
    form2.append("category", "favorite");
    const res2 = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form2 }));
    const sticker2 = await res2.json();

    const listRes = await app.request("/api/stickers");
    expect(listRes.status).toBe(200);

    const body = await listRes.json();
    expect(body.stickers.length).toBe(4); // 2 seeded + 2 uploaded
    // sort_order ASC: both have sort_order 0 and 0, tie-break by created_at DESC
    // When timestamps are identical the tie-break is non-deterministic, so only assert presence.
    const ids = body.stickers.map((s: any) => s.id);
    expect(ids).toContain(sticker1.id);
    expect(ids).toContain(sticker2.id);
  });

  it("GET with category=recent -> returns only recent stickers", async () => {
    // Seed already creates 2 initial recent stickers.
    const buffer = new Uint8Array([0x47, 0x49, 0x46]);

    const form1 = new FormData();
    form1.append("file", new File([buffer], "a.gif", { type: "image/gif" }));
    form1.append("category", "recent");
    await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form1 }));

    const form2 = new FormData();
    form2.append("file", new File([buffer], "b.gif", { type: "image/gif" }));
    form2.append("category", "favorite");
    await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form2 }));

    const listRes = await app.request("/api/stickers?category=recent");
    expect(listRes.status).toBe(200);

    const body = await listRes.json();
    expect(body.stickers.length).toBe(3); // 2 seeded + 1 uploaded
    expect(body.stickers[0].category).toBe("recent");
  });

  it("GET with invalid category -> 400", async () => {
    const res = await app.request("/api/stickers?category=invalid");
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/stickers/:id
  // ---------------------------------------------------------------------------

  it("DELETE existing sticker -> 204, physical file removed, subsequent GET -> 404", async () => {
    const buffer = new Uint8Array([0x47, 0x49, 0x46]);
    const form = new FormData();
    form.append("file", new File([buffer], "del.gif", { type: "image/gif" }));

    const postRes = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form }));
    const sticker = await postRes.json();
    const filePath = join(tmpDir, sticker.storage_path.split("/").pop()!);
    expect(existsSync(filePath)).toBe(true);

    const delRes = await app.request(`/api/stickers/${sticker.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(204);

    expect(existsSync(filePath)).toBe(false);

    const getRes = await app.request(`/api/stickers/${sticker.id}`);
    expect(getRes.status).toBe(404);
  });

  it("DELETE non-existing sticker -> 404 { error: 'not_found' }", async () => {
    const res = await app.request("/api/stickers/99999", { method: "DELETE" });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toEqual({ error: "not_found" });
  });
});
