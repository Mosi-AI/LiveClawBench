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
}
