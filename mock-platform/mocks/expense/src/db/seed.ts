import { existsSync, readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./init.js";

const BUILTIN_USERS = [
  { full_name: "Alice Chen", email: "alice@mosi.inc", password: "password123", department: "Operations", role: "employee" as const, preferred_currency: "USD" as const },
  { full_name: "Bob Smith", email: "bob@mosi.inc", password: "password123", department: "Finance", role: "manager" as const, preferred_currency: "USD" as const },
];

interface SeedUser {
  full_name: string; email: string; password: string; department: string;
  role: string; preferred_currency: string;
}

interface SeedDraft {
  draft_code: string; vendor_name: string; category: string | null; amount: number;
  currency: string; invoice_date: string; expense_date: string | null; notes: string | null;
  source_type: string; status: string; attachment_ref: string | null; owner_email: string;
}

interface SeedAttachment {
  attachment_ref: string; original_filename: string; source_file: string;
  mime_type: string; page_count: number | null; preview_text: string | null;
  extracted_vendor_name: string | null; extracted_amount: number | null;
  extracted_currency: string | null; extracted_invoice_date: string | null;
  linked_draft_code: string;
}

interface SeedActivity {
  linked_draft_code: string; actor_email: string; action_type: string;
  created_at: string;
}

interface SeedData {
  users?: SeedUser[];
  drafts?: SeedDraft[];
  attachments?: SeedAttachment[];
  activities?: SeedActivity[];
}

export function seed(): void {
  const db = getDb({ path: process.env.EXPENSE_MOCK_DB_PATH || ":memory:", autoMigrate: false });
  const dataDir = process.env.EXPENSE_MOCK_DATA_DIR || "/opt/mock/data";
  const attachmentsDir = process.env.EXPENSE_MOCK_ATTACHMENTS_DIR || join(dataDir, "attachments");

  db.exec("BEGIN TRANSACTION");

  try {
    // Layer 0: built-in users
    for (const u of BUILTIN_USERS) {
      const existing = db.query("SELECT id FROM user WHERE email = ?").get(u.email) as { id: number } | null;
      if (!existing) {
        db.exec(
          "INSERT INTO user (full_name, email, password, department, role, preferred_currency) VALUES (?, ?, ?, ?, ?, ?)",
          [u.full_name, u.email, u.password, u.department, u.role, u.preferred_currency],
        );
      }
    }

    // Layer 1: optional seed.json (per-task fixture; absent for the bare mock binary)
    const seedPath = join(dataDir, "seed.json");
    if (!existsSync(seedPath)) {
      db.exec("COMMIT");
      return;
    }

    const seedData: SeedData = JSON.parse(readFileSync(seedPath, "utf-8"));

    // Insert seed users
    if (seedData.users) {
      for (const u of seedData.users) {
        const existing = db.query("SELECT id FROM user WHERE email = ?").get(u.email) as { id: number } | null;
        if (!existing) {
          db.exec(
            "INSERT INTO user (full_name, email, password, department, role, preferred_currency) VALUES (?, ?, ?, ?, ?, ?)",
            [u.full_name, u.email, u.password, u.department, u.role, u.preferred_currency],
          );
        }
      }
    }

    // Insert seed drafts
    const draftIdMap = new Map<string, number>();
    if (seedData.drafts) {
      for (const d of seedData.drafts) {
        const existing = db.query("SELECT id FROM expense_draft WHERE draft_code = ?").get(d.draft_code) as { id: number } | null;
        if (existing) {
          draftIdMap.set(d.draft_code, existing.id);
          continue;
        }
        const user = db.query("SELECT id FROM user WHERE email = ?").get(d.owner_email) as { id: number } | null;
        if (!user) {
          throw new Error(`Seed draft ${d.draft_code}: owner_email "${d.owner_email}" not found`);
        }
        const result = db.exec(
          `INSERT INTO expense_draft (draft_code, user_id, vendor_name, category, amount, currency, invoice_date, expense_date, notes, source_type, status, attachment_ref)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [d.draft_code, user.id, d.vendor_name, d.category, d.amount, d.currency, d.invoice_date, d.expense_date, d.notes, d.source_type, d.status, d.attachment_ref],
        );
        draftIdMap.set(d.draft_code, Number(result.lastInsertRowid));
      }
    }

    // Copy and insert seed attachments
    if (seedData.attachments) {
      mkdirSync(attachmentsDir, { recursive: true });
      for (const a of seedData.attachments) {
        const existing = db.query("SELECT id FROM expense_attachment WHERE attachment_ref = ?").get(a.attachment_ref) as { id: number } | null;
        if (existing) continue;

        const draftId = draftIdMap.get(a.linked_draft_code);
        if (!draftId) {
          throw new Error(`Seed attachment ${a.attachment_ref}: linked_draft_code "${a.linked_draft_code}" not found`);
        }

        const refDir = join(attachmentsDir, a.attachment_ref);
        mkdirSync(refDir, { recursive: true });
        const storagePath = join(refDir, a.original_filename);

        const sourcePath = join(dataDir, a.source_file);
        if (existsSync(sourcePath)) {
          copyFileSync(sourcePath, storagePath);
        }

        db.exec(
          `INSERT INTO expense_attachment (draft_id, attachment_ref, original_filename, storage_path, mime_type, page_count, preview_text, extracted_vendor_name, extracted_amount, extracted_currency, extracted_invoice_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [draftId, a.attachment_ref, a.original_filename, storagePath, a.mime_type, a.page_count, a.preview_text, a.extracted_vendor_name, a.extracted_amount, a.extracted_currency, a.extracted_invoice_date],
        );
      }
    }

    // Insert seed activities (auto-generate 'created' for drafts without activities)
    if (seedData.drafts) {
      const activityDraftCodes = new Set((seedData.activities || []).map((a) => a.linked_draft_code));

      for (const d of seedData.drafts) {
        const draftId = draftIdMap.get(d.draft_code);
        if (!draftId) continue;

        // Check if any activity already exists for this draft
        const existingActivity = db.query("SELECT 1 FROM expense_activity WHERE draft_id = ?").get(draftId) as unknown;
        if (existingActivity) continue;

        // Find explicit activity for this draft
        const explicitActivity = (seedData.activities || []).find((a) => a.linked_draft_code === d.draft_code);

        if (explicitActivity) {
          const actor = db.query("SELECT id FROM user WHERE email = ?").get(explicitActivity.actor_email) as { id: number } | null;
          db.exec(
            "INSERT INTO expense_activity (draft_id, actor_user_id, action_type, created_at) VALUES (?, ?, ?, ?)",
            [draftId, actor?.id ?? null, explicitActivity.action_type, explicitActivity.created_at],
          );
        } else if (!activityDraftCodes.has(d.draft_code)) {
          // Auto-generate 'created' activity
          const draftRow = db.query("SELECT created_at, user_id FROM expense_draft WHERE id = ?").get(draftId) as { created_at: string; user_id: number } | null;
          if (draftRow) {
            db.exec(
              "INSERT INTO expense_activity (draft_id, actor_user_id, action_type, created_at) VALUES (?, ?, 'created', ?)",
              [draftId, draftRow.user_id, draftRow.created_at],
            );
          }
        }
      }
    }

    // Insert remaining explicit activities
    if (seedData.activities) {
      for (const a of seedData.activities) {
        const draftId = draftIdMap.get(a.linked_draft_code);
        if (!draftId) continue;

        const existingActivity = db.query("SELECT 1 FROM expense_activity WHERE draft_id = ? AND action_type = ? AND created_at = ?").get(draftId, a.action_type, a.created_at) as unknown;
        if (existingActivity) continue;

        const actor = db.query("SELECT id FROM user WHERE email = ?").get(a.actor_email) as { id: number } | null;
        db.exec(
          "INSERT INTO expense_activity (draft_id, actor_user_id, action_type, created_at) VALUES (?, ?, ?, ?)",
          [draftId, actor?.id ?? null, a.action_type, a.created_at],
        );
      }
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("mock-expense: FATAL: seed failed", err);
    process.exit(1);
  }
}
