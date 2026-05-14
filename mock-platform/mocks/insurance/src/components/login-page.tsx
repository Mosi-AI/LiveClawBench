/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

interface LoginPageProps {
  error?: string;
  next?: string;
}

export const LoginPage: FC<LoginPageProps> = ({ error, next = "/claims" }) => {
  return (
    <html>
      <head>
        <title>Login - Insurance Mock</title>
      </head>
      <body>
        <h1>Insurance Portal Login</h1>
        {error ? (
          <p style="color: red; border: 1px solid red; padding: 8px;">
            {error}
          </p>
        ) : null}
        <form method="post" action="/login">
          <input type="hidden" name="next" value={next} />
          <div>
            <label>
              Email:
              <input type="email" name="email" required />
            </label>
          </div>
          <div>
            <label>
              Password:
              <input type="password" name="password" required />
            </label>
          </div>
          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  );
};
