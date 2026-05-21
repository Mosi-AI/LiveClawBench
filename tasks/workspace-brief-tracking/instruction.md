You have access to a workspace note-taking service running at http://localhost:5009/.

Log in with username `demo` and password `demo123`.

1. Read the file at `/workspace/environment/meeting_minutes.txt`.
2. Create a new note with title `Sprint 24 Retrospective` and `content_type = "brief"`.
3. Extract information from the meeting minutes and populate the brief via `PUT /api/notes/{id}/brief`:
   - `key_updates` — at least 2 key updates from the meeting
   - `evidence_bullets` — at least 1 evidence bullet with a `source`
   - `action_items` — at least 2 action items:
     - one with `status: "todo"`
     - one with `status: "in_progress"`
4. Create a task record for this note via `PUT /api/notes/{id}/task-record`:
   - `record_type`: `tracker_update`
   - `summary_text`: must contain the substring `"Sprint 24 follow-up"`
   - `status`: `in_progress`

You may use the workspace REST API directly.
