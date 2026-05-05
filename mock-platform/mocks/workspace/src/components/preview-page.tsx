/** @jsxImportSource hono/jsx */
import type { Note, BriefEntry } from "../types.js";

interface PreviewPageProps {
  note: Note;
  renderedHtml: string;
  briefEntry?: BriefEntry;
}

export function PreviewPage({ note, renderedHtml, briefEntry }: PreviewPageProps) {
  return (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2>{note.title}</h2>
        <a href={`/note/${note.id}`} style="background:#16213e;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Back to Edit</a>
      </div>
      <div style="background:#f0f0f0;padding:12px 16px;border-radius:4px;margin-bottom:24px;color:#555;font-size:14px;">
        <strong>Preview:</strong> {note.preview_text || "No preview available"}
      </div>
      <div style="background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
        {note.content_type === "brief" && briefEntry ? (
          <div>
            <section class="brief-key-updates" style="margin-bottom:24px;">
              <h3 style="font-size:16px;margin-bottom:12px;color:#1a1a2e;">Key Updates</h3>
              <p style="white-space:pre-wrap;line-height:1.6;">{briefEntry.key_updates}</p>
            </section>

            {briefEntry.evidence_bullets.length > 0 && (
              <section class="brief-evidence" style="margin-bottom:24px;">
                <h3 style="font-size:16px;margin-bottom:12px;color:#1a1a2e;">Evidence</h3>
                <ul style="padding-left:20px;line-height:1.6;">
                  {briefEntry.evidence_bullets.map((ev, i) => (
                    <li key={`ev-${i}`}>
                      {ev.text}
                      {ev.source && <span style="color:#666;font-size:13px;margin-left:6px;">({ev.source})</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {briefEntry.action_items.length > 0 && (
              <section class="brief-action-items" style="margin-bottom:24px;">
                <h3 style="font-size:16px;margin-bottom:12px;color:#1a1a2e;">Action Items</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                  <thead>
                    <tr style="border-bottom:1px solid #ddd;">
                      <th style="text-align:left;padding:8px;">Status</th>
                      <th style="text-align:left;padding:8px;">Text</th>
                      <th style="text-align:left;padding:8px;">Owner</th>
                      <th style="text-align:left;padding:8px;">Due</th>
                      <th style="text-align:left;padding:8px;">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {briefEntry.action_items.map((item, i) => (
                      <tr key={`ai-${i}`} style="border-bottom:1px solid #eee;">
                        <td style="padding:8px;">
                          <span style={`display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;${statusBadgeStyle(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td style="padding:8px;">{item.text}</td>
                        <td style="padding:8px;color:#666;">{item.owner || "—"}</td>
                        <td style="padding:8px;color:#666;">{item.due_date || "—"}</td>
                        <td style="padding:8px;color:#666;">{item.priority || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {briefEntry.citations.length > 0 && (
              <section class="brief-citations" style="margin-bottom:24px;">
                <h3 style="font-size:16px;margin-bottom:12px;color:#1a1a2e;">Citations</h3>
                <ul style="padding-left:20px;line-height:1.6;">
                  {briefEntry.citations.map((cite, i) => (
                    <li key={`cite-${i}`}>
                      {cite.url ? (
                        <a href={cite.url} target="_blank" rel="noopener noreferrer" style="color:#0f3460;text-decoration:underline;">{cite.title}</a>
                      ) : (
                        <span>{cite.title}</span>
                      )}
                      {cite.note && <p style="color:#666;font-size:13px;margin-top:2px;">{cite.note}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : note.content_type === "brief" && !briefEntry ? (
          <p>Structured brief preview is not available because no brief entry exists for this note.</p>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        )}
      </div>
    </div>
  );
}

function statusBadgeStyle(status: string): string {
  switch (status) {
    case "todo":
      return "background:#fff3cd;color:#856404;";
    case "in_progress":
      return "background:#cce5ff;color:#004085;";
    case "done":
      return "background:#d4edda;color:#155724;";
    case "cancelled":
      return "background:#f8d7da;color:#721c24;";
    default:
      return "background:#e2e3e5;color:#383d41;";
  }
}
