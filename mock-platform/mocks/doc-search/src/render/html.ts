/**
 * HTML rendering utilities
 */

import type { Metadata } from "../types";

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPage(metadata: Metadata, title: string, bodyContent: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escHtml(title)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.meta { color: #666; font-size: 0.9em; margin: 4px 0; }
.pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; margin: 2px; background: #e8e8e8; }
.summary { color: #444; font-style: italic; }
.doc-card { border: 1px solid #ddd; padding: 12px; margin: 8px 0; border-radius: 6px; }
.result-title { margin: 4px 0; }
.open-link { color: #0066cc; }
.doc-body p { line-height: 1.6; }
form { margin: 16px 0; }
input[type=text] { padding: 6px; width: 60%; }
button { padding: 6px 14px; }
</style>
</head>
<body>
<p class="meta">${escHtml(metadata.site_title)}</p>
${bodyContent}
</body>
</html>`;
}
