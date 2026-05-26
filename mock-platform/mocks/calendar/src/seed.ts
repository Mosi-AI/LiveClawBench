import type { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "mock-lib";
import { initSchema } from "./db/schema";

export const DEFAULT_USER_EMAIL = "peter.griffin@work.mosi.inc";
export const DEFAULT_USER_PASSWORD = "password123";

// Second seeded user used for cross-user isolation tests and any task that
// needs a non-Peter actor. Per-email idempotency below ensures adding this
// user does not break tasks that pre-seeded Peter on an existing DB.
export const SECONDARY_USER_EMAIL = "lois.griffin@work.mosi.inc";
export const SECONDARY_USER_PASSWORD = "password123";

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: DEFAULT_USER_EMAIL,
    password: DEFAULT_USER_PASSWORD,
    firstName: "Peter",
    lastName: "Griffin",
  },
  {
    email: SECONDARY_USER_EMAIL,
    password: SECONDARY_USER_PASSWORD,
    firstName: "Lois",
    lastName: "Griffin",
  },
];

// C1/C2 variant tasks reuse the same calendar seed as their base tasks.
// The meeting-reschedule-response base task has no calendar events (only
// email + calendar interaction), and candidate-interview-slot-confirm also
// has no pre-seeded calendar events. Calendar C1/C2 fault injection is
// handled in the POST /api/events route handler (routes/events.ts), not
// in seed data.

function seedTaskData(db: Database, userId: number, taskName: string): void {
  const existingEvents = db.query("SELECT COUNT(*) as count FROM calendar_event").get() as { count: number };
  if (existingEvents.count > 0) return;

  switch (taskName) {
    case "social-cross-publish":
      db.run(
        `INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "Summer Tech Summit 2026 - Social Media Posting",
          "2026-06-15 09:00:00",
          "2026-06-15 10:00:00",
          "social-campaign",
          "Summit logistics confirmed for mid-June. Social assets and posting timeline referenced.",
        ],
      );
      db.run(
        `INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "Content Publishing Guidelines Review",
          "2026-06-14 14:00:00",
          "2026-06-14 15:00:00",
          "social-campaign",
          "Q2 publishing guidelines",
        ],
      );
      db.run(
        `INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "June All-Hands Meeting",
          "2026-06-16 10:00:00",
          "2026-06-16 11:00:00",
          "internal",
          "Company-wide update scheduled for mid-June.",
        ],
      );
      db.run(
        `INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "Product Launch Prep - June Cycle",
          "2026-06-17 14:00:00",
          "2026-06-17 15:30:00",
          "product",
          "Launch timeline and social coordination notes.",
        ],
      );
      console.log("calendar: seeded task data for social-cross-publish");
      break;

    case "social-pinned-post-update":
      db.run(
        `INSERT OR IGNORE INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "Social Media Q2 Content Plan",
          "2026-06-10 10:00:00",
          "2026-06-10 11:30:00",
          "social-content",
          "Q2 content planning notes. Verification required for pinned post updates: SM-Q2-7842",
        ],
      );
      console.log("calendar: seeded task data for social-pinned-post-update");
      break;

    // C1/C2 variant tasks: no pre-seeded calendar events. Fault injection
    // is handled in the POST /api/events route handler.
    case "meeting-slot-race":
    case "interview-slot-verify":
      console.log(`calendar: no seed data for C-axis variant ${taskName}`);
      break;

    default:
      break;
  }
}
export function seedDatabase(db: Database): void {
  initSchema(db);

  // Per-email idempotency: each seeded user is inserted only when its email
  // is absent. Switching away from the old `userCount === 0` gate lets us
  // add Lois without erasing Peter on partial-seed databases.
  for (const user of SEED_USERS) {
    const existing = db
      .query<{ id: number }, [string]>(
        "SELECT id FROM users WHERE email = ?",
      )
      .get(user.email);
    if (existing) continue;
    const hash = bcryptjs.hashSync(user.password, BCRYPT_SALT_ROUNDS);
    db.run(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES (?, ?, ?, ?)`,
      [user.email, hash, user.firstName, user.lastName],
    );
    console.log(`calendar: seeded user ${user.email}`);
  }

  const userRow = db.query("SELECT id FROM users WHERE email = ?").get(DEFAULT_USER_EMAIL) as { id: number } | null;
  if (userRow) {
    const taskName = process.env.TASK_NAME ?? "";
    seedTaskData(db, userRow.id, taskName);
  }
}
