/** @jsxImportSource hono/jsx */
/**
 * Workspace mock service — Notion-like note-taking SaaS
 *
 * Phase 1: account login/logout, note CRUD, plain-text/Markdown editors,
 * revision history, preview, seeded demo data.
 */

import { createMockApp, createRoute, startServer, authRequired } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { z } from "zod";
import { Database } from "bun:sqlite";
import { createSchema, seed } from "./data/seed.js";
import { getNoteById, listNotes, listRevisions, getRevisionCount, getUserById, getBriefEntry, getTaskRecord } from "./data/store.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerNoteRoutes } from "./routes/notes.js";
import { registerRevisionRoutes } from "./routes/revisions.js";
import { registerBriefRoutes } from "./routes/brief.js";
import { registerTaskRecordRoutes } from "./routes/task-record.js";
import { authRequiredPage } from "./middleware/auth-page.js";
import { renderMarkdown, renderPlainText } from "./markdown.js";
import { Layout } from "./components/layout.js";
import { LoginPage } from "./components/login-page.js";
import { WorkspacePage } from "./components/workspace-page.js";
import { NotePage } from "./components/note-page.js";
import { PreviewPage } from "./components/preview-page.js";
import { HistoryPage } from "./components/history-page.js";
import { TaskRecordPage } from "./components/task-record-page.js";

export function createWorkspaceApp(): MockAppV2 {
  const mockApp = createMockApp({
    name: "workspace",
    port: 5009,
    openApi: {
      enabled: true,
      title: "Workspace",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  const db = new Database(":memory:", { create: true });
  db.run("PRAGMA foreign_keys = ON");

  // Schema is created in the factory body so route handlers always see well-formed tables
  createSchema(db);

  // Sentinel route for binary isolation verification
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/workspace",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.boolean() }) },
        },
        description: "OK",
      },
    },
  });
  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  // API routes — auth first (public routes registered before this)
  registerAuthRoutes(app, db);
  app.use("/api/notes", authRequired);
  app.use("/api/notes/*", authRequired);
  registerNoteRoutes(app, db);
  registerRevisionRoutes(app, db);
  registerBriefRoutes(app, db);
  registerTaskRecordRoutes(app, db);

  // HTML page routes — public
  app.page("/", (c) => c.html(<LoginPage />));

  // HTML page routes — protected
  app.use("/workspace", authRequiredPage);
  app.use("/note/*", authRequiredPage);

  app.page("/workspace", (c) => {
    const userId = c.get("userId") as number;
    const notes = listNotes(db, userId);
    const counts: Record<number, number> = {};
    for (const n of notes) {
      counts[n.id] = getRevisionCount(db, n.id);
    }
    const user = getUserById(db, userId);
    return c.html(
      <Layout displayName={user?.display_name ?? "User"}>
        <WorkspacePage notes={notes} revisionCounts={counts} />
      </Layout>,
    );
  });

  app.page("/note/new", (c) => {
    const userId = c.get("userId") as number;
    const user = getUserById(db, userId);
    return c.html(
      <Layout displayName={user?.display_name ?? "User"}>
        <NotePage />
      </Layout>,
    );
  });

  app.page("/note/:id", (c) => {
    const userId = c.get("userId") as number;
    const id = Number(c.req.param("id"));
    const note = getNoteById(db, id);
    const user = getUserById(db, userId);
    if (!note || note.owner_user_id !== userId) return c.notFound();
    const briefEntry = note.content_type === "brief" ? (getBriefEntry(db, id) ?? undefined) : undefined;
    return c.html(
      <Layout displayName={user?.display_name ?? "User"} currentNoteId={id}>
        <NotePage note={note} briefEntry={briefEntry} />
      </Layout>,
    );
  });

  app.page("/note/:id/preview", (c) => {
    const userId = c.get("userId") as number;
    const id = Number(c.req.param("id"));
    const note = getNoteById(db, id);
    const user = getUserById(db, userId);
    if (!note || note.owner_user_id !== userId) return c.notFound();

    let rendered = "";
    let briefEntry = undefined;
    if (note.content_type === "markdown") {
      rendered = renderMarkdown(note.content);
    } else if (note.content_type === "plain_text") {
      rendered = renderPlainText(note.content);
    } else if (note.content_type === "brief") {
      briefEntry = getBriefEntry(db, id) ?? undefined;
    }

    return c.html(
      <Layout displayName={user?.display_name ?? "User"} currentNoteId={id}>
        <PreviewPage note={note} renderedHtml={rendered} briefEntry={briefEntry} />
      </Layout>,
    );
  });

  app.page("/note/:id/history", (c) => {
    const userId = c.get("userId") as number;
    const id = Number(c.req.param("id"));
    const note = getNoteById(db, id);
    const user = getUserById(db, userId);
    if (!note || note.owner_user_id !== userId) return c.notFound();
    const revisions = listRevisions(db, id);
    return c.html(
      <Layout displayName={user?.display_name ?? "User"} currentNoteId={id}>
        <HistoryPage note={note} revisions={revisions} />
      </Layout>,
    );
  });

  app.page("/note/:id/task-record", (c) => {
    const userId = c.get("userId") as number;
    const id = Number(c.req.param("id"));
    const note = getNoteById(db, id);
    const user = getUserById(db, userId);
    if (!note || note.owner_user_id !== userId) return c.notFound();
    const record = getTaskRecord(db, id);
    return c.html(
      <Layout displayName={user?.display_name ?? "User"} currentNoteId={id}>
        <TaskRecordPage note={note} record={record ?? undefined} />
      </Layout>,
    );
  });

  return {
    ...mockApp,
    seed: async () => {
      seed(db);
    },
  };
}

// Module-level: start server only when main
if (import.meta.main) {
  const app = createWorkspaceApp();
  startServer(app);
}
