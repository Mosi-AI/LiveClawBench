/**
 * create-mock — Scaffolding CLI for creating new mock packages
 *
 * Usage: bun run tools/create-mock/index.ts <name>
 *
 * Creates a new mock package at mocks/<name>/ with the standard structure:
 *   mocks/<name>/package.json
 *   mocks/<name>/src/index.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MOCKS_DIR = join(import.meta.dir, "..", "..", "mocks");

function toKebabCase(name: string): string {
  return name.replace(/[_\s]+/g, "-").toLowerCase();
}

async function createMock(name: string): Promise<void> {
  const kebab = toKebabCase(name);
  const mockDir = join(MOCKS_DIR, kebab);
  const srcDir = join(mockDir, "src");

  // Create directories
  await mkdir(srcDir, { recursive: true });

  // Write package.json
  const packageJson = {
    name: `@mock/${kebab}`,
    version: "0.1.0",
    private: true,
    dependencies: {
      "mock-lib": "workspace:*",
      hono: "^4.8.0",
    },
  };
  await writeFile(
    join(mockDir, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n",
  );

  // Write entry point
  const entryContent = `import { createMockApp, startServer } from "mock-lib";

const app = createMockApp({ name: "${kebab}" });

// ${kebab} routes will be added in migration tasks.

export default app;

// Start the server when this file is run directly (for standalone binary)
if (import.meta.main) {
  startServer(app);
}
`;
  await writeFile(join(srcDir, "index.ts"), entryContent);

  console.log(`Created mock package: mocks/${kebab}/`);
  console.log(`  - mocks/${kebab}/package.json`);
  console.log(`  - mocks/${kebab}/src/index.ts`);
  console.log(`\nRun 'bun install' to link the new package.`);
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
