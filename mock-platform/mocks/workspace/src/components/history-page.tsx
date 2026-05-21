/** @jsxImportSource hono/jsx */
import type { Note, NoteRevision } from "../types.js";

interface HistoryPageProps {
  note: Note;
  revisions: NoteRevision[];
}

export function HistoryPage({ note, revisions }: HistoryPageProps) {
  const reversed = [...revisions].reverse();

  return (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2>History: {note.title}</h2>
        <a href={`/note/${note.id}`} style="background:#16213e;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Back to Note</a>
      </div>
      {reversed.length === 0 ? (
        <p style="color:#666;">No revisions yet.</p>
      ) : (
        <div style="display:flex;flex-direction:column;gap:12px;">
          {reversed.map((rev) => (
            <div key={String(rev.id)} style="background:#fff;padding:16px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-weight:600;">Revision #{rev.revision_no}</span>
                <span style="color:#666;font-size:13px;">{rev.edited_at}</span>
              </div>
              <div style="background:#f8f8f8;padding:12px;border-radius:4px;font-family:monospace;font-size:13px;white-space:pre-wrap;">{rev.content_snapshot}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
