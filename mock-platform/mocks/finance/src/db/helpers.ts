import type { Database } from "bun:sqlite";

export function updateApprovalStatus(
  db: Database,
  id: number,
  value: "approved" | "rejected"
): void {
  db.run(
    "UPDATE transaction_record SET approval_status = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
    [value, value, id]
  );
}
