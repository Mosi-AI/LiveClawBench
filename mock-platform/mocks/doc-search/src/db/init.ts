/**
 * Database initialization
 */

import { Database } from "bun:sqlite";
import { mkdirSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import type { Document } from "../types";

export interface DbState {
  db: Database | null;
  dbPath: string;
  sqlPath: string;
}

export function createDbState(dbPath: string, sqlPath: string): DbState {
  return { db: null, dbPath, sqlPath };
}

export function initDatabase(state: DbState): void {
  const { dbPath, sqlPath } = state;

  // Ensure output directory exists
  const outputDir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    console.error(`mock-doc-search: FATAL: cannot create database directory: ${outputDir}`, err);
    process.exit(1);
  }

  // Delete existing DB to start fresh (matches Python behavior)
  try {
    unlinkSync(dbPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.error(`mock-doc-search: FATAL: cannot remove stale database: ${dbPath}`, err);
      process.exit(1);
    }
  }

  state.db = new Database(dbPath, { create: true });

  // Load and execute SQL seed file — fail fast if missing
  if (!existsSync(sqlPath)) {
    console.error(`mock-doc-search: FATAL: SQL seed file not found at ${sqlPath}`);
    console.error(`mock-doc-search: Ensure the per-task asset (documents.sql) is staged at /opt/mock/data/`);
    process.exit(1);
  }
  const sql = readFileSync(sqlPath, "utf-8");
  state.db.exec(sql);
  console.log(`mock-doc-search: initialized DB from ${sqlPath}`);
}

export function assertDb(state: DbState): Database {
  if (!state.db) {
    throw new Error("Database not initialized");
  }
  return state.db;
}

export function validateDocumentRow(row: unknown): Document {
  if (!row || typeof row !== "object") {
    throw new Error("Invalid document row: expected object");
  }
  const r = row as Record<string, unknown>;
  const required = ["id", "slug", "title", "kind", "status", "reliability", "updated_at", "owner", "summary", "body", "tags"] as const;
  for (const key of required) {
    if (typeof r[key] !== "string") {
      throw new Error(`Document row missing required field "${key}"`);
    }
  }
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    kind: r.kind as string,
    status: r.status as string,
    reliability: r.reliability as string,
    updated_at: r.updated_at as string,
    owner: r.owner as string,
    summary: r.summary as string,
    body: r.body as string,
    tags: r.tags as string,
  };
}
