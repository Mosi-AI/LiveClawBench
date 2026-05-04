/** @jsxImportSource hono/jsx */
import type { Note } from "../types.js";

interface PreviewPageProps {
  note: Note;
  renderedHtml: string;
}

export function PreviewPage({ note, renderedHtml }: PreviewPageProps) {
  return (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2>{note.title}</h2>
        <a href={`/note/${note.id}`} style="background:#16213e;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Back to Edit</a>
      </div>
      <div style="background:#f0f0f0;padding:12px 16px;border-radius:4px;margin-bottom:24px;color:#555;font-size:14px;">
        <strong>Preview:</strong> {note.preview_text || "No preview available"}
      </div>
      <div style="background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.1);" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </div>
  );
}
