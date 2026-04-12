/**
 * build-all.ts — Per-mock binary compilation pipeline
 *
 * Compiles each mock into a standalone binary via `bun build --compile`.
 * Implements a build compatibility gate: one mock failure does not block others.
 * Full implementation (isolation verification, summary report) arrives in task5.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const MOCKS_DIR = join(import.meta.dir, "..", "mocks");
const DIST_DIR = join(import.meta.dir, "..", "dist");

interface BuildResult {
  name: string;
  success: boolean;
  error?: string;
  binaryPath?: string;
}

async function discoverMocks(): Promise<string[]> {
  const entries = await readdir(MOCKS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

async function compileMock(name: string): Promise<BuildResult> {
  const entryPoint = join(MOCKS_DIR, name, "src", "index.ts");
  const outputPath = join(DIST_DIR, `mock-${name}`);

  try {
    const proc = Bun.spawn([
      "bun", "build", "--compile", entryPoint, "--outfile", outputPath,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return { name, success: false, error: stderr };
    }

    return { name, success: true, binaryPath: outputPath };
  } catch (err) {
    return { name, success: false, error: String(err) };
  }
}

async function main() {
  console.log("=== LiveClawBench Mock Build Pipeline ===\n");

  // Ensure dist directory exists
  await Bun.write(join(DIST_DIR, ".gitkeep"), "");
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
    console.log(`Compiling mock-${name}...`);
    const result = await compileMock(name);
    results.push(result);

    if (result.success) {
      console.log(`  ✓ mock-${name} -> ${result.binaryPath}`);
    } else {
      console.error(`  ✗ mock-${name} FAILED: ${result.error}`);
    }
  }

  // Summary report
  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n=== Build Summary ===`);
  console.log(`Passed: ${passed.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    console.log("\nFailed mocks:");
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  // Exit with error if all mocks failed
  if (passed.length === 0) {
    console.error("\nAll mocks failed to compile.");
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
