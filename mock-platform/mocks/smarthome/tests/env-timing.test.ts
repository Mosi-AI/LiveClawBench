import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

describe("smarthome mock env timing", () => {
  test("seed uses MOCK_DATA_DIR set after module import", () => {
    const tempDataDir = mkdtempSync(resolve(tmpdir(), "smarthome-mock-late-env-"));
    const modulePath = resolve(import.meta.dir, "../src/index.tsx");
    const seedPath = resolve(
      import.meta.dir,
      "../../../../tasks/grocery-reorder/environment/seed.sql",
    );

    const script = `
      delete process.env.MOCK_DATA_DIR;
      delete process.env.MOCK_SEED_PATH;
      const { createSmarthomeApp } = await import(Bun.argv[1]);
      process.env.MOCK_DATA_DIR = Bun.argv[2];
      process.env.MOCK_SEED_PATH = Bun.argv[3];
      const mockApp = createSmarthomeApp();
      mockApp.seed?.();
    `;

    const result = Bun.spawnSync({
      cmd: ["bun", "-e", script, modulePath, tempDataDir, seedPath],
      cwd: resolve(import.meta.dir, "../../../.."),
      stderr: "pipe",
      stdout: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(resolve(tempDataDir, "smarthome.db"))).toBe(true);
  });
});
