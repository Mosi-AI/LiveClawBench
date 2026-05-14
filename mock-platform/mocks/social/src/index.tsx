/** @jsxImportSource hono/jsx */
/**
 * Social mock service — Social Media Platform
 *
 * Implements: Auth, Posts, Comments, Accounts, Keyword Rules, Analytics APIs
 * plus 11 HTML pages (TSX) with inline CSS.
 */

import { createMockApp, startServer, sign, verify, tokenCookieOptions, authRequired, authOptional } from "mock-lib";
import type { AppEnv, MockAppV2 } from "mock-lib";
import { Hono } from "hono";
import { html } from "hono/html";
import type { FC } from "hono/jsx";
import { getDb, publishDueScheduledPosts } from "./db";
import { visibilityCode, feedVisibilityWhere, applyBlockFilter, validateTransition, isFollowing, isBlocked } from "./access";
import { applyModeration } from "./moderation";
import type { Database } from "bun:sqlite";

// DB query functions (extracted to separate module)
import {
  getAccountById,
  getAccountByUsername,
  getPostById,
  getPostTags,
  getPostAssets,
  getPostMetrics,
  getFollowerCount,
  getFollowingCount,
  getPostCount,
  isLiked,
  isReposted,
  normalizeTag,
  escapeLikePattern,
} from "./db-queries";

// Page components (extracted to separate module)
import {
  LoginPage,
  HomePage,
  ComposePage,
  PostDetailPage,
  ManagementPage,
  CalendarPage,
  DiscoverPage,
  ModerationPage,
  AnalyticsPage,
  ProfilePage,
} from "./pages";

// ---------------------------------------------------------------------------
// String enums — kept in sync with the CHECK constraints declared in db.ts.
// Using string-literal unions (instead of `string`) lets the TypeScript
// compiler catch typos at call sites and helps IDE autocompletion.
export type AccountType = "company" | "personal" | "creator" | "partner";
export type PostStatus = "draft" | "scheduled" | "published" | "deleted";
export type PostVisibility = "public" | "followers_only" | "unlisted";
export type ModerationState = "clear" | "flagged";
export type PostAssetType = "image" | "video" | "link_preview";
export type CommentStatus = "visible" | "hidden" | "deleted";
export type FollowStatus = "following" | "blocked";
export type KeywordMatchMode = "exact" | "contains" | "prefix";
export type KeywordScope = "post" | "comment";
export type KeywordAction = "warn" | "block" | "hide";

// Types (re-exported for external use)
// ---------------------------------------------------------------------------

export interface Account {
  id: number;
  username: string;
  password: string;
  display_name: string;
  account_type: AccountType;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  location: string | null;
  timezone: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Post {
  id: number;
  author_account_id: number;
  content: string;
  status: PostStatus;
  visibility: PostVisibility;
  moderation_state: ModerationState;
  scheduled_for: string | null;
  scheduled_timezone: string | null;
  published_at: string | null;
  deleted_at: string | null;
  is_pinned: number;
  has_event_cta: number;
  created_at: string;
  updated_at: string;
}

export interface PostAsset {
  id: number;
  post_id: number;
  asset_type: PostAssetType;
  asset_url: string;
  preview_text: string | null;
  alt_text: string | null;
  sort_order: number;
}

export interface Tag {
  id: number;
  label_text: string;
  normalized_name: string;
}

export interface PostMetric {
  id: number;
  post_id: number;
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  clicks: number;
  profile_visits: number;
  new_followers: number;
  last_synced_at: string;
}

export interface Comment {
  id: number;
  post_id: number;
  author_account_id: number | null;
  author_name: string;
  body: string;
  status: CommentStatus;
  parent_comment_id: number | null;
  created_at: string;
  updated_at: string;
  replies?: Comment[];
}

export interface KeywordRule {
  id: number;
  owner_account_id: number;
  phrase: string;
  match_mode: KeywordMatchMode;
  scope: KeywordScope;
  action: KeywordAction;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface FollowRelation {
  id: number;
  follower_account_id: number;
  target_account_id: number;
  status: FollowStatus;
  created_at: string;
  updated_at: string;
}

export interface EventCampaign {
  id: number;
  post_id: number;
  event_title: string;
  start_at: string;
  end_at: string | null;
  registration_url: string;
  registrations_count: number;
  attendance_goal: number;
  status: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

function registerRoutes(app: Hono<AppEnv>): void {
  const db = getDb();

  // Sentinel
  app.get("/__mock_sentinel__/social", (c) => c.json({ mock: "social", sentinel: true }));

  // -------------------------------------------------------------------------
  // Auth API
  // -------------------------------------------------------------------------

  app.post("/api/auth/login", async (c) => {
    let body: { username?: string; password?: string };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const { username, password } = body;
    if (!username || !password) return c.json({ error: "username and password required" }, 400);

    const account = getAccountByUsername(db, username);
    if (!account || account.password !== password) {
      return c.json({ error: "Invalid credentials" }, 401);
    }
    if (account.is_active === 0) {
      return c.json({ error: "Account is inactive" }, 401);
    }

    const token = await sign({ userId: account.id });
    const opts = tokenCookieOptions();
    c.header("Set-Cookie", `token=${token}; HttpOnly; Path=${opts.path}; Max-Age=${opts.maxAge}; SameSite=${opts.sameSite}${opts.secure ? "; Secure" : ""}`);
    return c.json({ success: true, account: { id: account.id, username: account.username, display_name: account.display_name }, session_token: token });
  });

  app.post("/api/auth/logout", (c) => {
    c.header("Set-Cookie", `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`);
    return c.json({ success: true });
  });

  app.get("/api/auth/me", authOptional, (c) => {
    const userId = c.var.userId;
    if (!userId) return c.json({ authenticated: false }, 200);
    const account = getAccountById(db, userId);
    if (!account || account.is_active === 0) return c.json({ authenticated: false }, 200);
    return c.json({
      authenticated: true,
      account: { id: account.id, username: account.username, display_name: account.display_name, account_type: account.account_type },
    });
  });

  app.post("/api/auth/switch", authRequired, async (c) => {
    let body: { account_id?: number };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const targetId = body.account_id;
    if (targetId == null) return c.json({ error: "account_id required" }, 400);

    const account = getAccountById(db, targetId);
    if (!account) return c.json({ error: "Account not found" }, 404);
    if (account.is_active === 0) {
      return c.json({ error: "Account is inactive" }, 401);
    }

    const token = await sign({ userId: account.id });
    const opts = tokenCookieOptions();
    c.header("Set-Cookie", `token=${token}; HttpOnly; Path=${opts.path}; Max-Age=${opts.maxAge}; SameSite=${opts.sameSite}${opts.secure ? "; Secure" : ""}`);
    return c.json({ success: true, account: { id: account.id, username: account.username, display_name: account.display_name } });
  });

  // -------------------------------------------------------------------------
  // Posts API
  // -------------------------------------------------------------------------

  app.get("/api/posts", authOptional, (c) => {
    publishDueScheduledPosts(db);
    const userId = c.var.userId;
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10) || 20));
    const statusFilter = c.req.query("status");
    const visibilityFilter = c.req.query("visibility");
    const authorIdParam = c.req.query("author_id");
    const includeDeleted = c.req.query("include_deleted") === "true";

    const authorId = authorIdParam ? parseInt(authorIdParam, 10) : undefined;
    if (authorIdParam && isNaN(authorId!)) return c.json({ error: "Invalid author_id" }, 400);

    // Self-status query: draft/scheduled/deleted for own posts bypasses feedVisibilityWhere.
    // The user owns those posts regardless of visibility rules.
    const selfStatusFilters = ["draft", "scheduled", "deleted"];
    const isSelfStatusQuery =
      statusFilter && selfStatusFilters.includes(statusFilter) && userId !== undefined && authorId === userId;

    // Guard: self-status filters require authentication
    if (statusFilter && selfStatusFilters.includes(statusFilter)) {
      if (userId === undefined || authorId !== userId) {
        return c.json({ error: "Authentication required" }, 401);
      }
    }

    if (isSelfStatusQuery) {
      if (!userId) return c.json({ error: "Authentication required" }, 401);
      const selfWhere = "p.author_account_id = ? AND p.status = ?";
      const selfParams: any[] = [userId, statusFilter];

      const countRow = db.query(`SELECT COUNT(*) as cnt FROM post p WHERE ${selfWhere}`).get(...selfParams) as { cnt: number };
      const total = countRow.cnt;

      const posts = db.query(`
        SELECT p.*, a.username as author_username, a.display_name as author_display_name
        FROM post p
        JOIN account a ON a.id = p.author_account_id
        WHERE ${selfWhere}
        ORDER BY p.is_pinned DESC, COALESCE(p.published_at, p.created_at) DESC, p.id DESC
        LIMIT ? OFFSET ?
      `).all(...selfParams, limit, (page - 1) * limit) as Array<Post & { author_username: string; author_display_name: string }>;

      const result = posts.map((p) => ({
        ...p,
        tags: getPostTags(db, p.id),
        assets: getPostAssets(db, p.id),
        metrics: getPostMetrics(db, p.id),
        liked: userId ? isLiked(db, p.id, userId) : false,
        reposted: userId ? isReposted(db, p.id, userId) : false,
        like_count: (db.query("SELECT COUNT(*) as cnt FROM post_like WHERE post_id = ?").get(p.id) as { cnt: number }).cnt,
        repost_count: (db.query("SELECT COUNT(*) as cnt FROM post_repost WHERE post_id = ?").get(p.id) as { cnt: number }).cnt,
        reply_count: (db.query("SELECT COUNT(*) as cnt FROM comment WHERE post_id = ? AND status = 'visible'").get(p.id) as { cnt: number }).cnt,
      }));

      return c.json({ posts: result, total, page, limit, total_pages: Math.ceil(total / limit) });
    }

    // Standard feed query path
    const showOwnDeleted = includeDeleted && userId !== undefined && authorId === userId;
    const feedVis = feedVisibilityWhere(userId, showOwnDeleted);
    const whereParts: string[] = [feedVis.sql];
    const params: any[] = [...feedVis.params];

    const blockedIds = applyBlockFilter(db, userId);
    if (blockedIds.length > 0) {
      whereParts.push(`p.author_account_id NOT IN (${blockedIds.join(",")})`);
    }

    if (statusFilter) {
      whereParts.push("p.status = ?");
      params.push(statusFilter);
    }
    if (visibilityFilter && !statusFilter) {
      whereParts.push("p.visibility = ?");
      params.push(visibilityFilter);
    }
    if (authorId !== undefined) {
      whereParts.push("p.author_account_id = ?");
      params.push(authorId);
    }

    const whereSql = whereParts.join(" AND ");

    const countRow = db.query(`SELECT COUNT(*) as cnt FROM post p WHERE ${whereSql}`).get(...params) as { cnt: number };
    const total = countRow.cnt;

    const posts = db.query(`
      SELECT p.*, a.username as author_username, a.display_name as author_display_name
      FROM post p
      JOIN account a ON a.id = p.author_account_id
      WHERE ${whereSql}
      ORDER BY p.is_pinned DESC, COALESCE(p.published_at, p.created_at) DESC, p.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, (page - 1) * limit) as Array<Post & { author_username: string; author_display_name: string }>;

    const result = posts.map((p) => ({
      ...p,
      tags: getPostTags(db, p.id),
      assets: getPostAssets(db, p.id),
      metrics: getPostMetrics(db, p.id),
      liked: userId ? isLiked(db, p.id, userId) : false,
      reposted: userId ? isReposted(db, p.id, userId) : false,
      like_count: (db.query("SELECT COUNT(*) as cnt FROM post_like WHERE post_id = ?").get(p.id) as { cnt: number }).cnt,
      repost_count: (db.query("SELECT COUNT(*) as cnt FROM post_repost WHERE post_id = ?").get(p.id) as { cnt: number }).cnt,
      reply_count: (db.query("SELECT COUNT(*) as cnt FROM comment WHERE post_id = ? AND status = 'visible'").get(p.id) as { cnt: number }).cnt,
    }));

    return c.json({ posts: result, total, page, limit, total_pages: Math.ceil(total / limit) });
  });

  app.post("/api/posts", authRequired, async (c) => {
    publishDueScheduledPosts(db);
    const userId = c.var.userId!;
    let body: { content?: string; visibility?: string; status?: string; scheduled_for?: string; tags?: string[]; assets?: any[] };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

    const content = (body.content ?? "").trim();
    if (!content) return c.json({ error: "content required" }, 400);

    const visibility = body.visibility || "public";
    const status = body.status || "published";
    const scheduledFor = body.scheduled_for || null;

    if (status === "scheduled" && !scheduledFor) {
      return c.json({ error: "scheduled_for is required when status is 'scheduled'" }, 400);
    }
    if (status === "published" && scheduledFor) {
      return c.json({ error: "scheduled_for is not valid when status is 'published'" }, 400);
    }

    const mod = applyModeration(db, content, "post");
    if (mod.action === "block") {
      return c.json({ error: "Blocked by keyword rule", matched: mod.matched, rule_id: mod.rule_id }, 400);
    }
    const moderationState = mod.action === "hide" ? "flagged" : "clear";

    const insert = db.prepare(`
      INSERT INTO post (author_account_id, content, status, visibility, moderation_state, scheduled_for, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const publishedAt = status === "published" ? new Date().toISOString() : null;
    const result = insert.run(userId, content, status, visibility, moderationState, scheduledFor, publishedAt);
    const postId = Number(result.lastInsertRowid);

    const tagList = body.tags || [];
    for (let i = 0; i < tagList.length; i++) {
      const label = tagList[i];
      const normalized = normalizeTag(label);
      if (!normalized) continue;
      let tagId: number;
      const existing = db.query("SELECT id FROM tag WHERE normalized_name = ?").get(normalized) as { id: number } | null;
      if (existing) {
        tagId = existing.id;
      } else {
        const tr = db.prepare("INSERT INTO tag (label_text, normalized_name) VALUES (?, ?)").run(label, normalized);
        tagId = Number(tr.lastInsertRowid);
      }
      db.prepare("INSERT INTO post_tag (post_id, tag_id, sort_order) VALUES (?, ?, ?)").run(postId, tagId, i);
    }

    const assetList = body.assets || [];
    for (let i = 0; i < assetList.length; i++) {
      const a = assetList[i];
      db.prepare("INSERT INTO post_asset (post_id, asset_type, asset_url, preview_text, alt_text, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
        .run(postId, a.asset_type || "image", a.asset_url || "", a.preview_text || null, a.alt_text || null, i);
    }

    db.prepare("INSERT INTO post_metric (post_id) VALUES (?)").run(postId);

    db.prepare("INSERT INTO post_action_log (post_id, actor_account_id, action_type, new_value) VALUES (?, ?, ?, ?)")
      .run(postId, userId, "created", status);

    const response: any = { success: true, post_id: postId, moderation: { action: mod.action, matched: mod.matched, rule_id: mod.rule_id } };
    if (mod.action === "warn") response.warning = mod.matched;
    return c.json(response, 201);
  });

  app.get("/api/posts/:id", authOptional, (c) => {
    publishDueScheduledPosts(db);
    const postId = parseInt(c.req.param("id"), 10);
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = db.query(`
      SELECT p.*, a.username as author_username, a.display_name as author_display_name
      FROM post p
      JOIN account a ON a.id = p.author_account_id
      WHERE p.id = ?
    `).get(postId) as (Post & { author_username: string; author_display_name: string }) | null;

    if (!post) return c.json({ error: "Post not found" }, 404);

    const userId = c.var.userId;
    const code = visibilityCode(post, userId, db);
    if (code !== "allow") {
      return c.json({ error: "Not authorized to view this post" }, code === "404" ? 404 : 403);
    }

    const likeCount = db.query("SELECT COUNT(*) as cnt FROM post_like WHERE post_id = ?").get(postId) as { cnt: number };
    const repostCount = db.query("SELECT COUNT(*) as cnt FROM post_repost WHERE post_id = ?").get(postId) as { cnt: number };
    const replyCount = db.query("SELECT COUNT(*) as cnt FROM comment WHERE post_id = ? AND status = 'visible'").get(postId) as { cnt: number };

    return c.json({
      ...post,
      tags: getPostTags(db, postId),
      assets: getPostAssets(db, postId),
      metrics: getPostMetrics(db, postId),
      liked: userId ? isLiked(db, postId, userId) : false,
      reposted: userId ? isReposted(db, postId, userId) : false,
      like_count: likeCount.cnt,
      repost_count: repostCount.cnt,
      reply_count: replyCount.cnt,
    });
  });

  app.put("/api/posts/:id", authRequired, async (c) => {
    const postId = parseInt(c.req.param("id"), 10);
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = getPostById(db, postId);
    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.author_account_id !== c.var.userId) return c.json({ error: "Not authorized" }, 403);

    let body: { content?: string; status?: string; visibility?: string; scheduled_for?: string | null; scheduled_timezone?: string; tags?: string[]; assets?: any[] };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

    const otherKeys = ["content", "status", "visibility", "scheduled_for", "scheduled_timezone"].some((k) => k in body);
    if (otherKeys && (!("tags" in body) || !("assets" in body))) {
      return c.json({ error: "tags and assets are required when updating content, status, visibility, or scheduled fields" }, 400);
    }

    if (body.status !== undefined && body.status !== post.status) {
      if (!validateTransition(post.status, body.status)) {
        return c.json({ error: `Invalid transition from ${post.status} to ${body.status}` }, 400);
      }
    }

    const effectiveStatus = body.status !== undefined ? body.status : post.status;
    if (("scheduled_for" in body || "scheduled_timezone" in body) && effectiveStatus !== "scheduled") {
      return c.json({ error: "scheduled_for and scheduled_timezone are only valid when status is 'scheduled'" }, 400);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (body.content !== undefined) {
      const mod = applyModeration(db, body.content, "post");
      if (mod.action === "block") {
        return c.json({ error: "Blocked by keyword rule", matched: mod.matched, rule_id: mod.rule_id }, 400);
      }
      updates.push("content = ?");
      params.push(body.content);
      updates.push("moderation_state = ?");
      params.push(mod.action === "hide" ? "flagged" : "clear");
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      params.push(body.status);
      if (body.status === "published" && !post.published_at) {
        updates.push("published_at = datetime('now')");
      }
      if (body.status === "draft" && post.status === "scheduled") {
        updates.push("scheduled_for = NULL");
      }
    }
    if (body.visibility !== undefined) {
      updates.push("visibility = ?");
      params.push(body.visibility);
    }
    if (body.scheduled_for !== undefined) {
      updates.push("scheduled_for = ?");
      params.push(body.scheduled_for);
    }
    if (body.scheduled_timezone !== undefined) {
      updates.push("scheduled_timezone = ?");
      params.push(body.scheduled_timezone);
    }
    updates.push("updated_at = datetime('now')");

    params.push(postId);
    db.query(`UPDATE post SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    if (body.tags !== undefined) {
      db.prepare("DELETE FROM post_tag WHERE post_id = ?").run(postId);
      for (let i = 0; i < body.tags.length; i++) {
        const label = body.tags[i];
        const normalized = normalizeTag(label);
        if (!normalized) continue;
        let tagId: number;
        const existing = db.query("SELECT id FROM tag WHERE normalized_name = ?").get(normalized) as { id: number } | null;
        if (existing) {
          tagId = existing.id;
        } else {
          const tr = db.prepare("INSERT INTO tag (label_text, normalized_name) VALUES (?, ?)").run(label, normalized);
          tagId = Number(tr.lastInsertRowid);
        }
        db.prepare("INSERT INTO post_tag (post_id, tag_id, sort_order) VALUES (?, ?, ?)").run(postId, tagId, i);
      }
    }

    if (body.assets !== undefined) {
      db.prepare("DELETE FROM post_asset WHERE post_id = ?").run(postId);
      for (let i = 0; i < body.assets.length; i++) {
        const a = body.assets[i];
        db.prepare("INSERT INTO post_asset (post_id, asset_type, asset_url, preview_text, alt_text, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
          .run(postId, a.asset_type || "image", a.asset_url || "", a.preview_text || null, a.alt_text || null, i);
      }
    }

    db.prepare("INSERT INTO post_action_log (post_id, actor_account_id, action_type, new_value) VALUES (?, ?, ?, ?)")
      .run(postId, c.var.userId, "updated", JSON.stringify(body));

    return c.json({ success: true });
  });

  app.delete("/api/posts/:id", authRequired, (c) => {
    const postId = parseInt(c.req.param("id"), 10);
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = getPostById(db, postId);
    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.author_account_id !== c.var.userId) return c.json({ error: "Not authorized" }, 403);

    if (!validateTransition(post.status, "deleted")) {
      return c.json({ error: `Cannot transition from ${post.status} to deleted` }, 400);
    }

    db.prepare("UPDATE post SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(postId);
    db.prepare("INSERT INTO post_action_log (post_id, actor_account_id, action_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)")
      .run(postId, c.var.userId, "deleted", post.status, "deleted");

    return c.json({ success: true });
  });

  app.post("/api/posts/:id/restore", authRequired, (c) => {
    const postId = parseInt(c.req.param("id"), 10);
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = getPostById(db, postId);
    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.author_account_id !== c.var.userId) return c.json({ error: "Not authorized" }, 403);

    if (!validateTransition(post.status, "draft")) {
      return c.json({ error: `Cannot transition from ${post.status} to draft` }, 400);
    }

    db.prepare("UPDATE post SET status = 'draft', deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(postId);
    db.prepare("INSERT INTO post_action_log (post_id, actor_account_id, action_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)")
      .run(postId, c.var.userId, "updated", "deleted", "draft");

    return c.json({ success: true });
  });

  app.post("/api/posts/:id/pin", authRequired, (c) => {
    const postId = parseInt(c.req.param("id"), 10);
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = getPostById(db, postId);
    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.author_account_id !== c.var.userId) return c.json({ error: "Not authorized" }, 403);

    const newPinned = post.is_pinned ? 0 : 1;

    if (newPinned) {
      db.prepare("UPDATE post SET is_pinned = 0 WHERE author_account_id = ? AND is_pinned = 1").run(c.var.userId);
    }

    db.prepare("UPDATE post SET is_pinned = ?, updated_at = datetime('now') WHERE id = ?").run(newPinned, postId);
    db.prepare("INSERT INTO post_action_log (post_id, actor_account_id, action_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)")
      .run(postId, c.var.userId, newPinned ? "pinned" : "unpinned", String(post.is_pinned), String(newPinned));

    return c.json({ pinned: newPinned === 1 });
  });

  app.post("/api/posts/:id/like", authRequired, (c) => {
    const postId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = getPostById(db, postId);
    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.status === "deleted") return c.json({ error: "Post not found" }, 404);

    const code = visibilityCode(post, userId, db);
    if (code !== "allow") {
      return c.json({ error: "Not authorized" }, code === "404" ? 404 : 403);
    }

    const existing = db.query("SELECT id FROM post_like WHERE post_id = ? AND account_id = ?").get(postId, userId) as { id: number } | null;
    if (existing) {
      db.prepare("DELETE FROM post_like WHERE post_id = ? AND account_id = ?").run(postId, userId);
      db.prepare("UPDATE post_metric SET likes = MAX(0, likes - 1) WHERE post_id = ?").run(postId);
      const likes = (db.query("SELECT likes FROM post_metric WHERE post_id = ?").get(postId) as { likes: number } | null)?.likes ?? 0;
      return c.json({ liked: false, likes });
    } else {
      db.prepare("INSERT INTO post_like (post_id, account_id) VALUES (?, ?)").run(postId, userId);
      db.prepare("UPDATE post_metric SET likes = likes + 1 WHERE post_id = ?").run(postId);
      const likes = (db.query("SELECT likes FROM post_metric WHERE post_id = ?").get(postId) as { likes: number } | null)?.likes ?? 0;
      return c.json({ liked: true, likes });
    }
  });

  app.post("/api/posts/:id/repost", authRequired, (c) => {
    const postId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = getPostById(db, postId);
    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.status === "deleted") return c.json({ error: "Post not found" }, 404);

    const code = visibilityCode(post, userId, db);
    if (code !== "allow") {
      return c.json({ error: "Not authorized" }, code === "404" ? 404 : 403);
    }

    const existing = db.query("SELECT id FROM post_repost WHERE post_id = ? AND account_id = ?").get(postId, userId) as { id: number } | null;
    if (existing) {
      db.prepare("DELETE FROM post_repost WHERE post_id = ? AND account_id = ?").run(postId, userId);
      db.prepare("UPDATE post_metric SET reposts = MAX(0, reposts - 1) WHERE post_id = ?").run(postId);
      const reposts = (db.query("SELECT reposts FROM post_metric WHERE post_id = ?").get(postId) as { reposts: number } | null)?.reposts ?? 0;
      return c.json({ reposted: false, reposts });
    } else {
      db.prepare("INSERT INTO post_repost (post_id, account_id) VALUES (?, ?)").run(postId, userId);
      db.prepare("UPDATE post_metric SET reposts = reposts + 1 WHERE post_id = ?").run(postId);
      const reposts = (db.query("SELECT reposts FROM post_metric WHERE post_id = ?").get(postId) as { reposts: number } | null)?.reposts ?? 0;
      return c.json({ reposted: true, reposts });
    }
  });

  // -------------------------------------------------------------------------
  // Comments API
  // -------------------------------------------------------------------------

  app.get("/api/posts/:id/comments", authOptional, async (c) => {
    publishDueScheduledPosts(db);
    const postId = parseInt(c.req.param("id"), 10);
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = getPostById(db, postId);
    if (!post) return c.json({ error: "Post not found" }, 404);

    const userId = c.var.userId;
    const code = visibilityCode(post, userId, db);
    if (code !== "allow") {
      return c.json({ error: "Not authorized" }, code === "404" ? 404 : 403);
    }

    // Import here to avoid circular dependency issues
    const { buildVisibilityAwareCommentTree } = await import("./db-queries");
    const comments = buildVisibilityAwareCommentTree(db, postId);
    return c.json({ comments });
  });

  app.post("/api/posts/:id/comments", authRequired, async (c) => {
    const postId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(postId)) return c.json({ error: "Invalid post ID" }, 400);

    const post = getPostById(db, postId);
    if (!post) return c.json({ error: "Post not found" }, 404);

    const code = visibilityCode(post, userId, db);
    if (code !== "allow") {
      return c.json({ error: "Not authorized" }, code === "404" ? 404 : 403);
    }

    let body: { body?: string; parent_comment_id?: number };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const text = (body.body ?? "").trim();
    if (!text) return c.json({ error: "body required" }, 400);

    const parentCommentId = body.parent_comment_id;
    if (parentCommentId !== undefined) {
      const parent = db.query("SELECT * FROM comment WHERE id = ?").get(parentCommentId) as Comment | null;
      if (!parent) return c.json({ error: "Parent comment not found" }, 404);
      if (parent.status !== "visible") {
        return c.json({ error: "Cannot reply to a hidden or deleted comment" }, 400);
      }
    }

    const mod = applyModeration(db, text, "comment");
    if (mod.action === "block") {
      return c.json({ error: "Blocked by keyword rule", matched: mod.matched, rule_id: mod.rule_id }, 400);
    }
    const status = mod.action === "hide" ? "hidden" : "visible";

    const account = getAccountById(db, userId);
    const result = db.prepare("INSERT INTO comment (post_id, author_account_id, author_name, body, status, parent_comment_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(postId, userId, account?.display_name || "Unknown", text, status, parentCommentId ?? null);
    const commentId = Number(result.lastInsertRowid);

    if (status === "visible") {
      db.prepare("UPDATE post_metric SET replies = replies + 1 WHERE post_id = ?").run(postId);
    }

    const response: any = { success: true, comment_id: commentId };
    if (mod.action === "warn") response.warning = mod.matched;
    return c.json(response, 201);
  });

  app.post("/api/comments/:id/reply", authRequired, async (c) => {
    const parentId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(parentId)) return c.json({ error: "Invalid comment ID" }, 400);

    const parent = db.query("SELECT * FROM comment WHERE id = ?").get(parentId) as Comment | null;
    if (!parent) return c.json({ error: "Parent comment not found" }, 404);
    if (parent.status !== "visible") {
      return c.json({ error: "Cannot reply to a hidden or deleted comment" }, 400);
    }

    const post = getPostById(db, parent.post_id);
    if (!post) return c.json({ error: "Post not found" }, 404);
    const code = visibilityCode(post, userId, db);
    if (code !== "allow") {
      return c.json({ error: "Not authorized" }, code === "404" ? 404 : 403);
    }

    let body: { body?: string };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const text = (body.body ?? "").trim();
    if (!text) return c.json({ error: "body required" }, 400);

    const mod = applyModeration(db, text, "comment");
    if (mod.action === "block") {
      return c.json({ error: "Blocked by keyword rule", matched: mod.matched, rule_id: mod.rule_id }, 400);
    }
    const status = mod.action === "hide" ? "hidden" : "visible";

    const account = getAccountById(db, userId);
    const result = db.prepare("INSERT INTO comment (post_id, author_account_id, author_name, body, status, parent_comment_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(parent.post_id, userId, account?.display_name || "Unknown", text, status, parentId);
    const commentId = Number(result.lastInsertRowid);

    if (status === "visible") {
      db.prepare("UPDATE post_metric SET replies = replies + 1 WHERE post_id = ?").run(parent.post_id);
    }

    const response: any = { success: true, comment_id: commentId };
    if (mod.action === "warn") response.warning = mod.matched;
    return c.json(response, 201);
  });

  app.delete("/api/comments/:id", authRequired, (c) => {
    const commentId = parseInt(c.req.param("id"), 10);
    if (isNaN(commentId)) return c.json({ error: "Invalid comment ID" }, 400);

    const comment = db.query("SELECT * FROM comment WHERE id = ?").get(commentId) as Comment | null;
    if (!comment) return c.json({ error: "Comment not found" }, 404);
    if (comment.author_account_id !== c.var.userId) return c.json({ error: "Not authorized" }, 403);

    // Only decrement replies if the comment was visible (transitioning from visible to deleted)
    const wasVisible = comment.status === "visible";

    const countRow = db.query(`
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM comment WHERE parent_comment_id = ? AND status = 'visible'
        UNION ALL
        SELECT c.id FROM comment c
        JOIN descendants d ON c.parent_comment_id = d.id
        WHERE c.status = 'visible'
      )
      SELECT COUNT(*) as cnt FROM descendants
    `).get(commentId) as { cnt: number };
    const visibleDescendantCount = countRow.cnt;

    function softDeleteSubtree(id: number) {
      const target = db.query("SELECT status FROM comment WHERE id = ?").get(id) as Comment;
      if (target.status !== 'visible') return;
      db.prepare("UPDATE comment SET status = 'deleted', updated_at = datetime('now') WHERE id = ?").run(id);
      const children = db.query("SELECT id FROM comment WHERE parent_comment_id = ? AND status = 'visible'").all(id) as Array<{ id: number }>;
      for (const child of children) {
        softDeleteSubtree(child.id);
      }
    }

    softDeleteSubtree(commentId);

    if (wasVisible) {
      const decrement = 1 + visibleDescendantCount;
      db.prepare("UPDATE post_metric SET replies = MAX(0, replies - ?) WHERE post_id = ?").run(decrement, comment.post_id);
    }

    return c.json({ success: true });
  });

  // -------------------------------------------------------------------------
  // Accounts API
  // -------------------------------------------------------------------------

  app.get("/api/accounts/search", authOptional, (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json({ accounts: [], total: 0, page: 1, limit: 20, total_pages: 0 });

    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10) || 20));

    const userId = c.var.userId;
    const blockedIds = applyBlockFilter(db, userId);
    const blockedClause = blockedIds.length > 0 ? `AND id NOT IN (${blockedIds.join(",")})` : "";

    const likePattern = `%${escapeLikePattern(q)}%`;
    const countRow = db.query(`
      SELECT COUNT(*) as cnt FROM account
      WHERE is_active = 1 AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\') ${blockedClause}
    `).get(likePattern, likePattern) as { cnt: number };
    const total = countRow.cnt;

    const accounts = db.query(`
      SELECT id, username, display_name, account_type, bio, avatar_url, location
      FROM account
      WHERE is_active = 1 AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\') ${blockedClause}
      ORDER BY display_name
      LIMIT ? OFFSET ?
    `).all(likePattern, likePattern, limit, (page - 1) * limit) as Array<Pick<Account, "id" | "username" | "display_name" | "account_type" | "bio" | "avatar_url" | "location">>;

    return c.json({ accounts, total, page, limit, total_pages: Math.ceil(total / limit) });
  });

  app.get("/api/accounts/:id", authOptional, (c) => {
    const accountId = parseInt(c.req.param("id"), 10);
    if (isNaN(accountId)) return c.json({ error: "Invalid account ID" }, 400);

    const account = getAccountById(db, accountId);
    if (!account) return c.json({ error: "Account not found" }, 404);

    const userId = c.var.userId;
    if (userId) {
      if (isBlocked(db, userId, accountId) || isBlocked(db, accountId, userId)) {
        return c.json({ error: "Account not found" }, 404);
      }
    }

    return c.json({
      id: account.id,
      username: account.username,
      display_name: account.display_name,
      account_type: account.account_type,
      bio: account.bio,
      avatar_url: account.avatar_url,
      banner_url: account.banner_url,
      website_url: account.website_url,
      location: account.location,
      created_at: account.created_at,
      follower_count: getFollowerCount(db, accountId),
      following_count: getFollowingCount(db, accountId),
      post_count: getPostCount(db, accountId),
      is_following: userId ? isFollowing(db, userId, accountId) : false,
      is_blocked: userId ? isBlocked(db, userId, accountId) : false,
    });
  });

  app.get("/api/accounts/:id/followers", authOptional, (c) => {
    const accountId = parseInt(c.req.param("id"), 10);
    if (isNaN(accountId)) return c.json({ error: "Invalid account ID" }, 400);

    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10) || 20));

    const userId = c.var.userId;
    const blockedIds = applyBlockFilter(db, userId);
    const blockedClause = blockedIds.length > 0 ? `AND a.id NOT IN (${blockedIds.join(",")})` : "";

    const countRow = db.query(`
      SELECT COUNT(*) as cnt FROM account a
      JOIN follow_relation fr ON fr.follower_account_id = a.id
      WHERE fr.target_account_id = ? AND fr.status = 'following' AND a.is_active = 1 ${blockedClause}
    `).get(accountId) as { cnt: number };
    const total = countRow.cnt;

    const followers = db.query(`
      SELECT a.id, a.username, a.display_name, a.avatar_url
      FROM account a
      JOIN follow_relation fr ON fr.follower_account_id = a.id
      WHERE fr.target_account_id = ? AND fr.status = 'following' AND a.is_active = 1 ${blockedClause}
      ORDER BY a.display_name
      LIMIT ? OFFSET ?
    `).all(accountId, limit, (page - 1) * limit) as Array<Pick<Account, "id" | "username" | "display_name" | "avatar_url">>;

    return c.json({ followers, total, page, limit, total_pages: Math.ceil(total / limit) });
  });

  app.get("/api/accounts/:id/following", authOptional, (c) => {
    const accountId = parseInt(c.req.param("id"), 10);
    if (isNaN(accountId)) return c.json({ error: "Invalid account ID" }, 400);

    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10) || 20));

    const userId = c.var.userId;
    const blockedIds = applyBlockFilter(db, userId);
    const blockedClause = blockedIds.length > 0 ? `AND a.id NOT IN (${blockedIds.join(",")})` : "";

    const countRow = db.query(`
      SELECT COUNT(*) as cnt FROM account a
      JOIN follow_relation fr ON fr.target_account_id = a.id
      WHERE fr.follower_account_id = ? AND fr.status = 'following' AND a.is_active = 1 ${blockedClause}
    `).get(accountId) as { cnt: number };
    const total = countRow.cnt;

    const following = db.query(`
      SELECT a.id, a.username, a.display_name, a.avatar_url
      FROM account a
      JOIN follow_relation fr ON fr.target_account_id = a.id
      WHERE fr.follower_account_id = ? AND fr.status = 'following' AND a.is_active = 1 ${blockedClause}
      ORDER BY a.display_name
      LIMIT ? OFFSET ?
    `).all(accountId, limit, (page - 1) * limit) as Array<Pick<Account, "id" | "username" | "display_name" | "avatar_url">>;

    return c.json({ following, total, page, limit, total_pages: Math.ceil(total / limit) });
  });

  app.put("/api/accounts/:id", authRequired, async (c) => {
    const accountId = parseInt(c.req.param("id"), 10);
    if (isNaN(accountId)) return c.json({ error: "Invalid account ID" }, 400);
    if (accountId !== c.var.userId) return c.json({ error: "Not authorized" }, 403);

    let body: { display_name?: string; bio?: string; location?: string; website_url?: string; avatar_url?: string; banner_url?: string };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

    const updates: string[] = [];
    const params: any[] = [];

    if (body.display_name !== undefined) { updates.push("display_name = ?"); params.push(body.display_name); }
    if (body.bio !== undefined) { updates.push("bio = ?"); params.push(body.bio); }
    if (body.location !== undefined) { updates.push("location = ?"); params.push(body.location); }
    if (body.website_url !== undefined) { updates.push("website_url = ?"); params.push(body.website_url); }
    if (body.avatar_url !== undefined) { updates.push("avatar_url = ?"); params.push(body.avatar_url); }
    if (body.banner_url !== undefined) { updates.push("banner_url = ?"); params.push(body.banner_url); }
    updates.push("updated_at = datetime('now')");
    params.push(accountId);

    if (updates.length > 1) {
      db.query(`UPDATE account SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    }

    return c.json({ success: true });
  });

  app.post("/api/accounts/:id/follow", authRequired, (c) => {
    const targetId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(targetId)) return c.json({ error: "Invalid account ID" }, 400);
    if (targetId === userId) return c.json({ error: "Cannot follow yourself" }, 400);

    const target = getAccountById(db, targetId);
    if (!target) return c.json({ error: "Account not found" }, 404);

    const sameDir = db.query("SELECT status FROM follow_relation WHERE follower_account_id = ? AND target_account_id = ?").get(userId, targetId) as { status: string } | null;
    if (sameDir?.status === "blocked") {
      return c.json({ error: "You have blocked this account" }, 403);
    }

    const oppositeDir = db.query("SELECT status FROM follow_relation WHERE follower_account_id = ? AND target_account_id = ?").get(targetId, userId) as { status: string } | null;
    if (oppositeDir?.status === "blocked") {
      return c.json({ error: "This account has blocked you" }, 403);
    }

    if (sameDir?.status === "following") {
      db.prepare("DELETE FROM follow_relation WHERE follower_account_id = ? AND target_account_id = ?").run(userId, targetId);
      return c.json({ success: true, following: false });
    } else {
      db.prepare("INSERT INTO follow_relation (follower_account_id, target_account_id, status) VALUES (?, ?, 'following')").run(userId, targetId);
      return c.json({ success: true, following: true });
    }
  });

  app.post("/api/accounts/:id/block", authRequired, (c) => {
    const targetId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(targetId)) return c.json({ error: "Invalid account ID" }, 400);
    if (targetId === userId) return c.json({ error: "Cannot block yourself" }, 400);

    const target = getAccountById(db, targetId);
    if (!target) return c.json({ error: "Account not found" }, 404);

    const existing = db.query("SELECT status FROM follow_relation WHERE follower_account_id = ? AND target_account_id = ?").get(userId, targetId) as { status: string } | null;

    if (existing?.status === "blocked") {
      db.prepare("DELETE FROM follow_relation WHERE follower_account_id = ? AND target_account_id = ?").run(userId, targetId);
      return c.json({ success: true, blocked: false });
    } else {
      db.prepare(`
        INSERT INTO follow_relation (follower_account_id, target_account_id, status)
        VALUES (?, ?, 'blocked')
        ON CONFLICT(follower_account_id, target_account_id) DO UPDATE SET status = 'blocked', updated_at = datetime('now')
      `).run(userId, targetId);
      return c.json({ success: true, blocked: true });
    }
  });

  // -------------------------------------------------------------------------
  // Keyword Rules API
  // -------------------------------------------------------------------------

  app.get("/api/keyword-rules", authRequired, (c) => {
    const userId = c.var.userId!;
    const rules = db.query("SELECT * FROM keyword_rule WHERE owner_account_id = ? ORDER BY created_at DESC").all(userId) as KeywordRule[];
    return c.json({ rules });
  });

  app.post("/api/keyword-rules", authRequired, async (c) => {
    const userId = c.var.userId!;
    let body: { phrase?: string; match_mode?: string; scope?: string; action?: string };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

    const phrase = (body.phrase ?? "").trim();
    if (!phrase) return c.json({ error: "phrase required" }, 400);

    const matchMode = body.match_mode || "contains";
    const scope = body.scope || "post";
    const action = body.action || "warn";

    try {
      const result = db.prepare("INSERT INTO keyword_rule (owner_account_id, phrase, match_mode, scope, action) VALUES (?, ?, ?, ?, ?)")
        .run(userId, phrase, matchMode, scope, action);
      return c.json({ success: true, rule_id: Number(result.lastInsertRowid) }, 201);
    } catch (e: any) {
      if (e.message?.includes("SQLITE_CONSTRAINT_UNIQUE")) {
        return c.json({ error: "Rule already exists" }, 409);
      }
      throw e;
    }
  });

  app.get("/api/keyword-rules/:id", authRequired, (c) => {
    const ruleId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(ruleId)) return c.json({ error: "Invalid rule ID" }, 400);

    const rule = db.query("SELECT * FROM keyword_rule WHERE id = ? AND owner_account_id = ?").get(ruleId, userId) as KeywordRule | null;
    if (!rule) return c.json({ error: "Rule not found" }, 404);
    return c.json(rule);
  });

  app.put("/api/keyword-rules/:id", authRequired, async (c) => {
    const ruleId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(ruleId)) return c.json({ error: "Invalid rule ID" }, 400);

    let body: { phrase?: string; match_mode?: string; scope?: string; action?: string };
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

    const rule = db.query("SELECT * FROM keyword_rule WHERE id = ? AND owner_account_id = ?").get(ruleId, userId) as KeywordRule | null;
    if (!rule) return c.json({ error: "Rule not found" }, 404);

    const updates: string[] = [];
    const params: any[] = [];
    if (body.phrase !== undefined) { updates.push("phrase = ?"); params.push(body.phrase); }
    if (body.match_mode !== undefined) { updates.push("match_mode = ?"); params.push(body.match_mode); }
    if (body.scope !== undefined) { updates.push("scope = ?"); params.push(body.scope); }
    if (body.action !== undefined) { updates.push("action = ?"); params.push(body.action); }
    updates.push("updated_at = datetime('now')");
    params.push(ruleId);

    db.query(`UPDATE keyword_rule SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    return c.json({ success: true });
  });

  app.delete("/api/keyword-rules/:id", authRequired, (c) => {
    const ruleId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(ruleId)) return c.json({ error: "Invalid rule ID" }, 400);

    const rule = db.query("SELECT * FROM keyword_rule WHERE id = ? AND owner_account_id = ?").get(ruleId, userId) as KeywordRule | null;
    if (!rule) return c.json({ error: "Rule not found" }, 404);

    db.prepare("DELETE FROM keyword_rule WHERE id = ?").run(ruleId);
    return c.json({ success: true });
  });

  app.post("/api/keyword-rules/:id/toggle", authRequired, (c) => {
    const ruleId = parseInt(c.req.param("id"), 10);
    const userId = c.var.userId!;
    if (isNaN(ruleId)) return c.json({ error: "Invalid rule ID" }, 400);

    const rule = db.query("SELECT * FROM keyword_rule WHERE id = ? AND owner_account_id = ?").get(ruleId, userId) as KeywordRule | null;
    if (!rule) return c.json({ error: "Rule not found" }, 404);

    const newActive = rule.is_active ? 0 : 1;
    db.prepare("UPDATE keyword_rule SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(newActive, ruleId);
    return c.json({ success: true, is_active: newActive === 1 });
  });

  // -------------------------------------------------------------------------
  // Analytics API
  // -------------------------------------------------------------------------

  app.get("/api/analytics/metrics", authRequired, (c) => {
    const userId = c.var.userId!;
    const postIdParam = c.req.query("post_id");

    if (postIdParam) {
      const postId = parseInt(postIdParam, 10);
      if (isNaN(postId)) return c.json({ error: "Invalid post_id" }, 400);

      const metric = db.query(`
        SELECT pm.*, p.content
        FROM post_metric pm
        JOIN post p ON p.id = pm.post_id
        WHERE p.id = ? AND p.author_account_id = ?
      `).get(postId, userId) as (PostMetric & { content: string }) | null;

      if (!metric) return c.json({ error: "Post not found or not owned" }, 404);
      return c.json(metric);
    }

    const metrics = db.query(`
      SELECT pm.*, p.content
      FROM post_metric pm
      JOIN post p ON p.id = pm.post_id
      WHERE p.author_account_id = ?
      ORDER BY pm.last_synced_at DESC
    `).all(userId) as Array<PostMetric & { content: string }>;

    return c.json({ metrics });
  });

  app.get("/api/analytics/events", authRequired, (c) => {
    const userId = c.var.userId!;
    const limit = Math.min(100, parseInt(c.req.query("limit") ?? "50", 10) || 50);

    const events = db.query(`
      SELECT ec.*
      FROM event_campaign ec
      JOIN post p ON p.id = ec.post_id
      WHERE p.author_account_id = ?
      ORDER BY ec.updated_at DESC
      LIMIT ?
    `).all(userId, limit) as any[];

    return c.json({ events });
  });

  // -------------------------------------------------------------------------
  // HTML Pages
  // -------------------------------------------------------------------------

  app.get("/", (c) => c.html(<LoginPage />));

  app.get("/home", authOptional, (c) => {
    const userId = c.var.userId;
    if (!userId) return c.redirect("/");
    publishDueScheduledPosts(db);

    const account = getAccountById(db, userId);
    if (!account) return c.redirect("/");

    const feedVis = feedVisibilityWhere(userId);
    const whereParts: string[] = [feedVis.sql];
    const params: any[] = [...feedVis.params];

    const blockedIds = applyBlockFilter(db, userId);
    if (blockedIds.length > 0) {
      whereParts.push(`p.author_account_id NOT IN (${blockedIds.join(",")})`);
    }

    const whereSql = whereParts.join(" AND ");

    const posts = db.query(`
      SELECT p.*, a.username as author_username, a.display_name as author_display_name
      FROM post p
      JOIN account a ON a.id = p.author_account_id
      WHERE ${whereSql}
      ORDER BY p.is_pinned DESC, COALESCE(p.published_at, p.created_at) DESC, p.id DESC
      LIMIT 20
    `).all(...params) as Array<Post & { author_username: string; author_display_name: string }>;

    const result = posts.map((p) => ({
      ...p,
      tags: getPostTags(db, p.id),
      assets: getPostAssets(db, p.id),
      liked: isLiked(db, p.id, userId),
      reposted: isReposted(db, p.id, userId),
      like_count: (db.query("SELECT COUNT(*) as cnt FROM post_like WHERE post_id = ?").get(p.id) as { cnt: number }).cnt,
      repost_count: (db.query("SELECT COUNT(*) as cnt FROM post_repost WHERE post_id = ?").get(p.id) as { cnt: number }).cnt,
      reply_count: (db.query("SELECT COUNT(*) as cnt FROM comment WHERE post_id = ? AND status = 'visible'").get(p.id) as { cnt: number }).cnt,
    }));

    return c.html(<HomePage posts={result} account={account} />);
  });

  app.get("/compose", authOptional, (c) => {
    const userId = c.var.userId;
    if (!userId) return c.redirect("/");
    const account = getAccountById(db, userId);
    if (!account) return c.redirect("/");
    return c.html(<ComposePage account={account} />);
  });

  app.get("/posts/:id", authOptional, async (c) => {
    const postId = parseInt(c.req.param("id"), 10);
    if (isNaN(postId)) return c.text("Invalid post ID", 400);

    const post = db.query(`
      SELECT p.*, a.username as author_username, a.display_name as author_display_name
      FROM post p
      JOIN account a ON a.id = p.author_account_id
      WHERE p.id = ?
    `).get(postId) as (Post & { author_username: string; author_display_name: string }) | null;

    if (!post) return c.text("Post not found", 404);

    const userId = c.var.userId;
    const code = visibilityCode(post, userId, db);
    if (code !== "allow") {
      return c.text("Not authorized", code === "404" ? 404 : 403);
    }

    const account = userId ? getAccountById(db, userId) : null;

    const enrichedPost = {
      ...post,
      tags: getPostTags(db, postId),
      assets: getPostAssets(db, postId),
      liked: userId ? isLiked(db, postId, userId) : false,
      reposted: userId ? isReposted(db, postId, userId) : false,
      like_count: (db.query("SELECT COUNT(*) as cnt FROM post_like WHERE post_id = ?").get(postId) as { cnt: number }).cnt,
      repost_count: (db.query("SELECT COUNT(*) as cnt FROM post_repost WHERE post_id = ?").get(postId) as { cnt: number }).cnt,
      impressions: (getPostMetrics(db, postId)?.impressions) || 0,
    };

    const { buildVisibilityAwareCommentTree } = await import("./db-queries");
    const comments = buildVisibilityAwareCommentTree(db, postId);
    return c.html(<PostDetailPage post={enrichedPost} comments={comments} account={account} />);
  });

  app.get("/management", authOptional, (c) => {
    const userId = c.var.userId;
    if (!userId) return c.redirect("/");
    publishDueScheduledPosts(db);
    const account = getAccountById(db, userId);
    if (!account) return c.redirect("/");

    const tab = c.req.query("tab") || "all";
    let statusFilter = "";
    if (tab !== "all") statusFilter = `AND p.status = '${tab.replace(/'/g, "''")}'`;

    const posts = db.query(`
      SELECT p.*, a.username as author_username, a.display_name as author_display_name
      FROM post p
      JOIN account a ON a.id = p.author_account_id
      WHERE p.author_account_id = ? ${statusFilter}
      ORDER BY p.created_at DESC
    `).all(userId) as Array<Post & { author_username: string; author_display_name: string }>;

    return c.html(<ManagementPage posts={posts} account={account} tab={tab} />);
  });

  app.get("/calendar", authOptional, (c) => {
    const userId = c.var.userId;
    if (!userId) return c.redirect("/");
    publishDueScheduledPosts(db);
    const account = getAccountById(db, userId);
    if (!account) return c.redirect("/");

    const now = new Date();
    const year = parseInt(c.req.query("year") ?? String(now.getFullYear()), 10);
    const month = parseInt(c.req.query("month") ?? String(now.getMonth()), 10);

    const posts = db.query(`
      SELECT p.* FROM post p
      WHERE p.author_account_id = ?
      ORDER BY p.created_at DESC
    `).all(userId) as Post[];

    return c.html(<CalendarPage posts={posts} account={account} year={year} month={month} />);
  });

  app.get("/discover", authOptional, (c) => {
    const userId = c.var.userId;
    const account = userId ? getAccountById(db, userId) : null;

    const q = c.req.query("q") ?? "";
    let accounts: Array<Pick<Account, "id" | "username" | "display_name" | "account_type" | "bio" | "avatar_url" | "location">> = [];
    if (q.trim()) {
      const likePattern = `%${escapeLikePattern(q)}%`;
      accounts = db.query(`
        SELECT id, username, display_name, account_type, bio, avatar_url, location
        FROM account
        WHERE is_active = 1 AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
        ORDER BY display_name
        LIMIT 50
      `).all(likePattern, likePattern) as typeof accounts;
    }

    return c.html(<DiscoverPage accounts={accounts} account={account} q={q} />);
  });

  app.get("/settings/moderation", authOptional, (c) => {
    const userId = c.var.userId;
    if (!userId) return c.redirect("/");
    const account = getAccountById(db, userId);
    if (!account) return c.redirect("/");

    const rules = db.query("SELECT * FROM keyword_rule WHERE owner_account_id = ? ORDER BY created_at DESC").all(userId) as KeywordRule[];
    return c.html(<ModerationPage rules={rules} account={account} />);
  });

  app.get("/analytics", authOptional, (c) => {
    const userId = c.var.userId;
    if (!userId) return c.redirect("/");
    const account = getAccountById(db, userId);
    if (!account) return c.redirect("/");

    const metrics = db.query(`
      SELECT pm.*, p.content
      FROM post_metric pm
      JOIN post p ON p.id = pm.post_id
      WHERE p.author_account_id = ?
      ORDER BY pm.last_synced_at DESC
    `).all(userId) as Array<PostMetric & { content: string }>;

    const events = db.query(`
      SELECT pal.*
      FROM post_action_log pal
      JOIN post p ON p.id = pal.post_id
      WHERE p.author_account_id = ?
      ORDER BY pal.created_at DESC
      LIMIT 50
    `).all(userId) as any[];

    return c.html(<AnalyticsPage metrics={metrics} events={events} account={account} />);
  });

  app.get("/profile", authOptional, (c) => {
    const userId = c.var.userId;
    if (!userId) return c.redirect("/");
    const profile = getAccountById(db, userId);
    if (!profile) return c.redirect("/");

    const posts = db.query(`
      SELECT p.* FROM post p
      WHERE p.author_account_id = ? AND p.status != 'deleted'
      ORDER BY p.created_at DESC
      LIMIT 20
    `).all(userId) as Post[];

    return c.html(<ProfilePage
      profile={profile}
      isSelf={true}
      isFollowing={false}
      isBlocked={false}
      followerCount={getFollowerCount(db, userId)}
      followingCount={getFollowingCount(db, userId)}
      postCount={getPostCount(db, userId)}
      posts={posts}
    />);
  });

  app.get("/profile/:id", authOptional, (c) => {
    const profileId = parseInt(c.req.param("id"), 10);
    if (isNaN(profileId)) return c.text("Invalid profile ID", 400);

    const profile = getAccountById(db, profileId);
    if (!profile) return c.text("Profile not found", 404);

    const userId = c.var.userId;
    if (!userId) return c.redirect("/");

    if (userId) {
      if (isBlocked(db, userId, profileId) || isBlocked(db, profileId, userId)) {
        return c.text("Profile not found", 404);
      }
    }

    const isSelf = userId === profileId;

    const posts = db.query(`
      SELECT p.* FROM post p
      WHERE p.author_account_id = ? AND p.status = 'published'
      ORDER BY p.created_at DESC
      LIMIT 20
    `).all(profileId) as Post[];

    return c.html(<ProfilePage
      profile={profile}
      isSelf={isSelf}
      isFollowing={userId ? isFollowing(db, userId, profileId) : false}
      isBlocked={userId ? isBlocked(db, userId, profileId) : false}
      followerCount={getFollowerCount(db, profileId)}
      followingCount={getFollowingCount(db, profileId)}
      postCount={getPostCount(db, profileId)}
      posts={posts}
    />);
  });
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

export function createSocialApp(): MockAppV2 {
  return createMockApp({
    name: "social",
    port: 3456,
    healthResponse: { status: "healthy", service: "social" },
    routes: registerRoutes,
  });
}

if (import.meta.main) {
  const app = createSocialApp();
  startServer(app, { seed: () => {} });
}
