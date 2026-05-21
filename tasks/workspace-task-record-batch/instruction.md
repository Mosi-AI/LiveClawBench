You have access to a workspace note-taking service running at http://localhost:5009/.

Log in with username `demo` and password `demo123`.

The workspace contains 7 seeded notes representing different work items. For **every note you see**, create or update its associated task record with appropriate values:

- `record_type` — infer from the note content (`communication`, `summary`, or `tracker_update`)
- `source_channel` — infer from the note content (`manual`, `email`, `meeting`, or `incident`)
- `summary_text` — write a non-empty summary derived from the note's content
- `status` — set to a reasonable initial state

After all 7 task records are created or updated, set **all** of their `status` fields to `done`.

You may use the workspace REST API directly. The relevant endpoints are:
- `POST /api/auth/login` — log in
- `GET /api/notes` — list all notes
- `GET /api/notes/{id}` — read a note
- `PUT /api/notes/{id}/task-record` — create or update a task record
