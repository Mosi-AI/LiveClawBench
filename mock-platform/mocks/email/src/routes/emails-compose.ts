import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err, getAuthUserId } from "../helpers";
import {
  CreateEmailBodySchema,
  UpdateEmailBodySchema,
  CreateEmailResponseSchema,
  UpdateEmailResponseSchema,
  IdParamSchema,
  ErrorResponseSchema,
} from "../schemas";
import { getEmailById } from "./emails-read";

export function registerComposeEmailRoutes(app: OpenAPIApp, db: Database): void {
  // POST /api/emails
  const createEmailRoute = createRoute({
    method: "post",
    path: "/api/emails",
    summary: "Create or send an email",
    request: {
      body: {
        content: { "application/json": { schema: CreateEmailBodySchema } },
        description: "Email data",
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: CreateEmailResponseSchema } },
        description: "Created",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Bad request",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(createEmailRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const body = c.req.valid("json");
    const recipientEmail = body.recipient;
    const subject = body.subject;
    const emailBody = body.body;
    const sendNow = body.send_now ?? false;
    const attachmentIds = body.attachment_ids ?? [];

    const recipient = db.query("SELECT id FROM users WHERE email = ?").get(recipientEmail) as
      | { id: number }
      | null;

    if (attachmentIds.length > 0) {
      const placeholders = attachmentIds.map(() => "?").join(",");
      const found = db.query(`SELECT id FROM attachments WHERE id IN (${placeholders})`).all(...attachmentIds) as { id: number }[];
      if (found.length !== attachmentIds.length) {
        return c.json(err("One or more attachments not found"), 404);
      }
    }

    const folder = sendNow ? "sent" : "drafts";

    const emailId = Number(
      db.query(
        `INSERT INTO emails (sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
      ).run(userId, recipient?.id ?? null, recipientEmail, subject, emailBody, folder).lastInsertRowid
    );

    for (const attId of attachmentIds) {
      db.query("UPDATE attachments SET email_id = ? WHERE id = ?").run(emailId, attId);
    }

    let recipientEmailId: number | null = null;
    if (sendNow && recipient) {
      const recipientInboxId = Number(
        db.query(
          `INSERT INTO emails (sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'inbox', 0, datetime('now'), datetime('now'))`
        ).run(userId, recipient.id, recipientEmail, subject, emailBody).lastInsertRowid
      );

      recipientEmailId = recipientInboxId;

      for (const attId of attachmentIds) {
        const att = db.query("SELECT * FROM attachments WHERE id = ?").get(attId) as Record<string, unknown> | null;
        if (att) {
          db.query(
            `INSERT INTO attachments (email_id, filename, original_filename, file_path, file_size, mime_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(
            recipientEmailId,
            String(att.filename),
            String(att.original_filename),
            String(att.file_path),
            Number(att.file_size),
            String(att.mime_type),
            String(att.created_at),
          );
        }
      }
    }

    const email = getEmailById(db, emailId);
    const message = sendNow ? "Email sent successfully" : "Email saved successfully";
    return c.json(ok({ message, email }, message), 201);
  });

  // PUT /api/emails/:id
  const updateRoute = createRoute({
    method: "put",
    path: "/api/emails/{id}",
    summary: "Update a draft email",
    request: {
      params: IdParamSchema,
      body: {
        content: { "application/json": { schema: UpdateEmailBodySchema } },
        description: "Email updates",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: UpdateEmailResponseSchema } },
        description: "OK",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Bad request",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
      403: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Forbidden",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(updateRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const { id } = c.req.valid("param");
    const emailId = parseInt(id, 10);
    const data = c.req.valid("json");

    const email = db.query("SELECT * FROM emails WHERE id = ?").get(emailId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);
    if (email.sender_id !== userId) return c.json(err("Access denied"), 403);
    if (email.folder !== "drafts") return c.json(err("Only drafts can be updated"), 400);

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.recipient !== undefined) {
      const recipient = db.query("SELECT id FROM users WHERE email = ?").get(data.recipient) as { id: number } | null;
      updates.push("recipient_id = ?");
      values.push(recipient?.id ?? null);
      updates.push("recipient_email = ?");
      values.push(data.recipient);
    }
    if (data.subject !== undefined) {
      updates.push("subject = ?");
      values.push(data.subject);
    }
    if (data.body !== undefined) {
      updates.push("body = ?");
      values.push(data.body);
    }

    if (data.attachment_ids !== undefined) {
      const newAttachmentIds = data.attachment_ids ?? [];
      db.query("UPDATE attachments SET email_id = NULL WHERE email_id = ?").run(emailId);
      for (const attId of newAttachmentIds) {
        db.query("UPDATE attachments SET email_id = ? WHERE id = ?").run(emailId, attId);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      db.query(`UPDATE emails SET ${updates.join(", ")} WHERE id = ?`).run(...values, emailId);
    }

    const updated = getEmailById(db, emailId);
    return c.json(ok({ message: "Email updated successfully", email: updated }, "Email updated successfully"));
  });
}
