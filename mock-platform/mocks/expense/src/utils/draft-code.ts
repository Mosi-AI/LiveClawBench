import { getExpenseDb } from "./db.js";

export function generateDraftCode(): string {
  const db = getExpenseDb();
  const year = new Date().getFullYear().toString();
  const row = db.query(
    "SELECT MAX(CAST(SUBSTR(draft_code, -4) AS INTEGER)) as max_seq FROM expense_draft WHERE draft_code LIKE ?",
  ).get(`EXP-${year}-%`) as { max_seq: number | null };
  const nextSeq = (row?.max_seq ?? 0) + 1;
  return `EXP-${year}-${String(nextSeq).padStart(4, "0")}`;
}
