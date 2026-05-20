import type { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "mock-lib";
import { initSchema } from "./db/schema";

export const DEFAULT_USER_EMAIL = "peter.griffin@work.mosi.inc";
export const DEFAULT_USER_PASSWORD = "password123";

function seedTaskData(db: Database, userId: number, taskName: string): void {
  const existingEvents = db.query("SELECT COUNT(*) as count FROM calendar_event").get() as { count: number };
  if (existingEvents.count > 0) return;

  switch (taskName) {
    case "social-cross-publish":
      db.run(
        `INSERT INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "Summer Tech Summit 2026 - Social Media Posting",
          "2026-06-15 09:00:00",
          "2026-06-15 10:00:00",
          "social-campaign",
          "POST_FORMAT: include event date June 15, 2026 and CTA: Register now at https://summit.mosi.inc",
        ],
      );
      db.run(
        `INSERT INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "Content Publishing Guidelines Review",
          "2026-06-14 14:00:00",
          "2026-06-14 15:00:00",
          "social-campaign",
          "cross-publish-guidelines",
        ],
      );
      console.log("calendar: seeded task data for social-cross-publish");
      break;

    case "social-pinned-post-update":
      db.run(
        `INSERT INTO calendar_event (user_id, title, start_time, end_time, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "Social Media Q2 Content Plan",
          "2026-06-10 10:00:00",
          "2026-06-10 11:30:00",
          "social-content",
          "VERIFICATION-CODE:SM-Q2-7842",
        ],
      );
      console.log("calendar: seeded task data for social-pinned-post-update");
      break;

    default:
      break;
  }
}

export function seedDatabase(db: Database): void {
  initSchema(db);

  // Idempotent user seed
  const userCount = db
    .query<{ count: number }, []>("SELECT COUNT(*) as count FROM users")
    .get();
  if (userCount && userCount.count === 0) {
    const hash = bcryptjs.hashSync(DEFAULT_USER_PASSWORD, BCRYPT_SALT_ROUNDS);
    db.run(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES (?, ?, ?, ?)`,
      [DEFAULT_USER_EMAIL, hash, "Peter", "Griffin"],
    );
    console.log("calendar: seeded default user");
  }

  const userRow = db.query("SELECT id FROM users WHERE email = ?").get(DEFAULT_USER_EMAIL) as { id: number } | null;
  if (userRow) {
    const taskName = process.env.TASK_NAME ?? "";
    seedTaskData(db, userRow.id, taskName);
  }
}
