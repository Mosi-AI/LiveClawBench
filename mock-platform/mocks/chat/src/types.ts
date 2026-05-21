/**
 * Shared TypeScript types for chat mock service.
 */

import type { Database } from "bun:sqlite";

export interface Sticker {
  id: number;
  user_id: number;
  pack_id: number | null;
  category: "recent" | "favorite" | "custom";
  storage_path: string;
  mime_type: "image/gif" | "image/png" | "image/jpeg" | "image/svg+xml";
  created_at: string;
  sort_order: number;
}

export interface ChatConfig {
  dbPath: string;
  stickerDir: string;
}

export interface DbState {
  db: Database | null;
  config: ChatConfig;
}
