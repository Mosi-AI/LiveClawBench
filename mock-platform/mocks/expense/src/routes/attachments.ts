import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import { getExpenseDb } from "../utils/db.js";
import { rowToAttachment } from "../utils/mappers.js";
import { AttachmentSchema, AttachmentUploadResponseSchema } from "../schemas.js";
import { generateAttachmentRef, sanitizeFilename } from "../utils/attachment-ref.js";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "text/plain", "text/html", "text/csv",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getAttachmentsDir(): string {
  const dataDir = process.env.EXPENSE_MOCK_DATA_DIR || "/opt/mock/data";
  return process.env.EXPENSE_MOCK_ATTACHMENTS_DIR || join(dataDir, "attachments");
}

function validateFile(file: unknown): { ok: false; error: string; status: number } | { ok: true; file: File } {
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No file provided", status: 400 };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "File size exceeds 10MB limit", status: 400 };
  }
  const mimeType = file.type.split(";")[0].trim();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: `MIME type "${mimeType}" not allowed`, status: 400 };
  }
  return { ok: true, file };
}

export function registerAttachmentRoutes(app: OpenAPIApp): void {
  // POST /api/drafts/{id}/attachments
  const uploadRoute = createRoute({
    method: "post",
    path: "/api/drafts/{id}/attachments",
    summary: "Upload attachment to draft",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: { content: { "application/json": { schema: AttachmentUploadResponseSchema } }, description: "Uploaded" },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad request" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  });

  app.openApiRoute(uploadRoute, async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const draft = db.query("SELECT * FROM expense_draft WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | null;
    if (!draft) return c.json({ error: "Draft not found" }, 404);

    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody();
    } catch {
      return c.json({ error: "Malformed multipart body" }, 400);
    }
    const fileResult = validateFile(body["file"]);
    if (!fileResult.ok) {
      return c.json({ error: fileResult.error }, fileResult.status);
    }
    const file = fileResult.file;

    const sanitized = sanitizeFilename(file.name);
    if (!sanitized) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const attachmentRef = generateAttachmentRef();
    const attachmentsDir = getAttachmentsDir();
    const refDir = join(attachmentsDir, attachmentRef);
    mkdirSync(refDir, { recursive: true });
    const storagePath = join(refDir, sanitized);

    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(storagePath, buffer);

    let previewText: string | null = null;
    const mimeType = file.type.split(";")[0].trim();
    if (["text/plain", "text/html", "text/csv"].includes(mimeType)) {
      try {
        previewText = readFileSync(storagePath, "utf-8").substring(0, 2048);
      } catch { /* best-effort */ }
    }

    const result = db.exec(
      `INSERT INTO expense_attachment (draft_id, attachment_ref, original_filename, storage_path, mime_type, file_size_bytes, preview_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, attachmentRef, sanitized, storagePath, mimeType, file.size, previewText],
    );

    const attachmentId = Number(result.lastInsertRowid);

    if (!draft.attachment_ref) {
      db.exec("UPDATE expense_draft SET attachment_ref = ?, updated_at = datetime('now') WHERE id = ?", [attachmentRef, id]);
    }

    db.exec("INSERT INTO expense_activity (draft_id, actor_user_id, action_type, new_value) VALUES (?, ?, 'attachment_added', ?)", [id, userId, attachmentRef]);

    const attachment = db.query("SELECT * FROM expense_attachment WHERE id = ?").get(attachmentId) as Record<string, unknown>;
    return c.json({
      success: true,
      attachment: rowToAttachment(attachment),
    });
  }, { auth: "required" });

  // GET /api/drafts/{id}/attachments
  const listRoute = createRoute({
    method: "get",
    path: "/api/drafts/{id}/attachments",
    summary: "List attachments for a draft",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: { content: { "application/json": { schema: z.object({ attachments: z.array(AttachmentSchema) }) } }, description: "Attachment list" },
    },
  });

  app.openApiRoute(listRoute, async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const draft = db.query("SELECT id FROM expense_draft WHERE id = ? AND user_id = ?").get(id, userId) as { id: number } | null;
    if (!draft) return c.json({ attachments: [] });

    const rows = db.query("SELECT * FROM expense_attachment WHERE draft_id = ?").all(id) as Record<string, unknown>[];
    return c.json({ attachments: rows.map(rowToAttachment) });
  }, { auth: "required" });

  // GET /api/attachments/{ref}
  const getRoute = createRoute({
    method: "get",
    path: "/api/attachments/{ref}",
    summary: "Get attachment file",
    request: { params: z.object({ ref: z.string() }) },
    responses: {
      200: { description: "File content" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  });

  app.openApiRoute(getRoute, async (c) => {
    const { ref } = c.req.valid("param");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const attachment = db.query(
      `SELECT a.* FROM expense_attachment a
       JOIN expense_draft d ON d.id = a.draft_id
       WHERE a.attachment_ref = ? AND d.user_id = ?`,
    ).get(ref, userId) as Record<string, unknown> | null;
    if (!attachment) return c.json({ error: "Attachment not found" }, 404);

    const storagePath = attachment.storage_path as string;
    if (!existsSync(storagePath)) return c.json({ error: "File not found on disk" }, 404);

    const data = readFileSync(storagePath);
    const mimeType = attachment.mime_type as string;
    const filename = attachment.original_filename as string;
    const download = c.req.query("download");

    c.header("Content-Type", mimeType);
    if (download === "1") {
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
    } else if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
      c.header("Content-Disposition", `inline; filename="${filename}"`);
    } else {
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
    }

    return c.body(data);
  }, { auth: "required" });

  // DELETE /api/attachments/{ref}
  const deleteRoute = createRoute({
    method: "delete",
    path: "/api/attachments/{ref}",
    summary: "Delete attachment",
    request: { params: z.object({ ref: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: z.object({ success: z.boolean() }) } }, description: "Deleted" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  });

  app.openApiRoute(deleteRoute, async (c) => {
    const { ref } = c.req.valid("param");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const attachment = db.query(
      `SELECT a.* FROM expense_attachment a
       JOIN expense_draft d ON d.id = a.draft_id
       WHERE a.attachment_ref = ? AND d.user_id = ?`,
    ).get(ref, userId) as Record<string, unknown> | null;
    if (!attachment) return c.json({ error: "Attachment not found" }, 404);

    try { unlinkSync(attachment.storage_path as string); } catch { /* best-effort */ }

    db.exec("UPDATE expense_draft SET attachment_ref = NULL WHERE attachment_ref = ?", [ref]);
    db.exec("DELETE FROM expense_attachment WHERE attachment_ref = ?", [ref]);

    return c.json({ success: true });
  }, { auth: "required" });
}
