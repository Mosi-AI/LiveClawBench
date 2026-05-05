import { Database } from "bun:sqlite";
import { generatePreviewText } from "./store.js";

export function createSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS note (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      content_type TEXT NOT NULL DEFAULT 'plain_text' CHECK(content_type IN ('plain_text', 'markdown', 'brief')),
      preview_text TEXT NOT NULL DEFAULT '',
      is_seeded INTEGER NOT NULL DEFAULT 0,
      save_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_user_id) REFERENCES user(id) ON DELETE RESTRICT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS note_revision (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      revision_no INTEGER NOT NULL,
      content_snapshot TEXT NOT NULL,
      change_summary TEXT NOT NULL DEFAULT '',
      edited_by_user_id INTEGER NOT NULL,
      edited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(note_id, revision_no),
      FOREIGN KEY (note_id) REFERENCES note(id) ON DELETE CASCADE,
      FOREIGN KEY (edited_by_user_id) REFERENCES user(id) ON DELETE RESTRICT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS brief_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL UNIQUE,
      key_updates TEXT NOT NULL DEFAULT '',
      evidence_bullets TEXT NOT NULL DEFAULT '[]',
      action_items TEXT NOT NULL DEFAULT '[]',
      citations TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'final')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES note(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS task_record (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL UNIQUE,
      record_type TEXT NOT NULL DEFAULT 'summary' CHECK(record_type IN ('communication', 'summary', 'tracker_update')),
      source_channel TEXT NOT NULL DEFAULT 'manual' CHECK(source_channel IN ('manual', 'email', 'meeting', 'incident')),
      summary_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'done', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES note(id) ON DELETE CASCADE
    )
  `);
}

export function seed(db: Database): void {
  // Insert demo user with hard-coded id=1
  db.run(
    `INSERT OR IGNORE INTO user (id, username, password, display_name, role, is_active)
     VALUES (1, 'demo', 'demo123', 'Demo User', 'user', 1)`
  );

  // Insert 3 seeded notes with hard-coded ids
  const seededNotes = [
    {
      id: 1,
      title: "Project Kickoff Meeting Notes",
      content: "Discussed project scope, timeline, and team assignments.\nAction items assigned to each member.\nNext review scheduled for Friday.",
      content_type: "plain_text",
    },
    {
      id: 2,
      title: "Weekly Report Template",
      content: "# Weekly Report\n\n## Achievements\n- Completed feature X\n- Fixed bug Y\n\n## Plans\n- Start feature Z\n- Code review session",
      content_type: "markdown",
    },
    {
      id: 3,
      title: "Q2 OKR Tracker",
      content: "Objective 1: Improve user engagement\nKey Result 1: Increase DAU by 20%\nKey Result 2: Reduce churn by 10%\n\nObjective 2: Technical debt reduction",
      content_type: "plain_text",
    },
  ];

  for (const n of seededNotes) {
    db.run(
      `INSERT OR IGNORE INTO note (id, owner_user_id, title, content, content_type, preview_text, is_seeded)
       VALUES (?, 1, ?, ?, ?, ?, 1)`,
      [n.id, n.title, n.content, n.content_type, generatePreviewText(n.content)],
    );

    // Insert initial revision with hard-coded id matching note_id
    db.run(
      `INSERT OR IGNORE INTO note_revision (id, note_id, revision_no, content_snapshot, edited_by_user_id)
       VALUES (?, ?, 1, ?, 1)`,
      [n.id, n.id, n.content],
    );
  }

  // Phase 2 seed data

  // 1. Insert seeded note id=4 (brief)
  const note4Content = `Key Updates:\n1. Launch mobile app v2. 2. Expand to EU market.\n\nEvidence:\n- User surveys show 68% demand mobile\n\nAction Items:\n- [todo] Finalize EU compliance docs\n\nCitations:\n- Q3 Market Research Report`;
  db.run(
    `INSERT OR IGNORE INTO note (id, owner_user_id, title, content, content_type, preview_text, is_seeded)
     VALUES (?, 1, ?, ?, ?, ?, 1)`,
    [4, "Q3 Product Strategy Brief", note4Content, "brief", generatePreviewText(note4Content)],
  );

  // 2. Insert brief_entry row id=1 for note_id=4
  db.run(
    `INSERT OR IGNORE INTO brief_entry (id, note_id, key_updates, evidence_bullets, action_items, citations, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      4,
      "1. Launch mobile app v2. 2. Expand to EU market.",
      JSON.stringify([{ text: "User surveys show 68% demand mobile", source: "document" }]),
      JSON.stringify([{ text: "Finalize EU compliance docs", status: "todo", priority: "high" }]),
      JSON.stringify([{ title: "Q3 Market Research Report", note: "Internal slide deck" }]),
      "draft",
    ],
  );

  // 3. Recompute note 4's preview_text via rule-1
  db.run(
    `UPDATE note SET preview_text = ? WHERE id = 4`,
    ["1. Launch mobile app v2. 2. Expand to EU market.".slice(0, 300)],
  );

  // 4. Insert seeded note id=5 (plain_text with task record)
  const note5Content = "Service degradation on 2024-07-15 due to DB connection pool exhaustion. Root cause: max_connections set too low. Mitigation: raised pool size; added monitoring alert.";
  db.run(
    `INSERT OR IGNORE INTO note (id, owner_user_id, title, content, content_type, preview_text, is_seeded)
     VALUES (?, 1, ?, ?, ?, ?, 1)`,
    [5, "Incident Report #42", note5Content, "plain_text", generatePreviewText(note5Content)],
  );

  // 5. Insert task_record row id=1 for note_id=5
  db.run(
    `INSERT OR IGNORE INTO task_record (id, note_id, record_type, source_channel, summary_text, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [1, 5, "tracker_update", "incident", "Service degradation on 2024-07-15 due to DB connection pool exhaustion.", "done"],
  );

  // 6. Insert initial revisions for notes 4 and 5
  db.run(
    `INSERT OR IGNORE INTO note_revision (id, note_id, revision_no, content_snapshot, edited_by_user_id)
     VALUES (?, ?, 1, ?, 1)`,
    [4, 4, note4Content],
  );
  db.run(
    `INSERT OR IGNORE INTO note_revision (id, note_id, revision_no, content_snapshot, edited_by_user_id)
     VALUES (?, ?, 1, ?, 1)`,
    [5, 5, note5Content],
  );
}

