/** @jsxImportSource hono/jsx */
import type { OpenAPIApp } from "mock-lib";
import { sign, tokenCookieOptions, authOptional } from "mock-lib";
import { getExpenseDb } from "../utils/db.js";
import { rowToDraft, rowToActivity, rowToAttachment, rowToUser } from "../utils/mappers.js";
import { LoginPage } from "../components/login-page.js";
import { DashboardPage } from "../components/dashboard-page.js";
import { DraftFormPage } from "../components/draft-form-page.js";
import { DraftDetailPage } from "../components/draft-detail-page.js";
import { ReportsPage } from "../components/reports-page.js";
import { ProfilePage } from "../components/profile-page.js";
import { generateAttachmentRef, sanitizeFilename } from "../utils/attachment-ref.js";
import { generateDraftCode } from "../utils/draft-code.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "hono";
import type { Draft, SpendOverTimePoint, TopCategory, TopMerchant } from "../types.js";

async function requireAuthPage(c: Context): Promise<number | null> {
  await authOptional(c, async () => {});
  if (!c.var.userId) {
    return null;
  }
  return c.var.userId as number;
}

function redirectLogin(c: Context) {
  return c.redirect("/login", 302);
}

function buildDraftWhere(userId: number, status?: string): { clause: string; params: unknown[] } {
  let clause = "WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (status) {
    clause += " AND status = ?";
    params.push(status);
  }
  return { clause, params };
}

function fetchDraftsPage(db: ReturnType<typeof getExpenseDb>, userId: number, status: string | undefined, page: number, limit: number): { drafts: Draft[]; total: number; totalPages: number } {
  const { clause, params } = buildDraftWhere(userId, status);
  const totalRow = db.query(`SELECT COUNT(*) as cnt FROM expense_draft ${clause}`).get(...params) as { cnt: number };
  const total = totalRow.cnt;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const rows = db.query(`SELECT * FROM expense_draft ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[];
  return { drafts: rows.map(rowToDraft), total, totalPages };
}

export function registerPageRoutes(app: OpenAPIApp): void {
  // GET /login
  app.page("/login", async (c) => {
    const token = c.req.header("cookie")?.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
    if (token) {
      const { verify } = await import("mock-lib");
      const payload = await verify(token);
      if (payload) return c.redirect("/dashboard", 302);
    }
    return c.html(<LoginPage />);
  });

  // POST /login
  app.post("/login", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody();
    } catch {
      return c.html(<LoginPage error="Invalid form submission" />, 400);
    }
    const email = body.email as string;
    const password = body.password as string;

    if (!email || !password) {
      return c.html(<LoginPage error="Email and password are required" />);
    }

    const db = getExpenseDb();
    const user = db.query("SELECT * FROM user WHERE email = ? AND password = ? AND is_active = 1").get(email, password) as Record<string, unknown> | null;

    if (!user) {
      return c.html(<LoginPage error="Invalid email or password" />);
    }

    db.exec("UPDATE user SET last_login_at = datetime('now') WHERE id = ?", [user.id]);

    const token = await sign({ sub: email, userId: user.id as number, role: user.role as string });
    const opts = tokenCookieOptions();
    c.header("Set-Cookie", `token=${token}; Path=${opts.path}; Max-Age=${opts.maxAge}; HttpOnly; SameSite=${opts.sameSite}`);
    return c.redirect("/dashboard", 302);
  });

  // GET /dashboard
  app.page("/dashboard", async (c) => {
    const userId = await requireAuthPage(c);
    if (userId === null) return redirectLogin(c);

    const status = c.req.query("status");
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = 20;

    const db = getExpenseDb();
    const { drafts, total, totalPages } = fetchDraftsPage(db, userId, status, page, limit);

    return c.html(<DashboardPage drafts={drafts} total={total} page={page} totalPages={totalPages} currentStatus={status} />);
  });

  // GET /drafts/new
  app.page("/drafts/new", async (c) => {
    const userId = await requireAuthPage(c);
    if (userId === null) return redirectLogin(c);
    return c.html(<DraftFormPage />);
  });

  // POST /drafts/new
  app.post("/drafts/new", async (c) => {
    const userId = await requireAuthPage(c);
    if (userId === null) return redirectLogin(c);

    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody();
    } catch {
      return c.html(<DraftFormPage />, 400);
    }
    const db = getExpenseDb();

    const vendor_name = body.vendor_name as string;
    const amount = parseFloat(body.amount as string);
    const invoice_date = body.invoice_date as string;
    const category = (body.category as string) || null;
    const notes = (body.notes as string) || null;

    if (!vendor_name || !amount || !invoice_date) {
      return c.html(<DraftFormPage />);
    }

    const draftCode = generateDraftCode();
    const result = db.exec(
      `INSERT INTO expense_draft (draft_code, user_id, vendor_name, category, amount, currency, invoice_date, expense_date, notes, source_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [draftCode, userId, vendor_name, category, amount, "USD", invoice_date, null, notes, "manual"],
    );
    const draftId = Number(result.lastInsertRowid);
    db.exec("INSERT INTO expense_activity (draft_id, actor_user_id, action_type) VALUES (?, ?, 'created')", [draftId, userId]);

    // Handle file upload if present
    const file = body["file"];
    if (file && file instanceof File && file.size > 0) {
      const mimeType = file.type.split(";")[0].trim();
      const sanitized = sanitizeFilename(file.name);
      if (sanitized) {
        const attachmentsDir = process.env.EXPENSE_MOCK_ATTACHMENTS_DIR || "/opt/mock/data/attachments";
        mkdirSync(attachmentsDir, { recursive: true });
        const attachmentRef = generateAttachmentRef();
        const ext = sanitized.includes(".") ? sanitized.split(".").pop() : "";
        const storagePath = join(attachmentsDir, `${attachmentRef}${ext ? "." + ext : ""}`);
        const buffer = Buffer.from(await file.arrayBuffer());
        writeFileSync(storagePath, buffer);
        db.exec(
          `INSERT INTO expense_attachment (draft_id, attachment_ref, original_filename, storage_path, mime_type, file_size_bytes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [draftId, attachmentRef, sanitized, storagePath, mimeType, file.size],
        );
        db.exec("UPDATE expense_draft SET attachment_ref = ? WHERE id = ?", [attachmentRef, draftId]);
      }
    }

    return c.redirect("/dashboard", 302);
  });

  // GET /drafts/{id}
  app.page("/drafts/:id", async (c) => {
    const userId = await requireAuthPage(c);
    if (userId === null) return redirectLogin(c);

    const id = parseInt(c.req.param("id"), 10);
    const db = getExpenseDb();

    const row = db.query("SELECT * FROM expense_draft WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | null;
    if (!row) return c.redirect("/dashboard", 302);

    const draft = rowToDraft(row);

    const activityRows = db.query(
      `SELECT a.*, u.full_name as actor_name FROM expense_activity a LEFT JOIN user u ON a.actor_user_id = u.id WHERE a.draft_id = ? ORDER BY a.created_at DESC`,
    ).all(id) as Record<string, unknown>[];
    const activities = activityRows.map(rowToActivity);

    const attachmentRows = db.query("SELECT * FROM expense_attachment WHERE draft_id = ?").all(id) as Record<string, unknown>[];
    const attachments = attachmentRows.map(rowToAttachment);

    return c.html(<DraftDetailPage draft={draft} activities={activities} attachments={attachments} />);
  });

  // GET /reports
  app.page("/reports", async (c) => {
    const userId = await requireAuthPage(c);
    if (userId === null) return redirectLogin(c);

    const db = getExpenseDb();
    const reportType = c.req.query("type") || "spend-over-time";
    const currency = c.req.query("currency") || "USD";
    const groupBy = c.req.query("group_by") || "month";
    const from = c.req.query("from") || "2020-01-01";
    const to = c.req.query("to") || new Date().toISOString().split("T")[0];

    let spendOverTime: { data: SpendOverTimePoint[]; total_spend: number; total_expenses: number } | undefined;
    let topCategories: { data: TopCategory[]; total_spend: number } | undefined;
    let topMerchants: { data: TopMerchant[]; total_spend: number } | undefined;

    if (reportType === "spend-over-time") {
      const rows = db.query(
        `SELECT CASE ? WHEN 'day' THEN invoice_date WHEN 'week' THEN strftime('%Y-W%W', invoice_date) WHEN 'month' THEN strftime('%Y-%m', invoice_date) END as period, SUM(amount) as total_amount, COUNT(*) as count FROM expense_draft WHERE user_id = ? AND status IN ('submitted', 'approved', 'reimbursed') AND currency = ? AND invoice_date BETWEEN ? AND ? GROUP BY period ORDER BY period`,
      ).all(groupBy, userId, currency, from, to) as Record<string, unknown>[];
      const totalSpend = rows.reduce((s, r) => s + (r.total_amount as number), 0);
      const totalExpenses = rows.reduce((s, r) => s + (r.count as number), 0);
      spendOverTime = {
        data: rows.map((r) => ({ period: r.period as string, total_amount: r.total_amount as number, count: r.count as number, currency })),
        total_spend: totalSpend, total_expenses: totalExpenses,
      };
    } else if (reportType === "top-categories") {
      const rows = db.query(
        `SELECT category, SUM(amount) as total_amount, COUNT(*) as count FROM expense_draft WHERE user_id = ? AND status IN ('submitted', 'approved', 'reimbursed') AND currency = ? AND invoice_date BETWEEN ? AND ? AND category IS NOT NULL GROUP BY category ORDER BY total_amount DESC`,
      ).all(userId, currency, from, to) as Record<string, unknown>[];
      const totalSpend = rows.reduce((s, r) => s + (r.total_amount as number), 0);
      topCategories = {
        data: rows.map((r) => ({
          category: r.category as string, total_amount: r.total_amount as number,
          count: r.count as number, percentage: totalSpend > 0 ? (r.total_amount as number) / totalSpend * 100 : 0,
        })),
        total_spend: totalSpend,
      };
    } else if (reportType === "top-merchants") {
      const rows = db.query(
        `SELECT vendor_name, SUM(amount) as total_amount, COUNT(*) as count FROM expense_draft WHERE user_id = ? AND status IN ('submitted', 'approved', 'reimbursed') AND currency = ? AND invoice_date BETWEEN ? AND ? GROUP BY vendor_name ORDER BY total_amount DESC LIMIT 10`,
      ).all(userId, currency, from, to) as Record<string, unknown>[];
      const totalSpend = rows.reduce((s, r) => s + (r.total_amount as number), 0);
      topMerchants = {
        data: rows.map((r) => ({
          vendor_name: r.vendor_name as string, total_amount: r.total_amount as number,
          count: r.count as number, percentage: totalSpend > 0 ? (r.total_amount as number) / totalSpend * 100 : 0,
        })),
        total_spend: totalSpend,
      };
    }

    return c.html(
      <ReportsPage reportType={reportType} groupBy={groupBy} currency={currency} spendOverTime={spendOverTime} topCategories={topCategories} topMerchants={topMerchants} />,
    );
  });

  // GET /profile
  app.page("/profile", async (c) => {
    const userId = await requireAuthPage(c);
    if (userId === null) return redirectLogin(c);

    const db = getExpenseDb();
    const user = db.query("SELECT * FROM user WHERE id = ?").get(userId) as Record<string, unknown> | null;
    if (!user) return redirectLogin(c);

    return c.html(<ProfilePage user={rowToUser(user)} />);
  });

  // POST /logout
  app.page("/logout", async (c) => {
    const opts = tokenCookieOptions();
    c.header("Set-Cookie", `token=; Path=${opts.path}; Max-Age=0; HttpOnly; SameSite=${opts.sameSite}`);
    return c.redirect("/login", 302);
  });
}
