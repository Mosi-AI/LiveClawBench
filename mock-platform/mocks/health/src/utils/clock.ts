import { initDb } from "../db";

export function getToday(): string {
  const db = initDb();
  const row = db.query("SELECT value FROM system_config WHERE key = 'current_date'").get() as { value: string } | null;
  return row?.value ?? "2026-05-13";
}

export function getCurrentTime(): string {
  const db = initDb();
  const row = db.query("SELECT value FROM system_config WHERE key = 'current_time'").get() as { value: string } | null;
  return row?.value ?? "16:42";
}

export function getNow(): string {
  return `${getToday()}T${getCurrentTime()}:00`;
}
