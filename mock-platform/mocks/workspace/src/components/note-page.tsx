/** @jsxImportSource hono/jsx */
import type { Note, BriefEntry } from "../types.js";

interface NotePageProps {
  note?: Note;
  briefEntry?: BriefEntry;
}

const EVIDENCE_SOURCES = [
  { value: "", label: "— Select source —" },
  { value: "user_input", label: "User Input" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "document", label: "Document" },
  { value: "system", label: "System" },
];

const ACTION_STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const ACTION_PRIORITIES = [
  { value: "", label: "—" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function NotePage({ note, briefEntry }: NotePageProps) {
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
            <option value="brief" selected={contentType === "brief"}>Brief</option>
          </select>
        </div>
        <div id="form-body">
          {contentType === "brief" ? renderBriefBody(briefEntry) : renderPlainBody(content)}
        </div>
        <button type="submit" style="background:#0f3460;color:#fff;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;">Save</button>
      </form>
      <script>{`
        function renderBriefBody(keyUpdates) {
          return (
            '<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">' +
            '<button type="button" id="btn-insert-heading" style="padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;">Insert Section Heading</button>' +
            '</div>' +
            '<div id="brief-key-updates" style="margin-bottom:16px;">' +
            '<label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Key Updates</label>' +
            '<textarea name="brief_key_updates" rows="6" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:monospace;">' + (keyUpdates || '') + '</textarea>' +
            '</div>' +
            '<div id="brief-evidence" style="margin-bottom:16px;">' +
            '<label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Evidence Bullets</label>' +
            '<div id="evidence-rows"></div>' +
            '<button type="button" id="btn-add-evidence" style="margin-top:8px;padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;">+ Add evidence</button>' +
            '</div>' +
            '<div id="brief-action" style="margin-bottom:16px;">' +
            '<label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Action Items</label>' +
            '<div id="action-rows"></div>' +
            '<button type="button" id="btn-add-action" style="margin-top:8px;padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;">+ Add action item</button>' +
            '</div>' +
            '<div id="brief-citations" style="margin-bottom:16px;">' +
            '<label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Citations</label>' +
            '<div id="citation-rows"></div>' +
            '<button type="button" id="btn-add-citation" style="margin-top:8px;padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;">+ Add citation</button>' +
            '</div>'
          );
        }

        function renderPlainBody(content) {
          return '<div style="margin-bottom:16px;">' +
            '<label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Content</label>' +
            '<textarea id="content" name="content" rows="16" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:monospace;">' + (content || '') + '</textarea>' +
            '</div>';
        }

        function attachRemoveHandlers(container) {
          container.querySelectorAll('.btn-remove').forEach(function(btn) {
            btn.onclick = function() {
              btn.parentElement.remove();
            };
          });
        }

        function attachBriefHandlers() {
          var formBody = document.getElementById('form-body');
          if (!formBody) return;

          function addRow(btnId, rowClass, containerId, html) {
            var btn = document.getElementById(btnId);
            if (!btn) return;
            btn.onclick = function() {
              var row = document.createElement('div');
              row.className = rowClass;
              row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;';
              row.innerHTML = html +
                '<button type="button" class="btn-remove" style="padding:8px 12px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;">Remove</button>';
              document.getElementById(containerId).appendChild(row);
              attachRemoveHandlers(row);
            };
          }

          addRow('btn-add-evidence', 'brief-evidence-row', 'evidence-rows',
            '<input type="text" name="brief_evidence_text" placeholder="Evidence text" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />' +
            '<select name="brief_evidence_source" style="padding:8px;border:1px solid #ddd;border-radius:4px;">' +
            '<option value="">— Select source —</option><option value="user_input">User Input</option><option value="email">Email</option>' +
            '<option value="meeting">Meeting</option><option value="document">Document</option><option value="system">System</option></select>');

          addRow('btn-add-action', 'brief-action-row', 'action-rows',
            '<input type="text" name="brief_action_text" placeholder="Action text" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />' +
            '<select name="brief_action_status" style="padding:8px;border:1px solid #ddd;border-radius:4px;">' +
            '<option value="todo">To Do</option><option value="in_progress">In Progress</option>' +
            '<option value="done">Done</option><option value="cancelled">Cancelled</option></select>' +
            '<input type="text" name="brief_action_owner" placeholder="Owner" style="width:120px;padding:8px;border:1px solid #ddd;border-radius:4px;" />' +
            '<input type="text" name="brief_action_due" placeholder="YYYY-MM-DD" style="width:120px;padding:8px;border:1px solid #ddd;border-radius:4px;" />' +
            '<select name="brief_action_priority" style="padding:8px;border:1px solid #ddd;border-radius:4px;">' +
            '<option value="">—</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>');

          addRow('btn-add-citation', 'brief-citation-row', 'citation-rows',
            '<input type="text" name="brief_cite_title" placeholder="Title" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />' +
            '<input type="text" name="brief_cite_url" placeholder="URL" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />' +
            '<input type="text" name="brief_cite_note" placeholder="Note" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />');

          attachRemoveHandlers(formBody);

          var insertHeading = document.getElementById('btn-insert-heading');
          if (insertHeading) {
            insertHeading.onclick = function() {
              var choice = prompt('Which section? (key_updates, evidence, action, citations)');
              if (!choice) return;
              var ta = document.querySelector('textarea[name="brief_key_updates"]');
              if (choice === 'key_updates' && ta) {
                ta.value += (ta.value ? '\\n' : '') + '## Key Updates';
                ta.focus();
              } else {
                var btn = document.getElementById('btn-add-' + choice.replace('citations', 'citation'));
                if (btn) btn.click();
              }
            };
          }
        }

        function swapFormBody(contentType) {
          var formBody = document.getElementById('form-body');
          var titleVal = document.getElementById('title').value;
          if (contentType === 'brief') {
            formBody.innerHTML = renderBriefBody('');
          } else {
            formBody.innerHTML = renderPlainBody('');
          }
          document.getElementById('title').value = titleVal;
          if (contentType === 'brief') {
            attachBriefHandlers();
          }
        }

        document.getElementById('content_type').addEventListener('change', function(e) {
          swapFormBody(e.target.value);
        });

        if (document.getElementById('content_type').value === 'brief') {
          attachBriefHandlers();
        }

        document.getElementById('note-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          var title = document.getElementById('title').value;
          var content_type = document.getElementById('content_type').value;
          var isNew = !window.location.pathname.match(/\\/note\\/(\\d+)/);
          var idMatch = window.location.pathname.match(/\\/note\\/(\\d+)/);

          try {
            if (content_type === 'brief') {
              var keyUpdates = document.querySelector('textarea[name="brief_key_updates"]')?.value || '';

              var evidence = [];
              document.querySelectorAll('.brief-evidence-row').forEach(function(row) {
                var text = (row.querySelector('input[name="brief_evidence_text"]')?.value || '').trim();
                if (!text) return;
                var source = row.querySelector('select[name="brief_evidence_source"]')?.value || undefined;
                evidence.push({ text: text, source: source || undefined });
              });

              var actions = [];
              document.querySelectorAll('.brief-action-row').forEach(function(row) {
                var text = (row.querySelector('input[name="brief_action_text"]')?.value || '').trim();
                if (!text) return;
                actions.push({
                  text: text,
                  status: row.querySelector('select[name="brief_action_status"]')?.value || 'todo',
                  owner: row.querySelector('input[name="brief_action_owner"]')?.value || undefined,
                  due_date: row.querySelector('input[name="brief_action_due"]')?.value || undefined,
                  priority: row.querySelector('select[name="brief_action_priority"]')?.value || undefined
                });
              });

              var citations = [];
              document.querySelectorAll('.brief-citation-row').forEach(function(row) {
                var titleField = (row.querySelector('input[name="brief_cite_title"]')?.value || '').trim();
                if (!titleField) return;
                citations.push({
                  title: titleField,
                  url: row.querySelector('input[name="brief_cite_url"]')?.value || undefined,
                  note: row.querySelector('input[name="brief_cite_note"]')?.value || undefined
                });
              });

              var briefPayload = {
                key_updates: keyUpdates,
                evidence_bullets: evidence,
                action_items: actions,
                citations: citations,
                status: 'draft'
              };

              var noteId;
              if (isNew) {
                var res = await fetch('/api/notes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: title, content: '', content_type: 'brief' })
                });
                if (!res.ok) throw new Error('POST note failed');
                var payload = await res.json();
                var data = payload.data || payload;
                noteId = data.id;
              } else {
                noteId = idMatch[1];
              }

              var briefRes = await fetch('/api/notes/' + noteId + '/brief', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(briefPayload)
              });
              if (!briefRes.ok) throw new Error('PUT brief failed');

              function flattenBrief(keyUpdates, evidence, actions, citations) {
                var parts = [];
                if (keyUpdates.trim()) parts.push('Key Updates:\\n' + keyUpdates);
                if (evidence.length > 0) parts.push('Evidence:\\n' + evidence.map(function(e) { return '- ' + e.text; }).join('\\n'));
                if (actions.length > 0) parts.push('Action Items:\\n' + actions.map(function(a) { return '- [' + a.status + '] ' + a.text; }).join('\\n'));
                if (citations.length > 0) parts.push('Citations:\\n' + citations.map(function(c) { return '- ' + c.title; }).join('\\n'));
                return parts.join('\\n\\n');
              }
              var flattened = flattenBrief(keyUpdates, evidence, actions, citations);

              var noteRes = await fetch('/api/notes/' + noteId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title, content: flattened, content_type: 'brief' })
              });
              if (!noteRes.ok) throw new Error('PUT note failed');

              window.location = '/workspace';
            } else {
              var content = document.getElementById('content').value;
              if (isNew) {
                var res = await fetch('/api/notes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: title, content: content, content_type: content_type })
                });
                if (res.ok) {
                  var payload = await res.json();
                  var data = payload.data || payload;
                  window.location = '/note/' + data.id;
                }
              } else {
                var id = idMatch[1];
                var res = await fetch('/api/notes/' + id, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: title, content: content, content_type: content_type })
                });
                if (res.ok) {
                  window.location = '/workspace';
                }
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

function renderPlainBody(content: string) {
  return (
    <div style="margin-bottom:16px;">
      <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Content</label>
      <textarea id="content" name="content" rows={16} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:monospace;">{content}</textarea>
    </div>
  );
}

function renderBriefBody(briefEntry?: BriefEntry) {
  const keyUpdates = briefEntry?.key_updates ?? "";

  return (
    <>
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button type="button" id="btn-insert-heading" style="padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;">Insert Section Heading</button>
      </div>
      <div id="brief-key-updates" style="margin-bottom:16px;">
        <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Key Updates</label>
        <textarea name="brief_key_updates" rows={6} required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:monospace;">{keyUpdates}</textarea>
      </div>
      <div id="brief-evidence" style="margin-bottom:16px;">
        <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Evidence Bullets</label>
        <div id="evidence-rows">
          {briefEntry?.evidence_bullets.map((e, i) => (
            <div class="brief-evidence-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
              <input type="text" name="brief_evidence_text" value={e.text} placeholder="Evidence text" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />
              <select name="brief_evidence_source" style="padding:8px;border:1px solid #ddd;border-radius:4px;">
                {EVIDENCE_SOURCES.map((s) => (
                  <option value={s.value} selected={e.source === s.value || (!e.source && s.value === "")}>{s.label}</option>
                ))}
              </select>
              <button type="button" class="btn-remove" style="padding:8px 12px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;">Remove</button>
            </div>
          ))}
        </div>
        <button type="button" id="btn-add-evidence" style="margin-top:8px;padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;">+ Add evidence</button>
      </div>
      <div id="brief-action" style="margin-bottom:16px;">
        <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Action Items</label>
        <div id="action-rows">
          {briefEntry?.action_items.map((a, i) => (
            <div class="brief-action-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
              <input type="text" name="brief_action_text" value={a.text} placeholder="Action text" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />
              <select name="brief_action_status" style="padding:8px;border:1px solid #ddd;border-radius:4px;">
                {ACTION_STATUSES.map((s) => (
                  <option value={s.value} selected={a.status === s.value}>{s.label}</option>
                ))}
              </select>
              <input type="text" name="brief_action_owner" value={a.owner ?? ""} placeholder="Owner" style="width:120px;padding:8px;border:1px solid #ddd;border-radius:4px;" />
              <input type="text" name="brief_action_due" value={a.due_date ?? ""} placeholder="YYYY-MM-DD" style="width:120px;padding:8px;border:1px solid #ddd;border-radius:4px;" />
              <select name="brief_action_priority" style="padding:8px;border:1px solid #ddd;border-radius:4px;">
                {ACTION_PRIORITIES.map((p) => (
                  <option value={p.value} selected={a.priority === p.value || (!a.priority && p.value === "")}>{p.label}</option>
                ))}
              </select>
              <button type="button" class="btn-remove" style="padding:8px 12px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;">Remove</button>
            </div>
          ))}
        </div>
        <button type="button" id="btn-add-action" style="margin-top:8px;padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;">+ Add action item</button>
      </div>
      <div id="brief-citations" style="margin-bottom:16px;">
        <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Citations</label>
        <div id="citation-rows">
          {briefEntry?.citations.map((c, i) => (
            <div class="brief-citation-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
              <input type="text" name="brief_cite_title" value={c.title} placeholder="Title" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />
              <input type="text" name="brief_cite_url" value={c.url ?? ""} placeholder="URL" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />
              <input type="text" name="brief_cite_note" value={c.note ?? ""} placeholder="Note" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;" />
              <button type="button" class="btn-remove" style="padding:8px 12px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;">Remove</button>
            </div>
          ))}
        </div>
        <button type="button" id="btn-add-citation" style="margin-top:8px;padding:8px 16px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;">+ Add citation</button>
      </div>
    </>
  );
}
