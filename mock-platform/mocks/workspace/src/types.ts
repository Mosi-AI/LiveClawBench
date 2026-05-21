export interface User {
  id: number;
  username: string;
  password: string;
  display_name: string;
  role: "admin" | "user";
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: number;
  owner_user_id: number;
  title: string;
  content: string;
  content_type: "plain_text" | "markdown" | "brief";
  preview_text: string;
  is_seeded: number;
  save_count: number;
  created_at: string;
  updated_at: string;
}

export interface NoteRevision {
  id: number;
  note_id: number;
  revision_no: number;
  content_snapshot: string;
  change_summary: string;
  edited_by_user_id: number;
  edited_at: string;
}

export interface BriefEvidence {
  text: string;
  source?: "user_input" | "email" | "meeting" | "document" | "system";
}

export interface BriefActionItem {
  text: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  owner?: string;
  due_date?: string;
  priority?: "low" | "medium" | "high";
}

export interface BriefCitation {
  title: string;
  url?: string;
  note?: string;
}

export interface BriefEntry {
  id: number;
  note_id: number;
  key_updates: string;
  evidence_bullets: BriefEvidence[];
  action_items: BriefActionItem[];
  citations: BriefCitation[];
  status: "draft" | "final";
  created_at: string;
  updated_at: string;
}

export interface TaskRecord {
  id: number;
  note_id: number;
  record_type: "communication" | "summary" | "tracker_update";
  source_channel: "manual" | "email" | "meeting" | "incident";
  summary_text: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  created_at: string;
  updated_at: string;
}
