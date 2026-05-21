/**
 * build-all.ts — Per-mock binary compilation pipeline
 *
 * Compiles each mock into a standalone binary via `bun build --compile`.
 * Features:
 * - Build compatibility gate: one mock failure does not block others
 * - Binary isolation verification: no cross-contamination of route strings
 * - Per-mock compile summary report
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, realpathSync, renameSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";

const MOCKS_DIR = join(import.meta.dir, "..", "mocks");
const DIST_DIR = join(import.meta.dir, "..", "dist");

interface BuildResult {
  name: string;
  success: boolean;
  error?: string;
  binaryPath?: string;
  size?: number;
}

async function discoverMocks(): Promise<string[]> {
  const entries = await readdir(MOCKS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function compileMock(name: string): Promise<BuildResult> {
  // Support both .ts and .tsx entry points (shop uses TSX for Hono JSX rendering)
  const tsPath = join(MOCKS_DIR, name, "src", "index.ts");
  const tsxPath = join(MOCKS_DIR, name, "src", "index.tsx");
  const entryPoint = existsSync(tsxPath) ? tsxPath : tsPath;
  const outputPath = join(DIST_DIR, `temp-mock-${name}`);

  try {
    // Auto-detect host architecture for cross-compilation target selection
    // ARM64 hosts build aarch64 binaries, x64 hosts build x86_64 binaries
    const hostArch = process.arch; // 'arm64' or 'x64'
    const target = hostArch === 'arm64' ? 'bun-linux-aarch64' : 'bun-linux-x64';

    // NOTE: Using --target requires network access on first run
    // to download the Linux runtime bundle. Offline or restricted-network
    // environments will fail with a "Failed to download" error.
    const proc = Bun.spawn([
      "bun", "build", "--compile", "--target", target,
      entryPoint, "--outfile", outputPath,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return { name, success: false, error: stderr.trim() };
    }

    const stat = await Bun.file(outputPath).stat();
    return { name, success: true, binaryPath: outputPath, size: stat?.size };
  } catch (err) {
    return { name, success: false, error: String(err) };
  }
}

/**
 * Binary isolation verification.
 *
 * Two-phase check per compiled binary:
 * 1. POSITIVE control: binary MUST contain its own sentinel route string
 * 2. NEGATIVE control: binary MUST NOT contain any foreign sentinel route string
 *
 * This proves both that each binary is self-contained and that cross-contamination
 * did not occur during compilation.
 */
async function verifyIsolation(results: BuildResult[]): Promise<{ violations: Map<string, string[]>; missingSentinels: string[]; readErrors: Map<string, string> }> {
  const violations = new Map<string, string[]>();
  const missingSentinels: string[] = [];
  const readErrors = new Map<string, string>();

  // Sentinel routes registered by each mock stub — must match mocks/*/src/index.ts
  const sentinelPatterns: Record<string, string> = {
    airline: "/__mock_sentinel__/airline",
    chat: "/__mock_sentinel__/chat",
    email: "/__mock_sentinel__/email",
    shop: "/__mock_sentinel__/shop",
    todolist: "/__mock_sentinel__/todolist",
    "doc-search": "/__mock_sentinel__/doc-search",
    workspace: "/__mock_sentinel__/workspace",
    finance: "/__mock_sentinel__/finance",
    insurance: "/__mock_sentinel__/insurance",
    calendar: "/__mock_sentinel__/calendar",
    "mint-diet": "/__mock_sentinel__/mint-diet",
    weather: "/__mock_sentinel__/weather",
    social: "/__mock_sentinel__/social",
    expense: "/__mock_sentinel__/expense",
    health: "/__mock_sentinel__/health",
  };

  const successfulMocks = results.filter((r) => r.success);

  // Phase 1: POSITIVE — each mock must contain its own sentinel
  // This check always runs, even if only one mock compiles
  for (const result of successfulMocks) {
    if (!result.binaryPath) continue;

    try {
      const binaryContent = await readFile(result.binaryPath);
      const binaryText = binaryContent.toString("utf-8");

      const ownSentinel = sentinelPatterns[result.name];
      if (ownSentinel && !binaryText.includes(ownSentinel)) {
        missingSentinels.push(result.name);
      }
    } catch (err) {
      console.error(`Error: Could not read ${result.name} for sentinel check: ${err}`);
      readErrors.set(result.name, `Binary read failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 2: NEGATIVE — foreign sentinels must be absent
  // This check requires at least 2 successful mocks to detect cross-contamination
  if (successfulMocks.length >= 2) {
    for (const result of successfulMocks) {
      if (!result.binaryPath) continue;

      try {
        const binaryContent = await readFile(result.binaryPath);
        const binaryText = binaryContent.toString("utf-8");

        const foundViolations: string[] = [];
        for (const [mockName, sentinel] of Object.entries(sentinelPatterns)) {
          if (mockName === result.name) continue;
          if (binaryText.includes(sentinel)) {
            foundViolations.push(sentinel);
          }
        }

        if (foundViolations.length > 0) {
          violations.set(result.name, foundViolations);
        }
      } catch (err) {
        console.error(`Error: Could not read ${result.name} for cross-contamination check: ${err}`);
        readErrors.set(result.name, `Binary read failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { violations, missingSentinels, readErrors };
}

function collectSrcFiles(dir: string, visited = new Set<string>()): string[] {
  let realDir: string;
  try { realDir = realpathSync(dir); } catch { realDir = dir; }
  if (visited.has(realDir)) return [];
  visited.add(realDir);
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSrcFiles(full, visited));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

function computeBuildManifest(name: string): Record<string, string> {
  const srcDir = join(MOCKS_DIR, name, "src");
  const files = collectSrcFiles(srcDir).sort();
  const manifest: Record<string, string> = {};
  for (const f of files) {
    const rel = relative(srcDir, f).replace(/\\/g, "/");
    // Normalize CRLF → LF before hashing so manifests are identical whether
    // built from a Windows checkout (core.autocrlf=true) or a Linux/WSL one.
    const content = readFileSync(f, "utf-8").replace(/\r\n/g, "\n");
    manifest[rel] = createHash("sha256").update(content).digest("hex");
  }
  return manifest;
}

function writeBuildManifest(manifest: Record<string, string>, destPath: string): void {
  writeFileSync(destPath, JSON.stringify(manifest, null, 2), "utf-8");
}

async function main() {
  console.log("=== LiveClawBench Mock Build Pipeline ===\n");

  // Ensure dist directory exists
  mkdirSync(DIST_DIR, { recursive: true });
  console.log(`Output directory: ${DIST_DIR}\n`);

  // Discover all mock packages
  const mocks = await discoverMocks();
  if (mocks.length === 0) {
    console.error("No mock packages found in", MOCKS_DIR);
    process.exit(1);
  }
  console.log(`Found ${mocks.length} mock(s): ${mocks.join(", ")}\n`);

  // Compile each mock independently (build compatibility gate)
  // Snapshot source hashes BEFORE compilation so the manifest records the exact
  // sources that were compiled, not any edits made while the build is running.
  const manifestSnapshots = new Map<string, Record<string, string>>();
  const results: BuildResult[] = [];
  for (const name of mocks) {
    let snapshot: Record<string, string>;
    try {
      snapshot = computeBuildManifest(name);
    } catch (err) {
      // Source snapshot failure counts as a build failure for this mock only;
      // other mocks are unaffected (build compatibility gate).
      console.log(`Compiling mock-${name}... FAILED`);
      console.error(`  Error: manifest snapshot failed: ${err}`);
      results.push({ name, success: false, error: `Manifest snapshot failed: ${err}` });
      continue;
    }
    manifestSnapshots.set(name, snapshot);
    process.stdout.write(`Compiling mock-${name}... `);
    const result = await compileMock(name);
    results.push(result);

    if (result.success) {
      const sizeMB = ((result.size ?? 0) / 1024 / 1024).toFixed(1);
      console.log(`OK (${sizeMB} MB)`);
    } else {
      console.log(`FAILED`);
      console.error(`  Error: ${result.error}`);
    }
  }

  console.log(`\n=== Binary Isolation Verification ===`);
  const { violations, missingSentinels, readErrors } = await verifyIsolation(results);

  // Apply read errors to results (verifyIsolation no longer mutates its input)
  for (const [name, errorMsg] of readErrors) {
    const result = results.find((r) => r.name === name);
    if (result) {
      result.success = false;
      result.error = errorMsg;
    }
  }

  // Transactional publish: only binaries that compiled AND passed isolation are published.
  //
  // Publish sequence for passing mocks:
  //   1. Write new manifest to dist/temp-manifest-<name>.json (no final paths touched yet)
  //   2. Backup dist/mock-<name> → dist/backup-mock-<name> (if present); track in backedUpFinal
  //   3. Backup dist/manifest-<name>.json → dist/backup-manifest-<name>.json (if present);
  //      if step 3 fails, step 2 is rolled back immediately before re-throwing
  //   4. Rename dist/temp-mock-<name> → dist/mock-<name> (promote binary)
  //   5. Rename dist/temp-manifest-<name>.json → dist/manifest-<name>.json (promote manifest)
  //   6. Delete backups (publish complete)
  //
  // Rollback guarantees per failure point:
  //   Step 1 or 2 fails  → outer catch cleans temp files; final artifacts untouched
  //   Step 3 fails       → inner catch restores backup-mock → mock, cleans temp files
  //   Step 4 or 5 fails  → inner catch restores both backups, cleans temp files
  // For failing mocks: delete the temp binary; leave existing dist/mock-<name> and manifest untouched.
  const isolationFailed = new Set<string>([
    ...missingSentinels,
    ...violations.keys(),
    ...readErrors.keys(),
  ]);

  for (const result of results) {
    const tempPath = join(DIST_DIR, `temp-mock-${result.name}`);
    const finalPath = join(DIST_DIR, `mock-${result.name}`);
    const backupPath = join(DIST_DIR, `backup-mock-${result.name}`);
    const tempManifestPath = join(DIST_DIR, `temp-manifest-${result.name}.json`);
    const finalManifestPath = join(DIST_DIR, `manifest-${result.name}.json`);
    const backupManifestPath = join(DIST_DIR, `backup-manifest-${result.name}.json`);

    if (!existsSync(tempPath)) continue;

    if (result.success && !isolationFailed.has(result.name)) {
      const hadFinal = existsSync(finalPath);
      const hadManifest = existsSync(finalManifestPath);
      let backedUpFinal = false;
      let backedUpManifest = false;

      try {
        // Pre-flight: remove stale backup artifacts from a previously interrupted build,
        // but only when the corresponding final artifact still exists — if the final is gone,
        // the backup is the last surviving copy and must be preserved.
        try { if (hadFinal && existsSync(backupPath)) unlinkSync(backupPath); } catch { /* ignore */ }
        try { if (hadManifest && existsSync(backupManifestPath)) unlinkSync(backupManifestPath); } catch { /* ignore */ }

        // Step 1: Write new manifest to temp path (no final paths touched yet)
        writeBuildManifest(manifestSnapshots.get(result.name)!, tempManifestPath);

        // Step 2: Backup old binary
        if (hadFinal) {
          renameSync(finalPath, backupPath);
          backedUpFinal = true;
        }

        // Step 3: Backup old manifest; on failure, roll back step 2 immediately
        if (hadManifest) {
          try {
            renameSync(finalManifestPath, backupManifestPath);
            backedUpManifest = true;
          } catch (backupErr) {
            if (backedUpFinal) try { renameSync(backupPath, finalPath); } catch { /* ignore */ }
            try { unlinkSync(tempPath); } catch { /* ignore */ }
            try { unlinkSync(tempManifestPath); } catch { /* ignore */ }
            throw backupErr;
          }
        }

        // Steps 4-5: Promote temp binary and manifest into final positions
        try {
          renameSync(tempPath, finalPath);
          renameSync(tempManifestPath, finalManifestPath);

          // Success: remove backups, record final path
          result.binaryPath = finalPath;
          if (backedUpFinal) try { unlinkSync(backupPath); } catch { /* ignore */ }
          if (backedUpManifest) try { unlinkSync(backupManifestPath); } catch { /* ignore */ }
        } catch (promoteErr) {
          // Rollback: restore previous artifacts; clean up any partially promoted files
          try { unlinkSync(finalPath); } catch { /* ignore */ }
          try { unlinkSync(finalManifestPath); } catch { /* ignore */ }
          if (backedUpFinal) try { renameSync(backupPath, finalPath); } catch { /* ignore */ }
          if (backedUpManifest) try { renameSync(backupManifestPath, finalManifestPath); } catch { /* ignore */ }
          try { unlinkSync(tempPath); } catch { /* ignore */ }
          try { unlinkSync(tempManifestPath); } catch { /* ignore */ }
          throw promoteErr;
        }
      } catch (err) {
        result.success = false;
        result.error = `Publish failed: ${err}`;
        // Clean up any remaining temp files (step 1 may have created them)
        try { if (existsSync(tempPath)) unlinkSync(tempPath); } catch { /* ignore */ }
        try { if (existsSync(tempManifestPath)) unlinkSync(tempManifestPath); } catch { /* ignore */ }
      }
    } else {
      try { unlinkSync(tempPath); } catch { /* ignore */ }
      if (isolationFailed.has(result.name) && result.success) {
        result.success = false;
        result.error = "Isolation verification failed";
      }
    }
  }

  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  // Report positive control failures
  if (missingSentinels.length > 0) {
    console.log("FAIL: Missing own sentinel (positive control):");
    for (const name of missingSentinels) {
      console.log(`  mock-${name} does not contain its own sentinel route`);
    }
  }

  // Report negative control failures
  if (violations.size > 0) {
    console.log("FAIL: Cross-contamination detected:");
    for (const [mock, routes] of violations) {
      console.log(`  mock-${mock} contains foreign sentinels: ${routes.join(", ")}`);
    }
  }

  // Report binary read errors
  if (readErrors.size > 0) {
    console.log("FAIL: Binary read errors during isolation verification:");
    for (const name of readErrors.keys()) {
      console.log(`  mock-${name} could not be read for isolation check`);
    }
  }

  const isolationPass = violations.size === 0 && missingSentinels.length === 0 && readErrors.size === 0;
  if (isolationPass) {
    console.log("PASS: All binaries contain own sentinel, no cross-contamination.");
  }

  // Summary report
  console.log(`\n=== Build Summary ===`);
  console.log(`Passed: ${passed.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    console.log("\nFailed mocks:");
    for (const f of failed) {
      console.log(`  - ${f.name}`);
    }
  }

  // Exit with error if all mocks failed
  if (passed.length === 0) {
    console.error("\nAll mocks failed to compile.");
    process.exit(1);
  }

  // Exit with error if isolation verification failed
  if (!isolationPass) {
    console.error("\nERROR: Isolation verification failed. Build pipeline cannot continue.");
    console.error("  Fix: Ensure each mock contains its own sentinel route and no foreign sentinels.");
    process.exit(1);
  }

  // Build compatibility gate: exit 0 even if some mocks failed
  // (individual failures are reported but don't block the pipeline)
  console.log("\nBuild pipeline complete.");
}

main().catch((err) => {
  console.error("Build pipeline error:", err);
  process.exit(1);
});
