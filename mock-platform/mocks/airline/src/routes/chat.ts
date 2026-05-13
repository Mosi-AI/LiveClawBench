import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import { DEFAULT_USER_ID } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  ChatSessionSchema,
  ChatMessageBodySchema,
  SessionIdParamSchema,
} from "../schemas";
import { z } from "zod";

export function registerChatRoutes(app: OpenAPIApp, db: Database, prefix: string): void {
  const sessionsResponse = OkSchema(z.object({ sessions: z.array(ChatSessionSchema) }));
  const sessionDetailResponse = OkSchema(ChatSessionSchema);
  const messageResponse = OkSchema(z.object({ user_message: z.string(), bot_response: z.string() }));
  const messageOnlyResponse = OkSchema(z.null());

  const listSessionsRoute = createRoute({
    method: "get",
    path: `${prefix}/chat/sessions`,
    summary: "List chat sessions",
    request: {
      query: z.object({ status: z.string().optional() }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: sessionsResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listSessionsRoute, (c) => {
    const query = c.req.valid("query");
    const status = query.status;
    let sql = "SELECT * FROM chat_sessions WHERE user_id = ?";
    const params: (number | string)[] = [DEFAULT_USER_ID];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    const items = db.query(`${sql} ORDER BY started_at DESC`).all(...params) as Record<string, unknown>[];
    return c.json(ok({ sessions: items }));
  });

  const createSessionRoute = createRoute({
    method: "post",
    path: `${prefix}/chat/sessions`,
    summary: "Create chat session",
    responses: {
      200: {
        content: { "application/json": { schema: sessionDetailResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(createSessionRoute, (c) => {
    const sessionId = `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const result = db.query(
      "INSERT INTO chat_sessions (user_id, session_id, status) VALUES (?, ?, 'active')"
    ).run(DEFAULT_USER_ID, sessionId);

    const id = Number(result.lastInsertRowid);
    const session = db.query("SELECT * FROM chat_sessions WHERE id = ?").get(id) as Record<string, unknown>;
    return c.json(ok(session, "Chat session created"));
  });

  const sendMessageRoute = createRoute({
    method: "post",
    path: `${prefix}/chat/sessions/{session_id}/messages`,
    summary: "Send chat message",
    request: {
      params: SessionIdParamSchema,
      body: {
        content: { "application/json": { schema: ChatMessageBodySchema } },
        description: "Message",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: messageResponse } },
        description: "OK",
      },
      400: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Bad request",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(sendMessageRoute, async (c) => {
    const { session_id } = c.req.valid("param");
    const body = c.req.valid("json");
    const message = body.message;

    const session = db.query("SELECT * FROM chat_sessions WHERE session_id = ? AND user_id = ?").get(session_id, DEFAULT_USER_ID) as Record<string, unknown> | null;
    if (!session) return c.json(err("Session not found"), 404);

    const sessionDbId = Number(session.id);

    db.query(
      "INSERT INTO chat_messages (session_id, message, sender_type, sender_name) VALUES (?, ?, 'user', 'Customer')"
    ).run(sessionDbId, message);

    const responses = [
      "Thank you for contacting GKD Airlines support. How can I assist you today?",
      "I understand your concern. Let me look into that for you.",
      "For booking changes, please visit the 'My Bookings' section.",
      "Your booking reference is your 6-character code. You can find it in your confirmation email.",
      "Is there anything else I can help you with today?",
    ];
    const botResponse = responses[Math.floor(Math.random() * responses.length)];

    db.query(
      "INSERT INTO chat_messages (session_id, message, sender_type, sender_name) VALUES (?, ?, 'bot', 'GKD Support')"
    ).run(sessionDbId, botResponse);

    return c.json(ok({ user_message: message, bot_response: botResponse }));
  });

  const closeSessionRoute = createRoute({
    method: "post",
    path: `${prefix}/chat/sessions/{session_id}/close`,
    summary: "Close chat session",
    request: { params: SessionIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: messageOnlyResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(closeSessionRoute, (c) => {
    const { session_id } = c.req.valid("param");
    const session = db.query("SELECT * FROM chat_sessions WHERE session_id = ? AND user_id = ?").get(session_id, DEFAULT_USER_ID) as Record<string, unknown> | null;
    if (!session) return c.json(err("Session not found"), 404);

    db.query("UPDATE chat_sessions SET status = 'closed', ended_at = datetime('now') WHERE id = ?").run(Number(session.id));
    return c.json(ok(null, "Chat session closed"));
  });
}
