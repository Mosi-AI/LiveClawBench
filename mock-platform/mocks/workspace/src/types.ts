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
