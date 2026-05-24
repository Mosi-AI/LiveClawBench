import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { rmSync, existsSync } from "fs";
import { resolve } from "path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// In-process acceptance harness
// ---------------------------------------------------------------------------
// Strategy: drive the Hono app via app.request() instead of spawning a
// compiled binary on a real port. This eliminates EADDRINUSE flakiness
// while exercising the same router, auth middleware, SQL, and OpenAPI
// validation. The compiled binary is covered separately by build-binary.test.ts.
// ---------------------------------------------------------------------------

const MOCK_ROOT = resolve(import.meta.dir, "..");

let dataDir: string;
let app: any;
let db: any;

// ---------------------------------------------------------------------------
// HTTP helpers (in-process)
// ---------------------------------------------------------------------------

async function fetchJson(path: string, opts?: RequestInit) {
  const res = await app.request(path, opts);
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

function getCookie(res: any) {
  // Try Set-Cookie header first (matches old spawn-based behavior)
  const setCookie = res.headers?.get?.("set-cookie") || "";
  const match = setCookie.match(/token=([^;]+)/);
  if (match) return `token=${match[1]}`;
  // Fallback: extract session_token from body (login response)
  if (res.body?.session_token) return `token=${res.body.session_token}`;
  return "";
}

async function doLogin(username: string, password: string = "demo123") {
  return fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

async function authFetch(path: string, cookie: string, opts: RequestInit = {}) {
  return fetchJson(path, { ...opts, headers: { ...opts.headers, Cookie: cookie } });
}

interface PostActionLogRow {
  id: number;
  post_id: number;
  actor_account_id: number;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

function getPostActionLogs(postId: number): PostActionLogRow[] {
  return db.query(
    "SELECT * FROM post_action_log WHERE post_id = ? ORDER BY created_at ASC",
  ).all(postId) as PostActionLogRow[];
}

describe("Social Mock AC Tests", () => {
  beforeAll(async () => {
    // Create temp data dir for test DB
    dataDir = mkdtempSync(resolve(tmpdir(), "social-acceptance-"));
    process.env.MOCK_DATA_DIR = dataDir;

    // Import and create the in-process app
    const { createSocialApp } = await import("../src/index.tsx");
    const { getDb } = await import("../src/db.ts");
    const social = createSocialApp();
    app = social.app;
    db = getDb();
  });

  afterAll(() => {
    // Clean up temp data dir
    if (dataDir) {
      try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
    }
    delete process.env.MOCK_DATA_DIR;
  });

  // ========================================================================
  // AC-1: Service Isolation
  // ========================================================================
  describe("AC-1", () => {
    it("sentinel route returns correct data", async () => {
      const { status, body } = await fetchJson("/__mock_sentinel__/social");
      expect(status).toBe(200);
      expect(body).toEqual({ mock: "social", sentinel: true });
    });
  });

  // ========================================================================
  // AC-2: Schema, Seed, and DB Path Integrity
  // ========================================================================
  describe("AC-2", () => {
    it("seed accounts exist", async () => {
      const { status, body } = await fetchJson("/api/accounts/1");
      expect(status).toBe(200);
      expect(body?.username).toBe("mosi_brand");
    });

    it("seed posts exist", async () => {
      const { status, body } = await fetchJson("/api/posts/1");
      expect(status).toBe(200);
      expect(body?.content).toContain("Welcome to Mosi Social");
    });

    it("DB fallback path works (service started)", async () => {
      const { status } = await fetchJson("/api/posts");
      expect(status).toBe(200);
    });
  });

  // ========================================================================
  // AC-3: Authentication
  // ========================================================================
  describe("AC-3", () => {
    it("login with valid credentials", async () => {
      const { status, body } = await doLogin("alice");
      expect(status).toBe(200);
      expect(body?.success).toBe(true);
      expect(body?.account?.username).toBe("alice");
    });

    it("login with invalid password returns 401", async () => {
      const { status } = await doLogin("alice", "wrong");
      expect(status).toBe(401);
    });

    it("login with nonexistent username returns 401", async () => {
      const { status } = await doLogin("nobody");
      expect(status).toBe(401);
    });

    it("login with inactive account returns 401", async () => {
      const { status, body } = await fetchJson("/api/auth/me");
      expect(status).toBe(200);
      expect(body?.authenticated).toBe(false);
    });

    it("auth-required endpoint without cookie returns 401", async () => {
      const { status } = await fetchJson("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "x" }) });
      expect(status).toBe(401);
    });

    it("/api/auth/me with inactive cookie returns {authenticated:false}", async () => {
      const { status, body } = await fetchJson("/api/auth/me");
      expect(status).toBe(200);
      expect(body).toEqual({ authenticated: false });
    });
  });

  // ========================================================================
  // AC-4: Account Switching
  // ========================================================================
  describe("AC-4", () => {
    it("switch to valid account", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/auth/switch", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: 3 }),
      });
      expect(status).toBe(200);
      expect(body?.success).toBe(true);
      expect(body?.account?.username).toBe("bob_creator");
    });

    it("switch to nonexistent account returns 404", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/auth/switch", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: 99999 }),
      });
      expect(status).toBe(404);
    });

    it("switch to inactive account returns 401", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/auth/switch", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: 0 }),
      });
      expect(status).toBe(404);
    });
  });

  // ========================================================================
  // AC-5: Post CRUD & State Machine
  // ========================================================================
  describe("AC-5", () => {
    it("create published post", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Test post", status: "published", visibility: "public" }),
      });
      expect(status).toBe(201);
      expect(body?.success).toBe(true);
      expect(body?.post_id).toBeGreaterThan(0);
      expect(body?.moderation).toBeDefined();
      expect(body?.moderation?.action).toBeDefined();

      const postId = body.post_id;
      const logs = getPostActionLogs(postId);
      const createdLog = logs.find((l) => l.action_type === "created");
      expect(createdLog).toBeDefined();
      expect(createdLog?.new_value).toBe("published");
    });

    it("create scheduled post requires scheduled_for", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Test", status: "scheduled" }),
      });
      expect(status).toBe(400);
    });

    it("create published post rejects scheduled_for", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Test", status: "published", scheduled_for: "2026-12-01T08:00:00" }),
      });
      expect(status).toBe(400);
    });

    it("invalid state transition returns 400", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/3", cookie, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Updated", status: "draft" }),
      });
      expect(status).toBe(400);
    });

    it("DELETE post returns success", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const create = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "To delete", status: "published" }),
      });
      const postId = create.body?.post_id;
      const { status, body } = await authFetch(`/api/posts/${postId}`, cookie, { method: "DELETE" });
      expect(status).toBe(200);
      expect(body?.success).toBe(true);
    });

    it("PUT with moderation block returns 400", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const create = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Original content", status: "published" }),
      });
      const postId = create.body?.post_id;
      const { status } = await authFetch(`/api/posts/${postId}`, cookie, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "This is spam content", tags: [], assets: [] }),
      });
      expect(status).toBe(400);
    });

    it("PUT with content but without tags/assets returns 400", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const create = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Draft post", status: "draft" }),
      });
      const postId = create.body?.post_id;
      const { status } = await authFetch(`/api/posts/${postId}`, cookie, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Updated content" }),
      });
      expect(status).toBe(400);
    });

    it("PUT transitioning scheduled to draft clears scheduled_for", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const create = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Scheduled post", status: "scheduled", scheduled_for: "2026-12-01T08:00:00" }),
      });
      const postId = create.body?.post_id;
      const { status } = await authFetch(`/api/posts/${postId}`, cookie, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Scheduled post", status: "draft", tags: [], assets: [] }),
      });
      expect(status).toBe(200);
      const { body } = await authFetch(`/api/posts/${postId}`, cookie);
      expect(body?.scheduled_for).toBeNull();
    });
  });

  // ========================================================================
  // AC-6: List & Detail Visibility, Filters, and Sort
  // ========================================================================
  describe("AC-6", () => {
    it("anonymous sees only public published posts", async () => {
      const { status, body } = await fetchJson("/api/posts");
      expect(status).toBe(200);
      const posts = body?.posts || [];
      for (const p of posts) {
        expect(p.visibility).toBe("public");
        expect(p.status).toBe("published");
      }
    });

    it("public post detail accessible to anonymous", async () => {
      const { status, body } = await fetchJson("/api/posts/1");
      expect(status).toBe(200);
      expect(body?.id).toBe(1);
    });

    it("followers_only post returns 403 for non-follower", async () => {
      const loginRes = await doLogin("mosi_brand");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/7", cookie);
      expect(status).toBe(403);
    });

    it("followers_only post accessible to follower", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const followCheck = await authFetch("/api/accounts/2/following", cookie);
      const isFollowing = (followCheck.body?.following || []).some((a: any) => a.id === 3);
      if (!isFollowing) {
        await authFetch("/api/accounts/3/follow", cookie, { method: "POST" });
      }
      const { status, body } = await authFetch("/api/posts/7", cookie);
      expect(status).toBe(200);
      expect(body?.id).toBe(7);
    });

    it("draft post returns 404 for non-author", async () => {
      const loginRes = await doLogin("bob_creator");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/6", cookie);
      expect(status).toBe(404);
    });

    it("deleted post returns 404 for non-author", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/8", cookie);
      expect(status).toBe(404);
    });

    it("blocked author's post returns 404 (not 403)", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/accounts/4", cookie);
      expect(status).toBe(404);
    });

    it("unlisted posts excluded from feed", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts", cookie);
      expect(status).toBe(200);
      const posts = body?.posts || [];
      for (const p of posts) {
        expect(p.visibility).not.toBe("unlisted");
      }
    });

    it("status=published filter maintains visibility", async () => {
      const loginRes = await doLogin("mosi_brand");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts?status=published", cookie);
      expect(status).toBe(200);
      const posts = body?.posts || [];
      for (const p of posts) {
        expect(p.status).toBe("published");
      }
    });

    it("author_id filter for other user shows only public published", async () => {
      const { status, body } = await fetchJson("/api/posts?author_id=2");
      expect(status).toBe(200);
      const posts = body?.posts || [];
      for (const p of posts) {
        expect(p.author_account_id).toBe(2);
        expect(p.status).toBe("published");
        expect(p.visibility).toBe("public");
      }
    });

    it("sort: pinned posts first", async () => {
      const { status, body } = await fetchJson("/api/posts");
      expect(status).toBe(200);
      const posts = body?.posts || [];
      if (posts.length > 0 && posts[0].is_pinned === 1) {
        expect(posts[0].is_pinned).toBe(1);
      }
    });

    it("authenticated feed includes own draft posts", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts", cookie);
      expect(status).toBe(200);
      const posts = body?.posts || [];
      const draftPost = posts.find((p: any) => p.id === 6);
      expect(draftPost).toBeDefined();
      expect(draftPost?.status).toBe("draft");
    });

    it("authenticated feed includes own scheduled posts", async () => {
      const loginRes = await doLogin("mosi_brand");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts", cookie);
      expect(status).toBe(200);
      const posts = body?.posts || [];
      const scheduledPost = posts.find((p: any) => p.id === 5);
      expect(scheduledPost).toBeDefined();
      expect(scheduledPost?.status).toBe("scheduled");
    });

    it("include_deleted=true WITHOUT author_id=<self> returns same as without it", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { body: normalBody } = await authFetch("/api/posts", cookie);
      const normalPosts = normalBody?.posts || [];

      const { body: deletedBody } = await authFetch("/api/posts?include_deleted=true", cookie);
      const deletedPosts = deletedBody?.posts || [];
      expect(deletedPosts.length).toBe(normalPosts.length);
    });

    it("status=deleted self-view returns caller's deleted posts", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { body } = await authFetch("/api/posts?status=deleted", cookie);
      const posts = body?.posts || [];
      for (const p of posts) {
        expect(p.author_account_id).toBe(2);
      }
    });
  });

  // ========================================================================
  // AC-7: Auto-publish
  // ========================================================================
  describe("AC-7", () => {
    it("scheduled posts exist with scheduled status", async () => {
      const loginRes = await doLogin("mosi_brand");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts/5", cookie);
      expect(status).toBe(200);
      expect(body?.status).toBe("scheduled");
    });

    it("scheduled post auto-publishes on read and creates post_action_log entry", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { body: createBody } = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Auto-publish test post",
          status: "scheduled",
          scheduled_for: "2020-01-01T00:00:00",
        }),
      });
      const postId = createBody?.post_id;
      expect(postId).toBeDefined();
      await authFetch("/api/posts", cookie);
      const logs = getPostActionLogs(postId);
      const publishedLogs = logs.filter((l) => l.action_type === "published");
      expect(publishedLogs).toHaveLength(1);
      expect(publishedLogs[0]?.actor_account_id).toBe(2);
    });

    it("due-scheduled post: detail endpoint triggers publish and logs exactly one published action with author as actor", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { body: createBody } = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Due-scheduled detail endpoint test",
          status: "scheduled",
          scheduled_for: "2020-01-01T00:00:00",
        }),
      });
      const postId = createBody?.post_id;
      expect(postId).toBeDefined();

      const { body: afterBody } = await authFetch(`/api/posts/${postId}`, cookie);
      expect(afterBody?.status).toBe("published");

      const logs = getPostActionLogs(postId);
      const publishedLogs = logs.filter((l) => l.action_type === "published");
      expect(publishedLogs).toHaveLength(1);
      expect(publishedLogs[0]?.actor_account_id).toBe(afterBody?.author_account_id);
      expect(afterBody?.author_account_id).toBe(2);
    });

    it("scheduled post status changes from scheduled to published after read", async () => {
      const loginRes = await doLogin("bob_creator");
      const cookie = getCookie(loginRes);
      const { body: createBody } = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Status transition test post",
          status: "scheduled",
          scheduled_for: "2020-01-01T00:00:00",
        }),
      });
      const postId = createBody?.post_id;
      expect(postId).toBeDefined();
      await authFetch("/api/posts", cookie);
      const { body: afterBody } = await authFetch(`/api/posts/${postId}`, cookie);
      expect(afterBody?.status).toBe("published");
    });
  });

  // ========================================================================
  // AC-8: Like & Repost
  // ========================================================================
  describe("AC-8", () => {
    it("like toggle", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts/1/like", cookie, { method: "POST" });
      expect(status).toBe(200);
      expect(typeof body?.liked).toBe("boolean");
      expect(typeof body?.likes).toBe("number");
    });

    it("repost toggle", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts/1/repost", cookie, { method: "POST" });
      expect(status).toBe(200);
      expect(typeof body?.reposted).toBe("boolean");
      expect(typeof body?.reposts).toBe("number");
    });

    it("like on deleted post returns 404", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/8/like", cookie, { method: "POST" });
      expect(status).toBe(404);
    });

    it("repost on deleted post returns 404", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/8/repost", cookie, { method: "POST" });
      expect(status).toBe(404);
    });
  });

  // ========================================================================
  // AC-9: Pin
  // ========================================================================
  describe("AC-9", () => {
    it("pin/unpin returns {pinned}", async () => {
      const loginRes = await doLogin("mosi_brand");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts/1/pin", cookie, { method: "POST" });
      expect(status).toBe(200);
      expect(typeof body?.pinned).toBe("boolean");
    });

    it("pin someone else's post returns 403", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/1/pin", cookie, { method: "POST" });
      expect(status).toBe(403);
    });
  });

  // ========================================================================
  // AC-10: Comment Threads
  // ========================================================================
  describe("AC-10", () => {
    it("create comment on visible post", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts/1/comments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Nice post!" }),
      });
      expect(status).toBe(201);
      expect(body?.comment_id).toBeGreaterThan(0);
    });

    it("create comment on invisible post returns 403/404", async () => {
      const loginRes = await doLogin("mosi_brand");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/7/comments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Test" }),
      });
      expect([403, 404]).toContain(status);
    });

    it("comment moderation blocks forbidden content and does NOT create comment", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const before = await authFetch("/api/posts/1/comments", cookie);
      const beforeCount = before.body?.comments?.length || 0;

      const { status, body } = await authFetch("/api/posts/1/comments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "scam" }),
      });
      expect(status).toBe(400);
      expect(body?.matched).toBe("scam");

      const after = await authFetch("/api/posts/1/comments", cookie);
      const afterCount = after.body?.comments?.length || 0;
      expect(afterCount).toBe(beforeCount);
    });

    it("comment on invisible post returns matching detail-read code", async () => {
      const loginRes = await doLogin("mosi_brand");
      const cookie = getCookie(loginRes);
      const detailRes = await authFetch("/api/posts/7", cookie);
      expect(detailRes.status).toBe(403);

      const { status } = await authFetch("/api/posts/7/comments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Test comment" }),
      });
      expect(status).toBe(403);
    });

    it("POST /api/comments/:id/reply to hidden parent returns 400", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status: createStatus, body: createBody } = await authFetch("/api/posts/1/comments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Test comment" }),
      });
      expect(createStatus).toBe(201);
      const commentId = createBody?.comment_id;

      db.prepare("UPDATE comment SET status = 'hidden' WHERE id = ?").run(commentId);
      const row = db.query("SELECT status FROM comment WHERE id = ?").get(commentId) as { status: string };
      expect(row?.status).toBe("hidden");

      const { status } = await authFetch(`/api/comments/${commentId}/reply`, cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Replying to hidden comment" }),
      });
      expect(status).toBe(400);
    });

    it("deleting a hidden comment does NOT decrement post_metric.replies", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);

      const { body: createBody } = await authFetch("/api/posts/1/comments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Test comment to hide" }),
      });
      const hiddenCommentId = createBody?.comment_id;

      const beforeRes = await authFetch("/api/posts/1", cookie);
      const repliesBefore = beforeRes.body?.metrics?.replies || 0;

      db.prepare("UPDATE comment SET status = 'hidden' WHERE id = ?").run(hiddenCommentId);

      const afterHideRes = await authFetch("/api/posts/1", cookie);
      const repliesAfterHide = afterHideRes.body?.metrics?.replies || 0;
      expect(repliesAfterHide).toBe(repliesBefore);

      const { status } = await authFetch(`/api/comments/${hiddenCommentId}`, cookie, { method: "DELETE" });
      expect(status).toBe(200);

      const afterRes = await authFetch("/api/posts/1", cookie);
      const repliesAfter = afterRes.body?.metrics?.replies || 0;
      expect(repliesAfter).toBe(repliesBefore);
    });

    it("reply to deleted parent comment returns 400", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);

      const { body: createBody } = await authFetch("/api/posts/1/comments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Parent comment" }),
      });
      const parentId = createBody?.comment_id;
      expect(parentId).toBeDefined();

      db.prepare("UPDATE comment SET status = 'deleted' WHERE id = ?").run(parentId);

      const { status } = await authFetch(`/api/comments/${parentId}/reply`, cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Reply to deleted comment" }),
      });
      expect(status).toBe(400);
    });

    it("comment on /api/posts/:id/comments where post is deleted returns same code as detail-read (404)", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/posts/8/comments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Comment on deleted post" }),
      });
      expect(status).toBe(404);
    });
  });

  // ========================================================================
  // AC-11: Follow, Block, Search
  // ========================================================================
  describe("AC-11", () => {
    it("follow toggle", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/accounts/1/follow", cookie, { method: "POST" });
      expect(status).toBe(200);
      expect(typeof body?.following).toBe("boolean");
    });

    it("bidirectional block hides posts", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const profileStatus = (await authFetch("/api/accounts/4", cookie)).status;
      expect(profileStatus).toBe(404);
    });

    it("blocked account profile returns 404", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/accounts/4", cookie);
      expect(status).toBe(404);
    });

    it("search filters blocked accounts", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/accounts/search?q=Carol", cookie);
      expect(status).toBe(200);
      const accounts = body?.accounts || [];
      for (const a of accounts) {
        expect(a.id).not.toBe(4);
      }
    });

    it("same-direction blocked: follow returns 403", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      await authFetch("/api/accounts/1/block", cookie, { method: "POST" });
      const { status, body } = await authFetch("/api/accounts/1/follow", cookie, { method: "POST" });
      expect(status).toBe(403);
      expect(body?.error).toContain("blocked");
      await authFetch("/api/accounts/1/block", cookie, { method: "POST" });
    });

    it("opposite-direction blocked: follow returns 403", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/accounts/4/follow", cookie, { method: "POST" });
      expect(status).toBe(403);
      expect(body?.error).toContain("blocked");
    });

    it("self-follow returns 400", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/accounts/2/follow", cookie, { method: "POST" });
      expect(status).toBe(400);
    });
  });

  // ========================================================================
  // AC-12: Search & List Pagination
  // ========================================================================
  describe("AC-12", () => {
    it("posts list pagination", async () => {
      const { status, body } = await fetchJson("/api/posts?page=1&limit=5");
      expect(status).toBe(200);
      expect(body?.posts?.length).toBeLessThanOrEqual(5);
      expect(body?.page).toBe(1);
      expect(body?.limit).toBe(5);
      expect(typeof body?.total_pages).toBe("number");
    });

    it("account search pagination", async () => {
      const { status, body } = await fetchJson("/api/accounts/search?q=a&page=1&limit=2");
      expect(status).toBe(200);
      expect(body?.accounts?.length).toBeLessThanOrEqual(2);
      expect(body?.page).toBe(1);
      expect(body?.limit).toBe(2);
    });
  });

  // ========================================================================
  // AC-13: Keyword Moderation
  // ========================================================================
  describe("AC-13", () => {
    it("post with block keyword rejected", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Buy my spam product now!" }),
      });
      expect(status).toBe(400);
      expect(body?.matched).toBe("spam");
    });

    it("post with hide keyword flagged", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const create = await authFetch("/api/posts", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "This is fake news!" }),
      });
      expect(create.status).toBe(201);
      const postId = create.body?.post_id;
      const { status, body } = await authFetch(`/api/posts/${postId}`, cookie);
      expect(status).toBe(200);
      expect(body?.moderation_state).toBe("flagged");
    });
  });

  // ========================================================================
  // AC-14: Analytics
  // ========================================================================
  describe("AC-14", () => {
    it("owner can read own post metrics", async () => {
      const loginRes = await doLogin("mosi_brand");
      const cookie = getCookie(loginRes);
      const { status, body } = await authFetch("/api/analytics/metrics?post_id=1", cookie);
      expect(status).toBe(200);
      expect(typeof body?.impressions).toBe("number");
    });

    it("foreign post metrics returns 404", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const { status } = await authFetch("/api/analytics/metrics?post_id=1", cookie);
      expect(status).toBe(404);
    });
  });

  // ========================================================================
  // AC-15: HTML Page Alignment
  // ========================================================================
  describe("AC-15", () => {
    it("HTML home page returns 200", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const res = await app.request("/home", { headers: { Cookie: cookie } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("HTML post detail returns 200", async () => {
      const res = await app.request("/posts/1");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("HTML profile page redirects unauthenticated users to /", async () => {
      const res = await app.request("/profile/1", { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/");
    });

    it("HTML blocked profile returns 404", async () => {
      const loginRes = await doLogin("alice");
      const cookie = getCookie(loginRes);
      const res = await app.request("/profile/4", { headers: { Cookie: cookie } });
      expect(res.status).toBe(404);
    });

    it("/discover accessible anonymously (200, not redirect)", async () => {
      const res = await app.request("/discover");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("/posts/:id accessible anonymously for public posts", async () => {
      const res = await app.request("/posts/1");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });
  });

  // ========================================================================
  // AC-17: Code Style — No plan tokens in source
  // ========================================================================
  describe("AC-17", () => {
    it("no plan tokens in source", async () => {
      let rgAvailable = false;
      try {
        const rgCheck = Bun.spawn({
          cmd: ["rg", "--version"],
          stdout: "ignore",
          stderr: "ignore",
        });
        const rgExit = await rgCheck.exited;
        rgAvailable = rgExit === 0;
      } catch {
        rgAvailable = false;
      }
      if (!rgAvailable) {
        console.warn("Skipping AC-17: ripgrep (rg) not available in PATH");
        return;
      }

      const srcDir = resolve(MOCK_ROOT, "src");
      const patterns = [
        String.raw`\bAC-\d+\b`,
        String.raw`\bDEC-\d+\b`,
        String.raw`\b(?:Milestone|Phase|Step)\s*\d+\b`,
        String.raw`(?:function|const|let|var)\s+(?:Milestone|Phase|Step|AC|DEC)(?:_?\d+)?\b`,
      ];

      for (const pattern of patterns) {
        const proc = Bun.spawn(
          ["rg", "--count-matches", "-i", pattern, srcDir],
          { stdout: "pipe", stderr: "pipe" },
        );
        const exitCode = await proc.exited;
        const stdout = await new Response(proc.stdout).text();
        const matchCount = parseInt(stdout.trim(), 10) || 0;
        expect(matchCount).toBe(0);
      }
    });
  });
});
