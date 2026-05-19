import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG_PATH = join(import.meta.dir, "..", "..", "config", "task-binary-map.json");

interface AssetMapping {
  src: string;
  dest: string;
}

interface TaskMapping {
  binaries: string[];
  startup_extra?: string;
  assets?: AssetMapping[];
}

interface MappingConfig {
  tasks: Record<string, TaskMapping>;
}

function readMapping(): MappingConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as MappingConfig;
}

describe("grocery-reorder task wiring", () => {
  test("uses task-specific shop products and startup override", () => {
    const mapping = readMapping();
    const task = mapping.tasks["grocery-reorder"];

    expect(task).toBeDefined();
    expect(task.startup_extra).toBe("tasks/grocery-reorder/environment/startup.sh");
    expect(task.assets).toContainEqual({
      src: "tasks/grocery-reorder/environment/products.json",
      dest: "/opt/mock/static/shop/products.json",
    });
  });
});
