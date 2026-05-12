import type { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "mock-lib";
import { initSchema } from "./db/schema";

export const DEFAULT_USER_EMAIL = "peter.griffin@work.mosi.inc";
export const DEFAULT_USER_PASSWORD = "password123";

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
}
