/** @jsxImportSource hono/jsx */
import { html, raw } from "hono/html";
import type { FC, Child } from "hono/jsx";

export const Layout: FC<{ title: string; children: Child; scripts?: string; styles?: string }> = ({ title, children, scripts, styles }) => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/static/css/style.css">
${styles ? html`<style>${raw(styles)}</style>` : ""}
</head>
<body>
<div class="app-layout">
<aside class="sidebar">
  <div class="sidebar-brand">
    <h2>Mosi Expenses</h2>
  </div>
  <nav class="sidebar-nav">
    <a href="/dashboard" class="nav-item">Home</a>
    <a href="/dashboard" class="nav-item">Inbox</a>
    <a href="/reports" class="nav-item">Reports</a>
    <a href="/profile" class="nav-item">Account</a>
  </nav>
</aside>
<main class="main-content">
<header class="top-bar">
  <h1 class="page-title">${title}</h1>
</header>
<div class="content-area">
${children}
</div>
</main>
</div>
${scripts ? html`<script>${raw(scripts)}</script>` : ""}
</body>
</html>`;
};
