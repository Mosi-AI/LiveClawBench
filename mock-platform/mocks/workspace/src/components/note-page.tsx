/** @jsxImportSource hono/jsx */
import type { Note } from "../types.js";

interface NotePageProps {
  note?: Note;
}

export function NotePage({ note }: NotePageProps) {
  const isNew = !note;
  const title = note?.title ?? "";
  const content = note?.content ?? "";
  const contentType = note?.content_type ?? "plain_text";

  return (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2>{isNew ? "New Note" : "Edit Note"}</h2>
      </div>
      <form id="note-form" style="background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Title</label>
          <input type="text" id="title" name="title" value={title} required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Content Type</label>
          <select id="content_type" name="content_type" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;">
            <option value="plain_text" selected={contentType === "plain_text"}>Plain Text</option>
            <option value="markdown" selected={contentType === "markdown"}>Markdown</option>
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Content</label>
          <textarea id="content" name="content" rows={16} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:monospace;">{content}</textarea>
        </div>
        <button type="submit" style="background:#0f3460;color:#fff;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;">Save</button>
      </form>
      <script>{`
        document.getElementById('note-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const title = document.getElementById('title').value;
          const content = document.getElementById('content').value;
          const content_type = document.getElementById('content_type').value;
          const isNew = !window.location.pathname.match(/\\/note\\/(\\d+)/);
          try {
            if (isNew) {
              const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, content_type })
              });
              if (res.ok) {
                const data = await res.json();
                window.location = '/note/' + data.id;
              }
            } else {
              const id = window.location.pathname.match(/\\/note\\/(\\d+)/)[1];
              const res = await fetch('/api/notes/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, content_type })
              });
              if (res.ok) {
                window.location = '/workspace';
              }
            }
          } catch (err) {
            console.error(err);
          }
        });
      `}</script>
    </div>
  );
}
