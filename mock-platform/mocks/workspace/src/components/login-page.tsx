/** @jsxImportSource hono/jsx */

export function LoginPage() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Workspace - Login</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          .card { background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 360px; }
          .card h1 { font-size: 24px; margin-bottom: 24px; text-align: center; }
          .field { margin-bottom: 16px; }
          .field label { display: block; font-size: 14px; margin-bottom: 6px; color: #333; }
          .field input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
          .field input:focus { outline: none; border-color: #0f3460; }
          .submit { width: 100%; padding: 12px; background: #1a1a2e; color: #fff; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
          .submit:hover { background: #16213e; }
          .error { color: #e94560; font-size: 14px; margin-top: 12px; text-align: center; display: none; }
        `}</style>
      </head>
      <body>
        <div class="card">
          <h1>Workspace</h1>
          <form id="login-form">
            <div class="field">
              <label for="username">Username</label>
              <input type="text" id="username" name="username" required />
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required />
            </div>
            <button type="submit" class="submit">Login</button>
            <div class="error" id="error">Login failed. Please check your username and password.</div>
          </form>
        </div>
        <script>{`
          document.getElementById('login-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            try {
              const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
              });
              if (res.ok) {
                const payload = await res.json();
                const data = payload.data || payload;
                window.location = data.redirect;
              } else {
                document.getElementById('error').style.display = 'block';
              }
            } catch {
              document.getElementById('error').style.display = 'block';
            }
          });
        `}</script>
      </body>
    </html>
  );
}
