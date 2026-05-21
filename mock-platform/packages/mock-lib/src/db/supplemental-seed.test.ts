import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySupplementalSeed } from "./supplemental-seed";

let tempDir: string;
let savedEnvDir: string | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "mock-supp-seed-"));
  savedEnvDir = process.env.MOCK_EXTRA_SEED_DIR;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (savedEnvDir === undefined) {
    delete process.env.MOCK_EXTRA_SEED_DIR;
  } else {
    process.env.MOCK_EXTRA_SEED_DIR = savedEnvDir;
  }
});

function makeDbWithItems(): Database {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  return db;
}

describe("applySupplementalSeed", () => {
  test("returns false and is a no-op when seed file does not exist", () => {
    const db = makeDbWithItems();
    const applied = applySupplementalSeed(db, "items", tempDir);
    expect(applied).toBe(false);
    const rows = db.query("SELECT COUNT(*) as n FROM items").get() as { n: number };
    expect(rows.n).toBe(0);
  });

  test("returns true and applies SQL when seed file exists", () => {
    writeFileSync(
      join(tempDir, "items.sql"),
      "INSERT INTO items (id, name) VALUES (1, 'phishing'), (2, 'leak');",
    );
    const db = makeDbWithItems();
    const applied = applySupplementalSeed(db, "items", tempDir);
    expect(applied).toBe(true);
    const names = db.query("SELECT name FROM items ORDER BY id").all() as { name: string }[];
    expect(names.map((r) => r.name)).toEqual(["phishing", "leak"]);
  });

  test("supports multi-statement SQL", () => {
    writeFileSync(
      join(tempDir, "items.sql"),
      `
        INSERT INTO items (id, name) VALUES (1, 'a');
        INSERT INTO items (id, name) VALUES (2, 'b');
        INSERT INTO items (id, name) VALUES (3, 'c');
      `,
    );
    const db = makeDbWithItems();
    applySupplementalSeed(db, "items", tempDir);
    const row = db.query("SELECT COUNT(*) as n FROM items").get() as { n: number };
    expect(row.n).toBe(3);
  });

  test("throws with informative message when SQL fails", () => {
    writeFileSync(join(tempDir, "items.sql"), "INSERT INTO nonexistent_table VALUES (1);");
    const db = makeDbWithItems();
    expect(() => applySupplementalSeed(db, "items", tempDir)).toThrow(/items.sql.*failed/);
  });

  test("uses MOCK_EXTRA_SEED_DIR env var when dir argument is omitted", () => {
    writeFileSync(join(tempDir, "items.sql"), "INSERT INTO items (id, name) VALUES (42, 'env');");
    process.env.MOCK_EXTRA_SEED_DIR = tempDir;
    const db = makeDbWithItems();
    const applied = applySupplementalSeed(db, "items");
    expect(applied).toBe(true);
    const row = db.query("SELECT name FROM items WHERE id = 42").get() as { name: string };
    expect(row.name).toBe("env");
  });

  test("explicit dir argument overrides env var", () => {
    writeFileSync(join(tempDir, "items.sql"), "INSERT INTO items (id, name) VALUES (1, 'from-arg');");
    process.env.MOCK_EXTRA_SEED_DIR = "/nonexistent/should/be/ignored";
    const db = makeDbWithItems();
    const applied = applySupplementalSeed(db, "items", tempDir);
    expect(applied).toBe(true);
  });

  test("looks for <service>.sql, not <service>/seed.sql", () => {
    writeFileSync(join(tempDir, "items.sql"), "INSERT INTO items (id, name) VALUES (1, 'svc');");
    const db = makeDbWithItems();
    // Confirm the convention: service name + .sql extension in the dir root
    const applied = applySupplementalSeed(db, "items", tempDir);
    expect(applied).toBe(true);
    // Different service name → no file → no-op
    const applied2 = applySupplementalSeed(db, "other", tempDir);
    expect(applied2).toBe(false);
  });
});
