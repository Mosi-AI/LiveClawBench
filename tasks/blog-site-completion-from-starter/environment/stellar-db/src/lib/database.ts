import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = join(dataDir, 'stellar.db');

// Database instance (singleton pattern)
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Enable Write-Ahead Logging for better concurrency
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function initializeSchema(): void {
  if (!db) return;

  // Core posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      featured_image TEXT,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      view_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME
    );
  `);

  // Tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Post-Tag junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, tag_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `);

  // Users table for admin
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Analytics table for privacy-friendly local analytics
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Media table for image management
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      alt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      title,
      content,
      content='posts',
      content_rowid='id'
    );
  `);

  // Triggers to keep FTS index in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS posts_fts_insert AFTER INSERT ON posts BEGIN
      INSERT INTO posts_fts(rowid, title, content)
      VALUES (new.id, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS posts_fts_update AFTER UPDATE ON posts BEGIN
      UPDATE posts_fts SET title = new.title, content = new.content
      WHERE rowid = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS posts_fts_delete AFTER DELETE ON posts BEGIN
      DELETE FROM posts_fts WHERE rowid = old.id;
    END;
  `);

  // Comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );
  `);

  // Settings table for blog configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default settings
  const defaultSettings = [
    ['blog_title', 'Stellar-DB'],
    ['blog_description', 'A self-hosted, Local-First blog platform'],
    ['posts_per_page', '10'],
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  defaultSettings.forEach(([key, value]) => {
    insertSetting.run(key, value);
  });
}

// Types
export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image: string | null;
  status: 'draft' | 'published' | 'archived';
  view_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'editor';
  last_login: string | null;
  created_at: string;
}

export interface Comment {
  id: number;
  post_id: number;
  author_name: string;
  author_email: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  parent_id: number | null;
  created_at: string;
}

export interface Media {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  created_at: string;
}

// Post CRUD operations
export const postQueries = {
  create: (data: Omit<Post, 'id' | 'view_count' | 'created_at' | 'updated_at'>) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO posts (title, slug, content, excerpt, featured_image, status, published_at)
      VALUES (@title, @slug, @content, @excerpt, @featured_image, @status, @published_at)
    `);
    const result = stmt.run(data);
    return result.lastInsertRowid as number;
  },

  findById: (id: number): Post | undefined => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
  },

  findBySlug: (slug: string): Post | undefined => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as Post | undefined;
  },

  findAll: (options: { status?: string; limit?: number; offset?: number } = {}): Post[] => {
    const db = getDatabase();
    let sql = 'SELECT * FROM posts';
    const params: (string | number)[] = [];

    if (options.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY created_at DESC';

    if (options.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    return db.prepare(sql).all(...params) as Post[];
  },

  update: (id: number, data: Partial<Omit<Post, 'id' | 'created_at'>>) => {
    const db = getDatabase();
    const fields = Object.keys(data).map(key => `${key} = @${key}`).join(', ');
    const stmt = db.prepare(`
      UPDATE posts SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = @id
    `);
    return stmt.run({ ...data, id });
  },

  delete: (id: number) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  },

  incrementViewCount: (id: number) => {
    const db = getDatabase();
    return db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(id);
  },

  search: (query: string): Post[] => {
    const db = getDatabase();
    // Search FTS5 index
    const ftsResults = db.prepare(
      'SELECT rowid FROM posts_fts WHERE posts_fts MATCH ? ORDER BY rank'
    ).all(query) as { rowid: number }[];

    if (ftsResults.length === 0) return [];

    const ids = ftsResults.map(r => r.rowid);
    const placeholders = ids.map(() => '?').join(',');
    const posts = db.prepare(
      `SELECT * FROM posts WHERE id IN (${placeholders}) AND status = 'published'`
    ).all(...ids) as Post[];

    // Return in order of FTS rank
    const postMap = new Map(posts.map(p => [p.id, p]));
    return ids.map(id => postMap.get(id)).filter((p): p is Post => p !== undefined);
  },
};

// User queries
export const userQueries = {
  create: (data: Omit<User, 'id' | 'last_login' | 'created_at'>) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (@username, @email, @password_hash, @role)
    `);
    return stmt.run(data);
  },

  findByUsername: (username: string): User | undefined => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  },

  findByEmail: (email: string): User | undefined => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  },

  updateLastLogin: (id: number) => {
    const db = getDatabase();
    return db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },
};

// Tag queries
export const tagQueries = {
  create: (data: Omit<Tag, 'id' | 'created_at'>) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO tags (name, slug) VALUES (@name, @slug)
    `);
    return stmt.run(data);
  },

  findAll: (): Tag[] => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
  },

  findBySlug: (slug: string): Tag | undefined => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags WHERE slug = ?').get(slug) as Tag | undefined;
  },

  getPostsByTag: (tagId: number): Post[] => {
    const db = getDatabase();
    return db.prepare(`
      SELECT p.* FROM posts p
      JOIN post_tags pt ON p.id = pt.post_id
      WHERE pt.tag_id = ? AND p.status = 'published'
      ORDER BY p.published_at DESC
    `).all(tagId) as Post[];
  },
};

// Media queries
export const mediaQueries = {
  create: (data: Omit<Media, 'id' | 'created_at'>) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO media (filename, original_name, mime_type, size, width, height, alt)
      VALUES (@filename, @original_name, @mime_type, @size, @width, @height, @alt)
    `);
    return stmt.run(data);
  },

  findAll: (): Media[] => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM media ORDER BY created_at DESC').all() as Media[];
  },

  findById: (id: number): Media | undefined => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM media WHERE id = ?').get(id) as Media | undefined;
  },

  delete: (id: number) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM media WHERE id = ?').run(id);
  },
};

// Settings queries
export const settingsQueries = {
  get: (key: string): string | undefined => {
    const db = getDatabase();
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return result?.value;
  },

  set: (key: string, value: string) => {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO settings (key, value) VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = CURRENT_TIMESTAMP
    `).run({ key, value });
  },

  getAll: (): Record<string, string> => {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },
};
