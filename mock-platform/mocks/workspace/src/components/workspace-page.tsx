/** @jsxImportSource hono/jsx */
import type { Note } from "../types.js";

interface WorkspacePageProps {
  notes: Note[];
  revisionCounts: Record<number, number>;
}

export function WorkspacePage({ notes, revisionCounts }: WorkspacePageProps) {
  return (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2>My Notes</h2>
        <a href="/note/new" style="background:#0f3460;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">New Note</a>
      </div>
      {notes.length === 0 ? (
        <p style="color:#666;">No notes yet. Create your first note!</p>
      ) : (
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background:#16213e;color:#fff;text-align:left;">
              <th style="padding:12px 16px;">Title</th>
              <th style="padding:12px 16px;">Created</th>
              <th style="padding:12px 16px;">Updated</th>
              <th style="padding:12px 16px;">Saves</th>
              <th style="padding:12px 16px;">Revisions</th>
              <th style="padding:12px 16px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((note) => (
              <tr style="border-bottom:1px solid #eee;" key={String(note.id)}>
                <td style="padding:12px 16px;">
                  <a href={`/note/${note.id}`} style="color:#0f3460;text-decoration:none;font-weight:500;">{note.title}</a>
                </td>
                <td style="padding:12px 16px;color:#666;font-size:13px;">{note.created_at}</td>
                <td style="padding:12px 16px;color:#666;font-size:13px;">{note.updated_at}</td>
                <td style="padding:12px 16px;">{note.save_count}</td>
                <td style="padding:12px 16px;">{revisionCounts[note.id] ?? 0}</td>
                <td style="padding:12px 16px;">
                  <a href={`/note/${note.id}`} style="margin-right:8px;color:#0f3460;">Open</a>
                  <a href={`/note/${note.id}/preview`} style="margin-right:8px;color:#0f3460;">Preview</a>
                  <a href={`/note/${note.id}/history`} style="margin-right:8px;color:#0f3460;">History</a>
                  <a href="#" onclick={`fetch('/api/notes/${note.id}',{method:'DELETE'}).then(()=>location.reload())`} style="color:#e94560;">Delete</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
