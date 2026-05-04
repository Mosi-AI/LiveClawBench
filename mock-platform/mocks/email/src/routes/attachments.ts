import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { err, DEFAULT_USER_ID } from "../helpers";
import { mkdirSync } from "node:fs";
import { join, extname } from "node:path";

const UPLOAD_BASE = "/var/lib/mock-data/email/attachments";
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS = new Set([
  "txt", "pdf", "png", "jpg", "jpeg", "gif", "doc", "docx", "xls", "xlsx", "zip",
]);

function secureFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  return base.replace(/[^\w.\-]/g, "_");
}

function generateUuid(): string {
  return crypto.randomUUID();
}

function attachmentToDict(row: Record<string, unknown>) {
  return {
    id: row.id,
    original_filename: row.original_filename,
    file_size: row.file_size,
    mime_type: row.mime_type,
    created_at: row.created_at,
  };
}

export function registerAttachmentRoutes(app: OpenAPIApp, db: Database): void {
  app.post("/api/attachments/upload", async (c) => {
    const userId = DEFAULT_USER_ID;

    const formData = await c.req.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return c.json(err("No files provided"), 400);
    }

    const fileEntries: File[] = [];
    let totalSize = 0;
    for (const f of files) {
      if (f instanceof File && f.name && f.name !== "") {
        fileEntries.push(f);
        totalSize += f.size;
      }
    }

    if (fileEntries.length === 0) {
      return c.json(err("No files selected"), 400);
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return c.json(err("Total attachment size exceeds 10MB limit"), 413);
    }

    const dateFolder = new Date().toISOString().slice(0, 10);
    const uploadDir = join(UPLOAD_BASE, dateFolder);
    mkdirSync(uploadDir, { recursive: true });

    const uploadedAttachments: Record<string, unknown>[] = [];

    for (const file of fileEntries) {
      const originalFilename = secureFilename(file.name);
      const fileExt = extname(originalFilename);
      const uniqueFilename = `${generateUuid()}${fileExt}`;
      const filePath = join(dateFolder, uniqueFilename);
      const fullPath = join(UPLOAD_BASE, filePath);

      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(fullPath, arrayBuffer);

      db.query(
        `INSERT INTO attachments (filename, original_filename, file_path, file_size, mime_type, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        uniqueFilename,
        originalFilename,
        filePath,
        file.size,
        file.type || "application/octet-stream",
      );

      const row = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
      const att = db.query(
        "SELECT id, original_filename, file_size, mime_type, created_at FROM attachments WHERE id = ?"
      ).get(row.id) as Record<string, unknown>;

      uploadedAttachments.push(attachmentToDict(att));
    }

    return c.json({ message: "Attachments uploaded successfully", attachments: uploadedAttachments }, 201);
  });

  app.get("/api/attachments/:id/download", async (c) => {
    const userId = DEFAULT_USER_ID;
    const attachmentId = parseInt(c.req.param("id"), 10);
    if (isNaN(attachmentId)) return c.json(err("Invalid attachment ID"), 400);

    const att = db.query("SELECT * FROM attachments WHERE id = ?").get(attachmentId) as Record<string, unknown> | null;
    if (!att) return c.json(err("Attachment not found"), 404);

    if (att.email_id) {
      const email = db.query("SELECT sender_id, recipient_id FROM emails WHERE id = ?").get(Number(att.email_id)) as
        | { sender_id: number; recipient_id: number | null }
        | null;
      if (!email || (email.sender_id !== userId && email.recipient_id !== userId)) {
        return c.json(err("Access denied"), 403);
      }
    } else {
      return c.json(err("Attachment not linked to any email"), 404);
    }

    const fullPath = join(UPLOAD_BASE, String(att.file_path));
    const file = Bun.file(fullPath);
    if (!(await file.exists())) {
      return c.json(err("File not found on disk"), 404);
    }

    c.header("Content-Disposition", `attachment; filename="${String(att.original_filename)}"`);
    c.header("Content-Type", String(att.mime_type));
    return c.body(await file.arrayBuffer());
  });

  app.delete("/api/attachments/:id", async (c) => {
    const userId = DEFAULT_USER_ID;
    const attachmentId = parseInt(c.req.param("id"), 10);
    if (isNaN(attachmentId)) return c.json(err("Invalid attachment ID"), 400);

    const att = db.query("SELECT * FROM attachments WHERE id = ?").get(attachmentId) as Record<string, unknown> | null;
    if (!att) return c.json(err("Attachment not found"), 404);

    if (att.email_id) {
      const email = db.query("SELECT sender_id, folder FROM emails WHERE id = ?").get(Number(att.email_id)) as
        | { sender_id: number; folder: string }
        | null;
      if (!email || email.folder !== "drafts" || email.sender_id !== userId) {
        return c.json(err("Cannot delete attachment from sent email"), 403);
      }
    }

    try {
      const fullPath = join(UPLOAD_BASE, String(att.file_path));
      await Bun.file(fullPath).delete();
    } catch {
      // File already deleted or doesn't exist
    }

    db.query("DELETE FROM attachments WHERE id = ?").run(attachmentId);
    return c.json({ message: "Attachment deleted" });
  });
}
