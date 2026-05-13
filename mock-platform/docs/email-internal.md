# Email Internal Documentation

This document covers implementation details of the `mock-email` service that are not part of the public API surface. For API routes and request/response schemas, see the auto-generated OpenAPI spec at `dist/openapi/email.json`.

---

## Data Types

Defined in `src/schemas.ts` using Zod schemas:

### Email

```typescript
interface Email {
  id: number;
  sender_id: number;
  sender_email: string;
  sender_name: string;
  recipient_id: number;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  folder: "inbox" | "sent" | "drafts" | "trash";
  is_read: boolean;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
}
```

### Attachment

```typescript
interface Attachment {
  id: number;
  original_filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}
```

### User

```typescript
interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}
```

---

## Database Schema

SQLite via `bun:sqlite`. Three core tables:

```sql
-- users
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at DATETIME
);

-- emails
CREATE TABLE emails (
  id INTEGER PRIMARY KEY,
  sender_id INTEGER,
  recipient_id INTEGER,
  recipient_email TEXT,
  subject TEXT,
  body TEXT,
  folder TEXT CHECK(folder IN ('inbox','sent','drafts','trash')),
  is_read INTEGER DEFAULT 0,
  created_at DATETIME,
  updated_at DATETIME
);

-- attachments
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY,
  email_id INTEGER,
  filename TEXT,
  original_filename TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at DATETIME
);
```

Indexes: `(sender_id, folder)`, `(recipient_id, folder)`, `created_at`, `(email_id)` on attachments.

---

## Seed Logic

### Baseline Data

Always injected unless the `emails` table already has rows for user "peter":

- **Inbox** (5 emails): Project Proposal, Team Meeting, Tech Arch Discussion, Feature Request, Invoice
- **Sent** (5 emails): Proposal to Client, Job Application, Support Request, Progress Update, Weekend Plans

### Task-Specific Injection

Controlled by `TASK_NAME` env var (defaults to `"email-writing"`):

| Task | Additional Emails |
|------|------------------|
| `email-reply` | Lau partnership inquiry (inbox) |
| `email-watch-shop` / `email-washer-change` | Brian (birthday gift), Lois (portable washer) |
| `flight-seat-selection` / `flight-seat-selection-failed` | GKD flight booking + Lau partnership |
| `flight-cancel-claim` | GKD flight cancellation + Lau partnership |
| `flight-info-change-notice` | GKD flight delay + Lau partnership |
| `schedule-change-request` | Lau partnership + sent email to Gary |

Idempotent user creation for "peter" and all simulated senders. Skips entirely if `emails` table already has rows for peter.

---

## Business Rules

### Compose & Send

- `POST /api/emails` — creates draft (`send_now = false`) or sends immediately (`send_now = true`)
- `PUT /api/emails/:id` — updates draft only (recipient, subject, body, attachment_ids). Fails with 400 if the email is not a draft.
- Sending creates an inbox copy for the recipient with duplicated attachments.

### Read & Status

- `GET /api/emails?folder=` — inbox ordered by `created_at DESC`, drafts by `updated_at DESC`
- `PUT /api/emails/:id/read` — only the **recipient** can toggle read status; the sender cannot mark sent emails as read

### Delete

- `DELETE /api/emails/:id` — first call moves to **trash**, second call **permanently deletes** (including attachments)
- Trash folder shows emails where the user is sender **or** recipient

### Draft Send

- `PUT /api/emails/:id/send` — transitions draft → sent, creates recipient inbox copy with attachments

### Attachments

- Files stored in `/var/lib/mock-data/email/attachments/YYYY-MM-DD/`
- UUID filename on disk; original name preserved in DB
- 10MB total upload limit
- Extension whitelist: `txt`, `pdf`, `png`, `jpg`, `jpeg`, `gif`, `doc`, `docx`, `xls`, `xlsx`, `zip`

---

## Task-Specific Behavior

The `TASK_NAME` switch in `seed.ts` enables scenario-specific fixtures without modifying route code:

- **Reply tasks**: Pre-seed an email requiring user response
- **Flight tasks**: Inject airline notification emails (`GKD` = mock airline)
- **Shopping tasks**: Inject e-commerce emails with purchase context

All task seeds preserve baseline data and append scenario-specific rows.

---

## Verifier Integration Notes

### Werkzeug Hash Compatibility

`src/helpers.ts` provides:

- `verifyWerkzeugHash(password, hash)` — async PBKDF2-SHA256 verification matching Flask's `generate_password_hash()`
- `generateWerkzeugHashSync(password)` — sync hash generation for seed fixtures
- Format: `pbkdf2:sha256:600000$salt$hash`

### Golden Response Testing

`tests/flask-golden.test.ts` compares Bun responses against Flask fixture files. Volatile fields are normalized:

- JWT tokens → `"<token>"`
- Timestamps → `"2024-01-01T00:00:00"`
- IDs → sequential integers
- Booleans → normalized

Coverage: login, inbox list, single email, user search, draft creation, draft send.

### Auth Flow

- JWT via `mock-lib` (`sign`/`verify`), `Authorization: Bearer <token>` header
- Login accepts Werkzeug hash **or** plain text fallback (development convenience only)
- `GET /api/auth/me` returns current user from JWT payload
