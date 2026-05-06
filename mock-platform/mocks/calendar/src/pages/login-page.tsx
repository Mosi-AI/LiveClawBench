/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

interface LoginPageProps {
  error?: string;
}

export const LoginPage: FC<LoginPageProps> = ({ error }) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Login — Company Calendar</title>
        <link rel="stylesheet" href="/static/css/style.css" />
      </head>
      <body>
        <nav class="top-nav">
          <div class="nav-brand">Company Calendar</div>
        </nav>
        <main class="container">
          <h1>Login</h1>
          {error && <p class="error">{error}</p>}
          <form method="post" action="/login" class="form-card">
            <label>
              Email:
              <input type="email" name="email" required />
            </label>
            <label>
              Password:
              <input type="password" name="password" required />
            </label>
            <button type="submit">Login</button>
          </form>
        </main>
      </body>
    </html>
  );
};
