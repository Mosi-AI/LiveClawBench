import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err, getAuthUserId } from "../helpers";
import {
  EmailListResponseSchema,
  EmailDetailResponseSchema,
  FolderQuerySchema,
  IdParamSchema,
  ErrorResponseSchema,
} from "../schemas";

export function emailToDict(row: Record<string, unknown>, attachments: Record<string, unknown>[]) {
  return {
    id: row.id,
    sender_id: row.sender_id,
    sender_email: row.sender_email,
    sender_name: row.sender_name,
    recipient_id: row.recipient_id,
    recipient_email: row.recipient_email,
    recipient_name: row.recipient_name ?? row.recipient_email,
    subject: row.subject,
    body: row.body,
    folder: row.folder,
    is_read: Boolean(row.is_read),
    created_at: row.created_at,
    updated_at: row.updated_at,
    attachments,
  };
}

export function getEmailAttachments(db: Database, emailId: number): Record<string, unknown>[] {
  return db.query(
    "SELECT id, original_filename, file_size, mime_type, created_at FROM attachments WHERE email_id = ?"
  ).all(emailId) as Record<string, unknown>[];
}

export function getEmailById(db: Database, emailId: number): Record<string, unknown> | null {
  const row = db.query(
    `SELECT e.*, u.username as sender_name, u.email as sender_email
     FROM emails e
     LEFT JOIN users u ON e.sender_id = u.id
     WHERE e.id = ?`
  ).get(emailId) as Record<string, unknown> | null;
  if (!row) return null;
  return emailToDict(row, getEmailAttachments(db, emailId));
}

export function registerReadEmailRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/emails?folder=
  const listRoute = createRoute({
    method: "get",
    path: "/api/emails",
    summary: "List emails",
    request: { query: FolderQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: EmailListResponseSchema } },
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
    },
  });

  app.openApiRoute(listRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const { folder: folderParam } = c.req.valid("query");
    const folder = folderParam ?? "inbox";

    let rows: Record<string, unknown>[] = [];

    if (folder === "inbox") {
      rows = db.query(
        `SELECT e.*, u.username as sender_name, u.email as sender_email
         FROM emails e
         LEFT JOIN users u ON e.sender_id = u.id
         WHERE e.recipient_id = ? AND e.folder = 'inbox'
         ORDER BY e.created_at DESC`
      ).all(userId) as Record<string, unknown>[];
    } else if (folder === "sent") {
      rows = db.query(
        `SELECT e.*, u.username as sender_name, u.email as sender_email
         FROM emails e
         LEFT JOIN users u ON e.sender_id = u.id
         WHERE e.sender_id = ? AND e.folder = 'sent'
         ORDER BY e.created_at DESC`
      ).all(userId) as Record<string, unknown>[];
    } else if (folder === "drafts") {
      rows = db.query(
        `SELECT e.*, u.username as sender_name, u.email as sender_email
         FROM emails e
         LEFT JOIN users u ON e.sender_id = u.id
         WHERE e.sender_id = ? AND e.folder = 'drafts'
         ORDER BY e.updated_at DESC`
      ).all(userId) as Record<string, unknown>[];
    } else if (folder === "trash") {
      rows = db.query(
        `SELECT e.*, u.username as sender_name, u.email as sender_email
         FROM emails e
         LEFT JOIN users u ON e.sender_id = u.id
         WHERE (e.sender_id = ? OR e.recipient_id = ?) AND e.folder = 'trash'
         ORDER BY e.created_at DESC`
      ).all(userId, userId) as Record<string, unknown>[];
    }

    const emails = rows.map((r) => emailToDict(r, getEmailAttachments(db, r.id as number)));
    return c.json(ok({ emails, count: emails.length }));
  });

  // GET /api/emails/:id
  const detailRoute = createRoute({
    method: "get",
    path: "/api/emails/{id}",
    summary: "Get email by ID",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: EmailDetailResponseSchema } },
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

  app.openApiRoute(detailRoute, async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);

    const { id } = c.req.valid("param");
    const emailId = parseInt(id, 10);

    const email = getEmailById(db, emailId);
    if (!email) return c.json(err("Email not found"), 404);
    if (email.sender_id !== userId && email.recipient_id !== userId) {
      return c.json(err("Access denied"), 403);
    }

    return c.json(ok({ email }));
  });
}
