import type { Database } from "bun:sqlite";
import { SCHEMA_SQL } from "./schema";
import { SCHEMA_SQL_V2 } from "./schema-v2";

interface MigrationDescriptor {
  id: string;
  run: (db: Database) => void;
}

const migrations: MigrationDescriptor[] = [
  { id: "finance_v1", run: (db: Database) => db.exec(SCHEMA_SQL) },
  { id: "finance_v2", run: (db: Database) => db.exec(SCHEMA_SQL_V2) },
];

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  for (const { id, run } of migrations) {
    const row = db
      .query<{ count: number }, [string]>(
        "SELECT COUNT(*) AS count FROM _migrations WHERE id = ?"
      )
      .get(id);
    if (row && row.count > 0) continue;
    run(db);
    db.run("INSERT INTO _migrations (id) VALUES (?)", [id]);
  }
}
