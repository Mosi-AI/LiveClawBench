/**
 * create-mock — Scaffolding CLI for creating new mock packages
 *
 * Usage: bun run tools/create-mock/index.ts <name>
 *
 * Creates a new mock package at mocks/<name>/ with standard structure:
 *   mocks/<name>/package.json
 *   mocks/<name>/src/index.ts
 *
 * The generated `index.ts` exports a `create<PascalCase>App()` factory
 * matching the convention enforced by `scripts/generate-openapi.ts`.
 * Server startup is guarded by `import.meta.main`, so the file is safe
 * to import for spec generation without booting a server.
 *
 * After scaffolding, `bun run check-openapi` succeeds without any further
 * hand-edits — the generator discovers the new mock by directory name and
 * derives the factory name via the same kebab→PascalCase convention used
 * here.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MOCKS_DIR = join(import.meta.dir, "..", "..", "mocks");

function toKebabCase(name: string): string {
  return name.replace(/[_\s]+/g, "-").toLowerCase();
}

/**
 * Convert kebab-case to PascalCase for factory and title naming.
 * Must match `factoryNameFor` in `scripts/generate-openapi.ts`.
 *   `airline`     → `Airline`
 *   `doc-search`  → `DocSearch`
 */
function toPascalCase(kebab: string): string {
  return kebab
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}

async function createMock(name: string): Promise<void> {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(kebab);
  const factoryName = `create${pascal}App`;
  const mockDir = join(MOCKS_DIR, kebab);
  const srcDir = join(mockDir, "src");

  // Create directories
  await mkdir(srcDir, { recursive: true });

  // Write package.json — declares the same direct deps as the existing
  // mocks (e.g. mocks/airline/package.json) so a fresh `bun install` wires
  // up everything the scaffolded factory imports.
  const packageJson = {
    name: `@mock/${kebab}`,
    version: "0.1.0",
    private: true,
    dependencies: {
      "mock-lib": "workspace:*",
      hono: "^4.8.0",
      zod: "^3.24.0",
    },
  };
  await writeFile(
    join(mockDir, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n",
  );

  // Write entry point — exports the conventional create<PascalCase>App factory
  // expected by scripts/generate-openapi.ts. Sentinel route is registered via
  // openApiRoute so the generated spec includes at least one path. Server
  // startup is guarded by import.meta.main so dynamic imports for spec
  // generation never boot a listener.
  const entryContent = `import { z } from "zod";
import { createMockApp, createRoute, startServer } from "mock-lib";

export function ${factoryName}() {
  const mockApp = createMockApp({
    name: "${kebab}",
    openApi: {
      enabled: true,
      title: "${pascal} Mock API",
      version: "1.0.0",
    },
  });

  // Sentinel route for isolation verification (AC-1.1).
  // Each mock registers a unique sentinel that build-all.ts checks for
  // both presence (own) and absence (foreign) to prove cross-contamination
  // freedom.
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/${kebab}",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              mock: z.literal("${kebab}"),
              sentinel: z.literal(true),
            }),
          },
        },
        description: "OK",
      },
    },
  });

  mockApp.app.openApiRoute(sentinelRoute, (c) =>
    c.json({ mock: "${kebab}" as const, sentinel: true as const }),
  );

  // ${kebab} routes will be added in subsequent migration tasks.

  return mockApp;
}

if (import.meta.main) {
  const mockApp = ${factoryName}();
  startServer(mockApp);
}
`;
  await writeFile(join(srcDir, "index.ts"), entryContent);

  console.log(`Created mock package: mocks/${kebab}/`);
  console.log(`  - mocks/${kebab}/package.json`);
  console.log(`  - mocks/${kebab}/src/index.ts (exports ${factoryName})`);
  console.log(`\nNext steps:`);
  console.log(`  1. Run 'bun install' to link the new package.`);
  console.log(
    `  2. Run 'bun run check-openapi' from mock-platform/ to regenerate specs ` +
      `and verify the new mock integrates cleanly.`,
  );
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: bun run tools/create-mock/index.ts <name>");
  console.error("Example: bun run tools/create-mock/index.ts airline");
  process.exit(1);
}

createMock(args[0]).catch((err) => {
  console.error("Error creating mock:", err);
  process.exit(1);
});
