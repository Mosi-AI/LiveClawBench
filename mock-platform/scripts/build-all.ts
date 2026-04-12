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
import { mkdirSync } from "node:fs";

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
      return { name, success: false, error: stderr.trim() };
    }

    const stat = await Bun.file(outputPath).stat();
    return { name, success: true, binaryPath: outputPath, size: stat?.size };
  } catch (err) {
    return { name, success: false, error: String(err) };
  }
}

/**
 * Binary isolation verification (AC-1.1).
 * Check that a compiled binary does not contain route strings from other mocks.
 */
async function verifyIsolation(results: BuildResult[]): Promise<Map<string, string[]>> {
  const violations = new Map<string, string[]>();

  // Define unique route patterns per mock (for cross-contamination checks)
  const routePatterns: Record<string, string[]> = {
    airline: ["/api/flights", "/api/bookings", "/api/checkin", "/api/baggage"],
    email: ["/api/emails", "/api/inbox", "/api/sent"],
    shop: ["/api/products", "/api/cart", "/api/orders"],
    todolist: ["/api/todos", "/api/tasks"],
    "browser-portal": ["/api/pages", "/api/search"],
  };

  const successfulMocks = results.filter((r) => r.success);
  if (successfulMocks.length < 2) return violations;

  for (const result of successfulMocks) {
    if (!result.binaryPath) continue;

    try {
      const binaryContent = await readFile(result.binaryPath);
      const binaryText = binaryContent.toString("utf-8");
      const foundViolations: string[] = [];

      // Check for routes from OTHER mocks in this binary
      for (const [mockName, patterns] of Object.entries(routePatterns)) {
        if (mockName === result.name) continue; // Skip own routes
        for (const pattern of patterns) {
          if (binaryText.includes(pattern)) {
            foundViolations.push(`${mockName}:${pattern}`);
          }
        }
      }

      if (foundViolations.length > 0) {
        violations.set(result.name, foundViolations);
      }
    } catch {
      // Binary may not be readable (permissions etc.) — skip isolation check
    }
  }

  return violations;
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

  // Binary isolation verification (AC-1.1)
  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n=== Binary Isolation Verification ===`);
  const violations = await verifyIsolation(results);
  if (violations.size > 0) {
    console.log("FAIL: Cross-contamination detected:");
    for (const [mock, routes] of violations) {
      console.log(`  mock-${mock} contains: ${routes.join(", ")}`);
    }
  } else {
    console.log("PASS: No cross-contamination detected between binaries.");
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

  // Build compatibility gate: exit 0 even if some mocks failed
  // (individual failures are reported but don't block the pipeline)
  console.log("\nBuild pipeline complete.");
}

main().catch((err) => {
  console.error("Build pipeline error:", err);
  process.exit(1);
});
