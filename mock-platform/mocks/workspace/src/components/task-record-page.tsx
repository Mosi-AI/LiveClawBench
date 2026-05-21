/** @jsxImportSource hono/jsx */
import type { Note, TaskRecord } from "../types.js";

interface TaskRecordPageProps {
  note: Note;
  record?: TaskRecord;
}

export function TaskRecordPage({ note, record }: TaskRecordPageProps) {
  const recordType = record?.record_type ?? "summary";
  const sourceChannel = record?.source_channel ?? "manual";
  const summaryText = record?.summary_text ?? "";
  const status = record?.status ?? "open";

  return (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2>Task Record: {note.title}</h2>
        <a href={`/note/${note.id}`} style="background:#16213e;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Back to Note</a>
      </div>
      <form id="task-record-form" style="background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Record Type</label>
          <select id="record_type" name="record_type" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;">
            <option value="communication" selected={recordType === "communication"}>Communication</option>
            <option value="summary" selected={recordType === "summary"}>Summary</option>
            <option value="tracker_update" selected={recordType === "tracker_update"}>Tracker Update</option>
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Source Channel</label>
          <select id="source_channel" name="source_channel" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;">
            <option value="manual" selected={sourceChannel === "manual"}>Manual</option>
            <option value="email" selected={sourceChannel === "email"}>Email</option>
            <option value="meeting" selected={sourceChannel === "meeting"}>Meeting</option>
            <option value="incident" selected={sourceChannel === "incident"}>Incident</option>
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Summary</label>
          <textarea id="summary_text" name="summary_text" rows={6} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:monospace;">{summaryText}</textarea>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:14px;margin-bottom:6px;color:#333;">Status</label>
          <select id="status" name="status" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;">
            <option value="open" selected={status === "open"}>Open</option>
            <option value="in_progress" selected={status === "in_progress"}>In Progress</option>
            <option value="done" selected={status === "done"}>Done</option>
            <option value="cancelled" selected={status === "cancelled"}>Cancelled</option>
          </select>
        </div>
        <button type="submit" style="background:#0f3460;color:#fff;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;">Save</button>
      </form>
      <script>{`
        document.getElementById('task-record-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const record_type = document.getElementById('record_type').value;
          const source_channel = document.getElementById('source_channel').value;
          const summary_text = document.getElementById('summary_text').value;
          const status = document.getElementById('status').value;
          const id = window.location.pathname.match(/\\/note\\/(\\d+)/)[1];
          try {
            const res = await fetch('/api/notes/' + id + '/task-record', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ record_type, source_channel, summary_text, status })
            });
            if (res.ok) {
              window.location = '/workspace';
            }
          } catch (err) {
            console.error(err);
          }
        });
      `}</script>
    </div>
  );
}
