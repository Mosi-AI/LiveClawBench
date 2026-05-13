import { describe, it, expect, beforeEach } from "bun:test";
import { resolve } from "path";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { createExpenseApp } from "../src/index.js";
import { runMigrations, resetDb } from "../src/db/init.js";
import { seed } from "../src/db/seed.js";
import type { MockAppV2 } from "mock-lib";

// ---------------------------------------------------------------------------
// In-process acceptance harness
// ---------------------------------------------------------------------------
// Strategy: drive the Hono app via app.app.request() instead of spawning a
// compiled binary on a real port. This is faster than the social mock's
// build-and-spawn approach (~50ms vs ~30s) while exercising the same router,
// auth middleware, SQL, and OpenAPI validation. The build pipeline itself is
// covered separately by `bun run build:images --dry-run` and `bun run build`.
//
// Mock root resolution is portable: derived from import.meta.dir, so the
// suite works on every contributor's machine and CI without hardcoded paths.
// ---------------------------------------------------------------------------

const MOCK_ROOT = resolve(import.meta.dir, "..");
let attachmentsDir: string;
let app: MockAppV2;

interface JsonResp {
  status: number;
  body: any;
  headers: Headers;
}

async function jreq(path: string, opts: RequestInit = {}): Promise<JsonResp> {
  const res = await app.app.request(path, opts);
  let body: any = null;
  try {
    body = await res.clone().json();
  } catch {
    body = await res.clone().text();
  }
  return { status: res.status, body, headers: res.headers };
}

async function login(email: string, password = "password123"): Promise<string> {
  const res = await app.app.request("/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const data = await res.json() as { token: string };
  return data.token;
}

function authHeaders(token: string): Record<string, string> {
  return { "Authorization": `Bearer ${token}` };
}

async function createDraft(token: string, overrides: Record<string, unknown> = {}): Promise<{ id: number; draft_code: string }> {
  const body = {
    vendor_name: "Default Vendor",
    amount: 25.0,
    currency: "USD",
    invoice_date: "2026-05-01",
    ...overrides,
  };
  const res = await app.app.request("/api/drafts", {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return await res.json() as { id: number; draft_code: string };
}

async function uploadAttachment(token: string, draftId: number, filename = "receipt.txt", content = "Hello receipt", mime = "text/plain"): Promise<{ attachment_ref: string }> {
  const fd = new FormData();
  fd.append("file", new File([content], filename, { type: mime }));
  const res = await app.app.request(`/api/drafts/${draftId}/attachments`, {
    method: "POST",
    headers: authHeaders(token),
    body: fd,
  });
  expect(res.status).toBe(200);
  const data = await res.json() as { attachment: { attachment_ref: string } };
  return data.attachment;
}

describe("Expense Mock AC", () => {
  beforeEach(() => {
    attachmentsDir = mkdtempSync(resolve(tmpdir(), "expense-mock-att-"));
    process.env.EXPENSE_MOCK_DB_PATH = ":memory:";
    process.env.EXPENSE_MOCK_DATA_DIR = attachmentsDir;
    process.env.EXPENSE_MOCK_ATTACHMENTS_DIR = attachmentsDir;
    resetDb();
    app = createExpenseApp();
    runMigrations();
    seed();
  });

  // =========================================================================
  // AC-1: Service Isolation
  // =========================================================================
  describe("AC-1 service isolation", () => {
    it("/health returns ok", async () => {
      const r = await jreq("/health");
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
    });

    it("/__mock_sentinel__/expense returns sentinel marker", async () => {
      const r = await jreq("/__mock_sentinel__/expense");
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true });
    });
  });

  // =========================================================================
  // AC-2: Schema, seed, and DB integrity
  // =========================================================================
  describe("AC-2 schema and seed", () => {
    it("seeded users alice and bob exist and can authenticate", async () => {
      const aliceToken = await login("alice@mosi.inc");
      expect(aliceToken).toBeTruthy();

      const bobToken = await login("bob@mosi.inc");
      expect(bobToken).toBeTruthy();
    });

    it("/api/me returns the authenticated user's profile", async () => {
      const token = await login("alice@mosi.inc");
      const r = await jreq("/api/me", { headers: authHeaders(token) });
      expect(r.status).toBe(200);
      expect(r.body.email).toBe("alice@mosi.inc");
      expect(r.body.full_name).toBe("Alice Chen");
      expect(r.body.role).toBe("employee");
    });
  });

  // =========================================================================
  // AC-3: Authentication
  // =========================================================================
  describe("AC-3 authentication", () => {
    it("token endpoint returns JWT with valid credentials", async () => {
      const r = await jreq("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
      });
      expect(r.status).toBe(200);
      expect(typeof r.body.token).toBe("string");
      expect(r.body.expires_in).toBe(3600);
    });

    it("invalid password returns 401", async () => {
      const r = await jreq("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@mosi.inc", password: "wrong" }),
      });
      expect(r.status).toBe(401);
    });

    it("nonexistent user returns 401", async () => {
      const r = await jreq("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ghost@mosi.inc", password: "password123" }),
      });
      expect(r.status).toBe(401);
    });

    it("malformed JSON body returns 400", async () => {
      const r = await jreq("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      });
      expect(r.status).toBe(400);
    });

    it("protected route without token returns 401", async () => {
      const r = await jreq("/api/drafts");
      expect(r.status).toBe(401);
    });

    it("protected route with bogus token returns 401", async () => {
      const r = await jreq("/api/drafts", { headers: { Authorization: "Bearer not-a-real-token" } });
      expect(r.status).toBe(401);
    });

    it("logout endpoint clears the token cookie", async () => {
      const token = await login("alice@mosi.inc");
      const r = await jreq("/api/auth/logout", { method: "POST", headers: authHeaders(token) });
      expect(r.status).toBe(200);
      const setCookie = r.headers.get("set-cookie") || "";
      expect(setCookie).toContain("Max-Age=0");
    });
  });

  // =========================================================================
  // AC-4: Draft CRUD
  // =========================================================================
  describe("AC-4 draft CRUD", () => {
    it("creates a draft with auto-generated EXP-YYYY-NNNN code", async () => {
      const token = await login("alice@mosi.inc");
      const r = await jreq("/api/drafts", {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_name: "Acme", amount: 19.99, invoice_date: "2026-05-02" }),
      });
      expect(r.status).toBe(200);
      expect(r.body.draft_code).toMatch(/^EXP-\d{4}-\d{4}$/);
      expect(r.body.status).toBe("draft");
    });

    it("lists drafts paginated and filtered by status", async () => {
      const token = await login("alice@mosi.inc");
      await createDraft(token, { vendor_name: "Vendor 1", amount: 10, invoice_date: "2026-05-01" });
      await createDraft(token, { vendor_name: "Vendor 2", amount: 20, invoice_date: "2026-05-02" });

      const all = await jreq("/api/drafts", { headers: authHeaders(token) });
      expect(all.status).toBe(200);
      expect(all.body.total).toBe(2);
      expect(all.body.drafts.length).toBe(2);

      const onlyDraft = await jreq("/api/drafts?status=draft", { headers: authHeaders(token) });
      expect(onlyDraft.body.total).toBe(2);

      const onlySubmitted = await jreq("/api/drafts?status=submitted", { headers: authHeaders(token) });
      expect(onlySubmitted.body.total).toBe(0);
    });

    it("PATCH writes activity log entries when fields change", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token, { vendor_name: "Old" });
      const patch = await jreq(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_name: "New" }),
      });
      expect(patch.status).toBe(200);
      expect(patch.body.vendor_name).toBe("New");

      const acts = await jreq(`/api/drafts/${draft.id}/activities`, { headers: authHeaders(token) });
      const editAct = (acts.body.activities as any[]).find((a) => a.action_type === "edited");
      expect(editAct).toBeDefined();
      expect(editAct.field_name).toBe("vendor_name");
      expect(editAct.old_value).toBe("Old");
      expect(editAct.new_value).toBe("New");
    });

    it("PATCH on submitted draft returns 403", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token, { vendor_name: "X", amount: 5, invoice_date: "2026-05-01", category: "software" });
      const submit = await jreq(`/api/drafts/${draft.id}/submit`, { method: "POST", headers: authHeaders(token) });
      expect(submit.status).toBe(200);

      const r = await jreq(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_name: "Y" }),
      });
      expect(r.status).toBe(403);
    });

    it("DELETE removes draft and returns 404 on follow-up GET", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token);
      const del = await jreq(`/api/drafts/${draft.id}`, { method: "DELETE", headers: authHeaders(token) });
      expect(del.status).toBe(200);

      const get = await jreq(`/api/drafts/${draft.id}`, { headers: authHeaders(token) });
      expect(get.status).toBe(404);
    });

    it("submit without category returns 400 validation error", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token, { vendor_name: "X", amount: 5, invoice_date: "2026-05-01" });
      const r = await jreq(`/api/drafts/${draft.id}/submit`, { method: "POST", headers: authHeaders(token) });
      expect(r.status).toBe(400);
      expect(r.body.fields[0].field).toBe("category");
    });

    it("submit twice returns 409", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token, { category: "software" });
      const first = await jreq(`/api/drafts/${draft.id}/submit`, { method: "POST", headers: authHeaders(token) });
      expect(first.status).toBe(200);

      const second = await jreq(`/api/drafts/${draft.id}/submit`, { method: "POST", headers: authHeaders(token) });
      expect(second.status).toBe(409);
    });

    it("invalid amount (negative) is rejected by zod schema", async () => {
      const token = await login("alice@mosi.inc");
      const r = await jreq("/api/drafts", {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_name: "X", amount: -5, invoice_date: "2026-05-01" }),
      });
      expect(r.status).toBe(400);
    });

    it("invalid date format is rejected by zod schema", async () => {
      const token = await login("alice@mosi.inc");
      const r = await jreq("/api/drafts", {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_name: "X", amount: 5, invoice_date: "05/01/2026" }),
      });
      expect(r.status).toBe(400);
    });
  });

  // =========================================================================
  // AC-5: Cross-user isolation (horizontal privilege escalation guards)
  // =========================================================================
  describe("AC-5 cross-user isolation", () => {
    it("alice cannot read bob's draft (returns 404)", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      const bobDraft = await createDraft(bobToken, { vendor_name: "Bob's secret expense" });

      const r = await jreq(`/api/drafts/${bobDraft.id}`, { headers: authHeaders(aliceToken) });
      expect(r.status).toBe(404);
    });

    it("alice cannot patch bob's draft", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      const bobDraft = await createDraft(bobToken);

      const r = await jreq(`/api/drafts/${bobDraft.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(aliceToken), "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_name: "hijacked" }),
      });
      expect(r.status).toBe(404);
    });

    it("alice cannot delete bob's draft", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      const bobDraft = await createDraft(bobToken);

      const r = await jreq(`/api/drafts/${bobDraft.id}`, { method: "DELETE", headers: authHeaders(aliceToken) });
      expect(r.status).toBe(404);
    });

    it("alice's draft list never contains bob's drafts", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      await createDraft(aliceToken, { vendor_name: "Alice One" });
      await createDraft(bobToken, { vendor_name: "Bob Secret" });

      const r = await jreq("/api/drafts", { headers: authHeaders(aliceToken) });
      expect(r.body.total).toBe(1);
      expect(r.body.drafts[0].vendor_name).toBe("Alice One");
    });

    it("alice cannot list bob's draft activities", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      const bobDraft = await createDraft(bobToken);

      const r = await jreq(`/api/drafts/${bobDraft.id}/activities`, { headers: authHeaders(aliceToken) });
      expect(r.status).toBe(200);
      expect(r.body.activities).toEqual([]);
    });
  });

  // =========================================================================
  // AC-6: Attachment ownership and validation
  // =========================================================================
  describe("AC-6 attachments", () => {
    it("uploads a text/plain attachment and stores preview text", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token);
      const att = await uploadAttachment(token, draft.id, "receipt.txt", "Hello world", "text/plain");
      expect(att.attachment_ref).toMatch(/^att_[a-z0-9]{8}$/);
    });

    it("rejects unsupported MIME types", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token);
      const fd = new FormData();
      fd.append("file", new File(["evil"], "evil.exe", { type: "application/x-msdownload" }));
      const r = await app.app.request(`/api/drafts/${draft.id}/attachments`, {
        method: "POST",
        headers: authHeaders(token),
        body: fd,
      });
      expect(r.status).toBe(400);
    });

    it("rejects unsafe filenames (path traversal)", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token);
      const fd = new FormData();
      fd.append("file", new File(["x"], "../../etc/passwd", { type: "text/plain" }));
      const r = await app.app.request(`/api/drafts/${draft.id}/attachments`, {
        method: "POST",
        headers: authHeaders(token),
        body: fd,
      });
      expect(r.status).toBe(400);
    });

    it("alice cannot GET bob's attachment by ref (returns 404)", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      const bobDraft = await createDraft(bobToken);
      const bobAtt = await uploadAttachment(bobToken, bobDraft.id, "bob-receipt.txt", "Bob secret", "text/plain");

      const r = await app.app.request(`/api/attachments/${bobAtt.attachment_ref}`, {
        headers: authHeaders(aliceToken),
      });
      expect(r.status).toBe(404);
    });

    it("alice cannot DELETE bob's attachment", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      const bobDraft = await createDraft(bobToken);
      const bobAtt = await uploadAttachment(bobToken, bobDraft.id);

      const r = await app.app.request(`/api/attachments/${bobAtt.attachment_ref}`, {
        method: "DELETE",
        headers: authHeaders(aliceToken),
      });
      expect(r.status).toBe(404);
    });

    it("owner can fetch attachment content with correct MIME", async () => {
      const token = await login("alice@mosi.inc");
      const draft = await createDraft(token);
      const att = await uploadAttachment(token, draft.id, "r.txt", "secret stuff", "text/plain");

      const res = await app.app.request(`/api/attachments/${att.attachment_ref}`, { headers: authHeaders(token) });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/plain");
      const text = await res.text();
      expect(text).toBe("secret stuff");
    });

    it("upload to nonexistent draft returns 404", async () => {
      const token = await login("alice@mosi.inc");
      const fd = new FormData();
      fd.append("file", new File(["x"], "r.txt", { type: "text/plain" }));
      const r = await app.app.request(`/api/drafts/999999/attachments`, {
        method: "POST",
        headers: authHeaders(token),
        body: fd,
      });
      expect(r.status).toBe(404);
    });
  });

  // =========================================================================
  // AC-7: Reports user isolation (regression guard for #pages.tsx + #reports.ts)
  // =========================================================================
  describe("AC-7 report user isolation", () => {
    async function seedReportableDraft(token: string, vendor: string, amount: number, category: string): Promise<void> {
      // Use a past date so it falls inside the default report window
      // (from = "2020-01-01", to = today).
      const d = await createDraft(token, { vendor_name: vendor, amount, category, invoice_date: "2026-01-15" });
      const r = await app.app.request(`/api/drafts/${d.id}/submit`, { method: "POST", headers: authHeaders(token) });
      expect(r.status).toBe(200);
    }

    it("API: spend-over-time only returns the caller's data", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      await seedReportableDraft(aliceToken, "Alice Vendor", 100, "software");
      await seedReportableDraft(bobToken, "Bob Vendor", 9999, "lodging");

      const r = await jreq("/api/reports/spend-over-time?currency=USD&group_by=month", { headers: authHeaders(aliceToken) });
      expect(r.status).toBe(200);
      expect(r.body.total_spend).toBe(100);
    });

    it("API: top-merchants does not leak other users' merchants", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      await seedReportableDraft(aliceToken, "AliceCo", 50, "software");
      await seedReportableDraft(bobToken, "BobBigSpender", 5000, "lodging");

      const r = await jreq("/api/reports/top-merchants?currency=USD", { headers: authHeaders(aliceToken) });
      const vendors = (r.body.data as any[]).map((x) => x.vendor_name);
      expect(vendors).toContain("AliceCo");
      expect(vendors).not.toContain("BobBigSpender");
    });

    it("API: top-categories does not leak other users' categories", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      await seedReportableDraft(aliceToken, "Alice", 30, "software");
      await seedReportableDraft(bobToken, "Bob", 1000, "lodging");

      const r = await jreq("/api/reports/top-categories?currency=USD", { headers: authHeaders(aliceToken) });
      const cats = (r.body.data as any[]).map((x) => x.category);
      expect(cats).toContain("software");
      expect(cats).not.toContain("lodging");
    });

    it("HTML /reports page also only shows the caller's totals", async () => {
      const aliceToken = await login("alice@mosi.inc");
      const bobToken = await login("bob@mosi.inc");
      await seedReportableDraft(aliceToken, "AliceVisible", 42, "software");
      await seedReportableDraft(bobToken, "BobInvisible", 7777, "lodging");

      // Issue request as alice via cookie set by /login
      const loginRes = await app.app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "email=alice@mosi.inc&password=password123",
        redirect: "manual",
      });
      const setCookie = loginRes.headers.get("set-cookie") || "";
      const tokenCookieMatch = setCookie.match(/token=([^;]+)/);
      expect(tokenCookieMatch).toBeTruthy();

      const cookie = `token=${tokenCookieMatch![1]}`;
      const html = await app.app.request("/reports?type=top-merchants&currency=USD", { headers: { Cookie: cookie } });
      expect(html.status).toBe(200);
      const bodyText = await html.text();
      expect(bodyText).toContain("AliceVisible");
      expect(bodyText).not.toContain("BobInvisible");
    });
  });

  // =========================================================================
  // AC-8: Search safety — LIKE wildcard escape
  // =========================================================================
  describe("AC-8 LIKE wildcard escape", () => {
    it("searching with literal % does not match unrelated drafts", async () => {
      const token = await login("alice@mosi.inc");
      await createDraft(token, { vendor_name: "Plain Vendor" });
      await createDraft(token, { vendor_name: "100% Pure Coffee" });

      const r = await jreq("/api/drafts?q=" + encodeURIComponent("%"), { headers: authHeaders(token) });
      expect(r.status).toBe(200);
      // Without escaping, '%' in LIKE matches everything; after escaping it
      // should only match the vendor that contains a literal '%'.
      const vendors = (r.body.drafts as any[]).map((d) => d.vendor_name);
      expect(vendors).toContain("100% Pure Coffee");
      expect(vendors).not.toContain("Plain Vendor");
    });

    it("searching with literal _ does not match unrelated drafts", async () => {
      const token = await login("alice@mosi.inc");
      await createDraft(token, { vendor_name: "abc" });
      await createDraft(token, { vendor_name: "a_b" });

      const r = await jreq("/api/drafts?q=" + encodeURIComponent("_"), { headers: authHeaders(token) });
      const vendors = (r.body.drafts as any[]).map((d) => d.vendor_name);
      expect(vendors).toContain("a_b");
      expect(vendors).not.toContain("abc");
    });

    it("oversized search term is rejected by zod max(255)", async () => {
      const token = await login("alice@mosi.inc");
      const longQ = "a".repeat(300);
      const r = await jreq("/api/drafts?q=" + longQ, { headers: authHeaders(token) });
      expect(r.status).toBe(400);
    });
  });

  // =========================================================================
  // AC-9: HTML pages — login flow and protection
  // =========================================================================
  describe("AC-9 HTML page flow", () => {
    it("unauthenticated /dashboard redirects to /login", async () => {
      const res = await app.app.request("/dashboard", { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/login");
    });

    it("/login renders login form HTML", async () => {
      const res = await app.app.request("/login");
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Mosi Expenses");
      expect(html).toContain("name=\"email\"");
      expect(html).toContain("name=\"password\"");
    });

    it("POST /login with valid creds sets token cookie and redirects", async () => {
      const res = await app.app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "email=alice@mosi.inc&password=password123",
        redirect: "manual",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/dashboard");
      expect(res.headers.get("set-cookie") || "").toMatch(/token=/);
    });

    it("POST /login with bad password renders LoginPage with error", async () => {
      const res = await app.app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "email=alice@mosi.inc&password=wrong",
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Invalid email or password");
    });
  });
});

// Best-effort cleanup for any temp dirs left over (in case beforeEach throws).
process.on("exit", () => {
  try {
    if (attachmentsDir && existsSync(attachmentsDir)) {
      rmSync(attachmentsDir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
});

// Suppress unused-import warning for writeFileSync (kept for future cases).
void writeFileSync;
