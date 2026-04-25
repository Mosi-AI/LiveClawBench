/**
 * generate-openapi.ts — Build-time OpenAPI document generation
 *
 * For each mock service:
 * 1. Dynamically imports the mock's entry point
 * 2. Calls the exported factory function (e.g. `createShopApp`) (must be guarded by `import.meta.main`)
 * 3. Calls `app.getOpenAPI31Document()` on the OpenAPI-enabled app
 * 4. Writes the resulting JSON to `dist/openapi/{name}.json`
 *
 * Mocks without a known factory mapping are skipped.
 */

import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const MOCKS_DIR = join(import.meta.dir, "..", "mocks");
const DIST_DIR = join(import.meta.dir, "..", "dist", "openapi");

const factoryNames: Record<string, string> = {
  airline: "createAirlineApp",
  email: "createEmailApp",
  todolist: "createTodolistApp",
  "doc-search": "createDocSearchApp",
  shop: "createShopApp",
};

interface GenerateResult {
  name: string;
  success: boolean;
  outputPath?: string;
  error?: string;
}

async function discoverMocks(): Promise<string[]> {
  const entries = await readdir(MOCKS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function generateForMock(name: string): Promise<GenerateResult> {
  const tsPath = join(MOCKS_DIR, name, "src", "index.ts");
  const tsxPath = join(MOCKS_DIR, name, "src", "index.tsx");
  const entryPoint = existsSync(tsxPath) ? tsxPath : tsPath;

  if (!existsSync(entryPoint)) {
    return { name, success: false, error: `Entry point not found: ${entryPoint}` };
  }

  const factoryName = factoryNames[name];
  if (!factoryName) {
    return {
      name,
      success: false,
      error: `No factory mapping for mock "${name}" — skipping`,
    };
  }

  try {
    // Dynamic import — safe because mocks guard server startup with import.meta.main
    const mockModule = await import(entryPoint);

    // Look for the specific factory function for this mock
    const createApp = mockModule[factoryName];
    if (typeof createApp !== "function") {
      return {
        name,
        success: false,
        error: `No exported '${factoryName}' function found in ${entryPoint}`,
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
  console.log(`Output directory: ${DIST_DIR}\n`);

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
      console.log(`SKIPPED`);
      console.error(`  Reason: ${result.error}`);
    }
  }

  // Summary report
  const passed = results.filter((r) => r.success);
  const skipped = results.filter((r) => !r.success);

  console.log(`\n=== Generation Summary ===`);
  console.log(`Generated: ${passed.length}/${results.length}`);
  console.log(`Skipped:   ${skipped.length}/${results.length}`);

  if (skipped.length > 0) {
    console.log("\nSkipped mocks:");
    for (const s of skipped) {
      console.log(`  - ${s.name}: ${s.error}`);
    }
  }

  // Exit 1 if any mapped mock failed generation; unmapped mocks are truly skipped
  const failedMapped = results.filter(
    (r) => !r.success && factoryNames[r.name],
  );
  if (failedMapped.length > 0) {
    console.error(
      `\nERROR: ${failedMapped.length} mapped mock(s) failed generation.`,
    );
    process.exit(1);
  }

  console.log("\nOpenAPI generation complete.");
}

main().catch((err) => {
  console.error("OpenAPI generation error:", err);
  process.exit(1);
});
