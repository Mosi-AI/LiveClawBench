import { z } from "zod";
import { createMockApp, createRoute, startServer } from "mock-lib";
import { getCalendarDb, initSchema } from "./db";
import { seedDatabase } from "./seed";
import { registerAuthRoutes } from "./routes/auth";
import { registerEventRoutes } from "./routes/events";

export function createCalendarApp(options?: { dbPath?: string }) {
  const db = getCalendarDb({ path: options?.dbPath });
  initSchema(db);
  seedDatabase(db);

  const mockApp = createMockApp({
    name: "calendar",
    port: 5003,
    healthResponse: { ok: true, status: "healthy", service: "calendar" },
    openApi: {
      enabled: true,
      title: "Calendar Mock API",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/calendar",
    summary: "Binary isolation probe",
    responses: {
      200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "OK" },
    },
  });
  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  // Simple login page for browser-based access
  app.get("/login", (c) => {
    return c.html(`<!DOCTYPE html>
<html>
<head><title>Calendar Login</title></head>
<body>
<h2>Calendar Login</h2>
<form id="f">
  <label>Email: <input type="email" id="email" value="peter.griffin@work.mosi.inc"/></label><br/>
  <label>Password: <input type="password" id="pwd" value="password123"/></label><br/>
  <button type="submit">Login</button>
</form>
<pre id="out"></pre>
<script>
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const r = await fetch('/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('pwd').value})});
  const j = await r.json();
  document.getElementById('out').textContent = JSON.stringify(j,null,2);
  if(j.access_token) localStorage.setItem('cal_token',j.access_token);
};
</script>
</body>
</html>`);
  });

  registerAuthRoutes(app, db);
  registerEventRoutes(app, db);

  return { ...mockApp, seed: () => seedDatabase(db) };
}

if (import.meta.main) {
  const mockApp = createCalendarApp();
  startServer(mockApp);
}
