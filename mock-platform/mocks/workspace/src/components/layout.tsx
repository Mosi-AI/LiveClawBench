/** @jsxImportSource hono/jsx */
import type { Child } from "hono/jsx";

interface LayoutProps {
  displayName: string;
  currentNoteId?: number;
  children: Child;
}

export function Layout({ displayName, currentNoteId, children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Workspace</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
          .topbar { background: #1a1a2e; color: #fff; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
          .topbar h1 { font-size: 18px; }
          .topbar .user { display: flex; align-items: center; gap: 12px; }
          .topbar form { display: inline; }
          .topbar button { background: #e94560; border: none; color: #fff; padding: 6px 14px; border-radius: 4px; cursor: pointer; }
          .container { display: flex; min-height: calc(100vh - 48px); }
          .sidebar { width: 200px; background: #16213e; color: #fff; padding: 20px; }
          .sidebar a { display: block; color: #fff; text-decoration: none; padding: 10px 12px; border-radius: 4px; margin-bottom: 4px; }
          .sidebar a:hover { background: #0f3460; }
          .main { flex: 1; padding: 24px; }
        `}</style>
      </head>
      <body>
        <div class="topbar">
          <h1>Workspace</h1>
          <div class="user">
            <span>{displayName}</span>
            <form method="post" action="/api/auth/logout">
              <button type="submit">Logout</button>
            </form>
          </div>
        </div>
        <div class="container">
          <nav class="sidebar">
            <a href="/workspace">Workspace</a>
            <a href="/note/new">New Note</a>
            {currentNoteId !== undefined && (
              <a href={`/note/${currentNoteId}/task-record`}>Task Record</a>
            )}
          </nav>
          <main class="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
