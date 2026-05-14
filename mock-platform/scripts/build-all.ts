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
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

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
  const outputPath = join(DIST_DIR, `mock-${name}`);

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
    email: "/__mock_sentinel__/email",
    shop: "/__mock_sentinel__/shop",
    todolist: "/__mock_sentinel__/todolist",
    "doc-search": "/__mock_sentinel__/doc-search",
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
  const results: BuildResult[] = [];
  for (const name of mocks) {
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
