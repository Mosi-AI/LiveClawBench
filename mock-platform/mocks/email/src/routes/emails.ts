import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { err, getAuthUserId } from "../helpers";

function emailToDict(row: Record<string, unknown>, attachments: Record<string, unknown>[]) {
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

function getEmailAttachments(db: Database, emailId: number): Record<string, unknown>[] {
  return db.query(
    "SELECT id, original_filename, file_size, mime_type, created_at FROM attachments WHERE email_id = ?"
  ).all(emailId) as Record<string, unknown>[];
}

function getEmailById(db: Database, emailId: number): Record<string, unknown> | null {
  const row = db.query(
    `SELECT e.*, u.username as sender_name, u.email as sender_email
     FROM emails e
     LEFT JOIN users u ON e.sender_id = u.id
     WHERE e.id = ?`
  ).get(emailId) as Record<string, unknown> | null;
  if (!row) return null;
  return emailToDict(row, getEmailAttachments(db, emailId));
}

export function registerEmailRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/emails?folder=
  app.get("/api/emails", async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);
    const folder = c.req.query("folder") ?? "inbox";

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
    } else {
      return c.json(err("Invalid folder"), 400);
    }

    const emails = rows.map((r) => emailToDict(r, getEmailAttachments(db, r.id as number)));
    return c.json({ emails, count: emails.length });
  });

  // GET /api/emails/:id
  app.get("/api/emails/:id", async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);
    const emailId = parseInt(c.req.param("id"), 10);
    if (isNaN(emailId)) return c.json(err("Invalid email ID"), 400);

    const email = getEmailById(db, emailId);
    if (!email) return c.json(err("Email not found"), 404);
    if (email.sender_id !== userId && email.recipient_id !== userId) {
      return c.json(err("Access denied"), 403);
    }

    return c.json({ email });
  });

  // POST /api/emails
  app.post("/api/emails", async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);
    const body = (await c.req.json()) as Record<string, unknown>;

    const recipientEmail = String(body.recipient ?? "");
    const subject = String(body.subject ?? "");
    const emailBody = String(body.body ?? "");
    const sendNow = Boolean(body.send_now);
    const attachmentIds = (body.attachment_ids as number[] | undefined) ?? [];

    if (!recipientEmail) {
      return c.json(err("Recipient is required"), 400);
    }

    // Find recipient user (optional)
    const recipient = db.query("SELECT id FROM users WHERE email = ?").get(recipientEmail) as
      | { id: number }
      | null;

    // Validate attachment IDs
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

    // Link attachments
    for (const attId of attachmentIds) {
      db.query("UPDATE attachments SET email_id = ? WHERE id = ?").run(emailId, attId);
    }

    // If sending now and recipient exists, create inbox copy
    let recipientEmailId: number | null = null;
    if (sendNow && recipient) {
      const recipientInboxId = Number(
        db.query(
          `INSERT INTO emails (sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'inbox', 0, datetime('now'), datetime('now'))`
        ).run(userId, recipient.id, recipientEmail, subject, emailBody).lastInsertRowid
      );

      recipientEmailId = recipientInboxId;

      // Duplicate attachments for recipient's copy
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
    return c.json({ message, email }, 201);
  });

  // PUT /api/emails/:id
  app.put("/api/emails/:id", async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);
    const emailId = parseInt(c.req.param("id"), 10);
    if (isNaN(emailId)) return c.json(err("Invalid email ID"), 400);

    const email = db.query("SELECT * FROM emails WHERE id = ?").get(emailId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);
    if (email.sender_id !== userId) return c.json(err("Access denied"), 403);
    if (email.folder !== "drafts") return c.json(err("Only drafts can be updated"), 400);

    const body = (await c.req.json()) as Record<string, unknown>;
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.recipient !== undefined) {
      const recipient = db.query("SELECT id FROM users WHERE email = ?").get(String(body.recipient)) as { id: number } | null;
      updates.push("recipient_id = ?");
      values.push(recipient?.id ?? null);
      updates.push("recipient_email = ?");
      values.push(String(body.recipient));
    }
    if (body.subject !== undefined) {
      updates.push("subject = ?");
      values.push(String(body.subject));
    }
    if (body.body !== undefined) {
      updates.push("body = ?");
      values.push(String(body.body));
    }

    // Update attachments if provided
    if (body.attachment_ids !== undefined) {
      const newAttachmentIds = (body.attachment_ids as number[] | undefined) ?? [];
      // Unlink existing attachments
      db.query("UPDATE attachments SET email_id = NULL WHERE email_id = ?").run(emailId);
      // Link new attachments
      for (const attId of newAttachmentIds) {
        db.query("UPDATE attachments SET email_id = ? WHERE id = ?").run(emailId, attId);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      db.query(`UPDATE emails SET ${updates.join(", ")} WHERE id = ?`).run(...values, emailId);
    }

    const updated = getEmailById(db, emailId);
    return c.json({ message: "Email updated successfully", email: updated });
  });

  // DELETE /api/emails/:id
  app.delete("/api/emails/:id", async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);
    const emailId = parseInt(c.req.param("id"), 10);
    if (isNaN(emailId)) return c.json(err("Invalid email ID"), 400);

    const email = db.query("SELECT * FROM emails WHERE id = ?").get(emailId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);
    if (email.sender_id !== userId && email.recipient_id !== userId) {
      return c.json(err("Access denied"), 403);
    }

    if (email.folder !== "trash") {
      db.query("UPDATE emails SET folder = 'trash', updated_at = datetime('now') WHERE id = ?").run(emailId);
      const updated = getEmailById(db, emailId);
      return c.json({ message: "Email moved to trash", email: updated });
    }

    // Permanently delete
    db.query("DELETE FROM attachments WHERE email_id = ?").run(emailId);
    db.query("DELETE FROM emails WHERE id = ?").run(emailId);
    return c.json({ message: "Email deleted permanently" });
  });

  // PUT /api/emails/:id/read
  app.put("/api/emails/:id/read", async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);
    const emailId = parseInt(c.req.param("id"), 10);
    if (isNaN(emailId)) return c.json(err("Invalid email ID"), 400);

    const email = db.query("SELECT * FROM emails WHERE id = ?").get(emailId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);
    if (email.recipient_id !== userId) return c.json(err("Access denied"), 403);

    const body = (await c.req.json()) as Record<string, unknown>;
    const isReadRaw = body.is_read;
    if (isReadRaw !== true && isReadRaw !== false) {
      return c.json(err("is_read must be a boolean"), 400);
    }
    const isRead = isReadRaw === true ? 1 : 0;

    db.query("UPDATE emails SET is_read = ?, updated_at = datetime('now') WHERE id = ?").run(isRead, emailId);

    const updated = getEmailById(db, emailId);
    return c.json({ message: "Email status updated", email: updated });
  });

  // PUT /api/emails/:id/send
  app.put("/api/emails/:id/send", async (c) => {
    const userId = await getAuthUserId(c);
    if (!userId) return c.json(err("Authentication required"), 401);
    const emailId = parseInt(c.req.param("id"), 10);
    if (isNaN(emailId)) return c.json(err("Invalid email ID"), 400);

    const email = db.query("SELECT * FROM emails WHERE id = ?").get(emailId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);
    if (email.sender_id !== userId) return c.json(err("Access denied"), 403);
    if (email.folder !== "drafts") return c.json(err("Only drafts can be sent"), 400);

    // Move to sent
    db.query("UPDATE emails SET folder = 'sent', updated_at = datetime('now') WHERE id = ?").run(emailId);

    // Get attachments
    const attachments = db.query("SELECT * FROM attachments WHERE email_id = ?").all(emailId) as Record<string, unknown>[];

    // Create recipient inbox copy if recipient is internal user
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

      // Duplicate attachments
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
    return c.json({ message: "Email sent successfully", email: updated });
  });
}
