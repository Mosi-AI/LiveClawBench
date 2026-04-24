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
  private ensured = false;

  constructor(options?: JsonStoreOptions) {
    this.dir = options?.dir ?? join(process.cwd(), "data");
  }

  private ensureDir(): void {
    if (this.ensured) return;
    mkdirSync(this.dir, { recursive: true });
    this.ensured = true;
  }

  /**
   * Read a JSON file from the store.
   * Returns defaultValue if file doesn't exist.
   */
  read<T>(key: string, defaultValue: T): T {
    this.ensureDir();
    try {
      const content = readFileSync(join(this.dir, `${key}.json`), "utf-8");
      return JSON.parse(content) as T;
    } catch (err) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return defaultValue;
      }
      throw new Error(`JsonStore read failed for "${key}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Write a JSON file to the store.
   */
  write<T>(key: string, data: T): void {
    this.ensureDir();
    const path = join(this.dir, `${key}.json`);
    try {
      writeFileSync(
        path,
        JSON.stringify(data, null, 2),
        "utf-8",
      );
    } catch (err) {
      throw new Error(`JsonStore write failed for "${key}" at ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
