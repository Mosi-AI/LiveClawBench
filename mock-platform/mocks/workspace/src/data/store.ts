import { Database } from "bun:sqlite";
import type { Note, NoteRevision } from "../types.js";

export function createNote(
  db: Database,
  ownerUserId: number,
  title: string,
  content: string,
  contentType: "plain_text" | "markdown" | "brief",
): Note {
  const now = new Date().toISOString();
  const previewText = generatePreviewText(content);

  const result = db.query(
    `INSERT INTO note (owner_user_id, title, content, content_type, preview_text, is_seeded, save_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
     RETURNING *`,
  ).get(ownerUserId, title, content, contentType, previewText, now, now) as Record<string, unknown>;

  return rowToNote(result);
}

export function getNoteById(db: Database, id: number): Note | null {
  const row = db.query("SELECT * FROM note WHERE id = ?").get(id) as Record<string, unknown> | null;
  if (!row) return null;
  return rowToNote(row);
}

export function updateNote(
  db: Database,
  id: number,
  title: string,
  content: string,
  contentType: "plain_text" | "markdown" | "brief",
  editedByUserId: number,
): Note | null {
  const note = getNoteById(db, id);
  if (!note) return null;

  const now = new Date().toISOString();
  const previewText = generatePreviewText(content, contentType, db, id);

  const transaction = db.transaction(() => {
    // Update note
    db.run(
      `UPDATE note SET title = ?, content = ?, content_type = ?, preview_text = ?, updated_at = ?, save_count = save_count + 1
       WHERE id = ?`,
      [title, content, contentType, previewText, now, id],
    );

    // Insert revision
    const nextRevisionNo = db.query(
      `SELECT COALESCE(MAX(revision_no), 0) + 1 AS next_no FROM note_revision WHERE note_id = ?`,
    ).get(id) as { next_no: number };

    db.run(
      `INSERT INTO note_revision (note_id, revision_no, content_snapshot, change_summary, edited_by_user_id)
       VALUES (?, ?, ?, '', ?)`,
      [id, nextRevisionNo.next_no, content, editedByUserId],
    );
  });

  transaction();
  return getNoteById(db, id);
}

export function deleteNote(db: Database, id: number): boolean {
  const note = getNoteById(db, id);
  if (!note) return false;
  db.run("DELETE FROM note WHERE id = ?", [id]);
  return true;
}

export function listNotes(db: Database, ownerUserId: number, seededOnly = false): Note[] {
  let sql = "SELECT * FROM note WHERE owner_user_id = ?";
  if (seededOnly) sql += " AND is_seeded = 1";
  sql += " ORDER BY updated_at DESC";

  const rows = db.query(sql).all(ownerUserId) as Record<string, unknown>[];
  return rows.map(rowToNote);
}

export function listRevisions(db: Database, noteId: number): NoteRevision[] {
  const sql = `SELECT * FROM note_revision WHERE note_id = ? ORDER BY revision_no ASC`;
  const rows = db.query(sql).all(noteId) as Record<string, unknown>[];
  return rows.map(rowToRevision);
}

export function getRevisionCount(db: Database, noteId: number): number {
  const row = db.query("SELECT COUNT(*) AS count FROM note_revision WHERE note_id = ?").get(noteId) as { count: number };
  return row.count;
}

export function getLatestRevision(db: Database, noteId: number): NoteRevision | null {
  const sql = `SELECT * FROM note_revision WHERE note_id = ? ORDER BY revision_no DESC LIMIT 1`;
  const row = db.query(sql).get(noteId) as Record<string, unknown> | null;
  if (!row) return null;
  return rowToRevision(row);
}

export function getUserById(db: Database, id: number): { id: number; username: string; display_name: string } | null {
  const row = db.query("SELECT id, username, display_name FROM user WHERE id = ? AND is_active = 1").get(id) as
    Record<string, unknown> | null;
  if (!row) return null;
  return {
    id: row.id as number,
    username: row.username as string,
    display_name: row.display_name as string,
  };
}

export function getUserByUsername(db: Database, username: string): { id: number; username: string; password: string; display_name: string } | null {
  const row = db.query("SELECT id, username, password, display_name FROM user WHERE username = ? AND is_active = 1").get(username) as
    Record<string, unknown> | null;
  if (!row) return null;
  return {
    id: row.id as number,
    username: row.username as string,
    password: row.password as string,
    display_name: row.display_name as string,
  };
}

function generatePreviewText(content: string, contentType?: string, db?: Database, noteId?: number): string {
  // Phase 1: if content_type is brief and brief_entry exists, use key_updates
  if (contentType === "brief" && db && noteId !== undefined) {
    const row = db.query("SELECT key_updates FROM brief_entry WHERE note_id = ?").get(noteId) as { key_updates: string } | null;
    if (row && row.key_updates) {
      return row.key_updates.slice(0, 300);
    }
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const preview = lines.slice(0, 4).join(" ").slice(0, 300);
  return preview;
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as number,
    owner_user_id: row.owner_user_id as number,
    title: row.title as string,
    content: row.content as string,
    content_type: row.content_type as "plain_text" | "markdown" | "brief",
    preview_text: row.preview_text as string,
    is_seeded: row.is_seeded as number,
    save_count: row.save_count as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToRevision(row: Record<string, unknown>): NoteRevision {
  return {
    id: row.id as number,
    note_id: row.note_id as number,
    revision_no: row.revision_no as number,
    content_snapshot: row.content_snapshot as string,
    change_summary: row.change_summary as string,
    edited_by_user_id: row.edited_by_user_id as number,
    edited_at: row.edited_at as string,
  };
}
