/** @jsxImportSource hono/jsx */
import { Layout } from "./layout.js";
import type { FC } from "hono/jsx";
import type { Draft, Activity, Attachment } from "../types.js";

interface DraftDetailPageProps {
  draft: Draft;
  activities: Activity[];
  attachments: Attachment[];
}

const statusColors: Record<string, string> = {
  draft: "badge-draft", submitted: "badge-submitted", approved: "badge-approved",
  rejected: "badge-rejected", reimbursed: "badge-reimbursed",
};

const categoryLabels: Record<string, string> = {
  travel: "Travel", meals: "Meals", office_supplies: "Office Supplies", software: "Software",
  lodging: "Lodging", transport: "Transport", other: "Other",
};

const actionLabels: Record<string, string> = {
  created: "Created", edited: "Edited", attachment_added: "Attachment added",
  submitted: "Submitted", status_changed: "Status changed",
};

function UploadForm({ draftId, label }: { draftId: number; label: string }) {
  return (
    <form method="post" action={`/api/drafts/${draftId}/attachments`} enctype="multipart/form-data" class="upload-form">
      <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.html,.csv" class="upload-input" />
      <button type="submit" class="btn btn-outline btn-sm">{label}</button>
    </form>
  );
}

export const DraftDetailPage: FC<DraftDetailPageProps> = ({ draft, activities, attachments }) => {
  const isEditable = draft.status === "draft";
  const inlineEditScript = `
async function patchDraftField(draftId, field, value) {
  try {
    const res = await fetch('/api/drafts/' + draftId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value === '' ? null : value })
    });
    if (!res.ok) {
      const err = await res.json().catch(function(){return{};});
      alert('Failed to update ' + field + ': ' + (err.error || res.status));
      return;
    }
    location.reload();
  } catch (e) {
    alert('Network error: ' + e);
  }
}
document.querySelectorAll('[data-inline-edit]').forEach(function(el){
  el.addEventListener('change', function(){
    var field = el.getAttribute('data-inline-edit');
    var draftId = el.getAttribute('data-draft-id');
    patchDraftField(draftId, field, el.value);
  });
});
`;

  return (
    <Layout title={`Draft ${draft.draft_code}`} scripts={inlineEditScript}>
      <div class="detail-header">
        <div class="detail-header-left">
          <span class={`badge ${statusColors[draft.status] || ""}`}>{draft.status}</span>
          <span class="detail-date">Created {draft.created_at}</span>
        </div>
        {isEditable && (
          <form method="post" action={`/api/drafts/${draft.id}/submit`} class="detail-header-right">
            <button type="submit" class="btn btn-primary">Submit</button>
          </form>
        )}
      </div>

      <div class="detail-body">
        <div class="detail-receipts">
          <h3>Receipts</h3>
          {attachments.length === 0 ? (
            <div class="empty-receipt">
              <span class="empty-receipt-icon">&#128196;</span>
              <p>Add a receipt</p>
              {isEditable && <UploadForm draftId={draft.id} label="Upload" />}
            </div>
          ) : (
            <div class="attachment-list">
              {attachments.map((a) => (
                <div class="attachment-item">
                  <span class="attachment-filename">{a.original_filename}</span>
                  <span class="attachment-size">{(a.file_size_bytes / 1024).toFixed(1)} KB</span>
                  <span class="attachment-type">{a.mime_type}</span>
                  <a href={`/api/attachments/${a.attachment_ref}`} class="btn btn-outline btn-sm" target="_blank">View</a>
                  {a.preview_text && <div class="attachment-preview">{a.preview_text}</div>}
                </div>
              ))}
              {isEditable && <UploadForm draftId={draft.id} label="Upload more" />}
            </div>
          )}
        </div>

        <div class="detail-fields">
          {isEditable ? (
            <div class="inline-field-form">
              <div class="field-group">
                <label>Amount</label>
                <input type="number" data-inline-edit="amount" data-draft-id={draft.id} value={draft.amount.toFixed(2)} step="0.01" min="0.01" />
              </div>
              <div class="field-group">
                <label>Merchant</label>
                <input type="text" data-inline-edit="vendor_name" data-draft-id={draft.id} value={draft.vendor_name} maxlength="255" />
              </div>
              <div class="field-group">
                <label>Date</label>
                <input type="date" data-inline-edit="invoice_date" data-draft-id={draft.id} value={draft.invoice_date} />
              </div>
              <div class="field-group">
                <label>Category</label>
                {!draft.category && <span class="field-validation">Missing category.</span>}
                <select data-inline-edit="category" data-draft-id={draft.id}>
                  <option value="">Select...</option>
                  {Object.entries(categoryLabels).map(([val, label]) => (
                    <option value={val} selected={draft.category === val}>{label}</option>
                  ))}
                </select>
              </div>
              <div class="field-group">
                <label>Notes</label>
                <textarea data-inline-edit="notes" data-draft-id={draft.id} maxlength="2000">{draft.notes || ""}</textarea>
              </div>
            </div>
          ) : (
            <div class="readonly-fields">
              <div class="field-group"><label>Amount</label><span>{draft.currency} {draft.amount.toFixed(2)}</span></div>
              <div class="field-group"><label>Merchant</label><span>{draft.vendor_name}</span></div>
              <div class="field-group"><label>Date</label><span>{draft.invoice_date}</span></div>
              <div class="field-group"><label>Category</label><span>{draft.category ? categoryLabels[draft.category] || draft.category : "—"}</span></div>
              <div class="field-group"><label>Notes</label><span>{draft.notes || "—"}</span></div>
            </div>
          )}
        </div>
      </div>

      <div class="activity-timeline">
        <h3>Activity</h3>
        {activities.length === 0 ? (
          <p class="no-activity">No activity yet.</p>
        ) : (
          <div class="timeline">
            {activities.map((a) => (
              <div class="timeline-item">
                <span class="timeline-dot"></span>
                <div class="timeline-content">
                  <span class="timeline-action">{actionLabels[a.action_type] || a.action_type}</span>
                  {a.field_name && <span class="timeline-field"> {a.field_name}: "{a.old_value}" &rarr; "{a.new_value}"</span>}
                  {a.actor_name && <span class="timeline-actor"> by {a.actor_name}</span>}
                  <span class="timeline-time">{a.created_at}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
