import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Supplemental seed mechanism — applies per-task SQL seed data on top
 * of the baseline `seedDatabase()` output.
 *
 * Each mock binary, after running its baseline seed, should call this
 * helper for its own service name. If a file at
 * `<dir>/<service>.sql` exists, its SQL is executed against the
 * passed-in database. If the file is missing, the call is a no-op
 * (backward compatible with all existing tasks that have no extra seed).
 *
 * Used to support data-only task variations without forking the entire
 * mock app. See `docs/refactor/mock-platform-migration-plan.md` for design.
 *
 * **Status: reserved infrastructure, no current consumers.**
 * The 6 Safety tasks in PR #54 deliberately chose the existing
 * `TASK_NAME` switch pattern in each mock's `seed.ts` (under
 * `mocks/<name>/src/`) instead of this mechanism, because that compiles
 * the adversarial content INTO the Bun binary (`bun build --compile`)
 * — an in-container agent cannot read the prompt text off disk, only
 * via the legitimate API. extraSeeds writes a readable file at
 * `/opt/mock/extra-seed/<service>.sql`, which is the wrong threat-model
 * fit for adversarial Safety content. extraSeeds is retained for future
 * non-Safety tasks that need task-specific data customisation without
 * security sensitivity.
 *
 * Build-time counterpart: the `extraSeeds` field in
 * `mock-platform/config/task-binary-map.json`, processed by
 * `scripts/build-task-images.ts` to emit
 * `COPY <src> /opt/mock/extra-seed/<service>.sql` into the per-task
 * Docker image. The convention path `/opt/mock/extra-seed/` is the
 * sole coupling between build and runtime.
 *
 * SQL contract:
 * - Statements run AFTER baseline seed completes — any baseline
 *   primary keys / FK targets are available for reference.
 * - Should be INSERT-only; CREATE TABLE / DROP / DELETE are allowed
 *   but discouraged because they couple to baseline schema versioning.
 * - The whole file is wrapped in a single `db.exec()` call which
 *   handles multi-statement SQL natively.
 *
 * @param db The SQLite database to apply seed to
 * @param service Service name (matches the file basename, e.g. "email" for "email.sql")
 * @param dir Directory holding `<service>.sql` files. Defaults to the
 *            `MOCK_EXTRA_SEED_DIR` env var, falling back to `/opt/mock/extra-seed`.
 * @returns true if a seed file was applied, false if no file existed
 */
export function applySupplementalSeed(
  db: Database,
  service: string,
  dir?: string,
): boolean {
  const seedDir = dir ?? process.env.MOCK_EXTRA_SEED_DIR ?? "/opt/mock/extra-seed";
  const sqlPath = join(seedDir, `${service}.sql`);

  if (!existsSync(sqlPath)) {
    return false;
  }

  let sql: string;
  try {
    sql = readFileSync(sqlPath, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[${service}] failed to read supplemental seed at ${sqlPath}: ${message}`,
    );
  }

  try {
    db.exec(sql);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[${service}] supplemental seed at ${sqlPath} failed to execute: ${message}`,
    );
  }

  // Log to stderr so it appears in mock startup logs without polluting
  // any stdout-based protocols.
  console.error(`[${service}] applied supplemental seed: ${sqlPath}`);
  return true;
}
