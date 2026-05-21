import { describe, beforeEach, afterAll, it, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { createChatApp } from "../src/index.js";
import type { OpenAPIApp } from "mock-lib";

const tmpDir = mkdtempSync(join(tmpdir(), "chat-test-"));

describe("store and chat endpoints", () => {
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
  // GET /api/store/packs
  // ---------------------------------------------------------------------------

  it("GET /api/store/packs -> returns 4 packs with acquired flag", async () => {
    const res = await app.request("/api/store/packs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.packs.length).toBe(4);
    expect(body.packs[0].title).toBe("Cute Cats");
    expect(body.packs[0].acquired).toBe(false);
    expect(body.packs[0].previews.length).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // POST /api/store/packs/:id/acquire
  // ---------------------------------------------------------------------------

  it("acquire pack 1 -> creates 3 user_sticker rows and ownership record", async () => {
    const res = await app.request("/api/store/packs/1/acquire", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.acquired).toBe(true);

    // Verify ownership
    const listRes = await app.request("/api/store/packs");
    const listBody = await listRes.json();
    const pack1 = listBody.packs.find((p: any) => p.id === 1);
    expect(pack1.acquired).toBe(true);

    // Verify stickers created
    const stickerRes = await app.request("/api/stickers?category=recent");
    const stickerBody = await stickerRes.json();
    const pack1Stickers = stickerBody.stickers.filter((s: any) => s.pack_id === 1);
    expect(pack1Stickers.length).toBe(3);
  });

  it("re-acquire pack 1 -> idempotent, no duplicates", async () => {
    const r1 = await app.request("/api/store/packs/1/acquire", { method: "POST" });
    expect(r1.status).toBe(200);

    const r2 = await app.request("/api/store/packs/1/acquire", { method: "POST" });
    expect(r2.status).toBe(200);

    const stickerRes = await app.request("/api/stickers?category=recent");
    const stickerBody = await stickerRes.json();
    const pack1Stickers = stickerBody.stickers.filter((s: any) => s.pack_id === 1);
    expect(pack1Stickers.length).toBe(3);
  });

  it("acquire non-existent pack -> 404", async () => {
    const res = await app.request("/api/store/packs/99/acquire", { method: "POST" });
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // GET /api/channels
  // ---------------------------------------------------------------------------

  it("GET /api/channels -> returns 3 seeded channels", async () => {
    const res = await app.request("/api/channels");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels.length).toBe(3);
    expect(body.channels.map((c: any) => c.name)).toEqual(["#general", "#pets", "#space"]);
  });

  // ---------------------------------------------------------------------------
  // GET /api/channels/:id/messages
  // ---------------------------------------------------------------------------

  it("GET /api/channels/2/messages -> returns seeded messages sorted by sent_at ASC", async () => {
    const res = await app.request("/api/channels/2/messages");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.length).toBe(2);
    expect(body.messages[0].sender).toBe("Alice");
    expect(body.messages[1].sender).toBe("Bob");
  });

  it("GET /api/channels/99/messages -> 404", async () => {
    const res = await app.request("/api/channels/99/messages");
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // POST /api/channels/:id/messages
  // ---------------------------------------------------------------------------

  it("send chat message -> 201 and message appears in list", async () => {
    const postRes = await app.request("/api/channels/1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Hello world", message_kind: "chat" }),
    });
    expect(postRes.status).toBe(201);
    const postBody = await postRes.json();
    expect(postBody.id).toBeDefined();

    const listRes = await app.request("/api/channels/1/messages");
    const listBody = await listRes.json();
    const msg = listBody.messages.find((m: any) => m.id === postBody.id);
    expect(msg).toBeDefined();
    expect(msg.sender).toBe("You");
    expect(msg.body).toBe("Hello world");
  });

  it("send chat message without body -> 400", async () => {
    const res = await app.request("/api/channels/1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_kind: "chat" }),
    });
    expect(res.status).toBe(400);
  });

  it("send sticker message with owned custom sticker -> 201 and readable label", async () => {
    // Seeded sticker id=1 is a custom sticker (pack_id=NULL)
    const postRes = await app.request("/api/channels/2/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_kind: "sticker", sticker_id: 1 }),
    });
    expect(postRes.status).toBe(201);

    const listRes = await app.request("/api/channels/2/messages");
    const listBody = await listRes.json();
    const msg = listBody.messages.find((m: any) => m.message_kind === "sticker");
    expect(msg).toBeDefined();
    expect(msg.source_ref).toBe("1");
    expect(msg.body).toContain("[sticker: custom]");
  });

  it("send sticker message with owned pack sticker -> 201 and readable label", async () => {
    // Acquire pack 1 (Cute Cats) to create pack stickers
    const acquireRes = await app.request("/api/store/packs/1/acquire", { method: "POST" });
    expect(acquireRes.status).toBe(200);

    // Find the first pack sticker (should correspond to "Sleepy Cat")
    const stickerRes = await app.request("/api/stickers?category=recent");
    const stickerBody = await stickerRes.json();
    const packSticker = stickerBody.stickers.find((s: any) => s.pack_id === 1);
    expect(packSticker).toBeDefined();

    const postRes = await app.request("/api/channels/2/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_kind: "sticker", sticker_id: packSticker.id }),
    });
    expect(postRes.status).toBe(201);
    const postBody = await postRes.json();

    const listRes = await app.request("/api/channels/2/messages");
    const listBody = await listRes.json();
    const msg = listBody.messages.find((m: any) => m.id === postBody.id);
    expect(msg).toBeDefined();
    expect(msg.body).toContain("[sticker: Sleepy Cat]");
  });

  it("send sticker message with unowned sticker -> 400 not_found", async () => {
    const res = await app.request("/api/channels/2/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_kind: "sticker", sticker_id: 99999 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("sticker_not_found");
  });

  it("send sticker message with sticker owned by another user -> 403 sticker_not_owned", async () => {
    // Use a file-based DB so we can open a second connection for raw SQL
    const testDir = mkdtempSync(join(tmpdir(), "chat-403-test-"));
    const testChat = createChatApp({ dbPath: join(testDir, "chat.sqlite"), stickerDir: testDir });
    await testChat.seed!();

    const db = new Database(join(testDir, "chat.sqlite"));
    db.run("PRAGMA foreign_keys = ON");
    db.run("INSERT INTO mock_user (id, display_name) VALUES (?, ?)", [999, "Other"]);
    const result = db.run(
      "INSERT INTO user_sticker (user_id, pack_id, category, storage_path, mime_type, created_at, sort_order) VALUES (?, NULL, 'recent', '/static/test.svg', 'image/svg+xml', ?, 0)",
      [999, new Date().toISOString()],
    );
    const stickerId = Number(result.lastInsertRowid);
    db.close();

    const res = await testChat.app.request("/api/channels/2/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_kind: "sticker", sticker_id: stickerId }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("sticker_not_owned");

    rmSync(testDir, { recursive: true, force: true });
  });

  it("send message to non-existent channel -> 404", async () => {
    const res = await app.request("/api/channels/99/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "test", message_kind: "chat" }),
    });
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // GET /chat (server-side channel selection)
  // ---------------------------------------------------------------------------

  it("GET /chat?channel=2 renders messages for #pets server-side", async () => {
    const res = await app.request("/chat?channel=2");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("I love cats");
    expect(html).not.toContain("Show me a rocket");
  });

  it("GET /chat without query falls back to channel 1", async () => {
    const res = await app.request("/chat");
    expect(res.status).toBe(200);
    const html = await res.text();
    // Channel 1 (#general) has no seeded messages, so just verify it renders the chat page
    expect(html).toContain("#general");
  });

  it("GET /chat?channel=99 falls back to channel 1", async () => {
    const res = await app.request("/chat?channel=99");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("#general");
    // Fallback selects channel 1, so channel 3 messages should not appear
    expect(html).not.toContain("Show me a rocket");
    // Channel 1 should be the active one
    expect(html).toContain('class="channel-item active" data-channel-id="1"');
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/stickers/:id
  // ---------------------------------------------------------------------------

  it("PATCH category -> moves sticker and renumbers", async () => {
    // Upload a sticker to recent
    const buffer = new Uint8Array([0x47, 0x49, 0x46]);
    const form = new FormData();
    form.append("file", new File([buffer], "a.gif", { type: "image/gif" }));
    form.append("category", "recent");
    const postRes = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form }));
    const sticker = await postRes.json();

    const patchRes = await app.request(`/api/stickers/${sticker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "favorite" }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.category).toBe("favorite");

    const listRes = await app.request("/api/stickers?category=favorite");
    const listBody = await listRes.json();
    expect(listBody.stickers.length).toBeGreaterThanOrEqual(1);
  });

  it("PATCH sort_order -> clamps and renumbers", async () => {
    // Upload two stickers to recent
    const buffer = new Uint8Array([0x47, 0x49, 0x46]);

    const form1 = new FormData();
    form1.append("file", new File([buffer], "a.gif", { type: "image/gif" }));
    form1.append("category", "recent");
    const res1 = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form1 }));
    const s1 = await res1.json();

    const form2 = new FormData();
    form2.append("file", new File([buffer], "b.gif", { type: "image/gif" }));
    form2.append("category", "recent");
    const res2 = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form2 }));
    const s2 = await res2.json();

    // Move s2 to position 0
    const patchRes = await app.request(`/api/stickers/${s2.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort_order: 0 }),
    });
    expect(patchRes.status).toBe(200);

    const listRes = await app.request("/api/stickers?category=recent");
    const listBody = await listRes.json();
    const recentStickers = listBody.stickers.filter((s: any) => s.category === "recent");
    // All recent stickers should have sequential sort_order starting from 0
    const sortOrders = recentStickers.map((s: any) => s.sort_order).sort((a: number, b: number) => a - b);
    expect(sortOrders[0]).toBe(0);
    expect(sortOrders[1]).toBe(1);
  });

  it("PATCH sort_order on first sticker to 1 -> reorders correctly", async () => {
    // Remove seeded stickers so recent starts empty
    await app.request("/api/stickers/1", { method: "DELETE" });
    await app.request("/api/stickers/2", { method: "DELETE" });

    // Upload two stickers to recent
    const buffer = new Uint8Array([0x47, 0x49, 0x46]);

    const form1 = new FormData();
    form1.append("file", new File([buffer], "a.gif", { type: "image/gif" }));
    form1.append("category", "recent");
    const res1 = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form1 }));
    const s1 = await res1.json();

    const form2 = new FormData();
    form2.append("file", new File([buffer], "b.gif", { type: "image/gif" }));
    form2.append("category", "recent");
    const res2 = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form2 }));
    const s2 = await res2.json();

    // Patch the first uploaded sticker (s1) with sort_order: 0 to move it to the front
    const patchRes = await app.request(`/api/stickers/${s1.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort_order: 0 }),
    });
    expect(patchRes.status).toBe(200);

    const listRes = await app.request("/api/stickers?category=recent");
    const listBody = await listRes.json();
    const recentStickers = listBody.stickers.filter((s: any) => s.category === "recent");

    // All stickers in recent should have sequential sort_order values starting from 0
    const sortOrders = recentStickers.map((s: any) => s.sort_order).sort((a: number, b: number) => a - b);
    for (let i = 0; i < sortOrders.length; i++) {
      expect(sortOrders[i]).toBe(i);
    }

    // The patched sticker (s1) should now be at the front (position 0) because
    // it was set to sort_order 0 and has a lower id than s2
    const s1After = recentStickers.find((s: any) => s.id === s1.id);
    expect(s1After.sort_order).toBe(0);
  });

  it("PATCH non-existent sticker -> 404", async () => {
    const res = await app.request("/api/stickers/99999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "favorite" }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH with invalid category -> 400", async () => {
    const buffer = new Uint8Array([0x47, 0x49, 0x46]);
    const form = new FormData();
    form.append("file", new File([buffer], "a.gif", { type: "image/gif" }));
    const postRes = await app.request(new Request("http://localhost:5003/api/stickers", { method: "POST", body: form }));
    const sticker = await postRes.json();

    const patchRes = await app.request(`/api/stickers/${sticker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "invalid" }),
    });
    expect(patchRes.status).toBe(400);
  });
});
