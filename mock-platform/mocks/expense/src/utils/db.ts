import { getDb } from "../db/init.js";
import type { Database } from "bun:sqlite";

export function getExpenseDb(): Database {
  return getDb({ path: process.env.EXPENSE_MOCK_DB_PATH || ":memory:", autoMigrate: false });
}

/**
 * Escape SQL LIKE wildcard characters in user input so that `%` and `_`
 * in the search term are treated as literals. Use together with the
 * `ESCAPE '\\'` clause on the LIKE operator.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
