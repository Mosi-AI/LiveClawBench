/** @jsxImportSource hono/jsx */

const NAV_ITEMS = [
  { href: "/departments", label: "Departments" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/expenses/new", label: "Expenses" },
  { href: "/invoices/new", label: "Invoices" },
  { href: "/assets", label: "Assets" },
  { href: "/portfolio", label: "Portfolio" },
];

export function HomePage({ userId }: { userId?: number }) {
  if (!userId) {
    return (
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Finance App</title>
          <style>{`
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .box { background: white; padding: 40px; border-radius: 8px; text-align: center; }
            a { display: inline-block; padding: 12px 24px; background: #2c3e50; color: white; text-decoration: none; border-radius: 4px; }
          `}</style>
        </head>
        <body>
          <div class="box">
            <h1>Finance App</h1>
            <p>Please log in to continue.</p>
            <a href="/login">Login</a>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Finance App</title>
        <style>{`
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; margin: 0; }
          .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
          h1 { color: #2c3e50; margin-bottom: 32px; }
          .nav-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .nav-btn { display: block; padding: 24px; background: white; border-radius: 8px; text-align: center; text-decoration: none; color: #2c3e50; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .nav-btn:hover { background: #ecf0f1; }
        `}</style>
      </head>
      <body>
        <div class="container">
          <h1>Finance App</h1>
          <div class="nav-grid">
            {NAV_ITEMS.map((item) => (
              <a href={item.href} class="nav-btn" key={item.href}>{item.label}</a>
            ))}
          </div>
        </div>
      </body>
    </html>
  );
}
