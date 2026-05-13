# Todolist Internal Documentation

This document covers implementation details of the `mock-todolist` service that are not part of the public API surface. For API routes and request/response schemas, see the auto-generated OpenAPI spec at `dist/openapi/todolist.json`.

---

## Data Types

Defined in `src/schemas.ts` using Zod schemas:

### Todo

```typescript
interface Todo {
  id: number;
  title: string;
  date: string;              // YYYY-MM-DD
  time: string | null;       // HH:MM
  location: string | null;
  person: string | null;
  description: string | null;
  created_at: string;        // ISO timestamp
  updated_at: string;        // ISO timestamp
}
```

**No status field** — todos exist until deleted. There is no "completed" or "done" state.

### Query Parameters

- `ListTodosQuerySchema`: optional `start_date` (`YYYY-MM-DD`), `end_date` (`YYYY-MM-DD`), `month` (`YYYY-MM`)
- `DateParamSchema`: `YYYY-MM-DD`
- `MonthParamSchema`: `YYYY-MM`
- `IdParamSchema`: numeric string

---

## Database Schema

SQLite via `bun:sqlite`:

```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  location TEXT,
  person TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_todos_date ON todos(date);
CREATE INDEX idx_todos_created_at ON todos(created_at);
```

DB path resolution: `options.dbPath` → `TODOLIST_DB_PATH` env → `:memory:`. In-memory DBs bypass the process singleton so multiple mocks in one container each get a fresh database.

---

## Seed Logic

### Baseline Data

`SEED_TODOS` — 30 hardcoded todos spanning March 7 to April 1, 2026. Mix of work/personal tasks, some with null `time`/`location`/`person`/`description`.

Three baseline todos have "Recurring task" in their description, but this is **purely textual** — there is no actual recurrence engine.

### Task-Specific Injection

Controlled by `TASK_NAME` env var (or `taskName` parameter):

| Task | Injected Todos | Date Logic |
|------|---------------|------------|
| `schedule-change-request` | 3 todos: "Game party", "Morning run", "Book club meeting" | `getNextSunday()` — the upcoming Sunday |
| `flight-info-change-notice` | 1 todo: "Game party w/ my old friends" | `getTodayPlus(2)` — today + 2 days |
| default | none | — |

**Idempotency**: Seed skips entirely if `COUNT(*) FROM todos > 0`. This handles container restarts and cross-app containers gracefully.

**Seed callback**: `createTodolistApp` returns `{ ..., seed: () => seedDatabase(db, options?.taskName) }` for explicit re-seeding in tests.

### `getNextSunday` Boundary Fix

Commit `8f0b0f6` fixed two bugs:

- **Sunday-on-Sunday**: `daysUntilSunday === 0` was incorrectly remapped to `7`, pushing Sunday to the *following* Sunday even when today was already Sunday. Fixed by using `daysUntilSunday = 6 - pyWeekday`, which correctly returns `0` when today is Sunday.
- **UTC off-by-one**: `toISOString().slice(0, 10)` returned UTC date, causing off-by-one errors near midnight. Fixed by using `formatLocalDate()` with local `getFullYear()`/`getMonth()`/`getDate()`.

---

## Business Rules

### CRUD Routes

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/todos` | List all. Query: `month`, `start_date` + `end_date`, or none. Ordered by `date ASC, time ASC, created_at ASC`. |
| GET | `/api/todos/{date}` | All todos for exact date. Ordered by `time ASC, created_at ASC`. |
| GET | `/api/todos/item/{id}` | Single todo by ID. 404 if missing. |
| POST | `/api/todos` | Create. Body: `title` (required), `date` (required), optional `time`/`location`/`person`/`description`. Returns 201 with full todo. |
| PUT | `/api/todos/{id}` | Update. Only provided fields are changed; empty updates return existing todo unchanged. `updated_at` set to `datetime('now')`. 404 if missing. String values are trimmed. Setting a field to `null` is allowed. |
| DELETE | `/api/todos/{id}` | Delete by ID. 404 if missing. |
| GET | `/api/summary/{month}` | Returns `{ "YYYY-MM-DD": count }` for each date in the month. |

### Month Filtering (`GET /api/todos?month=YYYY-MM`)

Uses a **half-open interval**:

```typescript
const startDate = `${month}-01`;
const endDate = monthNum === 12
  ? `${year + 1}-01-01`
  : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;
// Query: date >= ? AND date < ?
```

### Date Range Filtering (`GET /api/todos?start_date=...&end_date=...`)

Uses a **fully inclusive** interval: `date >= ? AND date <= ?`.

### Ordering Notes

- Global list: `date ASC, time ASC, created_at ASC`
- Date-specific list: `time ASC, created_at ASC`
- Null `time` values sort **last** within a date (SQLite null ordering)

---

## Task-Specific Behavior

| Task | Special Fixture |
|------|----------------|
| `schedule-change-request` | 3 social/appointment todos for the upcoming Sunday. Descriptions contain email addresses (verifier-relevant: email extraction). |
| `flight-info-change-notice` | 1 travel-meeting todo for `today + 2 days`. Description contains an email address; location is "Los Angeles Union Station" (verifier-relevant: travel/transport context). |

---

## Known Issues / Edge Cases

- **No recurrence engine**: "Recurring task" is only a description string. No automatic todo generation.
- **No status/completion tracking**: Todos have no `status` or `completed` field.
- **No helpers file**: All logic is inline in `routes/todos.ts` and `seed.ts`.
- **Time field is nullable string**: No timezone handling; stored as raw `HH:MM`.
- **Email addresses in descriptions**: Appear only in task-specific seed descriptions; no structured contact field.
