import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err, getAuthUserId } from "../helpers";
import {
  ReadEmailBodySchema,
  DeleteEmailResponseSchema,
  ReadStatusResponseSchema,
  SendEmailResponseSchema,
  IdParamSchema,
  ErrorResponseSchema,
} from "../schemas";
import { getEmailById } from "./emails-read";

export function registerActionEmailRoutes(app: OpenAPIApp, db: Database): void {
  // DELETE /api/emails/:id
  const deleteRoute = createRoute({
    method: "delete",
    path: "/api/emails/{id}",
    summary: "Delete or trash an email",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: DeleteEmailResponseSchema } },
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

  app.openApiRoute(deleteRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const { id } = c.req.valid("param");
    const emailId = parseInt(id, 10);

    const email = db.query("SELECT * FROM emails WHERE id = ?").get(emailId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);
    if (email.sender_id !== userId && email.recipient_id !== userId) {
      return c.json(err("Access denied"), 403);
    }

    if (email.folder !== "trash") {
      db.query("UPDATE emails SET folder = 'trash', updated_at = datetime('now') WHERE id = ?").run(emailId);
      const updated = getEmailById(db, emailId);
      return c.json(ok({ message: "Email moved to trash", email: updated }, "Email moved to trash"));
    }

    db.query("DELETE FROM attachments WHERE email_id = ?").run(emailId);
    db.query("DELETE FROM emails WHERE id = ?").run(emailId);
    return c.json(ok({}, "Email deleted permanently"));
  });

  // PUT /api/emails/:id/read
  const readRoute = createRoute({
    method: "put",
    path: "/api/emails/{id}/read",
    summary: "Toggle email read status",
    request: {
      params: IdParamSchema,
      body: {
        content: { "application/json": { schema: ReadEmailBodySchema } },
        description: "Read status",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: ReadStatusResponseSchema } },
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

  app.openApiRoute(readRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const { id } = c.req.valid("param");
    const emailId = parseInt(id, 10);
    const { is_read: isRead } = c.req.valid("json");

    const email = db.query("SELECT * FROM emails WHERE id = ?").get(emailId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);
    if (email.recipient_id !== userId) return c.json(err("Access denied"), 403);

    const isReadNum = isRead ? 1 : 0;
    db.query("UPDATE emails SET is_read = ?, updated_at = datetime('now') WHERE id = ?").run(isReadNum, emailId);

    const updated = getEmailById(db, emailId);
    return c.json(ok({ message: "Email status updated", email: updated }, "Email status updated"));
  });

  // PUT /api/emails/:id/send
  const sendRoute = createRoute({
    method: "put",
    path: "/api/emails/{id}/send",
    summary: "Send a draft email",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: SendEmailResponseSchema } },
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

  app.openApiRoute(sendRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const { id } = c.req.valid("param");
    const emailId = parseInt(id, 10);

    const email = db.query("SELECT * FROM emails WHERE id = ?").get(emailId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);
    if (email.sender_id !== userId) return c.json(err("Access denied"), 403);
    if (email.folder !== "drafts") return c.json(err("Only drafts can be sent"), 400);

    db.query("UPDATE emails SET folder = 'sent', updated_at = datetime('now') WHERE id = ?").run(emailId);

    const attachments = db.query("SELECT * FROM attachments WHERE email_id = ?").all(emailId) as Record<string, unknown>[];

    if (email.recipient_id) {
      const { lastInsertRowid: recipientEmailId } = db.query(
        `INSERT INTO emails (sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'inbox', 0, datetime('now'), datetime('now'))`
      ).run(
        Number(email.sender_id),
        Number(email.recipient_id),
        String(email.recipient_email),
        String(email.subject),
        String(email.body),
      );

      for (const att of attachments) {
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

    const updated = getEmailById(db, emailId);
    return c.json(ok({ message: "Email sent successfully", email: updated }, "Email sent successfully"));
  });
}
