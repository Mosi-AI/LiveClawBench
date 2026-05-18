/**
 * Dynamic configuration loading from the database.
 */

import { assertDb } from "./init";
import type { DbState } from "./init";
import type { Metadata } from "../types";

export interface ConfigState {
  metadata: Metadata;
  queryExamples: string[];
}

export function createConfigState(): ConfigState {
  return {
    metadata: {
      site_title: "Browser Portal",
      home_title: "Browser Portal",
      home_description: "Search this portal for documents.",
      search_placeholder: "Search for documents",
    },
    queryExamples: [],
  };
}

export function loadDynamicConfig(state: ConfigState, dbState: DbState): void {
  const database = assertDb(dbState);
  try {
    const metaRows = database.query("SELECT key, value FROM metadata").all() as Array<{ key: string; value: string }>;
    const metaMap = new Map(metaRows.map((r) => [r.key, r.value]));
    state.metadata = {
      site_title: metaMap.get("site_title") ?? state.metadata.site_title,
      home_title: metaMap.get("home_title") ?? state.metadata.home_title,
      home_description: metaMap.get("home_description") ?? state.metadata.home_description,
      search_placeholder: metaMap.get("search_placeholder") ?? state.metadata.search_placeholder,
    };

    const exampleRows = database.query("SELECT query FROM query_examples ORDER BY position ASC").all() as Array<{ query: string }>;
    state.queryExamples = exampleRows.map((r) => r.query);
  } catch (err) {
    console.error("mock-doc-search: FATAL: failed to load dynamic config from database", err);
    process.exit(1);
  }
}
