/** @jsxImportSource hono/jsx */

export function Layout({ title, children }: { title: string; children: JSX.Element }) {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style>{`
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; font-size: 20px; }
          .header a { color: #ecf0f1; text-decoration: none; margin-left: 16px; font-size: 14px; }
          .header a:hover { text-decoration: underline; }
          .breadcrumb { background: white; padding: 12px 20px; border-bottom: 1px solid #ddd; font-size: 14px; color: #666; }
          .content { background: white; padding: 20px; border-radius: 4px; margin-top: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        `}</style>
      </head>
      <body>
        <div class="header">
          <h1>Finance App</h1>
          <div>
            <a href="/">Home</a>
            <a href="/api/auth/logout">Logout</a>
          </div>
        </div>
        <div class="container">
          <div class="content">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
