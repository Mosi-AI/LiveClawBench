/** @jsxImportSource hono/jsx */
import { html, raw } from "hono/html";
import type { Child, FC } from "hono/jsx";

export const Layout: FC<{ title: string; children: Child; scripts?: string }> = ({
  title,
  children,
  scripts,
}) => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
  .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  h1 { color: #232F3E; margin-bottom: 20px; }
  h2 { color: #232F3E; margin-top: 30px; }
  .nav { display: flex; gap: 15px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0; flex-wrap: wrap; }
  .nav a { color: #667eea; text-decoration: none; padding: 8px 16px; border-radius: 4px; background: #f8f9fa; }
  .nav a:hover { background: #667eea; color: white; }
  .card { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
  .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
  .metric:last-child { border-bottom: none; }
  .metric-label { color: #666; }
  .metric-value { font-weight: 600; color: #232F3E; }
  .btn { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
  .btn:hover { background: #5a6fd6; }
  .btn-secondary { background: #6c757d; }
  .btn-danger { background: #dc3545; }
  input, select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; margin-right: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
  th { background: #f8f9fa; font-weight: 600; }
  .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
  .status-scheduled { background: #e3f2fd; color: #1976d2; }
  .status-brewing { background: #fff3e0; color: #f57c00; }
  .status-ready { background: #e8f5e9; color: #388e3c; }
</style>
</head>
<body>
<div class="container">
<nav class="nav">
<a href="/">Dashboard</a>
<a href="/thermostat">Thermostat</a>
<a href="/coffee">Coffee</a>
<a href="/inventory">Inventory</a>
<a href="/grocery">Shopping List</a>
<a href="/wearable">Wearable</a>
<a href="/calendar">Calendar</a>
<a href="/meal-plan">Meal Plan</a>
</nav>
${children}
</div>
${scripts ? html`<script>${raw(scripts)}</script>` : ""}
</body>
</html>`;
};

export const ErrorPage: FC<{ title: string; message: string }> = ({
  title,
  message,
}) => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
  .error-container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  h1 { color: #dc3545; margin-bottom: 20px; }
  p { color: #666; line-height: 1.6; }
</style>
</head>
<body>
<div class="error-container">
<h1>${title}</h1>
<p>${message}</p>
</div>
</body>
</html>`;
};
