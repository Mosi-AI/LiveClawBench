/**
 * generate-openapi.ts — Build-time OpenAPI document generation
 *
 * For each mock service:
 * 1. Dynamically imports the mock's entry point
 * 2. Calls the conventional factory function `create<PascalCase>App`
 *    derived from the directory name (e.g. `doc-search` → `createDocSearchApp`).
 *    Server startup must be guarded by `import.meta.main` so the import
 *    is side-effect-free.
 * 3. Calls `app.getOpenAPI31Document()` on the OpenAPI-enabled app
 * 4. Writes the resulting JSON to `dist/openapi/{name}.json`
 *
 * Stale-output cleanup: every `*.json` under `dist/openapi/` is removed
 * before the regeneration loop. Mocks that are still present get re-emitted;
 * orphans (renamed or deleted mocks) surface to `git diff --exit-code` as
 * deletions so `bun run check-openapi` can catch them.
 *
 * Any discovered mock whose conventional factory is missing or unusable
 * is a hard failure — every directory under `mocks/` must export the
 * conventional `create<PascalCase>App` function, otherwise the
 * spec-generation gate would silently miss new packages.
 */

import { readdir, mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const MOCKS_DIR = join(import.meta.dir, "..", "mocks");
const DIST_DIR = join(import.meta.dir, "..", "dist", "openapi");

/**
 * Convert a kebab-case mock directory name to its conventional factory
 * function name. Examples:
 *   `airline`     → `createAirlineApp`
 *   `doc-search`  → `createDocSearchApp`
 *   `todolist`    → `createTodolistApp`
 *
 * The same convention is used by `tools/create-mock`, so a freshly
 * scaffolded mock works with the generator without any registry edits.
 */
export function factoryNameFor(mockName: string): string {
  const pascal = mockName
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
  return `create${pascal}App`;
}

interface GenerateResult {
  name: string;
  success: boolean;
  outputPath?: string;
  error?: string;
}

export async function discoverMocks(): Promise<string[]> {
  const entries = await readdir(MOCKS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function clearStaleSpecs(): Promise<number> {
  if (!existsSync(DIST_DIR)) return 0;
  const entries = await readdir(DIST_DIR, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      await unlink(join(DIST_DIR, entry.name));
      removed += 1;
    }
  }
  return removed;
}

async function generateForMock(name: string): Promise<GenerateResult> {
  const tsPath = join(MOCKS_DIR, name, "src", "index.ts");
  const tsxPath = join(MOCKS_DIR, name, "src", "index.tsx");
  const entryPoint = existsSync(tsxPath) ? tsxPath : tsPath;

  if (!existsSync(entryPoint)) {
    return { name, success: false, error: `Entry point not found: ${entryPoint}` };
  }

  const factoryName = factoryNameFor(name);

  try {
    // Dynamic import — safe because mocks guard server startup with import.meta.main
    const mockModule = await import(entryPoint);

    // Look for the conventional factory function for this mock
    const createApp = mockModule[factoryName];
    if (typeof createApp !== "function") {
      return {
        name,
        success: false,
        error:
          `No exported '${factoryName}' function found in ${entryPoint}. ` +
          `Every mock under mocks/ must export create<PascalCase>App() ` +
          `following the kebab-case → PascalCase convention.`,
      };
    }

    // Create the app instance (no server startup)
    const mockApp = createApp();
    if (!mockApp?.app) {
      return {
        name,
        success: false,
        error: `${factoryName}() did not return a valid MockAppV2`,
      };
    }

    // Check if the app has OpenAPI document generation capability
    const app = mockApp.app;
    if (typeof app.getOpenAPI31Document !== "function") {
      return {
        name,
        success: false,
        error: `App does not have getOpenAPI31Document() — OpenAPI not enabled`,
      };
    }

    // Generate the OpenAPI 3.1 document using the mock's configured metadata.
    // openApiInfo is resolved at app creation and matches what the runtime
    // /openapi.json endpoint returns.
    const document = app.getOpenAPI31Document(
      mockApp.openApiInfo
        ? { openapi: "3.1.0", info: mockApp.openApiInfo }
        : undefined,
    );

    // Write JSON output
    const outputPath = join(DIST_DIR, `${name}.json`);
    await writeFile(outputPath, JSON.stringify(document, null, 2));

    return { name, success: true, outputPath };
  } catch (err) {
    return {
      name,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log("=== LiveClawBench OpenAPI Document Generation ===\n");

  // Ensure output directory exists
  await mkdir(DIST_DIR, { recursive: true });
  console.log(`Output directory: ${DIST_DIR}`);

  // Clear any pre-existing JSON outputs so renamed/deleted mocks surface as
  // deletions to `git diff --exit-code`. Regeneration immediately follows;
  // if it fails the chain stops here with a non-zero exit code.
  const cleared = await clearStaleSpecs();
  console.log(`Cleared ${cleared} stale spec file(s) from output directory\n`);

  // Discover all mock packages
  const mocks = await discoverMocks();
  if (mocks.length === 0) {
    console.error("No mock packages found in", MOCKS_DIR);
    process.exit(1);
  }
  console.log(`Found ${mocks.length} mock(s): ${mocks.join(", ")}\n`);

  // Generate OpenAPI docs for each mock
  const results: GenerateResult[] = [];
  for (const name of mocks) {
    process.stdout.write(`Generating OpenAPI for ${name}... `);
    const result = await generateForMock(name);
    results.push(result);

    if (result.success) {
      console.log(`OK → ${result.outputPath}`);
    } else {
      console.log(`FAIL`);
      console.error(`  Reason: ${result.error}`);
    }
  }

  // Summary report
  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n=== Generation Summary ===`);
  console.log(`Generated: ${passed.length}/${results.length}`);
  console.log(`Failed:    ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    console.log("\nFailed mocks:");
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
    console.error(
      `\nERROR: ${failed.length} mock(s) failed generation. ` +
        `Every mock under mocks/ must succeed — otherwise the spec-generation gate is incomplete.`,
    );
    process.exit(1);
  }

  console.log("\nOpenAPI generation complete.");
}

main().catch((err) => {
  console.error("OpenAPI generation error:", err);
  process.exit(1);
});
