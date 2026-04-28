/**
 * check-openapi-clean.ts — Verify dist/openapi/ matches HEAD
 *
 * Runs after `generate-openapi.ts` (see `package.json` `check-openapi`
 * script). Fails when `dist/openapi/` contains any uncommitted change —
 * modified, deleted, or untracked. This catches three failure modes that
 * `git diff --exit-code` alone cannot:
 *   1. A new mock generated a brand-new `dist/openapi/<name>.json` that
 *      was never staged. `git diff` ignores untracked files.
 *   2. A mock was renamed or deleted; cleanup in `generate-openapi.ts`
 *      removed its stale spec, leaving a tracked file marked as deleted.
 *   3. A mock's schema changed, regenerating an existing spec.
 *
 * Uses `git status --porcelain dist/openapi/` because porcelain output
 * is stable across git versions and reports all three states in one shot.
 */

import { spawnSync } from "node:child_process";

const status = spawnSync("git", ["status", "--porcelain", "dist/openapi/"], {
  encoding: "utf8",
});

if (status.status !== 0) {
  console.error("ERROR: `git status` failed:");
  if (status.stderr) console.error(status.stderr);
  process.exit(status.status ?? 1);
}

const output = (status.stdout ?? "").trim();
if (output.length > 0) {
  console.error(
    "ERROR: dist/openapi/ has uncommitted changes after regeneration:",
  );
  console.error(output);
  console.error(
    "\nCommit the regenerated specs (or revert if the change was unintentional). " +
      "Untracked files (??), modifications ( M), and deletions ( D) all fail this gate.",
  );
  process.exit(1);
}

console.log("dist/openapi/ is clean — no drift from HEAD.");
