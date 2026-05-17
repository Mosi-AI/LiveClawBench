/** @jsxImportSource hono/jsx */

export function LoginPage() {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Finance App - Login</title>
        <style>{`
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .login-box { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 320px; }
          .login-box h1 { margin: 0 0 24px; font-size: 24px; text-align: center; color: #2c3e50; }
          .form-group { margin-bottom: 16px; }
          label { display: block; margin-bottom: 6px; font-size: 14px; color: #555; }
          input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
          button { width: 100%; padding: 12px; background: #2c3e50; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
          button:hover { background: #34495e; }
          .error { color: #e74c3c; font-size: 14px; margin-top: 12px; text-align: center; display: none; }
        `}</style>
      </head>
      <body>
        <div class="login-box">
          <h1>Finance App</h1>
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="username" placeholder="admin" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="password" placeholder="admin123" />
          </div>
          <button id="login-btn">Login</button>
          <div class="error" id="error">Invalid credentials</div>
        </div>
        <script>{`
          document.getElementById('login-btn').addEventListener('click', async () => {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password }),
              credentials: 'include'
            });
            if (res.ok) {
              window.location.href = '/';
            } else {
              document.getElementById('error').style.display = 'block';
            }
          });
        `}</script>
      </body>
    </html>
  );
}
