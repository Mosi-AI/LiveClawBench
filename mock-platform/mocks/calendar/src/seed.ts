import type { Database } from "bun:sqlite";
import { generateWerkzeugHashSync } from "./helpers";

export function seedDatabase(db: Database): void {
  const existing = db.query("SELECT id FROM users WHERE email = ?").get("peter.griffin@work.mosi.inc");
  if (existing) return;

  const passwordHash = generateWerkzeugHashSync("password123");
  db.query(
    "INSERT INTO users (email, display_name, password_hash, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).run("peter.griffin@work.mosi.inc", "Peter Griffin", passwordHash);
}
