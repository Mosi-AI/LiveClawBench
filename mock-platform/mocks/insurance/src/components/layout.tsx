/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

interface LayoutProps {
  title: string;
  user?: { first_name: string; last_name: string } | null;
  children: any;
}

export const Layout: FC<LayoutProps> = ({ title, user, children }) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="stylesheet" href="/static/css/style.css" />
      </head>
      <body>
        <nav class="top-nav">
          <div class="nav-brand">Insurance Portal</div>
          <div class="nav-links">
            <a href="/claims">Claims</a>
            <a href="/appointments/search">Appointments</a>
            <a href="/plans">Plans</a>
          </div>
          <div class="nav-user">
            {user ? (
              <span>Welcome, {user.first_name} {user.last_name}</span>
            ) : (
              <a href="/login">Login</a>
            )}
          </div>
        </nav>
        <main class="container">{children}</main>
      </body>
    </html>
  );
};
