import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "node:path";

const DB_PATH = process.env.MOCK_DATA_DIR
  ? `${process.env.MOCK_DATA_DIR}/social/social.db`
  : "./data/social.db";

let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;

  // Ensure directory exists for file-backed DB
  const dir = dirname(DB_PATH);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error("[social] Failed to create DB directory:", err);
  }

  try {
    db = new Database(DB_PATH, { create: true });
  } catch (err) {
    console.error("[social] Failed to open DB at primary path:", err);
    const fallbackPath = "./data/social.db";
    const fallbackDir = fallbackPath.substring(0, fallbackPath.lastIndexOf("/"));
    mkdirSync(fallbackDir, { recursive: true });
    db = new Database(fallbackPath, { create: true });
  }

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  initSchema(db);
  seedData(db);

  if (!db) {
    // Defensive guard: every code path above either assigns `db` or throws,
    // but this assertion keeps the contract explicit so future refactors
    // cannot silently return null.
    throw new Error("Database failed to initialize: db is null after schema setup.");
  }
  return db;
}

function initSchema(database: Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'personal' CHECK (account_type IN ('company', 'personal', 'creator', 'partner')),
      bio TEXT,
      avatar_url TEXT,
      banner_url TEXT,
      website_url TEXT,
      location TEXT,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS post (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_account_id INTEGER NOT NULL REFERENCES account(id),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'deleted')),
      visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers_only', 'unlisted')),
      moderation_state TEXT NOT NULL DEFAULT 'clear' CHECK (moderation_state IN ('clear', 'flagged')),
      scheduled_for TEXT,
      scheduled_timezone TEXT,
      published_at TEXT,
      deleted_at TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      has_event_cta INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_asset (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video', 'link_preview')),
      asset_url TEXT NOT NULL,
      preview_text TEXT,
      alt_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label_text TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_tag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      actor_account_id INTEGER REFERENCES account(id) ON DELETE SET NULL,
      action_type TEXT NOT NULL CHECK (action_type IN ('created', 'updated', 'scheduled', 'published', 'deleted', 'pinned', 'unpinned', 'moderation_changed')),
      old_value TEXT,
      new_value TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      author_account_id INTEGER REFERENCES account(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
      parent_comment_id INTEGER REFERENCES comment(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follow_relation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      target_account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'following' CHECK (status IN ('following', 'blocked')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(follower_account_id, target_account_id),
      CHECK(follower_account_id != target_account_id)
    );

    CREATE TABLE IF NOT EXISTS keyword_rule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      phrase TEXT NOT NULL,
      match_mode TEXT NOT NULL DEFAULT 'contains' CHECK (match_mode IN ('exact', 'contains', 'prefix')),
      scope TEXT NOT NULL DEFAULT 'post' CHECK (scope IN ('post', 'comment')),
      action TEXT NOT NULL DEFAULT 'warn' CHECK (action IN ('warn', 'block', 'hide')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(owner_account_id, phrase, scope)
    );

    CREATE TABLE IF NOT EXISTS post_metric (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL UNIQUE REFERENCES post(id) ON DELETE CASCADE,
      impressions INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      reposts INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      profile_visits INTEGER NOT NULL DEFAULT 0,
      new_followers INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_campaign (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL UNIQUE REFERENCES post(id) ON DELETE CASCADE,
      event_title TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT,
      registration_url TEXT NOT NULL,
      registrations_count INTEGER NOT NULL DEFAULT 0,
      attendance_goal INTEGER NOT NULL DEFAULT 0 CHECK (attendance_goal >= 0),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'completed')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_like (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_id, account_id)
    );

    CREATE TABLE IF NOT EXISTS post_repost (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_id, account_id)
    );

    CREATE INDEX IF NOT EXISTS idx_post_author ON post(author_account_id);
    CREATE INDEX IF NOT EXISTS idx_post_author_status_created ON post(author_account_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_post_scheduled ON post(scheduled_for);
    CREATE INDEX IF NOT EXISTS idx_comment_post ON comment(post_id);
    CREATE INDEX IF NOT EXISTS idx_comment_parent ON comment(parent_comment_id);
    CREATE INDEX IF NOT EXISTS idx_follow_relation ON follow_relation(follower_account_id, target_account_id);
    CREATE INDEX IF NOT EXISTS idx_post_tag_post ON post_tag(post_id);
    CREATE INDEX IF NOT EXISTS idx_post_tag_tag ON post_tag(tag_id);
    CREATE INDEX IF NOT EXISTS idx_comment_author ON comment(author_account_id);
    CREATE INDEX IF NOT EXISTS idx_keyword_rule_owner ON keyword_rule(owner_account_id);
    CREATE INDEX IF NOT EXISTS idx_keyword_rule_owner_active ON keyword_rule(owner_account_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_post_like_post ON post_like(post_id);
    CREATE INDEX IF NOT EXISTS idx_post_like_account ON post_like(account_id);
    CREATE INDEX IF NOT EXISTS idx_post_repost_post ON post_repost(post_id);
    CREATE INDEX IF NOT EXISTS idx_post_repost_account ON post_repost(account_id);
  `);
}

interface SocialSeedAccount {
  username: string;
  password: string;
  display_name: string;
  account_type: string;
  timezone?: string;
  bio?: string;
}

interface SocialSeedPost {
  id?: number;
  author_username: string;
  content: string;
  status: string;
  visibility?: string;
  scheduled_for?: string | null;
  published_at?: string | null;
  is_pinned?: number;
  has_event_cta?: number;
}

interface SocialSeedTag {
  id?: number;
  label_text: string;
  normalized_name: string;
}

interface SocialSeedPostTag {
  post_id: number;
  tag_id: number;
  sort_order?: number;
}

interface SocialSeedComment {
  id?: number;
  post_id: number;
  author_username?: string | null;
  author_name: string;
  body: string;
  status?: string;
  parent_comment_id?: number | null;
  created_at?: string;
}

interface SocialSeedFollow {
  follower_username: string;
  target_username: string;
  status?: string;
}

interface SocialSeedKeywordRule {
  owner_username: string;
  phrase: string;
  match_mode?: string;
  scope?: string;
  action?: string;
  is_active?: number;
}

interface SocialSeedMetric {
  post_id: number;
  impressions?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  clicks?: number;
  profile_visits?: number;
  new_followers?: number;
  last_synced_at?: string;
}

interface SocialSeedCampaign {
  post_id: number;
  event_title: string;
  start_at: string;
  end_at?: string | null;
  registration_url: string;
  registrations_count?: number;
  attendance_goal?: number;
  status?: string;
}

interface SocialSeedActionLog {
  post_id: number;
  actor_username?: string | null;
  action_type: string;
  old_value?: string | null;
  new_value?: string | null;
  note?: string | null;
  created_at?: string;
}

interface SocialSeedLike {
  post_id: number;
  username: string;
}

interface SocialSeedRepost {
  post_id: number;
  username: string;
}

interface SocialSeedData {
  accounts?: SocialSeedAccount[];
  posts?: SocialSeedPost[];
  tags?: SocialSeedTag[];
  post_tags?: SocialSeedPostTag[];
  comments?: SocialSeedComment[];
  follow_relations?: SocialSeedFollow[];
  keyword_rules?: SocialSeedKeywordRule[];
  post_metrics?: SocialSeedMetric[];
  event_campaigns?: SocialSeedCampaign[];
  action_logs?: SocialSeedActionLog[];
  post_likes?: SocialSeedLike[];
  post_reposts?: SocialSeedRepost[];
}

function loadLayer1Seed(database: Database): void {
  const dataDir = process.env.MOCK_DATA_DIR || "/opt/mock/data";
  const seedPath = join(dataDir, "seed.json");

  const nowISO = () => new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

  if (!existsSync(seedPath)) return;

  console.log(`[social] Loading Layer 1 seed from ${seedPath}`);
  const raw = readFileSync(seedPath, "utf-8");
  let seed: SocialSeedData;
  try {
    seed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`[social] Malformed seed.json: ${(e as Error).message}`);
  }

  const resolveAccount = (username: string): number | null => {
    const row = database.query("SELECT id FROM account WHERE username = ?").get(username) as { id: number } | null;
    return row ? row.id : null;
  };

  const requireAccount = (username: string, context: string): number => {
    const id = resolveAccount(username);
    if (id === null) throw new Error(`[social] Seed ${context}: account "${username}" not found`);
    return id;
  };

  if (seed.accounts) {
    for (const a of seed.accounts) {
      if (resolveAccount(a.username)) continue;
      database.prepare(
        `INSERT INTO account (username, password, display_name, account_type, timezone, bio, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`
      ).run(a.username, a.password, a.display_name, a.account_type, a.timezone || "UTC", a.bio || null);
    }
  }

  if (seed.posts) {
    for (const p of seed.posts) {
      const authorId = resolveAccount(p.author_username);
      if (!authorId) throw new Error(`[social] Seed post: account "${p.author_username}" not found`);

      if (p.id) {
        const existing = database.query("SELECT id FROM post WHERE id = ?").get(p.id) as { id: number } | null;
        if (existing) continue;
      }

      const cols = p.id ? "id, " : "";
      const placeholders = p.id ? "?, " : "";
      const params = p.id ? [p.id] : [];

      database.prepare(
        `INSERT INTO post (${cols}author_account_id, content, status, visibility, scheduled_for, published_at, is_pinned, has_event_cta)
         VALUES (${placeholders}?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(...params, authorId, p.content, p.status, p.visibility || "public", p.scheduled_for ?? null, p.published_at ?? null, p.is_pinned ?? 0, p.has_event_cta ?? 0);
    }
  }

  if (seed.tags) {
    for (const t of seed.tags) {
      const existing = database.query("SELECT id FROM tag WHERE normalized_name = ?").get(t.normalized_name) as { id: number } | null;
      if (existing) continue;

      if (t.id) {
        database.prepare("INSERT INTO tag (id, label_text, normalized_name) VALUES (?, ?, ?)").run(t.id, t.label_text, t.normalized_name);
      } else {
        database.prepare("INSERT INTO tag (label_text, normalized_name) VALUES (?, ?)").run(t.label_text, t.normalized_name);
      }
    }
  }

  if (seed.post_tags) {
    for (const pt of seed.post_tags) {
      const existing = database.query("SELECT 1 FROM post_tag WHERE post_id = ? AND tag_id = ?").get(pt.post_id, pt.tag_id);
      if (existing) continue;
      database.prepare("INSERT INTO post_tag (post_id, tag_id, sort_order) VALUES (?, ?, ?)").run(pt.post_id, pt.tag_id, pt.sort_order ?? 0);
    }
  }

  if (seed.comments) {
    for (const c of seed.comments) {
      if (c.id) {
        const existing = database.query("SELECT id FROM comment WHERE id = ?").get(c.id) as { id: number } | null;
        if (existing) continue;
      }

      const authorId = c.author_username ? requireAccount(c.author_username, "comment author") : null;
      const cols = c.id ? "id, " : "";
      const placeholders = c.id ? "?, " : "";
      const params = c.id ? [c.id] : [];

      database.prepare(
        `INSERT INTO comment (${cols}post_id, author_account_id, author_name, body, status, parent_comment_id, created_at)
         VALUES (${placeholders}?, ?, ?, ?, ?, ?, ?)`
      ).run(...params, c.post_id, authorId, c.author_name, c.body, c.status || "visible", c.parent_comment_id ?? null, c.created_at ?? nowISO());
    }
  }

  if (seed.follow_relations) {
    for (const f of seed.follow_relations) {
      const followerId = requireAccount(f.follower_username, "follow_relation follower");
      const targetId = requireAccount(f.target_username, "follow_relation target");

      const existing = database.query("SELECT 1 FROM follow_relation WHERE follower_account_id = ? AND target_account_id = ?").get(followerId, targetId);
      if (existing) continue;
      database.prepare("INSERT INTO follow_relation (follower_account_id, target_account_id, status) VALUES (?, ?, ?)").run(followerId, targetId, f.status || "following");
    }
  }

  if (seed.keyword_rules) {
    for (const r of seed.keyword_rules) {
      const ownerId = requireAccount(r.owner_username, "keyword_rule owner");

      const existing = database.query("SELECT 1 FROM keyword_rule WHERE owner_account_id = ? AND phrase = ? AND scope = ?").get(ownerId, r.phrase, r.scope || "post");
      if (existing) continue;
      database.prepare(
        `INSERT INTO keyword_rule (owner_account_id, phrase, match_mode, scope, action, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(ownerId, r.phrase, r.match_mode || "contains", r.scope || "post", r.action || "warn", r.is_active ?? 1);
    }
  }

  if (seed.post_metrics) {
    for (const m of seed.post_metrics) {
      const existing = database.query("SELECT 1 FROM post_metric WHERE post_id = ?").get(m.post_id);
      if (existing) continue;
      database.prepare(
        `INSERT INTO post_metric (post_id, impressions, likes, replies, reposts, clicks, profile_visits, new_followers, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(m.post_id, m.impressions ?? 0, m.likes ?? 0, m.replies ?? 0, m.reposts ?? 0, m.clicks ?? 0, m.profile_visits ?? 0, m.new_followers ?? 0, m.last_synced_at ?? nowISO());
    }
  }

  if (seed.event_campaigns) {
    for (const ec of seed.event_campaigns) {
      const existing = database.query("SELECT 1 FROM event_campaign WHERE post_id = ?").get(ec.post_id);
      if (existing) continue;
      database.prepare(
        `INSERT INTO event_campaign (post_id, event_title, start_at, end_at, registration_url, registrations_count, attendance_goal, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(ec.post_id, ec.event_title, ec.start_at, ec.end_at ?? null, ec.registration_url, ec.registrations_count ?? 0, ec.attendance_goal ?? 0, ec.status || "draft");
    }
  }

  if (seed.action_logs) {
    for (const al of seed.action_logs) {
      const actorId = al.actor_username ? requireAccount(al.actor_username, "action_log actor") : null;
      database.prepare(
        `INSERT INTO post_action_log (post_id, actor_account_id, action_type, old_value, new_value, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(al.post_id, actorId, al.action_type, al.old_value ?? null, al.new_value ?? null, al.note ?? null, al.created_at ?? nowISO());
    }
  }

  if (seed.post_likes) {
    for (const pl of seed.post_likes) {
      const accountId = requireAccount(pl.username, "post_like account");
      const existing = database.query("SELECT 1 FROM post_like WHERE post_id = ? AND account_id = ?").get(pl.post_id, accountId);
      if (existing) continue;
      database.prepare("INSERT INTO post_like (post_id, account_id) VALUES (?, ?)").run(pl.post_id, accountId);
    }
  }

  if (seed.post_reposts) {
    for (const pr of seed.post_reposts) {
      const accountId = requireAccount(pr.username, "post_repost account");
      const existing = database.query("SELECT 1 FROM post_repost WHERE post_id = ? AND account_id = ?").get(pr.post_id, accountId);
      if (existing) continue;
      database.prepare("INSERT INTO post_repost (post_id, account_id) VALUES (?, ?)").run(pr.post_id, accountId);
    }
  }
}

function seedData(database: Database) {
  const count = database.query("SELECT COUNT(*) as count FROM account").get() as { count: number };
  if (count.count > 0) {
    console.log(`[social] Skipping re-seed: ${count.count} account(s) already exist.`);
    // Compatibility backfill: ensure alice's like exists for social-unlike-post (case_id=33).
    // On reused DBs a previous agent run may have deleted this like, and the full
    // seed transaction above is skipped because accounts already exist.
    const likeExists = database.query("SELECT 1 FROM post_like WHERE post_id = 1 AND account_id = 2").get();
    if (!likeExists) {
      const post1Exists = database.query("SELECT 1 FROM post WHERE id = 1").get();
      if (post1Exists) {
        database.prepare("INSERT INTO post_like (post_id, account_id) VALUES (1, 2)").run();
        console.log("[social] Restored alice's post_like seed (post_id=1, account_id=2)");
      }
    }
    // Layer 1 seeds must load even when Layer 0 accounts already exist.
    loadLayer1Seed(database);
    return;
  }
  console.log("[social] Seeding fresh demo data into empty social.db...");

  const tx = database.transaction(() => {
    // Seed accounts
    const insertAccount = database.prepare(`
      INSERT INTO account (id, username, password, display_name, account_type, timezone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    insertAccount.run(1, "mosi_brand", "demo123", "Mosi Brand", "company", "Asia/Shanghai");
    insertAccount.run(2, "alice", "demo123", "Alice", "personal", "America/New_York");
    insertAccount.run(3, "bob_creator", "demo123", "Bob Creator", "creator", "Europe/London");
    insertAccount.run(4, "carol_ops", "demo123", "Carol Ops", "personal", "UTC");

    // Seed posts
    const insertPost = database.prepare(`
      INSERT INTO post (id, author_account_id, content, status, visibility, scheduled_for, published_at, is_pinned, has_event_cta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPost.run(1, 1, "Welcome to Mosi Social! This is our official launch post. #MosiLaunch #SocialMedia", "published", "public", null, "2026-01-15 09:00:00", 1, 0);
    insertPost.run(2, 1, "Join us at the Mosi Annual Conference 2026! Register now for early bird tickets. #Conference #Tech", "published", "public", null, "2026-01-20 10:00:00", 0, 1);
    insertPost.run(3, 2, "Just exploring this new platform. The UI looks clean! #NewPlatform", "published", "public", null, "2026-01-22 14:30:00", 0, 0);
    insertPost.run(4, 3, "Check out my latest content creation tips. Thread below! #CreatorTips #Content", "published", "public", null, "2026-01-25 11:00:00", 0, 0);
    insertPost.run(5, 1, "Product update: Our new analytics dashboard is now live. #ProductUpdate", "scheduled", "public", "2026-12-01 08:00:00", null, 0, 0);
    insertPost.run(6, 2, "Working on a new blog post about social media strategy. Stay tuned!", "draft", "public", null, null, 0, 0);
    insertPost.run(7, 3, "Live streaming session tonight at 8PM GMT. Don't miss it! #LiveStream", "published", "followers_only", null, "2026-02-01 19:00:00", 0, 0);
    insertPost.run(8, 4, "Internal ops memo: Q2 planning starts next week.", "deleted", "public", null, "2026-02-05 09:00:00", 0, 0);
    insertPost.run(9, 1, "Thank you all for 10K followers! Here's a giveaway announcement. #Giveaway #Milestone", "published", "public", null, "2026-02-10 12:00:00", 0, 0);
    insertPost.run(10, 2, "Testing the scheduled post feature. This should go live tomorrow morning.", "scheduled", "public", "2026-12-15 07:00:00", null, 0, 0);

    // Seed post assets
    const insertAsset = database.prepare(`
      INSERT INTO post_asset (post_id, asset_type, asset_url, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    const svgImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23e0e0e0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EImage%3C/text%3E%3C/svg%3E";
    const svgLink = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23f0f0f0' width='400' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3ELink Preview%3C/text%3E%3C/svg%3E";
    insertAsset.run(1, "image", svgImage, 0);
    insertAsset.run(2, "link_preview", svgLink, 0);
    insertAsset.run(4, "image", svgImage, 0);
    insertAsset.run(4, "image", svgImage, 1);

    // Seed tags
    const insertTag = database.prepare(`
      INSERT INTO tag (id, label_text, normalized_name)
      VALUES (?, ?, ?)
    `);
    const tags: [number, string, string][] = [
      [1, "#MosiLaunch", "mosilaunch"],
      [2, "#SocialMedia", "socialmedia"],
      [3, "#Conference", "conference"],
      [4, "#Tech", "tech"],
      [5, "#NewPlatform", "newplatform"],
      [6, "#CreatorTips", "creatortips"],
      [7, "#Content", "content"],
      [8, "#ProductUpdate", "productupdate"],
      [9, "#LiveStream", "livestream"],
      [10, "#Giveaway", "giveaway"],
      [11, "#Milestone", "milestone"],
    ];
    for (const t of tags) insertTag.run(t[0], t[1], t[2]);

    // Seed post_tag associations
    const insertPostTag = database.prepare(`INSERT INTO post_tag (post_id, tag_id, sort_order) VALUES (?, ?, ?)`);
    insertPostTag.run(1, 1, 0); insertPostTag.run(1, 2, 1);
    insertPostTag.run(2, 3, 0); insertPostTag.run(2, 4, 1);
    insertPostTag.run(3, 5, 0);
    insertPostTag.run(4, 6, 0); insertPostTag.run(4, 7, 1);
    insertPostTag.run(5, 8, 0);
    insertPostTag.run(7, 9, 0);
    insertPostTag.run(9, 10, 0); insertPostTag.run(9, 11, 1);

    // Seed comments
    const insertComment = database.prepare(`
      INSERT INTO comment (id, post_id, author_account_id, author_name, body, status, parent_comment_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertComment.run(1, 1, 2, "Alice", "Great launch! Looking forward to using this platform.", "visible", null);
    insertComment.run(2, 1, 3, "Bob Creator", "Thanks Alice! Excited to create content here.", "visible", 1);
    insertComment.run(3, 1, 4, "Carol Ops", "Will there be analytics tools for brands?", "visible", null);
    insertComment.run(4, 1, 1, "Mosi Brand", "Yes! Check out our Analytics page.", "visible", 3);
    insertComment.run(5, 2, 2, "Alice", "Already registered! Can't wait for the conference.", "visible", null);

    // Seed follow relations
    const insertFollow = database.prepare(`
      INSERT INTO follow_relation (follower_account_id, target_account_id, status)
      VALUES (?, ?, ?)
    `);
    insertFollow.run(2, 1, "following");
    insertFollow.run(3, 1, "following");
    insertFollow.run(2, 3, "following");
    insertFollow.run(4, 1, "following");
    insertFollow.run(4, 2, "blocked");

    // Seed keyword rules
    const insertRule = database.prepare(`
      INSERT INTO keyword_rule (owner_account_id, phrase, match_mode, scope, action, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    insertRule.run(1, "spam", "contains", "post", "block");
    insertRule.run(1, "fake news", "contains", "post", "hide");
    insertRule.run(1, "scam", "exact", "comment", "block");

    // Seed post metrics (all published/scheduled except deleted #8)
    const insertMetric = database.prepare(`
      INSERT INTO post_metric (post_id, impressions, likes, replies, reposts, clicks, profile_visits, new_followers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMetric.run(1, 15420, 892, 45, 234, 120, 567, 45);
    insertMetric.run(2, 8750, 456, 12, 89, 340, 234, 23);
    insertMetric.run(3, 3200, 178, 3, 45, 12, 89, 8);
    insertMetric.run(4, 5600, 312, 8, 67, 23, 156, 15);
    insertMetric.run(5, 0, 0, 0, 0, 0, 0, 0);
    insertMetric.run(7, 2100, 145, 6, 34, 8, 67, 5);
    insertMetric.run(9, 12300, 756, 28, 156, 89, 445, 34);
    insertMetric.run(10, 0, 0, 0, 0, 0, 0, 0);

    // Seed event campaign
    database.prepare(`
      INSERT INTO event_campaign (post_id, event_title, start_at, end_at, registration_url, registrations_count, attendance_goal, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(2, "Mosi Annual Conference 2026", "2026-06-15 09:00:00", "2026-06-17 18:00:00", "https://conference.mosi.inc/register", 156, 500, "open");

    // Seed action logs for published posts
    const insertLog = database.prepare(`
      INSERT INTO post_action_log (post_id, actor_account_id, action_type, new_value)
      VALUES (?, ?, ?, ?)
    `);
    insertLog.run(1, 1, "published", "published");
    insertLog.run(2, 1, "published", "published");
    insertLog.run(3, 2, "published", "published");
    insertLog.run(4, 3, "published", "published");
    insertLog.run(7, 3, "published", "published");
    insertLog.run(9, 1, "published", "published");

    // Seed alice's post_like for social-unlike-post task (case_id=33)
    database.prepare("INSERT INTO post_like (post_id, account_id) VALUES (1, 2)").run();

    // Layer 1: optional per-task seed.json
    loadLayer1Seed(database);
  });

  tx();
}

export function publishDueScheduledPosts(database: Database) {
  const stmt = database.prepare(`
    UPDATE post SET status = 'published', published_at = datetime('now')
    WHERE status = 'scheduled' AND REPLACE(scheduled_for, 'T', ' ') <= datetime('now')
    RETURNING id, author_account_id
  `);
  const rows = stmt.all() as Array<{ id: number; author_account_id: number }>;

  const logStmt = database.prepare(`
    INSERT INTO post_action_log (post_id, actor_account_id, action_type, new_value)
    VALUES (?, ?, 'published', 'auto-publish')
  `);
  for (const row of rows) {
    logStmt.run(row.id, row.author_account_id);
  }
}
