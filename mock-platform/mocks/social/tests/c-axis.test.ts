import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetInjectionState } from "mock-lib";

describe("social C-axis fault injection", () => {
  let dataDir: string;
  let app: any;
  let db: any;
  let token: string;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "social-c-test-"));
    process.env.MOCK_DATA_DIR = dataDir;

    // Reset the DB singleton so getDb() opens a fresh DB in our temp dir
    const { resetDb } = await import("../src/db.ts");
    resetDb();

    const { createSocialApp } = await import("../src/index.tsx");
    const { getDb } = await import("../src/db.ts");
    const social = createSocialApp();
    app = social.app;
    db = getDb();

    // Login as alice
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "demo123" }),
    });
    const body = await res.json();
    token = body.session_token;
  });

  afterAll(() => {
    try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
    delete process.env.MOCK_DATA_DIR;
    delete process.env.TASK_NAME;
  });

  beforeEach(() => {
    resetInjectionState();
    delete process.env.TASK_NAME;
    // Clean up agent-created posts and likes from previous tests
    db.exec("DELETE FROM post WHERE id > 10");
    db.exec("DELETE FROM post_like WHERE post_id > 10 OR account_id = 2");
    db.exec("DELETE FROM post_action_log WHERE post_id > 10");
    db.exec("DELETE FROM post_metric WHERE post_id > 10");
    db.exec("DELETE FROM comment WHERE post_id > 10");
    db.exec("DELETE FROM post_tag WHERE post_id > 10");
  });

  function authHeaders() {
    return { Cookie: `token=${token}`, "Content-Type": "application/json" };
  }

  // ---------------------------------------------------------------------------
  // C1 — social-post-rate-limit
  // ---------------------------------------------------------------------------

  describe("C1: social-post-rate-limit", () => {
    test("returns 429 after agent has 2+ posts", async () => {
      process.env.TASK_NAME = "social-post-rate-limit";
      const headers = authHeaders();

      // Create 2 new posts (id > 10) to cross the threshold
      for (let i = 0; i < 2; i++) {
        const r = await app.request("/api/posts", {
          method: "POST",
          headers,
          body: JSON.stringify({ content: `Agent post ${i}` }),
        });
        expect(r.status).toBe(201);
      }

      // Third post triggers rate limit
      const rateLimited = await app.request("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "This should be rate limited" }),
      });
      expect(rateLimited.status).toBe(429);
      const body = await rateLimited.json();
      expect(body.error).toBe("RATE_LIMITED");
      expect(body.retry_after).toBe(30);
    });

    test("second rate-limit attempt succeeds (one-shot)", async () => {
      process.env.TASK_NAME = "social-post-rate-limit";
      const headers = authHeaders();

      // Create 2 posts
      for (let i = 0; i < 2; i++) {
        await app.request("/api/posts", {
          method: "POST",
          headers,
          body: JSON.stringify({ content: `Agent post ${i}` }),
        });
      }

      // First: rate limited
      const first = await app.request("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Rate limited" }),
      });
      expect(first.status).toBe(429);

      // Second: succeeds (one-shot fired)
      const second = await app.request("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Should succeed now" }),
      });
      expect(second.status).toBe(201);
      const body = await second.json();
      expect(body.post_id).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // C2 — social-unlike-verify
  // ---------------------------------------------------------------------------

  describe("C2: social-unlike-verify", () => {
    test("first unlike returns success but skips DB delete", async () => {
      process.env.TASK_NAME = "social-unlike-verify";
      const headers = authHeaders();

      // Create a post
      const postRes = await app.request("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Test post for unlike" }),
      });
      const post = await postRes.json();
      const postId = post.post_id;

      // Like the post
      const likeRes = await app.request(`/api/posts/${postId}/like`, {
        method: "POST",
        headers,
      });
      expect(likeRes.status).toBe(200);
      const likeData = await likeRes.json();
      expect(likeData.liked).toBe(true);

      // Unlike — C2 fires: returns success but skips DB delete
      const unlikeRes = await app.request(`/api/posts/${postId}/like`, {
        method: "POST",
        headers,
      });
      expect(unlikeRes.status).toBe(200);
      const unlikeData = await unlikeRes.json();
      expect(unlikeData.liked).toBe(false);

      // But GET should still show liked=true because DB delete was skipped
      const getRes = await app.request(`/api/posts/${postId}`, { headers });
      const getData = await getRes.json();
      expect(getData.liked).toBe(true);
    });

    test("second unlike actually deletes the like (one-shot)", async () => {
      process.env.TASK_NAME = "social-unlike-verify";
      const headers = authHeaders();

      // Create and like a post
      const postRes = await app.request("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Test post" }),
      });
      const postId = (await postRes.json()).post_id;

      await app.request(`/api/posts/${postId}/like`, { method: "POST", headers });

      // First unlike: silent fail
      await app.request(`/api/posts/${postId}/like`, { method: "POST", headers });

      // Second unlike: real delete
      const unlike2 = await app.request(`/api/posts/${postId}/like`, {
        method: "POST",
        headers,
      });
      expect(unlike2.status).toBe(200);

      // GET should show liked=false
      const getRes = await app.request(`/api/posts/${postId}`, { headers });
      const getData = await getRes.json();
      expect(getData.liked).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-C task — no injection
  // ---------------------------------------------------------------------------

  describe("non-C task: no fault injection", () => {
    test("posting works normally for non-C task", async () => {
      process.env.TASK_NAME = "social-media-posting";
      const headers = authHeaders();

      const res = await app.request("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Normal post" }),
      });
      expect(res.status).toBe(201);
    });

    test("unlike works normally for non-C task", async () => {
      process.env.TASK_NAME = "social-media-posting";
      const headers = authHeaders();

      const postRes = await app.request("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Normal post" }),
      });
      const postId = (await postRes.json()).post_id;

      await app.request(`/api/posts/${postId}/like`, { method: "POST", headers });

      const unlike = await app.request(`/api/posts/${postId}/like`, {
        method: "POST",
        headers,
      });
      expect(unlike.status).toBe(200);
      const unlikeData = await unlike.json();
      expect(unlikeData.liked).toBe(false);

      const getRes = await app.request(`/api/posts/${postId}`, { headers });
      expect((await getRes.json()).liked).toBe(false);
    });
  });
});
