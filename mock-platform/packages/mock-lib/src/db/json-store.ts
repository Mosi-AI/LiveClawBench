import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Simple JSON file store for mock data persistence.
 *
 * Useful for mock services that need lightweight data storage
 * without the overhead of SQLite (e.g., configuration, small datasets).
 */

export interface JsonStoreOptions {
  /** Directory for JSON files. Defaults to ./data */
  dir?: string;
}

export class JsonStore {
  private dir: string;

  constructor(options?: JsonStoreOptions) {
    this.dir = options?.dir ?? join(process.cwd(), "data");
    mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Read a JSON file from the store.
   * Returns defaultValue if file doesn't exist.
   */
  read<T>(key: string, defaultValue: T): T {
    try {
      const content = readFileSync(join(this.dir, `${key}.json`), "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Write a JSON file to the store.
   */
  write<T>(key: string, data: T): void {
    writeFileSync(
      join(this.dir, `${key}.json`),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  }
}
